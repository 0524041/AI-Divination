"""
追問、中止、重試與訪客限額測試（Ticket 06）
"""

import json
from contextlib import asynccontextmanager

import httpx
import pytest

from app.core.database import SessionLocal
from app.models import AIRequestLog, History, ThreadMessage, User
from app.services.thread_pipeline import (
    GUEST_DAILY_MESSAGE_LIMIT,
    QuotaExceeded,
    build_followup_messages,
    enforce_guest_quota,
)
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


def _seed_default(fake_ai):
    from app.services.endpoints import ensure_default_seed

    with SessionLocal() as db:
        endpoint = ensure_default_seed(db)
        endpoint.base_url = fake_ai.base_url
        endpoint.model = "fake-model"
        endpoint.api_key_encrypted = encrypt_api_key("sk-test")
        db.commit()


def _parse_events(text: str):
    events = []
    current = None
    for line in text.splitlines():
        if line.startswith(": "):
            events.append(("ping", None))
        elif line.startswith("event: "):
            current = line.removeprefix("event: ").strip()
        elif line.startswith("data: ") and current:
            events.append((current, json.loads(line.removeprefix("data: "))))
            current = None
    return events


def _make_completed_record(user_id: int) -> int:
    """直接建立已完成首解的紀錄＋訊息（跳過串流）"""
    with SessionLocal() as db:
        record = History(
            user_id=user_id,
            divination_type="liuyao",
            question="原始問題：事業",
            gender="male",
            chart_data=json.dumps({"benguaming": "澤山咸"}),
            status="completed",
            ai_provider="default",
            interpretation="【先前的解盤】世爻旺相，事業可成。",
        )
        db.add(record)
        db.commit()
        db.refresh(record)
        record_id = record.id

        db.add(
            ThreadMessage(
                record_id=record_id,
                role="assistant",
                content="【先前的解盤】世爻旺相，事業可成。",
            )
        )
        db.commit()
    return record_id


# --- 追問上下文 ---


async def test_followup_context_includes_history_and_question(fake_ai, make_user):
    _seed_default(fake_ai)
    user = make_user(username="ctx-user", role="user")
    record_id = _make_completed_record(user.id)

    with SessionLocal() as db:
        record = db.query(History).filter(History.id == record_id).first()
        _, messages = build_followup_messages(record, "那下個月呢？")

    roles = [m["role"] for m in messages]
    assert roles[0] == "system"
    assert roles[-1] == "user"
    assert messages[-1]["content"] == "那下個月呢？"
    # 解盤錨點在問題之前
    assert any("【先前的解盤】" in m["content"] for m in messages[:-1])


async def test_followup_window_truncates_old_messages(fake_ai, make_user):
    """超過滑窗的舊訊息被截斷；解盤錨點與新問題保留"""
    from app.services.thread_pipeline import FOLLOWUP_HISTORY_WINDOW

    user = make_user(username="window-user")
    with SessionLocal() as db:
        record = History(
            user_id=user.id,
            divination_type="liuyao",
            question="q",
            chart_data="{}",
            status="completed",
            interpretation="解盤",
        )
        db.add(record)
        db.commit()
        db.refresh(record)

        db.add(ThreadMessage(record_id=record.id, role="assistant", content="解盤"))
        for i in range(FOLLOWUP_HISTORY_WINDOW + 6):
            db.add(ThreadMessage(record_id=record.id, role="user", content=f"舊問題{i}"))
            db.add(ThreadMessage(record_id=record.id, role="assistant", content=f"舊回應{i}"))
        db.commit()
        rid = record.id

    with SessionLocal() as db:
        record = db.query(History).filter(History.id == rid).first()
        _, messages = build_followup_messages(record, "最新追問")

    # system + 滑窗 + 錨點 + 新問題
    assert len(messages) <= FOLLOWUP_HISTORY_WINDOW + 3
    assert "舊問題0" not in str(messages)


# --- 追問 E2E ---


async def test_followup_e2e_persists_and_streams(make_user, auth_headers, fake_ai):
    _seed_default(fake_ai)
    user = make_user(username="followup-e2e-user")
    headers = auth_headers(user.username)
    token = headers["Authorization"].removeprefix("Bearer ")
    record_id = _make_completed_record(user.id)

    fake_ai.respond_stream_items([("thinking", "查流月"), ("text", "下個月轉強。")])

    async with api_client() as client:
        response = await client.post(
            f"/api/records/{record_id}/followup?token={token}",
            json={"question": "那下個月呢？"},
        )

    assert response.status_code == 200
    events = _parse_events(response.text)
    assert [n for n, _ in events][-1] == "done"
    done = dict(events)["done"]
    assert done["content"] == "下個月轉強。"

    with SessionLocal() as db:
        msgs = (
            db.query(ThreadMessage)
            .filter(ThreadMessage.record_id == record_id)
            .order_by(ThreadMessage.id)
            .all()
        )
        assert [m.role for m in msgs] == ["assistant", "user", "assistant"]
        assert msgs[1].content == "那下個月呢？"
        assert msgs[2].content == "下個月轉強。"
        # 追問不覆寫首解欄位
        record = db.query(History).filter(History.id == record_id).first()
        assert record.interpretation == "【先前的解盤】世爻旺相，事業可成。"


