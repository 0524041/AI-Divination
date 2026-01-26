"""
AI 背景任務處理模組
整合 Liuyao, Tarot, Ziwei 的 AI 解盤任務，供 API 與 Retry 機制共用
"""
import json
import logging
from pathlib import Path
from datetime import datetime
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import get_settings, BASE_DIR
from app.models.history import History
from app.models.settings import AIConfig
from app.services.ai import get_ai_service
from app.utils.auth import decrypt_api_key

# 用於 Tarot Prompt 讀取
def get_tarot_system_prompt(spread_type: str) -> str:
    """根據牌陣類型讀取對應的 system prompt"""
    prompt_files = {
        "three_card": "tarot_system_prompt_three_card.md",
        "single": "tarot_system_prompt_single.md",
        "celtic_cross": "tarot_system_prompt_celtic_cross.md"
    }
    
    filename = prompt_files.get(spread_type, "tarot_system_prompt_three_card.md")
    prompt_path = Path(BASE_DIR) / "prompts" / filename
    
    if prompt_path.exists():
        return prompt_path.read_text(encoding="utf-8")
    else:
        raise FileNotFoundError(f"找不到 Prompt 檔案：{filename}")

# ========== 六爻任務 ==========

async def process_liuyao_task(history_id: int, db_url: str):
    """背景處理六爻占卜 (AI 解盤)"""
    engine = create_engine(db_url, connect_args={"check_same_thread": False})
    SessionLocal = sessionmaker(bind=engine)
    db = SessionLocal()
    
    try:
        history = db.query(History).filter(History.id == history_id).first()
        if not history:
            return
        
        history.status = "processing"
        db.commit()
        
        ai_config = db.query(AIConfig).filter(
            AIConfig.user_id == history.user_id,
            AIConfig.is_active == True
        ).first()
        
        if not ai_config:
            history.status = "error"
            history.interpretation = "錯誤：未設定 AI 服務"
            db.commit()
            return

        try:
            api_key = None
            if ai_config.api_key_encrypted:
                api_key = decrypt_api_key(ai_config.api_key_encrypted)

            ai_service = get_ai_service(
                ai_config.provider,
                api_key=api_key,
                base_url=ai_config.local_url,
                model=ai_config.effective_model
            )
        except Exception as e:
            history.status = "error"
            history.interpretation = f"錯誤：AI 服務初始化失敗 - {str(e)}"
            db.commit()
            return

        # 讀取 prompt
        prompt_path = Path(BASE_DIR) / "prompts" / "liuyao_system.md"
        system_prompt = ""
        if prompt_path.exists():
            system_prompt = prompt_path.read_text(encoding="utf-8")
        
        chart_data = json.loads(history.chart_data)
        chart_formatted = chart_data.get('formatted', '')
        
        user_prompt = f"""
【求測者資訊】
性別：{history.gender or '未指定'}
對象：{history.target or '自己'}

【用戶問題】
{history.question}

【六爻排盤詳情】
{chart_formatted}
"""
        
        try:
            result = await ai_service.generate(user_prompt, system_prompt)
            history.interpretation = result
            history.ai_provider = ai_config.provider
            history.ai_model = ai_config.effective_model
            history.status = "completed"
        except Exception as e:
            history.status = "error"
            history.interpretation = f"錯誤：AI 解盤失敗 - {str(e)}"
        
        db.commit()
        
    except Exception as e:
        print(f"Process liuyao divination error: {e}")
        if history:
            try:
                history.status = "error"
                history.interpretation = f"系統錯誤：{str(e)}"
                db.commit()
            except:
                pass
    finally:
        db.close()


# ========== 塔羅任務 ==========

