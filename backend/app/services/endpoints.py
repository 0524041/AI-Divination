"""
AI 端點註冊與解析（ADR-0001；連線×模型語意見 spec: ai-model-selection）

- ensure_default_seed：系統預設端點種子化（Agnes，幂等），種子時探測 /models 建立免費模型清單
- resolve_endpoint：依 (connection_id, model_id) 解析本次請求使用的連線與模型
  （connection_id=None → 系統免費模型；使用者連線缺漏時 fallback 系統預設）
- resolve_endpoint_for_record：由占卜紀錄的綁定（ai_connection_id/ai_model）解析，
  並相容舊紀錄的 ai_provider 語意
- log_ai_request：每次 AI 請求寫入用量紀錄（成功與失敗都記，永久保留）
"""

import json
import logging
from dataclasses import dataclass, field

import httpx
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import SessionLocal
from app.models.ai_request_log import AIRequestLog
from app.models.settings import AIConfig
from app.models.system_ai_endpoint import SystemAIEndpoint
from app.services.ai_provider import (
    ModelCallParams,
    OpenAICompatProvider,
    call_params_from_dict,
    completions_url,
    merge_call_params,
)
from app.services.presets import preset_model_params, preset_model_protocol
from app.utils.auth import decrypt_api_key, encrypt_api_key

logger = logging.getLogger(__name__)

PROBE_TIMEOUT_SECONDS = 5.0


@dataclass
class ResolvedEndpoint:
    """一次請求實際使用的連線與模型"""

    endpoint_id: int | None
    name: str
    base_url: str
    api_key: str
    model: str
    source: str  # "user" | "system"
    call_params: ModelCallParams | None = field(default=None)
    protocol: str = "chat"  # "chat" | "responses"

    def make_provider(self) -> OpenAICompatProvider:
        return OpenAICompatProvider(
            base_url=self.base_url,
            api_key=self.api_key,
            model=self.model,
            call_params=self.call_params,
            protocol=self.protocol,
        )

    @property
    def completions_url(self) -> str:
        return completions_url(self.base_url)


def probe_models(base_url: str, api_key: str) -> list[str]:
    """探測 OpenAI-compatible 服務的模型清單（GET {base_url}/models）；失敗時 raise"""
    url = f"{base_url.rstrip('/')}/models"
    headers = {"Authorization": f"Bearer {api_key}"} if api_key else {}
    with httpx.Client(timeout=PROBE_TIMEOUT_SECONDS) as client:
        response = client.get(url, headers=headers, follow_redirects=False)
        response.raise_for_status()
        data = response.json()
    return [m.get("id", "") for m in data.get("data", []) if m.get("id")]


