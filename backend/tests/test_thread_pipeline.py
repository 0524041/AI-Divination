"""
六爻 SSE 解盤管線測試（Ticket 04，Seam① HTTP API）
"""

import json
from contextlib import asynccontextmanager

import httpx
import pytest

from app.core.database import SessionLocal
from app.models import AIRequestLog, History, SystemAIEndpoint, ThreadMessage
from app.services import thread_pipeline
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
        endpoint = (
            db.query(SystemAIEndpoint).filter(SystemAIEndpoint.is_default).first()
        )
        if endpoint is None:
            from app.services.endpoints import ensure_default_seed

            endpoint = ensure_default_seed(db)
        endpoint.base_url = fake_ai.base_url
        endpoint.model = "fake-model"
        endpoint.api_key_encrypted = encrypt_api_key("sk-test")
        db.commit()
        return endpoint.id


def _sample_chart():
    return {
        "time": "2026-08-25 12:00:00",
        "bazi": "丙午年 丙申月 辛未日 甲午時",
        "kongwang": "戌亥",
        "guashen": "兌",
        "benguaming": "澤山咸",
        "bianguaming": "無變卦",
        "gua_type": "六世卦",
        "shensha": [{"name": "驛馬", "zhi": ["寅"]}],
        "yaogua": [3, 3, 2, 2, 3, 3],
        "yao_1": {
            "liushen": "玄武",
            "origin": {
                "relative": "父母",
                "zhi": "辰",
                "wuxing": "土",
                "line": "▅▅　▅▅",
                "is_subject": False,
                "is_object": False,
                "is_changed": False,
            },
        },
        "yao_6": {
            "liushen": "白虎",
            "origin": {
                "relative": "父母",
                "zhi": "未",
                "wuxing": "土",
                "line": "▅▅　▅▅",
                "is_subject": False,
                "is_object": True,
                "is_changed": False,
            },
        },
    }


def _record_id_of(user_id: int) -> int:
    with SessionLocal() as db:
        record = History(
            user_id=user_id,
            divination_type="liuyao",
            question="測問事業",
            gender="male",
            target="self",
            chart_data=json.dumps(_sample_chart(), ensure_ascii=False),
            status="pending",
            ai_provider="default",
        )
        db.add(record)
        db.commit()
        return record.id


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


async def _create_record(client, headers, question="測財運") -> int:
    response = await client.post(
        "/api/liuyao",
        json={"question": question, "mode": "thread"},
        headers=headers,
    )
    assert response.status_code == 200
    return response.json()["id"]


# --- 建立紀錄：thread 模式立即返回 ---


async def test_thread_mode_returns_chart_immediately(make_user, auth_headers):
    user = make_user(username="thread-create-user")
    headers = auth_headers(user.username)

    async with api_client() as client:
        response = await client.post(
            "/api/liuyao",
            json={
                "question": "近期工作運如何？",
                "gender": "male",
                "target": "self",
                "mode": "thread",
            },
            headers=headers,
        )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "pending"
    assert len(body["coins"]) == 6
    assert body["chart_data"]["benguaming"]

    with SessionLocal() as db:
        record = db.query(History).filter(History.id == body["id"]).first()
        assert record.interpretation is None


# --- 串流 happy path ---


async def test_stream_full_cycle(make_user, auth_headers, fake_ai):
    """meta→delta*→done；訊息恰持久化一次；interpretation 同步；用量記帳"""
    user = make_user(username="stream-cycle-user")
    headers = auth_headers(user.username)
    endpoint_id = _seed_default_pointing_to(fake_ai)
    token = headers["Authorization"].removeprefix("Bearer ")

    async with api_client() as client:
        record_id = await _create_record(client, headers)

        fake_ai.respond_stream_items(
            [("thinking", "先看世爻"), ("text", "# 解盤"), ("text", "\n結論吉。")]
        )
        fake_ai.stream_usage = {"prompt_tokens": 210, "completion_tokens": 33}

        async with client.stream(
            "GET", f"/api/records/{record_id}/stream?token={token}"
        ) as response:
            assert response.status_code == 200
            raw = b""
            async for chunk in response.aiter_bytes():
                raw += chunk
        events = _parse_sse_events(raw.decode("utf-8"))

    names = [name for name, _ in events]
    assert names[0] == "meta"
    assert names[-1] == "done"
    assert "error" not in names

    deltas = [data for name, data in events if name == "delta"]
    assert [d["text"] for d in deltas] == ["先看世爻", "# 解盤", "\n結論吉。"]
    assert deltas[0]["type"] == "thinking"

    done = events[-1][1]
    assert done["content"] == "# 解盤\n結論吉。"
    assert done["think"] == "先看世爻"
    assert done["prompt_tokens"] == 210
    assert done["message_id"] > 0

    with SessionLocal() as db:
        messages = (
            db.query(ThreadMessage).filter(ThreadMessage.record_id == record_id).all()
        )
        assert len(messages) == 1
        assert messages[0].content == "# 解盤\n結論吉。"
        assert messages[0].think == "先看世爻"
        assert messages[0].completion_tokens == 33

        record = db.query(History).filter(History.id == record_id).first()
        assert record.status == "completed"
        assert record.interpretation.startswith("<think>先看世爻</think>")

        logs = db.query(AIRequestLog).filter_by(endpoint_id=endpoint_id).all()
        assert len(logs) == 1
        assert logs[0].ok is True
        assert logs[0].completion_tokens == 33

    # 已完成紀錄再開串流 → 拒絕
    async with api_client() as client:
        second = await client.get(
            f"/api/records/{record_id}/stream?token={token}"
        )
    assert second.status_code == 409 or "already_completed" in second.text


