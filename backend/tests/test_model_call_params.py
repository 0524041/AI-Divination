"""
模型呼叫參數測試（spec: ai-model-selection）

不同模型需要不同的呼叫參數（reasoning 參數名稱與值、溫度、max tokens）。
- 預設 payload 維持現狀（temperature 0.9 / max_tokens 16384 / reasoning_effort "high"）
- ModelCallParams 可覆蓋任一項
- reasoning_param=None → 不送任何思考參數
- merge_call_params：後層非 None 覆蓋前層（entry params > preset params > 全域預設）
"""

import pytest

from app.services.ai_provider import (
    DEFAULT_CALL_PARAMS,
    UNSET,
    ModelCallParams,
    OpenAICompatProvider,
    merge_call_params,
)

pytestmark = pytest.mark.asyncio


async def _stream_once(fake_ai, params=None):
    provider = OpenAICompatProvider(
        base_url=fake_ai.base_url, api_key="sk-test", model="fake-model"
    )
    fake_ai.respond_stream(["好"])
    async for _ in provider.stream_messages(
        [{"role": "user", "content": "?"}], call_params=params
    ):
        pass
    await provider.aclose()
    return fake_ai.requests[-1]["body"]


async def test_default_payload_unchanged(fake_ai):
    """未帶參數時 payload 與重構前完全一致"""
    body = await _stream_once(fake_ai)

    assert body["temperature"] == 0.9
    assert body["max_tokens"] == 16384
    assert body["reasoning_effort"] == "high"


async def test_call_params_override_temperature_and_tokens(fake_ai):
    """覆蓋 temperature / max_tokens；未覆蓋的 reasoning 維持預設"""
    params = ModelCallParams(temperature=0.3, max_tokens=100)
    body = await _stream_once(fake_ai, params)

    assert body["temperature"] == 0.3
    assert body["max_tokens"] == 100
    assert body["reasoning_effort"] == "high"


async def test_reasoning_param_disabled(fake_ai):
    """reasoning_param=None → payload 不含任何思考參數"""
    params = ModelCallParams(reasoning_param=None)
    body = await _stream_once(fake_ai, params)

    assert "reasoning_effort" not in body


async def test_custom_reasoning_param_name_and_value(fake_ai):
    """換參數名（thinking_level）與值（字串或數值）"""
    params = ModelCallParams(
        reasoning_param="thinking_level", reasoning_value="medium"
    )
    body = await _stream_once(fake_ai, params)

    assert body["thinking_level"] == "medium"
    assert "reasoning_effort" not in body


async def test_numeric_reasoning_value(fake_ai):
    params = ModelCallParams(
        reasoning_param="reasoning_effort", reasoning_value=2
    )
    body = await _stream_once(fake_ai, params)

    assert body["reasoning_effort"] == 2


def test_merge_call_params_later_layer_wins():
    """merge：後層非 None 覆蓋前層；None 不覆蓋"""
    preset = ModelCallParams(
        reasoning_param="reasoning_effort",
        reasoning_value="medium",
        temperature=0.7,
    )
    entry = ModelCallParams(temperature=0.2)

    merged = merge_call_params(preset, entry)

    assert merged.temperature == 0.2
    assert merged.reasoning_param == "reasoning_effort"
    assert merged.reasoning_value == "medium"
    assert merged.max_tokens is UNSET  # 兩層皆未指定


def test_merge_with_none_layers():
    merged = merge_call_params(None, DEFAULT_CALL_PARAMS, None)
    assert merged.reasoning_param == "reasoning_effort"
    assert merged.reasoning_value == "high"
