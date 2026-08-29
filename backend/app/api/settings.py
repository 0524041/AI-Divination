"""
設定 API 路由（spec: ai-model-selection）

- GET  /api/settings/ai/presets        內建服務清單（preset）
- GET  /api/settings/ai                列出使用者連線
- POST /api/settings/ai                新增連線（name/base_url/api_key/preset_id）
- PUT  /api/settings/ai/{id}           更新連線
- PUT  /api/settings/ai/{id}/models    維護連線的模型清單（顯示/隱藏、參數）
- DELETE /api/settings/ai/{id}         刪除連線
- GET  /api/settings/ai/models         聚合模型清單（系統＋使用者；訪客僅系統）
- PUT  /api/settings/ai/default-model  我的預設模型
- POST /api/settings/ai/test           連線測試（探測 /models）
- GET  /api/settings/ai/default-info   系統預設資訊（相容舊選擇器）
"""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.settings import AIConfig, UserAIPreference
from app.models.system_ai_endpoint import SystemAIEndpoint
from app.models.user import User
from app.services.ai_probe import test_connection
from app.services.presets import load_presets
from app.utils.auth import (
    encrypt_api_key,
    get_current_user,
    get_current_user_or_guest,
)
from app.utils.security import RateLimitDep, sanitize_url

router = APIRouter(prefix="/api/settings", tags=["設定"])


# ========== Schemas ==========


class ConnectionRequest(BaseModel):
    """連線新增/更新請求"""

    name: Optional[str] = Field(None, description="服務顯示名稱", max_length=50)
    base_url: Optional[str] = Field(None, description="OpenAI-compatible 服務位址")
    api_key: Optional[str] = Field(None, description="API Key")
    preset_id: Optional[str] = Field(None, description="對應內建服務清單 id")


class ConnectionResponse(BaseModel):
    id: int
    name: Optional[str]
    base_url: Optional[str]
    preset_id: Optional[str]
    has_api_key: bool
    models: List[dict] = []


class ModelEntry(BaseModel):
    id: str = Field(..., min_length=1, max_length=150)
    label: Optional[str] = None
    enabled: bool = True
    params: Optional[dict] = None


class ModelsRequest(BaseModel):
    models: List[ModelEntry] = Field(..., max_length=200)


class ModelEntryOut(BaseModel):
    connection_id: Optional[int]
    connection_name: str
    model_id: str
    label: Optional[str] = None
    source: str  # "system" | "user"
    params: Optional[dict] = None


class ModelsListResponse(BaseModel):
    models: List[ModelEntryOut]
    default: dict


class DefaultModelRequest(BaseModel):
    connection_id: Optional[int] = Field(
        None, description="NULL 代表系統免費模型"
    )
    model_id: str = Field(..., min_length=1, max_length=150)


class TestConnectionRequest(BaseModel):
    """測試連線請求"""

    url: str


class TestConnectionResponse(BaseModel):
    success: bool
    models: List[str] = []
    error: Optional[str] = None


# ========== Presets ==========


@router.get("/ai/presets")
def list_presets(current_user: User = Depends(get_current_user)):
    """內建服務清單（新增連線時挑選服務）"""
    return load_presets()


# ========== 連線 CRUD ==========


def _connection_out(config: AIConfig) -> ConnectionResponse:
    return ConnectionResponse(
        id=config.id,
        name=config.name,
        base_url=config.base_url,
        preset_id=config.preset_id,
        has_api_key=bool(config.api_key_encrypted),
        models=config.models_list(),
    )


def _owned_connection(db: Session, config_id: int, user: User) -> AIConfig:
    config = (
        db.query(AIConfig)
        .filter(AIConfig.id == config_id, AIConfig.user_id == user.id)
        .first()
    )
    if not config:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="連線不存在")
    return config


def _sanitize_base_url(base_url: str) -> str:
    """URL 格式驗證與清理（本機/私有位址已開放所有使用者，可連 Ollama 等）"""
    try:
        return sanitize_url(base_url, allow_private=True)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/ai", response_model=List[ConnectionResponse])
