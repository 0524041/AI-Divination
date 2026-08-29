"""
紀錄綁定測試（spec: ai-model-selection）

模型選擇綁定在占卜紀錄上：首解 stream 請求帶 (connection_id, model_id) →
寫入 history；追問/重試沿用；追問可帶新參數切換（同步綁定）。
"""

import json
from contextlib import asynccontextmanager

import httpx
import pytest

from app.core.database import SessionLocal
from app.models import History, SystemAIEndpoint
from app.services.endpoints import ensure_default_seed
from app.utils.auth import encrypt_api_key

pytestmark = pytest.mark.asyncio


@asynccontextmanager
async def api_client():
    from app.main import app

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(
        transport=transport, base_url="http://testserver"
    ) as client:
        yield client


def _seed_default_pointing_to(fake_ai) -> int:
    with SessionLocal() as db:
        ensure_default_seed(db)
        endpoint = (
            db.query(SystemAIEndpoint).filter(SystemAIEndpoint.is_default).first()
        )
        endpoint.base_url = fake_ai.base_url
        endpoint.model = "fake-model"
        endpoint.default_model = "fake-model"
        endpoint.set_models_list([{"id": "fake-model", "enabled": True}])
        endpoint.api_key_encrypted = encrypt_api_key("sk-test")
        db.commit()
        return endpoint.id


def _make_connection(user_id: int, fake_ai) -> int:
    from app.models import AIConfig

    with SessionLocal() as db:
        config = AIConfig(
            user_id=user_id,
            name="我的服務",
            base_url=fake_ai.base_url,
            api_key_encrypted=encrypt_api_key("sk-user"),
            preset_id="openai",
            models=json.dumps([{"id": "m-fast", "enabled": True}]),
        )
        db.add(config)
        db.commit()
        db.refresh(config)
        return config.id


def _parse_sse_events(text: str) -> list[tuple[str, dict | None]]:
    events: list[tuple[str, dict | None]] = []
    current_event = None
    for line in text.splitlines():
        if line.startswith(": "):
            events.append(("ping", None))
        elif line.startswith("event: "):
            current_event = line.removeprefix("event: ").strip()
        elif line.startswith("data: ") and current_event:
            events.append((current_event, json.loads(line.removeprefix("data: "))))
            current_event = None
    return events


async def _stream_all(client, record_id: int, token: str, extra_query: str = ""):
    async with client.stream(
        "GET", f"/api/records/{record_id}/stream?token={token}{extra_query}"
    ) as response:
        assert response.status_code == 200
        raw = b""
        async for chunk in response.aiter_bytes():
            raw += chunk
    return _parse_sse_events(raw.decode("utf-8"))


def _record_of(record_id: int) -> tuple:
    """回傳 (id, ai_connection_id, ai_model, ai_provider)（session 內取值避免 detached）"""
    with SessionLocal() as db:
        record = db.query(History).filter(History.id == record_id).first()
        return (
            record.id,
            record.ai_connection_id,
            record.ai_model,
            record.ai_provider,
        )


async def _create_record(client, headers, question="測財運") -> int:
    response = await client.post(
        "/api/liuyao",
        json={"question": question, "mode": "thread"},
        headers=headers,
    )
    assert response.status_code == 200
    return response.json()["id"]


async def test_stream_with_connection_binding_persists_selection(
    make_user, auth_headers, fake_ai
):
    """首解帶 connection_id+model_id → 使用該連線並寫入紀錄綁定"""
    user = make_user(username="binding-stream-user")
    headers = auth_headers(user.username)
    _seed_default_pointing_to(fake_ai)
    connection_id = _make_connection(user.id, fake_ai)
    token = headers["Authorization"].removeprefix("Bearer ")

    async with api_client() as client:
        record_id = await _create_record(client, headers)
        fake_ai.respond_stream(["綁定連線解盤"])

        events = await _stream_all(
            client, record_id, token, f"&connection_id={connection_id}&model_id=m-fast"
        )

    assert "error" not in [name for name, _ in events]
    assert events[-1][0] == "done"

    rid, cid, model, provider = _record_of(record_id)
    assert cid == connection_id
    assert model == "m-fast"
    assert provider == "default"
    # 實際送出的請求使用綁定連線的 key 與模型
    last = fake_ai.requests[-1]
    assert last["body"]["model"] == "m-fast"
    assert last["headers"]["authorization"] == "Bearer sk-user"


async def test_stream_without_params_uses_and_records_system_default(
    make_user, auth_headers, fake_ai
):
    user = make_user(username="binding-system-user")
    headers = auth_headers(user.username)
    _seed_default_pointing_to(fake_ai)
    token = headers["Authorization"].removeprefix("Bearer ")

    async with api_client() as client:
        record_id = await _create_record(client, headers)
        fake_ai.respond_stream(["系統預設解盤"])

        events = await _stream_all(client, record_id, token)

    assert events[-1][0] == "done"
    rid, cid, model, provider = _record_of(record_id)
    assert cid is None
    assert model == "fake-model"
    assert provider == "default"


async def test_stream_invalid_model_reports_error(
    make_user, auth_headers, fake_ai
):
    user = make_user(username="binding-invalid-user")
    headers = auth_headers(user.username)
    _seed_default_pointing_to(fake_ai)
    connection_id = _make_connection(user.id, fake_ai)
    token = headers["Authorization"].removeprefix("Bearer ")

    async with api_client() as client:
        record_id = await _create_record(client, headers)
        fake_ai.respond_stream(["不該出現"])

        events = await _stream_all(
            client, record_id, token, f"&connection_id={connection_id}&model_id=nope"
        )

    errors = [data for name, data in events if name == "error"]
    assert errors and errors[0]["kind"] == "invalid_model"
    assert events[-1][0] != "done"


async def test_followup_reuses_record_binding_and_can_switch(
    make_user, auth_headers, fake_ai
):
    """追問沿用綁定；帶新參數可切換（並同步綁定）"""
    user = make_user(username="binding-followup-user")
    headers = auth_headers(user.username)
    _seed_default_pointing_to(fake_ai)
    connection_id = _make_connection(user.id, fake_ai)
    token = headers["Authorization"].removeprefix("Bearer ")

    async with api_client() as client:
        record_id = await _create_record(client, headers)

        # 首解：使用者連線
        fake_ai.respond_stream(["首解"])
        events = await _stream_all(
            client, record_id, token, f"&connection_id={connection_id}&model_id=m-fast"
        )
        assert events[-1][0] == "done"

        # 追問不帶參數 → 沿用綁定
        fake_ai.respond_stream(["追問一"])
        response = await client.post(
            f"/api/records/{record_id}/followup?token={token}",
            json={"question": "再詳細一點"},
        )
        assert response.status_code == 200
        raw = b""
        async for chunk in response.aiter_bytes():
            raw += chunk
        assert _parse_sse_events(raw.decode())[-1][0] == "done"
        assert fake_ai.requests[-1]["body"]["model"] == "m-fast"

        # 追問帶 connection_id=system → 切回系統預設並同步綁定
        fake_ai.respond_stream(["追問二"])
        response = await client.post(
            f"/api/records/{record_id}/followup?token={token}",
            json={
                "question": "換系統模型回答",
                "connection_id": "system",
                "model_id": "fake-model",
            },
        )
        assert response.status_code == 200
        raw = b""
        async for chunk in response.aiter_bytes():
            raw += chunk
        assert _parse_sse_events(raw.decode())[-1][0] == "done"
        assert fake_ai.requests[-1]["body"]["model"] == "fake-model"

    rid, cid, model, _provider = _record_of(record_id)
    assert cid is None
    assert model == "fake-model"
