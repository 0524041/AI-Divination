"""
OpenCode Go x-opencode-session header 迴歸測試

OpenCode Go（2026-09-06 起）要求每個請求帶 x-opencode-session
（一個對話一個穩定 ID），缺失會直接 error。本檔鎖定：

- 串流請求（chat / responses 兩種協定）帶上會話 ID
- 同一對話（thread-{record_id}）全程同一值
- 模型探測（probe_models / test_connection）無會話時用固定探測值
- 未設 session_id 時不送 header（其他供應商行為不變）
"""

import pytest

from app.services.ai_probe import test_connection as probe_connection
from app.services.ai_provider import (
    OPENCODE_PROBE_SESSION_ID,
    OPENCODE_SESSION_HEADER,
    OpenAICompatProvider,
    session_headers,
)
from app.services.endpoints import ResolvedEndpoint, probe_models

HEADER = OPENCODE_SESSION_HEADER.lower()  # 假伺服器記錄的 header key 為小寫
SESSION = "thread-42"


def test_session_headers_helper():
    assert session_headers(SESSION) == {OPENCODE_SESSION_HEADER: SESSION}
    assert session_headers(None) == {}
    assert session_headers("") == {}


@pytest.mark.asyncio
async def test_stream_sends_session_header(fake_ai):
    """chat/completions 串流帶上會話 header"""
    fake_ai.respond_stream(["好"])
    provider = OpenAICompatProvider(
        base_url=fake_ai.base_url,
        api_key="sk-test",
        model="fake-model",
        session_id=SESSION,
    )
    try:
        deltas = [d async for d in provider.stream_messages([{"role": "user", "content": "?"}])]
    finally:
        await provider.aclose()

    assert [d["text"] for d in deltas] == ["好"]
    assert fake_ai.last_request["headers"][HEADER] == SESSION


@pytest.mark.asyncio
async def test_stream_sends_session_header_responses_protocol(fake_ai):
    """/v1/responses 協定同樣帶上會話 header"""
    fake_ai.respond_stream(["答"])
    provider = OpenAICompatProvider(
        base_url=fake_ai.base_url,
        api_key="sk-test",
        model="fake-model",
        protocol="responses",
        session_id=SESSION,
    )
    try:
        deltas = [d async for d in provider.stream_messages([{"role": "user", "content": "?"}])]
    finally:
        await provider.aclose()

    assert [d["text"] for d in deltas] == ["答"]
    assert fake_ai.last_request["headers"][HEADER] == SESSION


@pytest.mark.asyncio
async def test_no_session_sends_no_header(fake_ai):
    """未設 session_id 時不送 header（其他供應商行為不變）"""
    fake_ai.respond_stream(["好"])
    provider = OpenAICompatProvider(
        base_url=fake_ai.base_url, api_key="sk-test", model="fake-model"
    )
    try:
        await provider.stream_messages([{"role": "user", "content": "?"}]).__anext__()
    except StopAsyncIteration:
        pass
    finally:
        await provider.aclose()

    assert HEADER not in fake_ai.last_request["headers"]


@pytest.mark.asyncio
async def test_make_provider_passes_session_id(fake_ai):
    """ResolvedEndpoint.make_provider 透傳 session_id（管線傳 thread-{record_id}）"""
    fake_ai.respond_stream(["好"])
    resolved = ResolvedEndpoint(
        endpoint_id=None,
        name="t",
        base_url=fake_ai.base_url,
        api_key="k",
        model="m",
        source="user",
    )
    provider = resolved.make_provider(session_id="thread-7")
    try:
        [d async for d in provider.stream_messages([{"role": "user", "content": "?"}])]
    finally:
        await provider.aclose()

    assert provider.session_id == "thread-7"
    assert fake_ai.last_request["headers"][HEADER] == "thread-7"


def test_probe_models_sends_session_header(fake_ai):
    """同步模型探測帶上會話 header"""
    models = probe_models(f"{fake_ai.base_url}/v1", "sk-test", session_id="thread-9")

    assert models == ["fake-model"]
    assert fake_ai.last_request["headers"][HEADER] == "thread-9"


def test_probe_models_uses_probe_fallback_without_session(fake_ai):
    """探測無會話時用固定探測值（非對話請求不斷線）"""
    probe_models(f"{fake_ai.base_url}/v1", "sk-test")

    assert fake_ai.last_request["headers"][HEADER] == OPENCODE_PROBE_SESSION_ID


@pytest.mark.asyncio
async def test_test_connection_sends_session_header(fake_ai):
    """非同步連線測試帶上會話 header"""
    result = await probe_connection(fake_ai.base_url, session_id="thread-11")

    assert result["success"] is True
    assert fake_ai.last_request["headers"][HEADER] == "thread-11"


@pytest.mark.asyncio
async def test_test_connection_uses_probe_fallback_without_session(fake_ai):
    """連線測試無會話時用固定探測值"""
    result = await probe_connection(fake_ai.base_url)

    assert result["success"] is True
    assert fake_ai.last_request["headers"][HEADER] == OPENCODE_PROBE_SESSION_ID