def list_connections(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """取得使用者的服務連線清單"""
    configs = db.query(AIConfig).filter(AIConfig.user_id == current_user.id).all()
    return [_connection_out(c) for c in configs]


@router.post("/ai", response_model=ConnectionResponse)
def create_connection(
    request: ConnectionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """新增服務連線（不自動選用；模型清單另外維護）"""
    if not request.base_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="需要提供服務位址"
        )

    config = AIConfig(
        user_id=current_user.id,
        name=request.name,
        base_url=_sanitize_base_url(request.base_url),
        api_key_encrypted=encrypt_api_key(request.api_key) if request.api_key else None,
        preset_id=request.preset_id,
    )
    db.add(config)
    db.commit()
    db.refresh(config)
    return _connection_out(config)

# ========== 聚合模型清單與預設模型 ==========
# （路由需註冊在 /ai/{config_id} 之前，避免被參數化路由搶先匹配）


@router.get("/ai/models", response_model=ModelsListResponse)
def list_selectable_models(
    current_user: User = Depends(get_current_user_or_guest),
    db: Session = Depends(get_db),
):
    """聚合可選模型清單（系統免費模型＋使用者的；訪客僅系統）"""
    models = _system_model_entries(db)
    default = {"connection_id": None, "model_id": None}
    if current_user.role != "guest":
        models.extend(_user_model_entries(db, current_user))
        default = _default_preference(db, current_user)
    return ModelsListResponse(models=models, default=default)


@router.put("/ai/default-model")
def set_default_model(
    request: DefaultModelRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """設定「我的預設模型」（每次占卜的初始選擇）"""
    if request.connection_id is None:
        # 系統免費模型：驗證 model_id 在系統清單中
        system_ids = [e.model_id for e in _system_model_entries(db)]
        if request.model_id not in system_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="模型不在系統免費清單中",
            )
    else:
        config = _owned_connection(db, request.connection_id, current_user)
        enabled = config.enabled_model_ids()
        if request.model_id not in enabled:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="模型不在連線的顯示清單中",
            )

    pref = (
        db.query(UserAIPreference)
        .filter(UserAIPreference.user_id == current_user.id)
        .first()
    )
    if pref is None:
        pref = UserAIPreference(user_id=current_user.id)
        db.add(pref)
    pref.default_connection_id = request.connection_id
    pref.default_model_id = request.model_id
    db.commit()
    return {"message": "已設定預設模型"}



