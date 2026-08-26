"""
AI 端點註冊與解析（ADR-0001）

- ensure_default_seed：系統預設端點種子化（Agnes，幂等）
- resolve_endpoint：解析本次請求使用的端點
  （使用者 active 自訂端點 → 系統預設；use_system=True 直接用系統預設）
- log_ai_request：每次 AI 請求寫入用量紀錄（成功與失敗都記，永久保留）
"""

from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import SessionLocal
from app.models.ai_request_log import AIRequestLog
from app.models.settings import AIConfig
from app.models.system_ai_endpoint import SystemAIEndpoint
from app.services.ai_provider import OpenAICompatProvider, completions_url
from app.utils.auth import decrypt_api_key, encrypt_api_key

# 舊版 provider 名稱 → 對應的 OpenAI-compatible base_url
LEGACY_PROVIDER_BASE_URLS = {
    "openai": "https://api.openai.com/v1",
    # Google 官方 OpenAI 相容層（Bearer API Key）
    "gemini": "https://generativelanguage.googleapis.com/v1beta/openai",
}


@dataclass
class ResolvedEndpoint:
    """一次請求實際使用的端點"""

    endpoint_id: int | None
    name: str
    base_url: str
    api_key: str
    model: str
    source: str  # "user" | "system"

    def make_provider(self) -> OpenAICompatProvider:
        return OpenAICompatProvider(
            base_url=self.base_url,
            api_key=self.api_key,
            model=self.model,
        )

    @property
    def completions_url(self) -> str:
        return completions_url(self.base_url)


def ensure_default_seed(db: Session) -> SystemAIEndpoint | None:
    """系統預設端點種子化：表為空且環境提供 Agnes 金鑰時建立；幂等"""
    if db.query(SystemAIEndpoint).count() > 0:
        return db.query(SystemAIEndpoint).first()

    settings = get_settings()
    if not settings.AGNES_API_KEY:
        return None

    endpoint = SystemAIEndpoint(
        name="Agnes 預設",
        base_url=settings.AGNES_BASE_URL,
        api_key_encrypted=encrypt_api_key(settings.AGNES_API_KEY),
        model=settings.AGNES_MODEL_ID,
        is_default=True,
        is_active=True,
    )
    db.add(endpoint)
    db.commit()
    db.refresh(endpoint)
    return endpoint


def get_system_default(db: Session) -> SystemAIEndpoint | None:
    return (
        db.query(SystemAIEndpoint)
        .filter(SystemAIEndpoint.is_default.is_(True), SystemAIEndpoint.is_active)
        .order_by(SystemAIEndpoint.id)
        .first()
    )


def _resolve_user_config(db: Session, user_id: int) -> ResolvedEndpoint | None:
    """使用者 active 自訂端點（沿用既有 ai_configs，統一映射到 OpenAI-compatible）"""
    config = (
        db.query(AIConfig)
        .filter(AIConfig.user_id == user_id, AIConfig.is_active)
        .first()
    )
    if not config:
        return None

    base_url = LEGACY_PROVIDER_BASE_URLS.get(config.provider) or config.local_url
    api_key = (
        decrypt_api_key(config.api_key_encrypted)
        if config.api_key_encrypted
        else ""
    )
    if not base_url or not config.effective_model:
        return None

    return ResolvedEndpoint(
        endpoint_id=None,
        name=config.name or f"{config.provider}/{config.effective_model}",
        base_url=base_url,
        api_key=api_key,
        model=config.effective_model,
        source="user",
    )


def resolve_endpoint(
    db: Session, user_id: int | None = None, use_system: bool = False
) -> ResolvedEndpoint:
    """決定本次請求使用的端點；無可用端點時 raise LookupError（語意化錯誤由呼叫端轉譯）"""
    if not use_system and user_id is not None:
        user_endpoint = _resolve_user_config(db, user_id)
        if user_endpoint is not None:
            return user_endpoint

    system_default = get_system_default(db)
    if system_default is None:
        ensure_default_seed(db)
        system_default = get_system_default(db)

    if system_default is None:
        raise LookupError("沒有可用的系統預設 AI 端點，請聯絡管理者設定")

    return ResolvedEndpoint(
        endpoint_id=system_default.id,
        name=system_default.name,
        base_url=system_default.base_url,
        api_key=decrypt_api_key(system_default.api_key_encrypted),
        model=system_default.model,
        source="system",
    )


def log_ai_request(
    *,
    user_id: int | None,
    resolved: ResolvedEndpoint,
    ok: bool,
    error_kind: str | None = None,
    prompt_tokens: int | None = None,
    completion_tokens: int | None = None,
    duration_ms: int | None = None,
    db: Session | None = None,
) -> None:
    """寫入一筆用量紀錄（成功與失敗都記）"""
    own_session = db is None
    session = db or SessionLocal()
    try:
        session.add(
            AIRequestLog(
                user_id=user_id,
                endpoint_id=resolved.endpoint_id,
                endpoint_name=resolved.name,
                model=resolved.model,
                ok=ok,
                error_kind=error_kind,
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                duration_ms=duration_ms,
            )
        )
        session.commit()
    except Exception:
        session.rollback()
        # 用量紀錄失敗不得影響主流程
    finally:
        if own_session:
            session.close()
