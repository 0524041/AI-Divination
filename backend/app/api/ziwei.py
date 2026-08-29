"""紫微斗數占卜 API"""

import json
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.models.history import History
from app.models.user import User
from app.utils.auth import get_current_user, get_current_user_or_guest

router = APIRouter(prefix="/api/ziwei", tags=["紫微斗數"], redirect_slashes=False)
settings = get_settings()


class ZiweiDivinationRequest(BaseModel):
    birth_data_id: Optional[int] = None
    name: str
    gender: str
    birth_date: datetime
    birth_location: str
    is_twin: bool = False
    twin_order: Optional[str] = None
    query_type: str = Field(..., pattern="^(natal|yearly|monthly|daily)$")
    query_date: Optional[datetime] = None
    question: str = Field(..., min_length=1, max_length=500)
    chart_data: dict
    prompt_context: Optional[str] = (
        None  # Make optional as we generate it in backend now
    )
    use_default_ai: bool = Field(
        default=False, description="（已棄用，僅相容舊客戶端）"
    )
    mode: str = Field(
        default="thread", description="（已棄用，僅接受 thread 模式）"
    )


class DivinationResponse(BaseModel):
    id: int
    status: str
    message: str


@router.post("", response_model=DivinationResponse)
async def create_divination(
    data: ZiweiDivinationRequest,
    http_request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_or_guest),
):
    if current_user.role == "guest":
        from app.utils.security import check_guest_daily_limit

        allowed, today_count = check_guest_daily_limit(http_request, db)
        if not allowed:
            raise HTTPException(
                status_code=429,
                detail=f"訪客試用每日限制 5 次，今日已使用 {today_count} 次。請註冊帳號以使用完整功能。",
            )

    if data.query_type != "natal" and not data.query_date:
        raise HTTPException(status_code=400, detail="流年/流月/流日需要提供查詢日期")

    # 後端 schema 驗證（前端 iztro 排盤，拒收畸形資料）
    from app.services.prompts import validate_ziwei_chart

    try:
        validate_ziwei_chart(data.chart_data)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=f"命盤資料不完整：{exc}")

    try:

        final_chart_data = data.chart_data
        final_chart_data["prompt_context"] = data.prompt_context
        # Save query metadata to chart_data so it persists in history
        final_chart_data["query_type"] = data.query_type
        final_chart_data["name"] = data.name  # Save subject name
        if data.query_date:
            final_chart_data["query_date"] = data.query_date.isoformat()

        history = History(
            user_id=current_user.id,
            divination_type="ziwei",
            question=data.question,
            gender=data.gender,
            chart_data=json.dumps(final_chart_data, ensure_ascii=False),
            status="pending",
            ai_provider="default",
        )
        db.add(history)
        db.commit()
        db.refresh(history)

        return {
            "id": history.id,
            "status": history.status,
            "message": "命盤已生成，請開啟串流取得解盤。",
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"占卜建立失敗：{str(e)}")


@router.post("/{history_id}/cancel")
def cancel_divination(
    history_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    history = (
        db.query(History)
        .filter(History.id == history_id, History.user_id == current_user.id)
        .first()
    )

    if not history:
        raise HTTPException(status_code=404, detail="找不到該占卜記錄")

    if history.status not in ["pending", "processing"]:
        raise HTTPException(status_code=400, detail="無法取消已完成的占卜")

    history.status = "cancelled"
    history.interpretation = "用戶取消"
    db.commit()

    return {"status": "success", "message": "已取消占卜"}
