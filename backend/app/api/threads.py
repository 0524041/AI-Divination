"""
Thread 串流 API（ADR-0002）

GET /api/records/{record_id}/stream?token=<JWT>
EventSource 無法帶 header，故 token 走 query param（沿用前端 SecureSSEConnection 慣例）。
"""

import asyncio

from fastapi import APIRouter, HTTPException, Query, status
from fastapi.responses import StreamingResponse

from app.core.database import SessionLocal
from app.models.history import History
from app.services.thread_pipeline import stream_interpretation, stream_is_active
from app.utils.auth import decode_token

router = APIRouter(prefix="/api/records", tags=["thread"])


def _authenticate(token: str):
    payload = decode_token(token) if token else None
    username = (payload or {}).get("sub")
    if not username:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="無效的認證憑證"
        )

    with SessionLocal() as db:
        from app.models.user import User

        user = db.query(User).filter(User.username == username).first()
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="使用者不存在"
            )
        return user


@router.get("/{record_id}/stream")
async def stream_record(
    record_id: int,
    token: str = Query(default=""),
    heartbeat: float = Query(default=15.0, gt=0, le=60),
):
    """訂閱占卜紀錄的解盤串流"""
    user = _authenticate(token)

    with SessionLocal() as db:
        record = db.query(History).filter(History.id == record_id).first()
    if record is None or record.user_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="紀錄不存在"
        )

    if stream_is_active(record_id):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="此紀錄已有進行中的解盤串流",
        )

    async def event_stream():
        async for chunk in stream_interpretation(
            record_id, user_id=user.id, heartbeat_interval=heartbeat
        ):
            yield chunk
        # 讓瀏覽器確實收到最後一段後再關閉
        await asyncio.sleep(0)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
