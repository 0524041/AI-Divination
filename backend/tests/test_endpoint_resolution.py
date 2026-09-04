"""
端點解析測試（spec: ai-model-selection）

新語意：resolve_endpoint(connection_id, model_id) — 明確指定連線×模型。
涵蓋：Agnes 種子化（含模型清單探測）、系統預設解析、使用者連線解析、
per-model 呼叫參數合併（entry > preset > 全域預設）、舊紀錄相容、用量紀錄。
"""

import pytest

from app.core.config import get_settings
from app.core.database import SessionLocal
from app.models import AIConfig, AIRequestLog, History, SystemAIEndpoint
from app.services.ai_provider import UNSET
from app.services.endpoints import (
    ensure_default_seed,
    log_ai_request,
    resolve_endpoint,
    resolve_endpoint_for_record,
)
from app.utils.auth import decrypt_api_key, encrypt_api_key

pytestmark = pytest.mark.asyncio

GEMINI_COMPAT_URL = "https://generativelanguage.googleapis.com/v1beta/openai"


def _db():
    return SessionLocal()


def _make_connection(db, user_id, **overrides):
    defaults = dict(
        user_id=user_id,
        name="我的服務",
        base_url="https://example.com/v1",
        api_key_encrypted=encrypt_api_key("sk-user-key"),
        preset_id="openai",
        models='[{"id": "m-fast", "enabled": true}, '
        '{"id": "m-strong", "enabled": true, "params": {"temperature": 0.2}}]',
    )
    defaults.update(overrides)
    config = AIConfig(**defaults)
    db.add(config)
    db.commit()
    db.refresh(config)
    return config


# --- 種子化 ---


def test_seed_creates_default_from_env():
    """表為空＋環境有 Agnes 設定 → 建立預設端點（含單一模型清單）"""
    with _db() as db:
        endpoint = ensure_default_seed(db)

    assert endpoint is not None
    assert endpoint.name == "Agnes 預設"
    assert endpoint.is_default is True
    assert endpoint.is_active is True
    assert endpoint.model == "agnes-2.0-flash"
    assert endpoint.base_url == "https://apihub.agnes-ai.com/v1"
    assert endpoint.effective_default_model() == "agnes-2.0-flash"
    # 金鑰以加密形式儲存
    assert endpoint.api_key_encrypted != "test-agnes-key"
    assert decrypt_api_key(endpoint.api_key_encrypted) == "test-agnes-key"


def test_seed_probes_models_and_stores_list(monkeypatch):
    """種子時探測 /models → 內建款 enabled，探測到的其他款 disabled"""
    monkeypatch.setattr(get_settings(), "AI_PROBE_MODELS", True)
    monkeypatch.setattr(
        "app.services.endpoints.probe_models",
        lambda base_url, api_key: ["agnes-2.5-pro", "agnes-2.0-flash"],
    )
    with _db() as db:
        endpoint = ensure_default_seed(db)

    assert endpoint.enabled_model_ids() == ["agnes-2.0-flash", "agnes-2.5-flash"]
    assert endpoint.effective_default_model() == "agnes-2.0-flash"
    entries = {m["id"]: m["enabled"] for m in endpoint.models_list()}
    assert entries["agnes-2.5-pro"] is False


def test_seed_probe_failure_falls_back_to_preset_models(monkeypatch):
    """探測失敗 → 僅內建款 enabled"""
    def _boom(base_url, api_key):
        raise RuntimeError("network down")

    monkeypatch.setattr(get_settings(), "AI_PROBE_MODELS", True)
    monkeypatch.setattr("app.services.endpoints.probe_models", _boom)
    with _db() as db:
        endpoint = ensure_default_seed(db)

    assert sorted(endpoint.enabled_model_ids()) == [
        "agnes-2.0-flash",
        "agnes-2.5-flash",
    ]


def test_seed_is_idempotent():
    """重複執行種子化不會產生第二筆"""
    with _db() as db:
        first = ensure_default_seed(db)
        second = ensure_default_seed(db)

    assert first.id == second.id
    with _db() as db:
        assert db.query(SystemAIEndpoint).count() == 1


# --- 系統預設解析 ---


async def test_system_default_uses_default_model(fake_ai):
    """connection_id 未指定 → 系統預設端點＋預設模型"""
    with _db() as db:
        ensure_default_seed(db)

    with _db() as db:
        resolved = resolve_endpoint(db)

    assert resolved.source == "system"
    assert resolved.api_key == "test-agnes-key"
    assert resolved.model == "agnes-2.0-flash"