def ensure_default_seed(db: Session) -> SystemAIEndpoint | None:
    """系統預設端點種子化：表為空且環境提供 Agnes 金鑰時建立；幂等

    種子時探測 /models 建立免費模型清單；探測失敗僅寫入環境設定的單一模型。
    """
    if db.query(SystemAIEndpoint).count() > 0:
        return db.query(SystemAIEndpoint).first()

    settings = get_settings()
    if not settings.AGNES_API_KEY:
        return None

    try:
        if get_settings().AI_PROBE_MODELS:
            model_ids = probe_models(settings.AGNES_BASE_URL, settings.AGNES_API_KEY)
        else:
            model_ids = []
    except Exception as exc:
        logger.info("Agnes 模型探測失敗，使用環境預設：%s", exc)
        model_ids = []

    if settings.AGNES_MODEL_ID not in model_ids:
        model_ids.insert(0, settings.AGNES_MODEL_ID)

    endpoint = SystemAIEndpoint(
        name="Agnes 預設",
        base_url=settings.AGNES_BASE_URL,
        api_key_encrypted=encrypt_api_key(settings.AGNES_API_KEY),
        model=settings.AGNES_MODEL_ID,
        default_model=settings.AGNES_MODEL_ID,
        models=json.dumps(
            [{"id": m, "enabled": True} for m in model_ids], ensure_ascii=False
        ),
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


def _resolve_system(
    db: Session, model_id: str | None
) -> ResolvedEndpoint:
    """系統免費模型解析；model_id 不在清單時 ValueError"""
    system_default = get_system_default(db)
    if system_default is None:
        ensure_default_seed(db)
        system_default = get_system_default(db)

    if system_default is None:
        raise LookupError("沒有可用的系統預設 AI 端點，請聯絡管理者設定")

    allowed = system_default.enabled_model_ids()
    if model_id is None:
        model = system_default.effective_default_model()
    elif model_id in allowed:
        model = model_id
    else:
        raise ValueError(f"模型 {model_id} 不在系統免費清單中")

    return ResolvedEndpoint(
        endpoint_id=system_default.id,
        name=system_default.name,
        base_url=system_default.base_url,
        api_key=decrypt_api_key(system_default.api_key_encrypted),
        model=model,
        source="system",
    )


def _entry_call_params(preset_id: str | None, model_id: str, entry: dict | None):
    """合併 per-model 呼叫參數：entry params > preset params"""
    preset_layer = preset_model_params(preset_id, model_id) if preset_id else None
    entry_layer = call_params_from_dict((entry or {}).get("params"))
    return merge_call_params(preset_layer, entry_layer)


def _entry_protocol(preset_id: str | None, model_id: str, entry: dict | None) -> str:
    """模型請求協定：entry protocol > preset protocol > chat"""
    if entry and entry.get("protocol"):
        return entry["protocol"]
    if preset_id:
        preset_protocol = preset_model_protocol(preset_id, model_id)
        if preset_protocol:
            return preset_protocol
    return "chat"


def _resolve_user_connection(
    db: Session, user_id: int, connection_id: int, model_id: str | None
) -> ResolvedEndpoint | None:
    """使用者連線解析；連線不存在或不屬於本人 → None（由上層 fallback 系統）"""
    config = (
        db.query(AIConfig)
        .filter(AIConfig.id == connection_id, AIConfig.user_id == user_id)
        .first()
    )
    if config is None:
        return None

    if model_id is None:
        enabled = config.enabled_model_ids()
        if not enabled:
            raise ValueError(f"連線「{config.name or config.id}」沒有啟用的模型")
        model = enabled[0]
        entry = config.model_entry(model)
    else:
        entry = config.model_entry(model_id)
        if entry is None or not entry.get("enabled", True):
            raise ValueError(
                f"模型 {model_id} 不在連線「{config.name or config.id}」的顯示清單中"
            )
        model = model_id

    api_key = (
        decrypt_api_key(config.api_key_encrypted)
        if config.api_key_encrypted
        else ""
    )
    if not config.base_url:
        raise ValueError(f"連線「{config.name or config.id}」缺少服務位址")

    return ResolvedEndpoint(
        endpoint_id=config.id,
        name=config.name or f"{config.preset_id or '自訂'}",
        base_url=config.base_url,
        api_key=api_key,
        model=model,
        source="user",
        call_params=_entry_call_params(config.preset_id, model, entry),
        protocol=_entry_protocol(config.preset_id, model, entry),
    )


def resolve_endpoint(
    db: Session,
    *,
    user_id: int | None = None,
    connection_id: int | None = None,
    model_id: str | None = None,
) -> ResolvedEndpoint:
    """決定本次請求使用的連線與模型

    - connection_id=None → 系統免費模型（model_id 可指定清單中的模型）
    - connection_id 指定 → 驗證屬於 user_id；缺漏/非本人時 fallback 系統預設
    - model_id 不在清單 → ValueError
    - 無可用系統端點 → LookupError（語意化錯誤由呼叫端轉譯）
    """
    if connection_id is not None and user_id is not None:
        resolved = _resolve_user_connection(db, user_id, connection_id, model_id)
        if resolved is not None:
            return resolved
        # 連線已刪除或不屬於本人（含舊紀錄綁定）→ 回落系統預設
        logger.info(
            "連線 %s 不可用，回落系統預設模型（user_id=%s）", connection_id, user_id
        )

    return _resolve_system(db, model_id if connection_id is None else None)


def resolve_endpoint_for_record(
    db: Session,
    record,
    *,
    user_id: int,
    connection_id: int | None = None,
    model_id: str | None = None,
    use_system: bool = False,
) -> ResolvedEndpoint:
    """由占卜紀錄解析端點（spec: 紀錄綁定 + 舊資料相容）

    優先序：請求參數 > 紀錄綁定（ai_connection_id/ai_model）> 系統預設。
    舊紀錄（無綁定，ai_provider 為 "default" 或 NULL）一律解析到系統預設。
    use_system=True 為明確切回系統免費模型。
    """
    if use_system:
        return resolve_endpoint(db, model_id=model_id)

    cid = connection_id if connection_id is not None else record.ai_connection_id
    mid = model_id if model_id is not None else record.ai_model

    return resolve_endpoint(
        db, user_id=user_id, connection_id=cid, model_id=mid
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
