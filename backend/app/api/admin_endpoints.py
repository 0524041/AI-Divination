"""
系統預設端點管理與用量統計（Ticket 13，ADR-0001）

- GET    /api/admin/endpoints            列出（金鑰永不回明文）
- POST   /api/admin/endpoints            新增
- PUT    /api/admin/endpoints/{id}       編輯
- DELETE /api/admin/endpoints/{id}       停用（軟刪）
- POST   /api/admin/endpoints/{id}/default   指定為預設
- POST   /api/admin/endpoints/{id}/test      測試連線
- GET    /api/admin/usage/stats              用量聚合
"""

from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from fastapi import status as http_status
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.ai_request_log import AIRequestLog
from app.models.system_ai_endpoint import SystemAIEndpoint
from app.services.endpoints import ensure_default_seed
from app.utils.auth import decrypt_api_key, encrypt_api_key, get_admin_user

router = APIRouter(prefix="/api/admin", tags=["管理"])


# ========== Schemas ==========


class EndpointIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)
    base_url: str = Field(..., min_length=1, max_length=255)
    api_key: str = Field(..., min_length=1)
    model: str = Field(..., min_length=1, max_length=100)
    models: list[dict] | None = Field(None, description="免費模型清單 [{id, enabled}]")
    default_model: str | None = Field(None, description="預設免費模型 id")


class EndpointOut(BaseModel):
    id: int
    name: str
    base_url: str
    model: str
    models: list[dict] = []
    default_model: str | None = None
    is_default: bool
    is_active: bool
    key_preview: str  # 僅尾四碼


class UsageStats(BaseModel):
    total_requests: int
    ok_requests: int
    total_tokens: int
    per_user: list[dict]
    daily_trend: list[dict]
    per_model: list[dict]


def _to_out(endpoint: SystemAIEndpoint) -> EndpointOut:
    try:
        plain = decrypt_api_key(endpoint.api_key_encrypted)
        preview = f"••••{plain[-4:]}" if len(plain) >= 4 else "••••"
    except Exception:
        preview = "••••"
    return EndpointOut(
        id=endpoint.id,
        name=endpoint.name,
        base_url=endpoint.base_url,
        model=endpoint.model,
        models=endpoint.models_list(),
        default_model=endpoint.default_model,
        is_default=endpoint.is_default,
        is_active=endpoint.is_active,
        key_preview=preview,
    )


# ========== Endpoints CRUD ==========


@router.get("/endpoints", response_model=list[EndpointOut])
def list_endpoints(
    db: Session = Depends(get_db),
    admin_user=Depends(get_admin_user),
):
    ensure_default_seed(db)
    return [_to_out(e) for e in db.query(SystemAIEndpoint).all()]


@router.post("/endpoints", response_model=EndpointOut)
def create_endpoint(
    payload: EndpointIn,
    db: Session = Depends(get_db),
    admin_user=Depends(get_admin_user),
):
    endpoint = SystemAIEndpoint(
        name=payload.name,
        base_url=payload.base_url.rstrip("/"),
        api_key_encrypted=encrypt_api_key(payload.api_key),
        model=payload.model,
        is_default=False,
        is_active=True,
    )
    if payload.models is not None:
        endpoint.set_models_list(payload.models)
    if payload.default_model:
        endpoint.default_model = payload.default_model
    db.add(endpoint)
    db.commit()
    db.refresh(endpoint)
    return _to_out(endpoint)


@router.put("/endpoints/{endpoint_id}", response_model=EndpointOut)
def update_endpoint(
    endpoint_id: int,
    payload: EndpointIn,
    db: Session = Depends(get_db),
    admin_user=Depends(get_admin_user),
):
    endpoint = db.query(SystemAIEndpoint).filter_by(id=endpoint_id).first()
    if not endpoint:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="端點不存在")
    endpoint.name = payload.name
    endpoint.base_url = payload.base_url.rstrip("/")
    endpoint.api_key_encrypted = encrypt_api_key(payload.api_key)
    endpoint.model = payload.model
    if payload.models is not None:
        endpoint.set_models_list(payload.models)
    if payload.default_model:
        endpoint.default_model = payload.default_model
    db.commit()
    return _to_out(endpoint)