async def test_followup_quota_blocks_guest_at_limit(make_user, auth_headers, fake_ai):
    """訪客第 11 則 AI 回應被拒（429＋kind=quota_exceeded）；登入者不受限"""
    _seed_default(fake_ai)
    guest = make_user(username="quota-guest", role="guest")
    headers = auth_headers(guest.username)
    token = headers["Authorization"].removeprefix("Bearer ")
    record_id = _make_completed_record(guest.id)

    # 預先灌滿今日額度
    with SessionLocal() as db:
        for _ in range(GUEST_DAILY_MESSAGE_LIMIT):
            db.add(
                AIRequestLog(
                    user_id=guest.id,
                    model="fake-model",
                    ok=True,
                    created_at=__import__("datetime").datetime.utcnow(),
                )
            )
        db.commit()

    async with api_client() as client:
        response = await client.post(
            f"/api/records/{record_id}/followup?token={token}",
            json={"question": "還能問嗎？"},
        )

    assert response.status_code == 429
    detail = response.json()["detail"]
    assert detail["kind"] == "quota_exceeded"


async def test_logged_in_user_has_no_limit(make_user, auth_headers, fake_ai):
    user = make_user(username="nolog-limit-user", role="user")
    with SessionLocal() as db:
        db_user = db.query(User).filter(User.id == user.id).first()
        try:
            for _ in range(GUEST_DAILY_MESSAGE_LIMIT + 5):
                enforce_guest_quota(db, db_user)
        except QuotaExceeded:
            pytest.fail("登入使用者不應受限")


async def test_quota_endpoint_reports_remaining(make_user, auth_headers):
    guest = make_user(username="quota-status-user", role="guest")
    headers = auth_headers(guest.username)
    token = headers["Authorization"].removeprefix("Bearer ")

    async with api_client() as client:
        response = await client.get(f"/api/records/quota?token={token}")

    body = response.json()
    assert body == {"limited": True, "used": 0, "remaining": GUEST_DAILY_MESSAGE_LIMIT, "limit": GUEST_DAILY_MESSAGE_LIMIT}


# --- 重試（替換語意） ---


async def test_retry_replaces_last_assistant_message(make_user, auth_headers, fake_ai):
    _seed_default(fake_ai)
    user = make_user(username="retry-user")
    headers = auth_headers(user.username)
    token = headers["Authorization"].removeprefix("Bearer ")
    record_id = _make_completed_record(user.id)

    # 加一輪追問歷史
    with SessionLocal() as db:
        db.add(ThreadMessage(record_id=record_id, role="user", content="細說世爻"))
        db.add(ThreadMessage(record_id=record_id, role="assistant", content="舊的回答"))
        db.commit()

    fake_ai.respond_stream(["新的回答"])

    async with api_client() as client:
        response = await client.post(f"/api/records/{record_id}/retry?token={token}")

    assert response.status_code == 200
    events = _parse_events(response.text)
    assert events[-1][0] == "done"

    with SessionLocal() as db:
        msgs = (
            db.query(ThreadMessage)
            .filter(ThreadMessage.record_id == record_id)
            .order_by(ThreadMessage.id)
            .all()
        )
        contents = [m.content for m in msgs]
        assert "舊的回答" not in contents
        assert contents[-1] == "新的回答"  # 替換而非追加


async def test_retry_without_assistant_rejected(make_user, auth_headers, fake_ai):
    _seed_default(fake_ai)
    user = make_user(username="retry-empty-user")
    headers = auth_headers(user.username)
    token = headers["Authorization"].removeprefix("Bearer ")

    with SessionLocal() as db:
        record = History(
            user_id=user.id,
            divination_type="liuyao",
            question="q",
            chart_data="{}",
            status="pending",
        )
        db.add(record)
        db.commit()
        db.refresh(record)
        record_id = record.id

    async with api_client() as client:
        response = await client.post(f"/api/records/{record_id}/retry?token={token}")

    events = _parse_events(response.text)
    assert events[-1][0] == "error"
    assert events[-1][1]["kind"] == "invalid_state"


async def test_other_users_record_rejected_on_followup(make_user, auth_headers):
    owner = make_user(username="f-owner")
    stranger = make_user(username="f-stranger")
    stranger_token = auth_headers(stranger.username)["Authorization"].removeprefix("Bearer ")
    record_id = _make_completed_record(owner.id)

    async with api_client() as client:
        response = await client.post(
            f"/api/records/{record_id}/followup?token={stranger_token}",
            json={"question": "偷看"},
        )
    assert response.status_code == 404