async def test_system_model_must_be_in_enabled_list(fake_ai):
    with _db() as db:
        ensure_default_seed(db)

    with _db() as db:
        with pytest.raises(ValueError, match="agnes-9.9"):
            resolve_endpoint(db, model_id="agnes-9.9")


async def test_system_enabled_model_selects_specific(fake_ai, monkeypatch):
    monkeypatch.setattr(get_settings(), "AI_PROBE_MODELS", True)
    monkeypatch.setattr(
        "app.services.endpoints.probe_models",
        lambda base_url, api_key: ["agnes-2.0-flash", "agnes-2.5-flash"],
    )
    with _db() as db:
        ensure_default_seed(db)

    with _db() as db:
        resolved = resolve_endpoint(db, model_id="agnes-2.5-flash")

    assert resolved.model == "agnes-2.5-flash"
    assert resolved.source == "system"


async def test_no_seed_available_raises_clear_error():
    """無任何端點且環境缺金鑰 → LookupError 帶可讀訊息"""
    from types import SimpleNamespace
    from unittest.mock import patch

    with patch("app.services.endpoints.get_settings") as mock:
        mock.return_value = SimpleNamespace(
            AGNES_API_KEY="", AGNES_BASE_URL="x", AGNES_MODEL_ID="m"
        )
        with _db() as db:
            assert db.query(SystemAIEndpoint).count() == 0
            with pytest.raises(LookupError, match="系統預設"):
                resolve_endpoint(db)


# --- 使用者連線解析 ---


async def test_user_connection_resolves_with_model(make_user):
    user = make_user(username="byok-user")
    with _db() as db:
        ensure_default_seed(db)
        config = _make_connection(db, user.id)

    with _db() as db:
        resolved = resolve_endpoint(
            db, user_id=user.id, connection_id=config.id, model_id="m-fast"
        )

    assert resolved.source == "user"
    assert resolved.name == "我的服務"
    assert resolved.base_url == "https://example.com/v1"
    assert resolved.api_key == "sk-user-key"
    assert resolved.model == "m-fast"


async def test_user_connection_default_to_first_enabled_model(make_user):
    user = make_user(username="first-model-user")
    with _db() as db:
        config = _make_connection(db, user.id)

    with _db() as db:
        resolved = resolve_endpoint(db, user_id=user.id, connection_id=config.id)

    assert resolved.model == "m-fast"


async def test_user_connection_merges_params_entry_over_preset(make_user):
    """entry params 覆蓋 preset；未指定的沿用全域預設"""
    user = make_user(username="params-user")
    with _db() as db:
        config = _make_connection(db, user.id)

    with _db() as db:
        resolved = resolve_endpoint(
            db, user_id=user.id, connection_id=config.id, model_id="m-strong"
        )

    # entry 指定 temperature=0.2；preset(openai) 無 params → 其餘不覆蓋（UNSET）
    assert resolved.call_params.temperature == 0.2
    assert resolved.call_params.reasoning_param is UNSET


async def test_user_connection_preset_params_apply(make_user):
    """preset 有 params 時作為 entry 之下的一層"""
    user = make_user(username="preset-params-user")
    with _db() as db:
        config = _make_connection(
            db, user.id, preset_id="ollama", models='[{"id": "llama3", "enabled": true}]'
        )

    with _db() as db:
        resolved = resolve_endpoint(
            db, user_id=user.id, connection_id=config.id, model_id="llama3"
        )

    assert resolved.call_params.reasoning_param is None  # ollama preset 明確停用


async def test_model_not_in_enabled_list_raises(make_user):
    user = make_user(username="bad-model-user")
    with _db() as db:
        config = _make_connection(
            db, user.id, models='[{"id": "m-fast", "enabled": false}]'
        )

    with _db() as db:
        with pytest.raises(ValueError, match="m-fast"):
            resolve_endpoint(
                db, user_id=user.id, connection_id=config.id, model_id="m-fast"
            )


async def test_missing_connection_falls_back_to_system(make_user):
    """連線已被刪除 → fallback 系統預設（舊紀錄仍可追問）"""
    user = make_user(username="deleted-conn-user")
    with _db() as db:
        ensure_default_seed(db)

    with _db() as db:
        resolved = resolve_endpoint(
            db, user_id=user.id, connection_id=99999, model_id="x"
        )

    assert resolved.source == "system"


