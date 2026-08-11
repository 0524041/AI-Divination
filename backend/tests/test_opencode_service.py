"""
OpenCodeService 測試（系統邊界：mock 外部 opencode API）
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.ai import OpenCodeService, get_ai_service


class FakeOpenAIResponse:
    message = MagicMock()
    message.content = "解盤結果"
    choice = MagicMock()
    choice.message = message
    choices = [choice]


@pytest.mark.asyncio
async def test_opencode_service_generate_sends_expected_params():
    """generate 必須以 DeepSeek V4 Flash 參數設定呼叫 opencode 端點"""
    create_mock = AsyncMock(return_value=FakeOpenAIResponse())

    with patch(
        "app.services.ai.AsyncOpenAI",
        return_value=MagicMock(chat=MagicMock(completions=MagicMock(create=create_mock))),
    ) as client_cls:
        service = OpenCodeService("test-key")
        result = await service.generate("user prompt", "system prompt")

    assert result == "解盤結果"

    client_cls.assert_called_once_with(
        base_url="https://opencode.ai/zen/go/v1", api_key="test-key"
    )

    create_mock.assert_awaited_once()
    call_kwargs = create_mock.await_args.kwargs
    assert call_kwargs["model"] == "deepseek-v4-flash"
    assert call_kwargs["temperature"] == 0.9
    assert call_kwargs["max_tokens"] == 46800
    assert call_kwargs["reasoning_effort"] == "max"
    assert call_kwargs["messages"][0] == {"role": "system", "content": "system prompt"}
    assert call_kwargs["messages"][1] == {"role": "user", "content": "user prompt"}


def test_get_ai_service_opencode_provider():
    """get_ai_service 支援 'opencode' provider"""
    service = get_ai_service("opencode", api_key="test-key")
    assert isinstance(service, OpenCodeService)
    assert service.model == "deepseek-v4-flash"
