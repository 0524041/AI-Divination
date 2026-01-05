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

# 讀取 system prompt
SYSTEM_PROMPT_PATH = Path(BASE_DIR) / "prompts" / "tarot_system_prompt.md"

# ========== Schemas ==========

class TarotCard(BaseModel):
    id: int
    name: str
    name_cn: str
    image: str
    reversed: bool = False
    position: str  # 'past', 'present', 'future'

class TarotRequest(BaseModel):
    """塔羅占卜請求"""
    question: str = Field(..., min_length=1, max_length=500)
    cards: List[TarotCard] = Field(..., min_items=3, max_items=3)

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
            if ai_config.provider == "gemini":
                api_key = decrypt_api_key(ai_config.api_key_encrypted)
                ai_service = get_ai_service("gemini", api_key=api_key)
            else:
                ai_service = get_ai_service(
                    "local",
                    base_url=ai_config.local_url,
                    model=ai_config.local_model
                )
        except Exception as e:
            history.status = "error"
            history.interpretation = f"錯誤：AI 服務初始化失敗 - {str(e)}"
            db.commit()
            return
        
        # 讀取 system prompt
        system_prompt = ""
        if SYSTEM_PROMPT_PATH.exists():
            system_prompt = SYSTEM_PROMPT_PATH.read_text(encoding="utf-8")
        else:
            history.status = "error"
            history.interpretation = "錯誤：找不到 System Prompt 檔案"
            db.commit()
            return

        # 解析 chart_data
        try:
            chart_data = json.loads(history.chart_data)
            cards = chart_data.get("cards", [])
        except Exception as e:
            history.status = "error"
            history.interpretation = f"錯誤：資料解析失敗 - {str(e)}"
            db.commit()
            return

        # 構建 User Prompt
        # 這裡使用 f-string 構建 prompt，將卡牌資訊填入
        card_1 = next((c for c in cards if c["position"] == "past"), cards[0])
        card_2 = next((c for c in cards if c["position"] == "present"), cards[1])
        card_3 = next((c for c in cards if c["position"] == "future"), cards[2])

        user_prompt = f"""
User Question: {history.question}

Cards Drawn:
1. Past: {card_1['name_cn']} ({card_1['name']}) {'(Reversed)' if card_1.get('reversed') else ''}
2. Present: {card_2['name_cn']} ({card_2['name']}) {'(Reversed)' if card_2.get('reversed') else ''}
3. Future: {card_3['name_cn']} ({card_3['name']}) {'(Reversed)' if card_3.get('reversed') else ''}

Please interpret this spread.
"""

        # 呼叫 AI
        try:
            response = await ai_service.generate(user_prompt, system_prompt)
            history.interpretation = response
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
    
    # 準備 chart_data
    chart_data = {
        "spread": "three_card",
        "cards": [card.dict() for card in request.cards],
        # 為了相容前端顯示，可能需要一些額外欄位，或者前端要改
        "benguaming": "塔羅牌", # Placeholder for history list view
        "bianguaming": "三牌陣" # Placeholder for history list view
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