async def process_tarot_task(history_id: int, db_url: str):
    """背景處理塔羅占卜 (AI 解盤)"""
    engine = create_engine(db_url, connect_args={"check_same_thread": False})
    SessionLocal = sessionmaker(bind=engine)
    db = SessionLocal()
    
    try:
        history = db.query(History).filter(History.id == history_id).first()
        if not history:
            return
        
        history.status = "processing"
        db.commit()
        
        ai_config = db.query(AIConfig).filter(
            AIConfig.user_id == history.user_id,
            AIConfig.is_active == True
        ).first()
        
        if not ai_config:
            history.status = "error"
            history.interpretation = "錯誤：未設定 AI 服務"
            db.commit()
            return
        
        try:
            api_key = None
            if ai_config.api_key_encrypted:
                api_key = decrypt_api_key(ai_config.api_key_encrypted)

            ai_service = get_ai_service(
                ai_config.provider,
                api_key=api_key,
                base_url=ai_config.local_url,
                model=ai_config.effective_model
            )
        except Exception as e:
            history.status = "error"
            history.interpretation = f"錯誤：AI 服務初始化失敗 - {str(e)}"
            db.commit()
            return
        
        chart_data = json.loads(history.chart_data)
        spread_type = chart_data.get("spread", "three_card")
        
        try:
            system_prompt = get_tarot_system_prompt(spread_type)
        except FileNotFoundError as e:
            history.status = "error"
            history.interpretation = f"錯誤：{str(e)}"
            db.commit()
            return

        try:
            cards = chart_data.get("cards", [])
            user_prompt = ""
            
            if spread_type == "single":
                card = cards[0]
                user_prompt = f"""
User Question: {history.question}

Card Drawn: {card['name_cn']} ({card['name']}) {'(Reversed)' if card.get('reversed') else '(Upright)'}

Please interpret this single card reading.
"""
            elif spread_type == "three_card":
                card_1 = next((c for c in cards if c["position"] == "past"), cards[0])
                card_2 = next((c for c in cards if c["position"] == "present"), cards[1])
                card_3 = next((c for c in cards if c["position"] == "future"), cards[2])

                user_prompt = f"""
User Question: {history.question}

Cards Drawn:
1. Past: {card_1['name_cn']} ({card_1['name']}) {'(Reversed)' if card_1.get('reversed') else '(Upright)'}
2. Present: {card_2['name_cn']} ({card_2['name']}) {'(Reversed)' if card_2.get('reversed') else '(Upright)'}
3. Future: {card_3['name_cn']} ({card_3['name']}) {'(Reversed)' if card_3.get('reversed') else '(Upright)'}

Please interpret this three-card spread.
"""
            elif spread_type == "celtic_cross":
                position_names = ["The Heart", "The Challenge", "Conscious", "Foundation", "Recent Past", 
                                "Near Future", "Your Attitude", "External", "Hopes & Fears", "Outcome"]
                
                cards_text = "\n".join([
                    f"{i+1}. {position_names[i]}: {c['name_cn']} ({c['name']}) {'(Reversed)' if c.get('reversed') else '(Upright)'}"
                    for i, c in enumerate(cards[:10])
                ])
                
                user_prompt = f"""
User Question: {history.question}

Celtic Cross Spread:
{cards_text}

Please interpret this Celtic Cross spread.
"""
            else:
                raise ValueError(f"不支援的牌陣類型：{spread_type}")
                
        except Exception as e:
            history.status = "error"
            history.interpretation = f"錯誤：User Prompt 構建失敗 - {str(e)}"
            db.commit()
            return

        try:
            response = await ai_service.generate(user_prompt, system_prompt)
            history.interpretation = response
            history.ai_provider = ai_config.provider
            history.ai_model = ai_config.effective_model
            history.status = "completed"
            db.commit()
        except Exception as e:
            history.status = "error"
            history.interpretation = f"AI 生成失敗：{str(e)}"
            db.commit()

    except Exception as e:
        print(f"Background task error: {e}")
        if history:
            try:
                history.status = "error"
                history.interpretation = f"系統錯誤：{str(e)}"
                db.commit()
            except:
                pass
    finally:
        db.close()

# ========== 紫微斗數任務 ==========

