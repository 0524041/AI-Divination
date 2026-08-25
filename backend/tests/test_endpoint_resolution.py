"""
端點註冊與解析測試（Ticket 02）

涵蓋：Agnes 種子化（幂等）、解析順序（使用者自訂 → 系統預設）、
金鑰解密接線、用量紀錄（成功/失敗都記）。
"""

import pytest

from app.core.database import SessionLocal
from app.models import AIConfig, AIRequestLog, SystemAIEndpoint
from app.services.endpoints import (
    ensure_default_seed,
    log_ai_request,
    resolve_endpoint,
)
from app.utils.auth import decrypt_api_key, encrypt_api_key

pytestmark = pytest.mark.asyncio


def _db():
    return SessionLocal()


# --- 種子化 ---


def test_seed_creates_default_from_env():
    """表為空＋環境有 Agnes 設定 → 建立預設端點"""
    with _db() as db:
        endpoint = ensure_default_seed(db)

    assert endpoint is not None
    assert endpoint.name == "Agnes 預設"
    assert endpoint.is_default is True
    assert endpoint.is_active is True
    assert endpoint.model == "agnes-2.0-flash"
    assert endpoint.base_url == "https://apihub.agnes-ai.com/v1"
    # 金鑰以加密形式儲存
    assert endpoint.api_key_encrypted != "test-agnes-key"
    assert decrypt_api_key(endpoint.api_key_encrypted) == "test-agnes-key"


def test_seed_is_idempotent():
    """重複執行種子化不會產生第二筆"""
    with _db() as db:
        first = ensure_default_seed(db)
        second = ensure_default_seed(db)

    assert first.id == second.id
    with _db() as db:
        assert db.query(SystemAIEndpoint).count() == 1


# --- 解析順序 ---


async def test_guest_resolves_to_system_default(fake_ai):
    """無 user_id（訪客）→ 系統預設端點，金鑰已解密"""
    with _db() as db:
        ensure_default_seed(db)

    with _db() as db:
        resolved = resolve_endpoint(db, user_id=None)

    assert resolved.source == "system"
    assert resolved.endpoint_id is not None
    assert resolved.api_key == "test-agnes-key"
    assert resolved.model == "agnes-2.0-flash"


async def test_user_without_config_falls_back_to_system_default(make_user):
    """未設定自訂端點的使用者 → 系統預設"""
    user = make_user(username="no-config-user")
    with _db() as db:
        ensure_default_seed(db)

    with _db() as db:
        resolved = resolve_endpoint(db, user_id=user.id)

    assert resolved.source == "system"


async def test_user_active_config_overrides_system_default(make_user):
    """使用者 active 自訂端點覆蓋系統預設"""
    user = make_user(username="byok-user")
    with _db() as db:
        ensure_default_seed(db)
        db.add(
            AIConfig(
                user_id=user.id,
                provider="openai",
                name="我的 OpenAI",
                model="gpt-test",
                api_key_encrypted=encrypt_api_key("sk-user-key"),
                is_active=True,
            )
        )
        db.commit()

    with _db() as db:
        resolved = resolve_endpoint(db, user_id=user.id)

    assert resolved.source == "user"
    assert resolved.name == "我的 OpenAI"
    assert resolved.api_key == "sk-user-key"
    assert resolved.model == "gpt-test"
    assert resolved.base_url == "https://api.openai.com/v1"


async def test_inactive_user_config_ignored(make_user):
    """停用的自訂端點不參與解析"""
    user = make_user(username="inactive-config-user")
    with _db() as db:
        ensure_default_seed(db)
        db.add(
            AIConfig(
                user_id=user.id,
                provider="openai",
                model="gpt-x",
                api_key_encrypted=encrypt_api_key("sk-k"),
                is_active=False,
            )
        )
        db.commit()

    with _db() as db:
        resolved = resolve_endpoint(db, user_id=user.id)

    assert resolved.source == "system"


async def test_use_system_flag_forces_default(make_user):
    """use_system=True 時即使有 active 自訂端點也用系統預設"""
    user = make_user(username="force-default-user")
    with _db() as db:
        ensure_default_seed(db)
        db.add(
            AIConfig(
                user_id=user.id,
                provider="openai",
                model="gpt-y",
                api_key_encrypted=encrypt_api_key("sk-k"),
                is_active=True,
            )
        )
        db.commit()

    with _db() as db:
        resolved = resolve_endpoint(db, user_id=user.id, use_system=True)

    assert resolved.source == "system"


async def test_no_seed_available_raises_clear_error():
    """無任何端點且環境缺金鑰 → LookupError 帶可讀訊息"""
    from types import SimpleNamespace
    from unittest.mock import patch

    # 模擬環境沒有 AGNES 金鑰：讓 seed 內部讀到的 settings 缺 key
    with patch("app.services.endpoints.get_settings") as mock:
        mock.return_value = SimpleNamespace(
            AGNES_API_KEY="", AGNES_BASE_URL="x", AGNES_MODEL_ID="m"
        )
        # 確保 get_system_default 也查不到（表此時應為空）
        with _db() as db:
            assert db.query(SystemAIEndpoint).count() == 0
            with pytest.raises(LookupError, match="系統預設"):
                resolve_endpoint(db, user_id=None)


# --- 用量紀錄 ---


async def test_log_success_and_failure_rows(fake_ai, make_user):
    """成功與失敗請求各寫一列；欄位正確"""
    user = make_user(username="usage-user")
    with _db() as db:
        endpoint = ensure_default_seed(db)

    resolved = resolve_endpoint(SessionLocal(), user_id=None)
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
    """整合：解析出的預設端點指向假伺服器後可直接串流"""
    with _db() as db:
        endpoint = ensure_default_seed(db)
        endpoint.base_url = fake_ai.base_url
        endpoint.model = "fake-model"
        endpoint.api_key_encrypted = encrypt_api_key("sk-test-key")
        db.commit()
        target_id = endpoint.id

    fake_ai.respond_stream(["好"])

    with _db() as db:
        resolved = resolve_endpoint(db, user_id=None)

    provider = resolved.make_provider()
    deltas = [d async for d in provider.stream_messages([{"role": "user", "content": "?"}])]

    assert [d["text"] for d in deltas] == ["好"]
    assert provider.last_usage is None  # 假伺服器未回 usage 時不虛構數字

    log_ai_request(
        user_id=None,
        resolved=resolved,
        ok=True,
        prompt_tokens=provider.last_usage.prompt_tokens if provider.last_usage else None,
        completion_tokens=(
            provider.last_usage.completion_tokens if provider.last_usage else None
        ),
        duration_ms=10,
    )
    with _db() as db:
        row = db.query(AIRequestLog).first()
        assert row is not None
        assert row.endpoint_id == target_id
        assert row.ok is True