# --- 心跳 ---


async def test_stream_emits_heartbeat_when_idle(make_user, auth_headers, fake_ai):
    user = make_user(username="heartbeat-user")
    headers = auth_headers(user.username)
    _seed_default_pointing_to(fake_ai)
    token = headers["Authorization"].removeprefix("Bearer ")

    async with api_client() as client:
        record_id = await _create_record(client, headers, "測心跳")

        fake_ai.respond_stream(["晚到的一句"])
        fake_ai.stream_delay = 0.3

        async with client.stream(
            "GET", f"/api/records/{record_id}/stream?token={token}&heartbeat=0.05"
        ) as response:
            raw = b""
            async for chunk in response.aiter_bytes():
                raw += chunk

    events = _parse_sse_events(raw.decode("utf-8"))
    assert ("ping", None) in events
    assert events[-1][0] == "done"


# --- 錯誤路徑 ---


async def test_stream_upstream_error_marks_record(make_user, auth_headers, fake_ai):
    user = make_user(username="err-path-user")
    headers = auth_headers(user.username)
    endpoint_id = _seed_default_pointing_to(fake_ai)
    token = headers["Authorization"].removeprefix("Bearer ")

    async with api_client() as client:
        record_id = await _create_record(client, headers, "測錯誤")
        fake_ai.respond_error(429, message="quota exhausted")

        text_response = await client.get(
            f"/api/records/{record_id}/stream?token={token}"
        )
        # 錯誤仍在 200 串流內以 error 事件傳達
        assert text_response.status_code == 200
        events = _parse_sse_events(text_response.text)

    assert events[-1][0] == "error"
    assert events[-1][1]["kind"] == "quota"

    with SessionLocal() as db:
        record = db.query(History).filter(History.id == record_id).first()
        assert record.status == "error"
        log = db.query(AIRequestLog).filter_by(endpoint_id=endpoint_id).first()
        assert log.ok is False
        assert log.error_kind == "quota"


# --- 擁有權、認證、併發守衛 ---


async def test_stream_other_users_record_rejected(make_user, auth_headers):
    owner = make_user(username="owner-user")
    stranger = make_user(username="stranger-user")
    owner_headers = auth_headers(owner.username)
    stranger_token = auth_headers(stranger.username)["Authorization"].removeprefix(
        "Bearer "
    )

    async with api_client() as client:
        created = await client.post(
            "/api/liuyao",
            json={"question": "私人問題", "mode": "thread"},
            headers=owner_headers,
        )
        record_id = created.json()["id"]

        response = await client.get(
            f"/api/records/{record_id}/stream?token={stranger_token}"
        )
    assert response.status_code == 404


async def test_stream_requires_valid_token():
    async with api_client() as client:
        response = await client.get("/api/records/999/stream?token=bad-token")
    assert response.status_code == 401


async def test_concurrent_second_stream_conflict(make_user, auth_headers, fake_ai):
    user = make_user(username="conflict-user")
    headers = auth_headers(user.username)
    _seed_default_pointing_to(fake_ai)
    token = headers["Authorization"].removeprefix("Bearer ")

    async with api_client() as client:
        record_id = await _create_record(client, headers, "併發測試")

    thread_pipeline._active_streams.add(record_id)
    try:
        async with api_client() as client:
            response = await client.get(
                f"/api/records/{record_id}/stream?token={token}"
            )
        assert response.status_code == 409
    finally:
        thread_pipeline._active_streams.discard(record_id)


# --- 未接入類型明確報錯（Ticket 05 擴充前） ---


async def test_non_liuyao_type_reports_not_implemented(
    make_user, auth_headers, fake_ai
):
    user = make_user(username="legacy-type-user")
    headers = auth_headers(user.username)
    _seed_default_pointing_to(fake_ai)
    token = headers["Authorization"].removeprefix("Bearer ")

    with SessionLocal() as db:
        record = History(
            user_id=user.id,
            divination_type="ziwei",
            question="q",
            chart_data="{}",
            status="pending",
        )
        db.add(record)
        db.commit()
        record_id = record.id

    async with api_client() as client:
        response = await client.get(
            f"/api/records/{record_id}/stream?token={token}"
        )
        events = _parse_sse_events(response.text)

    assert events[-1] == (
        "error",
        {"kind": "upstream", "message": "類型 ziwei 尚未接入新管線"},
    )
