"""
設定 API 路由
"""

from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import Optional, List

from app.core.database import get_db
from app.models.user import User
from app.models.settings import AIConfig
from app.utils.auth import get_current_user, encrypt_api_key, decrypt_api_key
from app.services.ai import CustomAIService
from app.utils.security import sanitize_url, RateLimitDep

router = APIRouter(prefix="/api/settings", tags=["設定"])


# ========== Schemas ==========


class AIConfigRequest(BaseModel):
    """AI 設定請求"""

    provider: str = Field(..., description="'gemini' | 'local' | 'openai'")
    name: Optional[str] = Field(
        None, description="用戶自訂的 AI 服務名稱", max_length=50
    )
    api_key: Optional[str] = Field(None, description="Gemini/OpenAI API Key")
    local_url: Optional[str] = Field(None, description="Local AI URL")
    local_model: Optional[str] = Field(None, description="Local AI Model")


class AIConfigResponse(BaseModel):
    """AI 設定回應"""

    id: int
    provider: str
    name: Optional[str]
    has_api_key: bool
    local_url: Optional[str]
    local_model: Optional[str]
    is_active: bool


class TestConnectionRequest(BaseModel):
    """測試連線請求"""

    url: str


class TestConnectionResponse(BaseModel):
    """測試連線回應"""

    success: bool
    models: List[str] = []
    error: Optional[str] = None


# ========== Endpoints ==========


@router.get("/ai", response_model=List[AIConfigResponse])
def get_ai_configs(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """取得用戶的 AI 設定"""
    configs = db.query(AIConfig).filter(AIConfig.user_id == current_user.id).all()

    return [
        AIConfigResponse(
            id=c.id,
            provider=c.provider,
            name=c.name,
            has_api_key=bool(c.api_key_encrypted),
            local_url=c.local_url,
            local_model=c.local_model,
            is_active=c.is_active,
        )
        for c in configs
    ]


@router.post("/ai", response_model=AIConfigResponse)
def create_ai_config(
    request: AIConfigRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """新增 AI 設定"""
    # 驗證
    if request.provider == "gemini" and not request.api_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Gemini 需要提供 API Key"
        )
    if request.provider == "openai" and not request.api_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="OpenAI 需要提供 API Key"
        )
    if request.provider == "local" and not (request.local_url and request.local_model):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="自定義 AI 需要提供 URL 和模型",
        )

    # URL 安全清理與驗證
    # 管理員可以使用 localhost/私有 IP
    is_admin = current_user.role == "admin"

    if request.provider == "local":
        try:
            request.local_url = sanitize_url(request.local_url, allow_private=is_admin)
        except ValueError as e:
            if not is_admin:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="禁止連線到私有網路。只有管理員可以使用 localhost。",
                )
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    # 停用其他同類型設定
    db.query(AIConfig).filter(
        AIConfig.user_id == current_user.id, AIConfig.provider == request.provider
    ).update({"is_active": False})

    # 建立新設定
    config = AIConfig(
        user_id=current_user.id,
        provider=request.provider,
        name=request.name,
        api_key_encrypted=encrypt_api_key(request.api_key) if request.api_key else None,
        local_url=request.local_url,
        local_model=request.local_model,
        is_active=True,
    )
    db.add(config)
    db.commit()
    db.refresh(config)

    return AIConfigResponse(
        id=config.id,
        provider=config.provider,
        name=config.name,
        has_api_key=bool(config.api_key_encrypted),
        local_url=config.local_url,
        local_model=config.local_model,
        is_active=config.is_active,
    )


@router.put("/ai/{config_id}", response_model=AIConfigResponse)
def update_ai_config(
    config_id: int,
    request: AIConfigRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """更新 AI 設定"""
    config = (
        db.query(AIConfig)
        .filter(AIConfig.id == config_id, AIConfig.user_id == current_user.id)
        .first()
    )

    if not config:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="設定不存在")

    config.provider = request.provider
    config.name = request.name
    if request.api_key:
        config.api_key_encrypted = encrypt_api_key(request.api_key)

    # 管理員可以使用 localhost/私有 IP
    is_admin = current_user.role == "admin"

    if request.local_url:
        try:
            config.local_url = sanitize_url(request.local_url, allow_private=is_admin)
        except ValueError as e:
            if not is_admin:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="禁止連線到私有網路。只有管理員可以使用 localhost。",
                )
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    else:
        config.local_url = request.local_url

    config.local_model = request.local_model

    db.commit()
    db.refresh(config)

    return AIConfigResponse(
        id=config.id,
        provider=config.provider,
        name=config.name,
        has_api_key=bool(config.api_key_encrypted),
        local_url=config.local_url,
        local_model=config.local_model,
        is_active=config.is_active,
    )


@router.put("/ai/{config_id}/activate")
def activate_ai_config(
    config_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """啟用 AI 設定"""
    config = (
        db.query(AIConfig)
        .filter(AIConfig.id == config_id, AIConfig.user_id == current_user.id)
        .first()
    )

    if not config:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="設定不存在")

    # 停用其他設定
    db.query(AIConfig).filter(AIConfig.user_id == current_user.id).update(
        {"is_active": False}
    )

    # 啟用此設定
    config.is_active = True
    db.commit()

    return {"message": "已啟用"}


@router.delete("/ai/{config_id}")
def delete_ai_config(
    config_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """刪除 AI 設定"""
    config = (
        db.query(AIConfig)
        .filter(AIConfig.id == config_id, AIConfig.user_id == current_user.id)
        .first()
    )

    if not config:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="設定不存在")

    db.delete(config)
    db.commit()

    return {"message": "已刪除"}


@router.post("/ai/test", response_model=TestConnectionResponse)
async def test_ai_connection(
    request: Request,
    body: TestConnectionRequest,
    current_user: User = Depends(get_current_user),
    _: None = Depends(RateLimitDep(max_requests=5, window_seconds=60)),
):
    """
    測試 AI 連線

    注意：只有管理員可以使用 localhost/私有 IP 進行測試
    """
    import logging

    security_logger = logging.getLogger("security.audit")

    # 記錄連線測試嘗試
    client_ip = request.client.host if request.client else "unknown"
    is_admin = current_user.role == "admin"

    security_logger.info(
        f"AI Connection Test | IP: {client_ip} | User: {current_user.username} | "
        f"Admin: {is_admin} | URL: {body.url}"
    )

    try:
        url = sanitize_url(body.url, allow_private=is_admin)
    except ValueError as e:
        security_logger.warning(
            f"AI Connection Test BLOCKED | IP: {client_ip} | User: {current_user.username} | "
            f"URL: {body.url} | Reason: {str(e)}"
        )
        if is_admin:
            return TestConnectionResponse(success=False, error=str(e))
        else:
            return TestConnectionResponse(
                success=False,
                error="禁止連線到私有網路。只有管理員可以測試 localhost。",
            )

    result = await CustomAIService.test_connection(url)

    # 記錄結果
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
