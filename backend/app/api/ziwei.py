"""紫微斗數占卜 API"""

import json
from datetime import datetime
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import Optional


from app.core.database import get_db
from app.core.config import get_settings, BASE_DIR
from app.models.user import User
from app.models.settings import AIConfig
from app.models.history import History
from app.utils.auth import get_current_user, decrypt_api_key
from app.services.ai import get_ai_service
from app.services.ai_tasks import process_ziwei_task

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


class DivinationResponse(BaseModel):
    id: int
    status: str
    message: str


@router.post("", response_model=DivinationResponse)
async def create_divination(
    data: ZiweiDivinationRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ai_config = (
        db.query(AIConfig)
        .filter(AIConfig.user_id == current_user.id, AIConfig.is_active == True)
        .first()
    )

    if not ai_config:
        raise HTTPException(status_code=400, detail="請先設定 AI 服務")

    if data.query_type != "natal" and not data.query_date:
        raise HTTPException(status_code=400, detail="流年/流月/流日需要提供查詢日期")

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
        )
        db.add(history)
        db.commit()
        db.refresh(history)

        background_tasks.add_task(
            process_ziwei_task, history.id, str(settings.DATABASE_URL)
        )

        return {
            "id": history.id,
            "status": "pending",
            "message": "占卜建立成功，AI 解讀中...",
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