async def test_foreign_connection_falls_back_to_system(make_user):
    """不屬於本人的連線 → fallback 系統預設（不洩漏他人設定）"""
    owner = make_user(username="conn-owner")
    other = make_user(username="conn-other")
    with _db() as db:
        ensure_default_seed(db)
        config = _make_connection(db, owner.id)

    with _db() as db:
        resolved = resolve_endpoint(
            db, user_id=other.id, connection_id=config.id, model_id="m-fast"
        )

    assert resolved.source == "system"


# --- 舊紀錄相容（resolve_endpoint_for_record） ---


async def test_record_binding_used(make_user):
    user = make_user(username="binding-user")
    with _db() as db:
        ensure_default_seed(db)
        config = _make_connection(db, user.id)
        record = History(
            user_id=user.id,
            divination_type="liuyao",
            question="q",
            chart_data="{}",
            ai_connection_id=config.id,
            ai_model="m-strong",
        )
        db.add(record)
        db.commit()
        record_id = record.id

    with _db() as db:
        record = db.query(History).filter(History.id == record_id).first()
        resolved = resolve_endpoint_for_record(db, record, user_id=user.id)

    assert resolved.source == "user"
    assert resolved.model == "m-strong"


async def test_legacy_default_record_uses_system(make_user):
    user = make_user(username="legacy-default-user")
    with _db() as db:
        ensure_default_seed(db)
        _make_connection(db, user.id)
        record = History(
            user_id=user.id,
            divination_type="liuyao",
            question="q",
            chart_data="{}",
            ai_provider="default",
        )
        db.add(record)
        db.commit()
        record_id = record.id

    with _db() as db:
        record = db.query(History).filter(History.id == record_id).first()
        resolved = resolve_endpoint_for_record(db, record, user_id=user.id)

    assert resolved.source == "system"


async def test_legacy_null_record_uses_system(make_user):
    """舊紀錄（ai_provider=NULL、無綁定）→ 一律解析到系統預設（spec 決策 5）"""
    user = make_user(username="legacy-null-user")
    with _db() as db:
        ensure_default_seed(db)
        _make_connection(db, user.id, is_active=True)
        record = History(
            user_id=user.id,
            divination_type="liuyao",
            question="q",
            chart_data="{}",
        )
        db.add(record)
        db.commit()
        record_id = record.id

    with _db() as db:
        record = db.query(History).filter(History.id == record_id).first()
        resolved = resolve_endpoint_for_record(db, record, user_id=user.id)

    assert resolved.source == "system"
    assert resolved.model == "agnes-2.0-flash"


# --- 用量紀錄 ---


async def test_log_success_and_failure_rows(fake_ai, make_user):
    """成功與失敗請求各寫一列；欄位正確"""
    user = make_user(username="usage-user")
    with _db() as db:
        endpoint = ensure_default_seed(db)

    resolved = resolve_endpoint(SessionLocal())
    log_ai_request(
        user_id=user.id,
        resolved=resolved,
        ok=True,
        prompt_tokens=11,
        completion_tokens=7,
        duration_ms=1234,
    )
    log_ai_request(
        user_id=user.id,
        resolved=resolved,
        ok=False,
        error_kind="quota",
        duration_ms=56,
    )

    with _db() as db:
        rows = db.query(AIRequestLog).order_by(AIRequestLog.id).all()
        assert len(rows) == 2
        success, failure = rows
        assert success.ok is True
        assert success.error_kind is None
        assert success.prompt_tokens == 11
        assert success.completion_tokens == 7
        assert success.duration_ms == 1234
        assert success.endpoint_id == endpoint.id
        assert success.user_id == user.id
        assert failure.ok is False
        assert failure.error_kind == "quota"
        assert failure.prompt_tokens is None


async def test_resolve_then_stream_against_fake_server(fake_ai):
    """整合：解析出的預設端點指向假伺服器後可直接串流（含參數傳遞）"""
    with _db() as db:
        endpoint = ensure_default_seed(db)
        endpoint.base_url = fake_ai.base_url
        endpoint.model = "fake-model"
        endpoint.api_key_encrypted = encrypt_api_key("sk-test-key")
        db.commit()

    fake_ai.respond_stream(["好"])

    with _db() as db:
        resolved = resolve_endpoint(db)

    provider = resolved.make_provider()
    deltas = [d async for d in provider.stream_messages([{"role": "user", "content": "?"}])]

    assert [d["text"] for d in deltas] == ["好"]
    assert provider.last_usage is None  # 假伺服器未回 usage 時不虛構數字

    log_ai_request(
        user_id=None,
        resolved=resolved,
        ok=True,
        duration_ms=10,
    )
    with _db() as db:
        row = db.query(AIRequestLog).first()
        assert row is not None
        assert row.ok is True
