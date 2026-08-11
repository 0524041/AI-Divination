"""
預設 AI 配置測試：所有未設定自訂模型的用戶都應取得 opencode 預設配置
"""

from types import SimpleNamespace
from unittest.mock import patch

import pytest

from app.services.ai_tasks import get_default_ai_config


class FakeDB:
    def __init__(self, user=None):
        self._user = user

    def query(self, _model):
        return self

    def filter(self, *_args, **_kwargs):
        return self

    def first(self):
        return self._user


@pytest.fixture
def fake_settings():
    with patch("app.services.ai_tasks.get_settings") as mock:
        mock.return_value = SimpleNamespace(OPENCODE_API_KEY="test-key")
        yield mock


def test_default_config_returns_for_regular_user(fake_settings):
    """一般註冊用戶（非 guest）未設定 AI 服務時也應取得預設配置"""
    db = FakeDB(user=SimpleNamespace(role="user"))
    config = get_default_ai_config(db, 1)

    assert config is not None
    assert config.provider == "opencode"
    assert config.effective_model == "deepseek-v4-flash"


def test_default_config_returns_for_guest(fake_settings):
    """訪客應取得預設配置"""
    db = FakeDB(user=SimpleNamespace(role="guest"))
    config = get_default_ai_config(db, 2)

    assert config is not None
    assert config.provider == "opencode"


def test_default_config_returns_none_when_user_missing(fake_settings):
    """用戶不存在時回傳 None"""
    db = FakeDB(user=None)
    assert get_default_ai_config(db, 999) is None


def test_default_config_raises_without_api_key():
    """環境缺少 OPENCODE_API_KEY 時拋錯"""
    with patch("app.services.ai_tasks.get_settings") as mock:
        mock.return_value = SimpleNamespace(OPENCODE_API_KEY="")
        db = FakeDB(user=SimpleNamespace(role="user"))
        with pytest.raises(ValueError, match="OPENCODE_API_KEY"):
            get_default_ai_config(db, 1)


def test_default_config_works_with_task_call_pattern():
    """模擬背景任務的 get_ai_service 呼叫模式，確保預設配置可正常建立 AI 服務"""
    from app.services.ai import get_ai_service

    with patch("app.services.ai_tasks.get_settings") as mock:
        mock.return_value = SimpleNamespace(OPENCODE_API_KEY="test-key")
        db = FakeDB(user=SimpleNamespace(role="user"))
        config = get_default_ai_config(db, 1)

    service = get_ai_service(
        config.provider,
        api_key=config._api_key,
        base_url=config.local_url,
        model=config.effective_model,
    )
    assert service.model == "deepseek-v4-flash"
