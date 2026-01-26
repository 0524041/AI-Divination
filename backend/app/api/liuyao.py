"""
占卜 API 路由
"""
import json
from pathlib import Path
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import Optional

from app.core.database import get_db
from app.core.config import get_settings, BASE_DIR
from app.models.user import User
from app.models.settings import AIConfig
from app.models.history import History
from app.utils.auth import get_current_user, decrypt_api_key
from app.services.liuyao import perform_divination
from app.services.ai_tasks import process_liuyao_task

router = APIRouter(prefix="/api/liuyao", tags=["六爻"], redirect_slashes=False)
settings = get_settings()

# ========== Schemas ==========
# ... (Validation schemas remain similar) ...

class LiuYaoRequest(BaseModel):
    """六爻占卜請求"""
    question: str = Field(..., min_length=1, max_length=500)
    gender: Optional[str] = Field(None, description="'male' | 'female'")
    target: Optional[str] = Field(None, description="'self' | 'parent' | 'friend' | 'other'")

class DivinationResponse(BaseModel):
    """占卜回應"""
    id: int
    status: str
    coins: list
    chart_data: dict
    message: str


# ========== Endpoints ==========

@router.post("", response_model=DivinationResponse)
@router.post("/", response_model=DivinationResponse, include_in_schema=False)
async def create_liuyao_divination(
    request: LiuYaoRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """六爻占卜"""
    try:
        # 檢查是否有 AI 設定
        ai_config = db.query(AIConfig).filter(
            AIConfig.user_id == current_user.id,
            AIConfig.is_active == True
        ).first()
        
        if not ai_config:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="請先在設定頁面配置 AI 服務"
            )
        
        # 執行占卜 (擲硬幣 + 排盤)
        result = perform_divination(question=request.question)
        
        # 儲存到歷史紀錄
        history = History(
            user_id=current_user.id,
            divination_type="liuyao",
            question=request.question,
            gender=request.gender,
            target=request.target,
            chart_data=json.dumps(result, ensure_ascii=False),
            status="pending"
        )
        db.add(history)
        db.commit()
        db.refresh(history)
        
        # 背景處理 AI 解盤 - 使用 shared task
        background_tasks.add_task(
            process_liuyao_task,
            history.id,
            settings.DATABASE_URL
        )
        
        return DivinationResponse(
            id=history.id,
            status="pending",
            coins=result['yaogua'],
            chart_data=result,
            message="占卜已開始，AI 正在解盤中..."
        )
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Backend Error: {str(e)}"
        )


@router.post("/{history_id}/cancel")
def cancel_divination(
    history_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """取消占卜"""
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
