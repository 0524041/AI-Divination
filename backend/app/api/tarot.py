"""
塔羅牌 API 路由
"""
import json
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import List, Optional

from app.core.database import get_db
from app.core.config import get_settings, BASE_DIR
from app.models.settings import AIConfig
from app.models.history import History
from app.utils.auth import get_current_user, decrypt_api_key
from app.services.ai import get_ai_service

router = APIRouter(prefix="/api/tarot", tags=["塔羅"])
settings = get_settings()

# 讀取 system prompt 的函數
def get_system_prompt_for_spread(spread_type: str) -> str:
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

# ========== Schemas ==========

class TarotCard(BaseModel):
    id: int
    name: str
    name_cn: str
    image: str
    reversed: bool = False
    position: str  # 'past', 'present', 'future', 'heart', 'challenge', etc.

class TarotRequest(BaseModel):
    """塔羅占卜請求"""
    question: str = Field(..., min_length=1, max_length=500)
    cards: List[TarotCard] = Field(..., min_items=1, max_items=10)  # 支援 1-10 張牌
    spread_type: str = Field(default="three_card")  # "three_card", "single", "celtic_cross"

class TarotResponse(BaseModel):
    """塔羅回應"""
    id: int
    status: str
    message: str

# ========== Background Tasks ==========

async def process_tarot_divination(history_id: int, db_url: str):
    """背景處理塔羅占卜 (AI 解盤)"""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    
    engine = create_engine(db_url, connect_args={"check_same_thread": False})
    SessionLocal = sessionmaker(bind=engine)
    db = SessionLocal()
    
    try:
        # 取得歷史紀錄
        history = db.query(History).filter(History.id == history_id).first()
        if not history:
            return
        
        history.status = "processing"
        db.commit()
        
        # 取得用戶的 AI 設定
        ai_config = db.query(AIConfig).filter(
            AIConfig.user_id == history.user_id,
            AIConfig.is_active == True
        ).first()
        
        if not ai_config:
            history.status = "error"
            history.interpretation = "錯誤：未設定 AI 服務"
            db.commit()
            return
        
        # 準備 AI 服務
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
        except Exception as e:
            history.status = "error"
            history.interpretation = f"錯誤：AI 服務初始化失敗 - {str(e)}"
            db.commit()
            return
        
        # 讀取對應的 system prompt
        chart_data = json.loads(history.chart_data)
        spread_type = chart_data.get("spread", "three_card")
        
        try:
            system_prompt = get_system_prompt_for_spread(spread_type)
        except FileNotFoundError as e:
            history.status = "error"
            history.interpretation = f"錯誤：{str(e)}"
            db.commit()
            return

        # 構建 User Prompt（根據牌陣類型）
        try:
            cards = chart_data.get("cards", [])
            
            if spread_type == "single":
                # 單抽牌
                card = cards[0]
                user_prompt = f"""
User Question: {history.question}

Card Drawn: {card['name_cn']} ({card['name']}) {'(Reversed)' if card.get('reversed') else '(Upright)'}

Please interpret this single card reading.
"""
            elif spread_type == "three_card":
                # 三牌陣
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
                # 凱爾特十字（10 張牌）
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

        # 呼叫 AI
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
            history.status = "error"
            history.interpretation = f"系統錯誤：{str(e)}"
            db.commit()
    finally:
        db.close()


# ========== Endpoints ==========

@router.post("", response_model=TarotResponse)
async def create_tarot_divination(
    request: TarotRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """建立塔羅占卜"""
    
    # 牌陣類型名稱映射
    spread_names = {
        "three_card": "三牌陣",
        "single": "單抽牌",
        "celtic_cross": "凱爾特十字"
    }
    
    # 準備 chart_data
    chart_data = {
        "spread": request.spread_type,
        "spread_name": spread_names.get(request.spread_type, "未知牌陣"),
        "cards": [card.dict() for card in request.cards],
    }
    
    # 建立歷史紀錄
    history = History(
        user_id=current_user.id,
        divination_type="tarot",
        question=request.question,
        chart_data=json.dumps(chart_data, ensure_ascii=False),
        status="pending"
    )
    
    db.add(history)
    db.commit()
    db.refresh(history)
    
    # 觸發背景任務
    db_url = settings.DATABASE_URL
    if db_url.startswith("sqlite"):
        # 修正 SQLite URL 格式以供背景任務使用
        if "///" not in db_url:
            db_url = db_url.replace("sqlite://", "sqlite:///")
            
    background_tasks.add_task(process_tarot_divination, history.id, db_url)
    
    return TarotResponse(
        id=history.id,
        status="pending",
        message="塔羅占卜已建立，正在進行 AI 解盤..."
    )

@router.post("/{history_id}/cancel")
async def cancel_tarot_divination(
    history_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """取消塔羅占卜"""
    history = db.query(History).filter(
        History.id == history_id,
        History.user_id == current_user.id
    ).first()
    
    if not history:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="紀錄不存在"
        )
    
    if history.status == "completed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="已完成的占卜無法取消"
        )
    
    history.status = "cancelled"
    db.commit()
    
    return {"message": "已取消"}
