"""
設定 API 路由
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import Optional, List

from app.core.database import get_db
from app.models.user import User
from app.models.settings import AIConfig
from app.utils.auth import get_current_user, encrypt_api_key, decrypt_api_key
from app.services.ai import LocalAIService

router = APIRouter(prefix="/api/settings", tags=["設定"])


# ========== Schemas ==========

class AIConfigRequest(BaseModel):
    """AI 設定請求"""
    provider: str = Field(..., description="'gemini' | 'local'")
    api_key: Optional[str] = Field(None, description="Gemini API Key")
    local_url: Optional[str] = Field(None, description="Local AI URL")
    local_model: Optional[str] = Field(None, description="Local AI Model")


class AIConfigResponse(BaseModel):
    """AI 設定回應"""
    id: int
    provider: str
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
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """取得用戶的 AI 設定"""
    configs = db.query(AIConfig).filter(AIConfig.user_id == current_user.id).all()
    
    return [
        AIConfigResponse(
            id=c.id,
            provider=c.provider,
            has_api_key=bool(c.api_key_encrypted),
            local_url=c.local_url,
            local_model=c.local_model,
            is_active=c.is_active
        )
        for c in configs
    ]


@router.post("/ai", response_model=AIConfigResponse)
def create_ai_config(
    request: AIConfigRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """新增 AI 設定"""
    # 驗證
    if request.provider == "gemini" and not request.api_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Gemini 需要提供 API Key"
        )
    if request.provider == "local" and (not request.local_url or not request.local_model):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Local AI 需要提供 URL 和模型"
        )
    
    # 停用其他同類型設定
    db.query(AIConfig).filter(
        AIConfig.user_id == current_user.id,
        AIConfig.provider == request.provider
    ).update({"is_active": False})
    
    # 建立新設定
    config = AIConfig(
        user_id=current_user.id,
        provider=request.provider,
        api_key_encrypted=encrypt_api_key(request.api_key) if request.api_key else None,
        local_url=request.local_url,
        local_model=request.local_model,
        is_active=True
    )
    db.add(config)
    db.commit()
    db.refresh(config)
    
    return AIConfigResponse(
        id=config.id,
        provider=config.provider,
        has_api_key=bool(config.api_key_encrypted),
        local_url=config.local_url,
        local_model=config.local_model,
        is_active=config.is_active
    )


@router.put("/ai/{config_id}", response_model=AIConfigResponse)
def update_ai_config(
    config_id: int,
    request: AIConfigRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """更新 AI 設定"""
    config = db.query(AIConfig).filter(
        AIConfig.id == config_id,
        AIConfig.user_id == current_user.id
    ).first()
    
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="設定不存在"
        )
    
    config.provider = request.provider
    if request.api_key:
        config.api_key_encrypted = encrypt_api_key(request.api_key)
    config.local_url = request.local_url
    config.local_model = request.local_model
    
    db.commit()
    db.refresh(config)
    
    return AIConfigResponse(
        id=config.id,
        provider=config.provider,
        has_api_key=bool(config.api_key_encrypted),
        local_url=config.local_url,
        local_model=config.local_model,
        is_active=config.is_active
    )


@router.put("/ai/{config_id}/activate")
def activate_ai_config(
    config_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """啟用 AI 設定"""
    config = db.query(AIConfig).filter(
        AIConfig.id == config_id,
        AIConfig.user_id == current_user.id
    ).first()
    
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="設定不存在"
        )
    
    # 停用其他設定
    db.query(AIConfig).filter(
        AIConfig.user_id == current_user.id
    ).update({"is_active": False})
    
    # 啟用此設定
    config.is_active = True
    db.commit()
    
    return {"message": "已啟用"}


@router.delete("/ai/{config_id}")
def delete_ai_config(
    config_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """刪除 AI 設定"""
    config = db.query(AIConfig).filter(
        AIConfig.id == config_id,
        AIConfig.user_id == current_user.id
    ).first()
    
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="設定不存在"
        )
    
    db.delete(config)
    db.commit()
    
    return {"message": "已刪除"}


@router.post("/ai/test", response_model=TestConnectionResponse)
async def test_ai_connection(request: TestConnectionRequest):
    """測試 Local AI 連線"""
    result = await LocalAIService.test_connection(request.url)
    return TestConnectionResponse(**result)
