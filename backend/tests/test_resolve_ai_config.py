"""
resolve_ai_config 測試：決定背景任務要用哪個 AI 配置
情境：
- 使用者明確選了「預設」→ 用預設配置（忽略使用者 config）
- 有 active config → 用使用者的
- 無 config → fallback 預設
- 無 config 且預設不可用 → None
"""

from types import SimpleNamespace

import pytest

from app.models.user import User
from app.services.ai_tasks import resolve_ai_config


class FakeDB:
    """模擬 db：query(AIConfig) → active_config，query(User) → user"""

    def __init__(self, user=None, active_config=None):
        self._user = user
        self._active_config = active_config
        self._model = None

    def query(self, model):
        self._model = model
        return self

    def filter(self, *_args, **_kwargs):
        return self

    def first(self):
        if self._model is User:
            return self._user
        return self._active_config


class FakeDefaultConfig:
    provider = "opencode"


@pytest.fixture
def fake_default(monkeypatch):
    monkeypatch.setattr(
        "app.services.ai_tasks.get_default_ai_config",
        lambda db, uid: FakeDefaultConfig(),
    )


def test_resolve_uses_default_when_flag_set(fake_default):
    """history.ai_provider == 'default' 時必須用預設配置，忽略使用者 active config"""
    user_config = SimpleNamespace(provider="gemini", api_key_encrypted="x")
    db = FakeDB(user=SimpleNamespace(role="user"), active_config=user_config)

    result = resolve_ai_config(db, 1, use_default=True)

    assert result.provider == "opencode"


def test_resolve_uses_active_config_when_no_flag(fake_default):
    """沒有 default 標記時用使用者的 active config"""
    user_config = SimpleNamespace(provider="gemini", api_key_encrypted="x")
    db = FakeDB(user=SimpleNamespace(role="user"), active_config=user_config)

    result = resolve_ai_config(db, 1, use_default=False)

    assert result is user_config


def test_resolve_falls_back_to_default_without_config(fake_default):
    """無 active config 時 fallback 到預設"""
    db = FakeDB(user=SimpleNamespace(role="user"), active_config=None)

    result = resolve_ai_config(db, 1, use_default=False)

    assert result.provider == "opencode"


def test_resolve_returns_none_when_no_config_and_no_default(monkeypatch):
    """沒有 active config 且預設不可用（用戶不存在）時回傳 None"""
    monkeypatch.setattr(
        "app.services.ai_tasks.get_default_ai_config",
        lambda db, uid: None,
    )
    db = FakeDB(user=None, active_config=None)

    assert resolve_ai_config(db, 999, use_default=False) is None
