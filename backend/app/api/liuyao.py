"""
占卜 API 路由
"""

import json
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.models.history import History
from app.models.user import User
from app.services.ai_tasks import process_liuyao_task
from app.services.liuyao import perform_divination
from app.utils.auth import get_current_user, get_current_user_or_guest

router = APIRouter(prefix="/api/liuyao", tags=["六爻"], redirect_slashes=False)
settings = get_settings()

# ========== Schemas ==========
# ... (Validation schemas remain similar) ...


class LiuYaoRequest(BaseModel):
    """六爻占卜請求"""

    question: str = Field(..., min_length=1, max_length=500)
    gender: Optional[str] = Field(None, description="'male' | 'female'")
    target: Optional[str] = Field(
        None, description="'self' | 'parent' | 'friend' | 'other'"
    )
    use_default_ai: bool = Field(
        default=False, description="使用者明確選擇使用預設 AI 服務"
    )


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
    liuyao_request: LiuYaoRequest,
    request: Request,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user_or_guest),
    db: Session = Depends(get_db),
):
    """六爻占卜"""
    try:
        if current_user.role == "guest":
            from app.utils.security import check_guest_daily_limit

            allowed, today_count = check_guest_daily_limit(request, db)
            if not allowed:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"訪客試用每日限制 5 次，今日已使用 {today_count} 次。請註冊帳號以使用完整功能。",
                )

        result = perform_divination(question=liuyao_request.question)

        history = History(
            user_id=current_user.id,
            divination_type="liuyao",
            question=liuyao_request.question,
            gender=liuyao_request.gender,
            target=liuyao_request.target,
            chart_data=json.dumps(result, ensure_ascii=False),
            status="pending",
            ai_provider="default" if liuyao_request.use_default_ai else None,
        )
        db.add(history)
        db.commit()
        db.refresh(history)

        background_tasks.add_task(
            process_liuyao_task, history.id, settings.DATABASE_URL
        )

        return DivinationResponse(
            id=history.id,
            status="pending",
            coins=result["yaogua"],
            chart_data=result,
            message="占卜已開始，AI 正在解盤中...",
        )
    except HTTPException:
        raise
    except Exception as e:
        import traceback

        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Backend Error: {str(e)}",
        )


@router.post("/{history_id}/cancel")
def cancel_divination(
    history_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """取消占卜"""
    history = (
        db.query(History)
        .filter(History.id == history_id, History.user_id == current_user.id)
        .first()
    )

    if not history:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="紀錄不存在")

    if history.status == "completed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="已完成的占卜無法取消"
        )

    history.status = "cancelled"
    db.commit()

    return {"message": "已取消"}