from app.services.ziwei_service import ziwei_service
from app.schemas.ziwei import ZiweiProcessRequest, ZiweiBirthDetails, ZiweiQuerySettings

async def process_ziwei_task(history_id: int, db_url: str):
    """背景處理紫微斗數占卜(AI 解讀)"""
    engine = create_engine(db_url, connect_args={"check_same_thread": False})
    SessionLocal = sessionmaker(bind=engine)
    db = SessionLocal()
    history = None

    try:
        history = db.query(History).filter(History.id == history_id).first()
        if not history:
            return

        history.status = "processing"
        db.commit()

        ai_config = db.query(AIConfig).filter(
            AIConfig.user_id == history.user_id, 
            AIConfig.is_active == True
        ).first()

        if not ai_config:
            history.status = "error"
            history.interpretation = "錯誤：未設定 AI 服務"
            db.commit()
            return

        try:
            api_key = None
            if ai_config.api_key_encrypted:
                api_key = decrypt_api_key(ai_config.api_key_encrypted)

            ai_service = get_ai_service(
                ai_config.provider,
                api_key=api_key,
                base_url=ai_config.local_url,
                model=ai_config.effective_model,
            )
        except Exception as e:
            history.status = "error"
            history.interpretation = f"錯誤：AI 服務初始化失敗 - {str(e)}"
            db.commit()
            return

        prompt_path = Path(BASE_DIR) / "prompts" / "ziwei_system.md"
        system_prompt_template = ""
        if prompt_path.exists():
            system_prompt_template = prompt_path.read_text(encoding="utf-8")
        else:
            system_prompt_template = "你是一位紫微斗數專家。請根據提供的信息回答問題。\n\n{{使用者資訊}}\n\n{{完整命盤}}\n\n{{補充說明}}"

        chart_data_json = json.loads(history.chart_data)

        raw_gender = history.gender or "male"
        normalized_gender = "男"
        if raw_gender == "female" or raw_gender == "女":
            normalized_gender = "女"
        elif raw_gender == "male" or raw_gender == "男":
            normalized_gender = "男"

        process_request = ZiweiProcessRequest(
            birth_details=ZiweiBirthDetails(
                name=chart_data_json.get("name", "用戶"),
                gender=normalized_gender,
                birth_date=datetime.now(),
                birth_location="Unknown",
            ),
            query_settings=ZiweiQuerySettings(
                query_type=chart_data_json.get("query_type", "natal"),
                query_date=datetime.fromisoformat(chart_data_json.get("query_date")) if chart_data_json.get("query_date") else datetime.now(),
                question=history.question,
            ),
            chart_data=chart_data_json,
        )

        if "solarDate" in chart_data_json:
            try:
                process_request.birth_details.birth_date = datetime.strptime(
                    chart_data_json["solarDate"], "%Y-%m-%d"
                )
            except:
                pass

        prompt_data = ziwei_service.process_chart(process_request)

        final_system_prompt = (
            system_prompt_template.replace(
                "{{使用者資訊}}", prompt_data["user_info_json"]
            )
            .replace("{{完整命盤}}", prompt_data["chart_info_json"])
            .replace("{{補充說明}}", prompt_data["supplementary_info_json"])
            .replace("{{使用者提問問題}}", prompt_data["question"])
        )

        user_prompt = f"請解答我的問題：{history.question}"

        try:
            interpretation = await ai_service.generate(
                prompt=user_prompt, system_prompt=final_system_prompt
            )

            history.interpretation = interpretation
            history.status = "completed"
            history.ai_provider = ai_config.provider
            history.ai_model = ai_config.effective_model
        except Exception as e:
            history.status = "error"
            history.interpretation = f"AI 解讀失敗：{str(e)}"

        db.commit()

    except Exception as e:
        if history:
            try:
                history.status = "error"
                history.interpretation = f"系統錯誤：{str(e)}"
                db.commit()
            except:
                pass
    finally:
        db.close()
