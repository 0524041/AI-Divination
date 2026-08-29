"""
Responses API protocol 測試（OpenCode Go /v1/responses 相容模型）

OpenCode Go 的部分模型（Grok 4.6、GPT 5.6 Luna、Muse Spark）只掛在
`/v1/responses`（OpenAI Responses API），chat/completions 會被閘道拒絕。
- provider 依 protocol 分流請求端點與 payload 形狀
- 事件解析：response.output_text.delta → text；reasoning delta → thinking；
  response.completed → usage
- 預設 protocol=chat，行為完全不變
"""

import pytest

from app.services.ai_provider import OpenAICompatProvider
from app.services.presets import get_preset, preset_model_protocol

pytestmark = pytest.mark.asyncio


async def _stream_all(fake_ai, protocol=None, params=None):
    provider = OpenAICompatProvider(
        base_url=fake_ai.base_url,
        api_key="sk-test",
        model="fake-model",
        protocol=protocol,
    )
    deltas = []
    async for d in provider.stream_messages(
        [{"role": "user", "content": "?"}], call_params=params
    ):
        deltas.append(d)
    await provider.aclose()
    return deltas, fake_ai.requests[-1]["body"]


async def test_responses_protocol_sends_responses_payload(fake_ai):
    """payload 為 Responses API 形狀：input + max_output_tokens + reasoning"""
    fake_ai.respond_stream(["答"])
    deltas, body = await _stream_all(fake_ai, protocol="responses")

    assert deltas == [{"type": "text", "text": "答"}]
    assert body["model"] == "fake-model"
    assert body["input"] == [
        {"role": "user", "content": [{"type": "input_text", "text": "?"}]}
    ]
    assert body["max_output_tokens"] == 16384
    assert body["reasoning"] == {"effort": "high"}
    assert "messages" not in body
    assert "reasoning_effort" not in body


async def test_responses_protocol_parses_thinking_and_text(fake_ai):
    fake_ai.respond_stream_items([("thinking", "想"), ("text", "答案")])
    deltas, _ = await _stream_all(fake_ai, protocol="responses")

    assert deltas == [
        {"type": "thinking", "text": "想"},
        {"type": "text", "text": "答案"},
    ]


async def test_responses_protocol_captures_usage(fake_ai):
    fake_ai.respond_stream(["答"])
    fake_ai.stream_usage = {"prompt_tokens": 10, "completion_tokens": 5}

    provider = OpenAICompatProvider(
        base_url=fake_ai.base_url, api_key="sk", model="m", protocol="responses"
    )
    async for _ in provider.stream_messages([{"role": "user", "content": "?"}]):
        pass
    await provider.aclose()

    assert provider.last_usage is not None
    assert provider.last_usage.prompt_tokens == 10
    assert provider.last_usage.completion_tokens == 5


async def test_responses_protocol_maps_error_status(fake_ai):
    fake_ai.mode = "error"
    fake_ai.error_status = 401

    provider = OpenAICompatProvider(
        base_url=fake_ai.base_url, api_key="sk", model="m", protocol="responses"
    )
    with pytest.raises(Exception) as exc_info:
        async for _ in provider.stream_messages([{"role": "user", "content": "?"}]):
            pass
    await provider.aclose()

    assert getattr(exc_info.value, "kind", None) == "auth"


async def test_chat_protocol_remains_default(fake_ai):
    """未指定 protocol → chat/completions，payload 與原本一致"""
    fake_ai.respond_stream(["好"])
    deltas, body = await _stream_all(fake_ai)

    assert deltas == [{"type": "text", "text": "好"}]
    assert body["messages"] == [{"role": "user", "content": "?"}]
    assert body["reasoning_effort"] == "high"


async def test_responses_reasoning_disabled(fake_ai):
    """reasoning_param=None → responses payload 不帶 reasoning"""
    from app.services.ai_provider import ModelCallParams

    fake_ai.respond_stream(["答"])
    _, body = await _stream_all(
        fake_ai,
        protocol="responses",
        params=ModelCallParams(reasoning_param=None),
    )
    assert "reasoning" not in body


# --- preset 接線 ---


def test_opencode_preset_marks_responses_models():
    """OpenCode Go preset 標記 /v1/responses 相容模型"""
    assert get_preset("opencode") is not None
    assert preset_model_protocol("opencode", "muse-spark-1.2-contributor") == "responses"
    assert preset_model_protocol("opencode", "grok-4.6") == "responses"
    assert preset_model_protocol("opencode", "gpt-5.6-luna") == "responses"
    # chat/completions 相容模型沒有 protocol 標記
    assert preset_model_protocol("opencode", "deepseek-v4-flash") is None
    assert preset_model_protocol("opencode", "no-such-model") is None