@router.put("/ai/{config_id}", response_model=ConnectionResponse)
def update_connection(
    config_id: int,
    request: ConnectionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """更新連線（名稱/位址/金鑰/preset）"""
    config = _owned_connection(db, config_id, current_user)

    if request.name is not None:
        config.name = request.name
    if request.base_url is not None:
        config.base_url = _sanitize_base_url(request.base_url)
    if request.preset_id is not None:
        config.preset_id = request.preset_id
    if request.api_key:
        config.api_key_encrypted = encrypt_api_key(request.api_key)

    db.commit()
    db.refresh(config)
    return _connection_out(config)


@router.put("/ai/{config_id}/models", response_model=ConnectionResponse)
def update_connection_models(
    config_id: int,
    request: ModelsRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """維護連線的模型清單（顯示/隱藏、排序、per-model 參數）"""
    config = _owned_connection(db, config_id, current_user)

    for entry in request.models:
        if not entry.id.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="模型 id 不可為空"
            )

    config.set_models_list(
        [
            {
                "id": entry.id.strip(),
                **({"label": entry.label} if entry.label else {}),
                "enabled": entry.enabled,
                **({"params": entry.params} if entry.params else {}),
            }
            for entry in request.models
        ]
    )
    db.commit()
    db.refresh(config)
    return _connection_out(config)


@router.delete("/ai/{config_id}")
def delete_connection(
    config_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """刪除連線（綁定此連線的舊紀錄追問時回落系統免費模型）"""
    config = _owned_connection(db, config_id, current_user)

    db.query(UserAIPreference).filter(
        UserAIPreference.user_id == current_user.id,
        UserAIPreference.default_connection_id == config_id,
    ).update({"default_connection_id": None, "default_model_id": None})
    db.delete(config)
    db.commit()

    return {"message": "已刪除"}


def _system_model_entries(db: Session) -> List[ModelEntryOut]:
    from app.services.endpoints import ensure_default_seed

    endpoint = (
        db.query(SystemAIEndpoint)
        .filter(SystemAIEndpoint.is_default.is_(True), SystemAIEndpoint.is_active)
        .order_by(SystemAIEndpoint.id)
        .first()
    ) or ensure_default_seed(db)
    if endpoint is None:
        return []

    entries = []
    for item in endpoint.models_list():
        if not item.get("enabled", True):
            continue
        entries.append(
            ModelEntryOut(
                connection_id=None,
                connection_name=endpoint.name,
                model_id=item["id"],
                label=item.get("label"),
                source="system",
                params=item.get("params"),
            )
        )
    return entries


def _user_model_entries(db: Session, user: User) -> List[ModelEntryOut]:
    configs = db.query(AIConfig).filter(AIConfig.user_id == user.id).all()
    entries = []
    for config in configs:
        for item in config.models_list():
            if not item.get("enabled", True):
                continue
            entries.append(
                ModelEntryOut(
                    connection_id=config.id,
                    connection_name=config.name or "我的服務",
                    model_id=item["id"],
                    label=item.get("label"),
                    source="user",
                    params=item.get("params"),
                )
            )
    return entries


def _default_preference(db: Session, user: User) -> dict:
    pref = db.query(UserAIPreference).filter(UserAIPreference.user_id == user.id).first()
    return {
        "connection_id": pref.default_connection_id if pref else None,
        "model_id": pref.default_model_id if pref else None,
    }


# ========== 系統預設資訊（相容舊選擇器） ==========


@router.get("/ai/default-info")
def get_system_default_info(
    current_user: User = Depends(get_current_user_or_guest),
    db: Session = Depends(get_db),
):
    """系統預設端點資訊（訪客與使用者共用）"""
    from app.services.endpoints import ensure_default_seed, get_system_default

    endpoint = get_system_default(db) or ensure_default_seed(db)
    if endpoint is None:
        return {"name": "系統預設", "model": None}
    return {"name": endpoint.name, "model": endpoint.effective_default_model()}


# ========== 連線測試 ==========


@router.post("/ai/test", response_model=TestConnectionResponse)
async def test_ai_connection(
    request: Request,
    body: TestConnectionRequest,
    current_user: User = Depends(get_current_user),
    _: None = Depends(RateLimitDep(max_requests=5, window_seconds=60)),
):
    """
    測試 AI 連線（探測 /models 回傳候選模型清單）；
    本機/私有位址已開放所有使用者。
    """
    import logging

    security_logger = logging.getLogger("security.audit")

    client_ip = request.client.host if request.client else "unknown"

    security_logger.info(
        f"AI Connection Test | IP: {client_ip} | User: {current_user.username} | "
        f"URL: {body.url}"
    )

    try:
        url = sanitize_url(body.url, allow_private=True)
    except ValueError as e:
        security_logger.warning(
            f"AI Connection Test BLOCKED | IP: {client_ip} | User: {current_user.username} | "
            f"URL: {body.url} | Reason: {str(e)}"
        )
        return TestConnectionResponse(success=False, error=str(e))

    result = await test_connection(url)

    if result.get("success"):
        security_logger.info(
            f"AI Connection Test SUCCESS | IP: {client_ip} | URL: {url} | "
            f"Models: {len(result.get('models', []))}"
        )
    else:
        security_logger.warning(
            f"AI Connection Test FAILED | IP: {client_ip} | URL: {url} | "
            f"Error: {result.get('error', 'unknown')}"
        )

    return TestConnectionResponse(**result)
