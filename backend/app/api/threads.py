"""
Thread 串流 API（ADR-0002）

- GET  /api/records/{record_id}/stream?token=   首解串流
- POST /api/records/{record_id}/followup?token= 追問（回應走 SSE）
- POST /api/records/{record_id}/retry?token=    重試最後回應（替換語意）
- GET  /api/records/quota?token=                訪客額度餘量

EventSource 無法帶 header，token 走 query param（沿用前端 SecureSSEConnection 慣例）。
"""

from fastapi import APIRouter, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.core.database import SessionLocal
from app.models.history import History
from app.models.user import User
from app.services.thread_pipeline import (
    QuotaExceeded,
    enforce_guest_quota,
    guest_quota_status,
    retry_last_response,
    stream_followup,
    stream_interpretation,
    stream_is_active,
)
from app.utils.auth import decode_token

router = APIRouter(prefix="/api/records", tags=["thread"])


class FollowupRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=1000)


def _authenticate(token: str) -> User:
    payload = decode_token(token) if token else None
    username = (payload or {}).get("sub")
    if not username:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="無效的認證憑證"
        )

    with SessionLocal() as db:
        user = db.query(User).filter(User.username == username).first()
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="使用者不存在"
            )
        return user


def _owned_record(record_id: int, user: User) -> None:
    with SessionLocal() as db:
        record = db.query(History).filter(History.id == record_id).first()
    if record is None or record.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="紀錄不存在")


def _guard(record_id: int, user: User) -> None:
    """擁有權＋訪客限額＋併發守衛"""
    _owned_record(record_id, user)

    with SessionLocal() as db:
        try:
            enforce_guest_quota(db, user)
        except QuotaExceeded as exc:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={
                    "message": str(exc),
                    "used": exc.used,
                    "limit": exc.limit,
                    "kind": "quota_exceeded",
                },
            )

    if stream_is_active(record_id):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="此紀錄已有進行中的解盤串流"
        )


def _sse_response(generator) -> StreamingResponse:
    async def event_stream():
        async for chunk in generator:
            yield chunk

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/quota")
async def get_quota(token: str = Query(default="")):
    """訪客額度餘量；登入使用者不受限"""
    user = _authenticate(token)
    return guest_quota_status(SessionLocal(), user.id)


@router.get("/{record_id}/stream")
async def stream_record(
    record_id: int,
    token: str = Query(default=""),
    heartbeat: float = Query(default=15.0, gt=0, le=60),
):
    """訂閱占卜紀錄的首解串流"""
    user = _authenticate(token)
    _owned_record(record_id, user)

    if stream_is_active(record_id):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="此紀錄已有進行中的解盤串流"
        )

    return _sse_response(
        stream_interpretation(
            record_id, user_id=user.id, heartbeat_interval=heartbeat
        )
    )


@router.post("/{record_id}/followup")
async def followup_record(
    record_id: int,
    body: FollowupRequest,
    token: str = Query(default=""),
    heartbeat: float = Query(default=15.0, gt=0, le=60),
):
    """追問：問題持久化後，回應以 SSE 串流送達"""
    user = _authenticate(token)
    _guard(record_id, user)

    return _sse_response(
        stream_followup(
            record_id,
            user_id=user.id,
            question=body.question,
            heartbeat_interval=heartbeat,
        )
    )


@router.post("/{record_id}/retry")
async def retry_record(
    record_id: int,
    token: str = Query(default=""),
    heartbeat: float = Query(default=15.0, gt=0, le=60),
):
    """重試最後一則助手回應（替換語意）"""
    user = _authenticate(token)
    _guard(record_id, user)

    return _sse_response(
        retry_last_response(
            record_id, user_id=user.id, heartbeat_interval=heartbeat
        )
    )
