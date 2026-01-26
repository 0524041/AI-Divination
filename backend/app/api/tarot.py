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
from app.services.ai_tasks import process_tarot_task

router = APIRouter(prefix="/api/tarot", tags=["塔羅"])
settings = get_settings()

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
    
    # 觸發背景任務 - 使用 shared task
    db_url = settings.DATABASE_URL
    if db_url.startswith("sqlite"):
        # 修正 SQLite URL 格式以供背景任務使用
        if "///" not in db_url:
            db_url = db_url.replace("sqlite://", "sqlite:///")
            
    background_tasks.add_task(process_tarot_task, history.id, db_url)
    
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
