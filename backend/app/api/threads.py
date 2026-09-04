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
    acquire_stream_slot,
    enforce_guest_quota,
    guest_quota_status,
    retry_last_response,
    stream_followup,
    stream_interpretation_preclaimed,
)
from app.utils.auth import decode_token

router = APIRouter(prefix="/api/records", tags=["thread"])


class FollowupRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=1000)
    connection_id: str | None = Field(
        None, description="切換模型：使用者連線 id 或 'system'（切回系統免費模型）"
    )
    model_id: str | None = Field(None, description="切換模型：模型 id")


def _parse_connection_id(value: str | None) -> int | None:
    """"system"/空 → None（系統免費模型）；數字字串 → 連線 id"""
    if not value or value == "system":
        return None
    try:
        return int(value)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="無效的 connection_id"
        )


def _model_switch(connection_value: str | None, model_value: str | None) -> dict:
    """組出模型切換參數（明確 'system' 時強制使用系統免費模型）"""
    return {
        "connection_id": _parse_connection_id(connection_value),
        "model_id": model_value or None,
        "use_system": (connection_value or "") == "system",
    }


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
    if record is None or (record.user_id != user.id and user.role != "admin"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="紀錄不存在")


def _guard(record_id: int, user: User, *, check_slot: bool = False) -> None:
    """擁有權＋訪客限額（＋可選的串流佔位）"""
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

    if check_slot and not acquire_stream_slot(record_id):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="此紀錄已有進行中的解盤串流"
        )


def _sse_response(generator_factory, record_id: int) -> StreamingResponse:
    """以同步佔位避免 lazy-generator 造成的 409 競態；斷線/錯誤轉 error 事件"""
    import json as _json

    async def event_stream():
        try:
            async for chunk in generator_factory():
                yield chunk
        except RuntimeError as exc:
            yield (
                "event: error\ndata: "
                + _json.dumps({"kind": "conflict", "message": str(exc)}, ensure_ascii=False)
                + "\n\n"
            )
        finally:
            from app.services.thread_pipeline import release_stream_slot

            release_stream_slot(record_id)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/quota")
async def get_quota(token: str = Query(default="")):
    """訪客額度餘量；登入使用者不受限"""
    user = _authenticate(token)
    with SessionLocal() as db:
        return guest_quota_status(db, user.id)


@router.get("/{record_id}/stream")
async def stream_record(
    record_id: int,
    token: str = Query(default=""),
    heartbeat: float = Query(default=15.0, gt=0, le=60),
    connection_id: str = Query(default="", description="使用者連線 id 或 'system'"),
    model_id: str = Query(default="", description="本次使用的模型 id"),
):
    """訂閱占卜紀錄的首解串流（選擇會綁定到紀錄）"""
    user = _authenticate(token)
    _guard(record_id, user, check_slot=True)

    return _sse_response(
        lambda: stream_interpretation_preclaimed(
            record_id,
            user_id=user.id,
            heartbeat_interval=heartbeat,
            **_model_switch(connection_id, model_id),
        ),
        record_id,
    )


@router.post("/{record_id}/followup")
async def followup_record(
    record_id: int,
    body: FollowupRequest,
    token: str = Query(default=""),
    heartbeat: float = Query(default=15.0, gt=0, le=60),
):
    """追問：問題持久化後，回應以 SSE 串流送達（可帶模型切換）"""
    user = _authenticate(token)
    _guard(record_id, user, check_slot=True)

    return _sse_response(
        lambda: stream_followup(
            record_id,
            user_id=user.id,
            question=body.question,
            heartbeat_interval=heartbeat,
            preclaimed=True,
            **_model_switch(body.connection_id, body.model_id),
        ),
        record_id,
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
        lambda: retry_last_response(
            record_id,
            user_id=user.id,
            heartbeat_interval=heartbeat,
            preclaimed=True,
        ),
        record_id,
    )
