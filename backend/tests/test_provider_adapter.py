"""
Provider adapter 測試（Seam②：假 OpenAI-compatible 伺服器）

驗證統一 AI Provider 的外部行為：請求形狀、串流解析與分流、
錯誤映射、token 用量擷取。
"""

import httpx
import pytest

from app.services.ai_provider import (
    REQUEST_TEMPERATURE,
    THINKING_LEVEL,
    AIProviderError,
    OpenAICompatProvider,
    completions_url,
    effort_label,
)

pytestmark = pytest.mark.asyncio


def _provider(fake_ai, timeout: float = 30.0) -> OpenAICompatProvider:
    return OpenAICompatProvider(
        base_url=fake_ai.base_url,
        api_key="sk-test-key",
        model="fake-model",
        timeout_seconds=timeout,
    )


async def _collect(provider: OpenAICompatProvider, messages=None) -> list[dict]:
    deltas = []
    async for delta in provider.stream_messages(
        messages or [{"role": "user", "content": "解盤"}]
    ):
        deltas.append(delta)
    return deltas


# --- 請求形狀 ---


async def test_request_shape_matches_openai_contract(fake_ai):
    """請求形狀：model/messages/串流/固定參數/auth header"""
    fake_ai.respond_stream(["ok"])

    await _collect(_provider(fake_ai))

    request = fake_ai.last_request
    assert request["path"] == "/v1/chat/completions"
    assert request["headers"]["authorization"] == "Bearer sk-test-key"
    body = request["body"]
    assert body["model"] == "fake-model"
    assert body["messages"] == [{"role": "user", "content": "解盤"}]
    assert body["stream"] is True
    # 溫度與思考程度為固定常數 0.9，思考以字串列舉送出
    assert body["temperature"] == REQUEST_TEMPERATURE == 0.9
    assert body["reasoning_effort"] == effort_label(THINKING_LEVEL) == "high"


# --- 串流解析 ---


async def test_stream_text_deltas_in_order_and_done(fake_ai):
    """純文字 delta 依序聚合，正常結束"""
    fake_ai.respond_stream(["甲", "乙", "丙"])

    deltas = await _collect(_provider(fake_ai))

    assert [d["text"] for d in deltas] == ["甲", "乙", "丙"]
    assert all(d["type"] == "text" for d in deltas)


async def test_stream_thinking_and_text_split(fake_ai):
    """reasoning_content→thinking 事件、content→text 事件 分流"""
    fake_ai.respond_stream_items(
        [("thinking", "推理第一步"), ("text", "結論"), ("thinking", "補充"), ("text", "。")]
    )

    deltas = await _collect(_provider(fake_ai))

    assert deltas == [
        {"type": "thinking", "text": "推理第一步"},
        {"type": "text", "text": "結論"},
        {"type": "thinking", "text": "補充"},
        {"type": "text", "text": "。"},
    ]


async def test_stream_usage_captured_from_final_chunk(fake_ai):
    """上游回傳 usage 時擷取 token 統計"""
    fake_ai.respond_stream(["答案"])
    fake_ai.stream_usage = {"prompt_tokens": 120, "completion_tokens": 45}

    provider = _provider(fake_ai)
    await _collect(provider)

    assert provider.last_usage is not None
    assert provider.last_usage.prompt_tokens == 120
    assert provider.last_usage.completion_tokens == 45


async def test_empty_delta_lines_tolerated(fake_ai):
    """空行與非資料行被容錯略過（不影響聚合）"""
    fake_ai.respond_stream(["x"])
    deltas = await _collect(_provider(fake_ai))
    assert len(deltas) == 1


# --- 錯誤映射 ---


@pytest.mark.parametrize(
    ("status_code", "expected_kind"),
    [(401, "auth"), (403, "auth"), (429, "quota"), (500, "upstream"), (503, "upstream")],
)
async def test_http_errors_mapped_to_kinds(fake_ai, status_code, expected_kind):
    """HTTP 錯誤映射到語意化類別"""
    fake_ai.respond_error(status_code, message="injected")

    with pytest.raises(AIProviderError) as exc_info:
        await _collect(_provider(fake_ai))

    assert exc_info.value.kind == expected_kind
    assert exc_info.value.status_code == status_code


async def test_timeout_maps_to_kind_timeout(fake_ai):
    """逾時映射到 timeout 類別（伺服器延遲超過客戶端逾時）"""
    fake_ai.respond_stream(["slow"])
    fake_ai.stream_delay = 1.0

    provider = OpenAICompatProvider(
        base_url=fake_ai.base_url,
        api_key="k",
        model="m",
        timeout_seconds=0.2,
    )
    with pytest.raises(AIProviderError) as exc_info:
        await _collect(provider)
    assert exc_info.value.kind == "timeout"


async def test_non_stream_response_rejected_as_upstream(fake_ai):
    """200 但非 event-stream（如誤設的單發端點）→ upstream 錯誤，不得靜默空輸出"""
    fake_ai.mode = "json"  # 預設單發 JSON，未開串流

    with pytest.raises(AIProviderError) as exc_info:
        await _collect(_provider(fake_ai))

    assert exc_info.value.kind == "upstream"
    assert "application/json" in str(exc_info.value)


# --- URL 正規化與參數常數 ---


def test_completions_url_normalization():
    """/v1 有無皆可組出正確位址"""
    assert (
        completions_url("https://api.example.com/v1/")
        == "https://api.example.com/v1/chat/completions"
    )
    assert (
        completions_url("https://api.example.com")
        == "https://api.example.com/v1/chat/completions"
    )


def test_effort_label_boundaries():
    """思考程度映射邊界"""
    assert effort_label(0.0) == "low"
    assert effort_label(0.33) == "low"
    assert effort_label(0.34) == "medium"
    assert effort_label(0.66) == "medium"
    assert effort_label(0.67) == "high"
    assert effort_label(0.9) == "high"


async def test_provider_accepts_injected_client(fake_ai):
    """客戶端可注入（供未來連線池共用）"""
    fake_ai.respond_stream(["ok"])
    injected = httpx.AsyncClient(timeout=10.0)
    provider = OpenAICompatProvider(
        base_url=fake_ai.base_url,
        api_key="k",
        model="m",
        client=injected,
    )
    try:
        deltas = await _collect(provider)
        assert deltas[0]["type"] == "text"
    finally:
        await injected.aclose()