@router.delete("/endpoints/{endpoint_id}")
def deactivate_endpoint(
    endpoint_id: int,
    db: Session = Depends(get_db),
    admin_user=Depends(get_admin_user),
):
    endpoint = db.query(SystemAIEndpoint).filter_by(id=endpoint_id).first()
    if not endpoint:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="端點不存在")
    if endpoint.is_default and db.query(SystemAIEndpoint).filter_by(is_active=True).count() <= 1:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST, detail="不能停用唯一的預設端點"
        )
    if endpoint.is_default:
        # 指定另一個活躍端點為預設
        replacement = (
            db.query(SystemAIEndpoint)
            .filter(SystemAIEndpoint.id != endpoint_id, SystemAIEndpoint.is_active)
            .first()
        )
        if replacement:
            replacement.is_default = True
        endpoint.is_default = False
    endpoint.is_active = False
    db.commit()
    return {"message": "已停用"}


@router.post("/endpoints/{endpoint_id}/default", response_model=EndpointOut)
def set_default_endpoint(
    endpoint_id: int,
    db: Session = Depends(get_db),
    admin_user=Depends(get_admin_user),
):
    endpoint = db.query(SystemAIEndpoint).filter_by(id=endpoint_id, is_active=True).first()
    if not endpoint:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="端點不存在")

    for e in db.query(SystemAIEndpoint).filter(SystemAIEndpoint.is_default):
        e.is_default = False
    endpoint.is_default = True
    db.commit()
    return _to_out(endpoint)


@router.post("/endpoints/{endpoint_id}/test")
async def test_endpoint_connection(
    endpoint_id: int,
    db: Session = Depends(get_db),
    admin_user=Depends(get_admin_user),
):
    """以極小請求實測連線；回傳語意化結果"""
    from app.services.ai_provider import AIProviderError, OpenAICompatProvider

    endpoint = db.query(SystemAIEndpoint).filter_by(id=endpoint_id).first()
    if not endpoint:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="端點不存在")

    provider = OpenAICompatProvider(
        base_url=endpoint.base_url,
        api_key=decrypt_api_key(endpoint.api_key_encrypted),
        model=endpoint.model,
        timeout_seconds=20.0,
    )
    started = __import__("time").monotonic()
    try:
        async for _ in provider.stream_messages([{"role": "user", "content": "ping"}]):
            break  # 收到第一個 delta 即視為成功
        latency_ms = int((__import__("time").monotonic() - started) * 1000)
        return {"ok": True, "latency_ms": latency_ms}
    except AIProviderError as exc:
        return {"ok": False, "kind": exc.kind, "message": str(exc)}


# ========== 用量統計 ==========


@router.get("/usage/stats", response_model=UsageStats)
def usage_stats(
    days: int = 30,
    db: Session = Depends(get_db),
    admin_user=Depends(get_admin_user),
):
    since = datetime.utcnow() - timedelta(days=days)

    base = db.query(AIRequestLog).filter(AIRequestLog.created_at >= since)

    total = base.count()
    ok_count = base.filter(AIRequestLog.ok.is_(True)).count()
    tokens = (
        db.query(func.coalesce(func.sum(AIRequestLog.completion_tokens), 0))
        .filter(AIRequestLog.created_at >= since)
        .scalar()
        or 0
    )

    per_user_rows = (
        db.query(User.username, func.count(AIRequestLog.id))
        .join(User, AIRequestLog.user_id == User.id, isouter=True)
        .filter(AIRequestLog.created_at >= since)
        .group_by(User.username)
        .order_by(func.count(AIRequestLog.id).desc())
        .limit(10)
        .all()
    )
    daily_rows = (
        db.query(
            func.date(AIRequestLog.created_at),
            func.count(AIRequestLog.id),
        )
        .filter(AIRequestLog.created_at >= since, AIRequestLog.ok.is_(True))
        .group_by(func.date(AIRequestLog.created_at))
        .order_by(func.date(AIRequestLog.created_at))
        .all()
    )
    model_rows = (
        db.query(AIRequestLog.model, func.count(AIRequestLog.id))
        .filter(AIRequestLog.created_at >= since)
        .group_by(AIRequestLog.model)
        .all()
    )

    return UsageStats(
        total_requests=total,
        ok_requests=ok_count,
        total_tokens=int(tokens),
        per_user=[
            {"username": u or "訪客", "count": c} for u, c in per_user_rows
        ],
        daily_trend=[
            {"date": str(d), "count": c} for d, c in daily_rows
        ],
        per_model=[
            {"model": m or "未知", "count": c} for m, c in model_rows
        ],
    )


# 匯入擺後面避免循環：User 模型
from app.models.user import User  # noqa: E402
