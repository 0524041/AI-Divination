"""
三類型演算與 Prompt 統一測試（Ticket 05）
"""

import json
from contextlib import asynccontextmanager

import httpx
import pytest

from app.core.database import SessionLocal
from app.models import History, ThreadMessage
from app.services.prompts import (
    build_tarot_messages,
    build_ziwei_messages,
    format_tarot_cards_compact,
    validate_ziwei_chart,
)
from app.services.tarot_draw import DECK, SPREAD_SIZES, draw_cards, validate_cards

pytestmark = pytest.mark.asyncio


@asynccontextmanager
async def api_client():
    from app.main import app

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(
        transport=transport, base_url="http://testserver"
    ) as client:
        yield client


# --- 塔羅抽牌演算法 ---


def test_deck_is_standard_78_unique():
    assert len(DECK) == 78
    assert len({c["id"] for c in DECK}) == 78
    names = {c["name_cn"] for c in DECK}
    assert "愚者" in names and "錢幣國王" in names


@pytest.mark.parametrize("spread", ["single", "three_card", "celtic_cross"])
def test_draw_shape_and_no_duplicates(spread):
    cards = draw_cards(spread)
    assert len(cards) == SPREAD_SIZES[spread]
    assert len({c["id"] for c in cards}) == len(cards)
    for card in cards:
        assert isinstance(card["reversed"], bool)
        assert card["position"]


def test_draw_reversed_distribution_roughly_balanced():
    draws = [draw_cards("three_card") for _ in range(60)]
    reversed_count = sum(
        1 for hand in draws for card in hand if card["reversed"]
    )
    total = 60 * 3
    # 大約一半；寬鬆區間避免 flaky
    assert total * 0.3 < reversed_count < total * 0.7


def test_validate_cards_legacy_rejects_bad_payloads():
    with pytest.raises(ValueError):
        validate_cards([{"id": 1}], "single")  # 缺欄位
    with pytest.raises(ValueError):
        validate_cards(
            [
                {"id": 1, "name": "a", "name_cn": "甲"},
                {"id": 1, "name": "b", "name_cn": "乙"},
            ],
            "three_card",
        )  # 重複+數量不符
    with pytest.raises(ValueError):
        draw_cards("five_star")


# --- 塔羅 thread 模式 E2E：伺服器抽牌 + SSE ---


async def _seed_default(fake_ai):
    from app.services.endpoints import ensure_default_seed
    from app.utils.auth import encrypt_api_key

    with SessionLocal() as db:
        endpoint = ensure_default_seed(db)
        endpoint.base_url = fake_ai.base_url
        endpoint.model = "fake-model"
        endpoint.api_key_encrypted = encrypt_api_key("sk-test")
        db.commit()


async def test_tarot_thread_mode_server_draws_and_streams(make_user, auth_headers, fake_ai):
    """thread 模式：後端抽牌（請求未帶 cards）→ 回傳牌陣 → SSE 解盤"""
    user = make_user(username="tarot-thread-user")
    headers = auth_headers(user.username)
    await _seed_default(fake_ai)

    fake_ai.respond_stream_items([("text", "過去受困，現在有轉機。")])

    async with api_client() as client:
        created = await client.post(
            "/api/tarot",
            json={"question": "感情走向？", "spread_type": "three_card", "mode": "thread"},
            headers=headers,
        )
        assert created.status_code == 200
        body = created.json()
        cards = body["chart_data"]["cards"]
        assert len(cards) == 3
        assert [c["position"] for c in cards] == ["past", "present", "future"]

        token = headers["Authorization"].removeprefix("Bearer ")
        record_id = body["id"]
        async with client.stream(
            "GET", f"/api/records/{record_id}/stream?token={token}"
        ) as response:
            raw = b""
            async for chunk in response.aiter_bytes():
                raw += chunk

    assert "done" in raw.decode("utf-8")

    with SessionLocal() as db:
        messages = (
            db.query(ThreadMessage).filter(ThreadMessage.record_id == record_id).all()
        )
        assert len(messages) == 1

        record = db.query(History).filter(History.id == record_id).first()
        stored = json.loads(record.chart_data)
        assert stored["cards"][0]["position_name"] in ("過去", "現在", "未來")


async def test_tarot_thread_mode_prompt_contains_compact_cards(make_user, auth_headers, fake_ai):
    """送給 AI 的內容含繁中緊湊牌陣（位置｜中文名｜正逆位），不含英文 Card Drawn 格式"""
    user = make_user(username="tarot-prompt-user")
    headers = auth_headers(user.username)
    await _seed_default(fake_ai)

    async with api_client() as client:
        created = await client.post(
            "/api/tarot",
            json={"question": "事業建議", "spread_type": "single", "mode": "thread"},
            headers=headers,
        )
        record_id = created.json()["id"]
        token = headers["Authorization"].removeprefix("Bearer ")

        fake_ai.respond_stream(["ok"])
        await client.get(f"/api/records/{record_id}/stream?token={token}")

    request_body = fake_ai.last_request["body"]
    user_message = request_body["messages"][1]["content"]
    assert "【牌陣】" in user_message
    assert "單張｜" in user_message
    assert ("正位" in user_message) or ("逆位" in user_message)
    assert "Card Drawn:" not in user_message


# --- 紫微 schema 驗證 ---


def _valid_ziwei_chart():
    return {
        "fiveElementsClass": "木三局",
        "zodiac": "虎",
        "palaces": [
            {
                "name": name,
                "earthlyBranch": branch,
                "heavenlyStem": "甲",
                "majorStars": [{"name": "紫微", "brightness": "廟"}],
                "minorStars": [],
                "adjectiveStars": [],
                "decadal": {"range": [6, 15]},
                "ages": [6],
                "isBodyPalace": name == "命宮",
            }
            for name, branch in zip(
                [
                    "命宮", "兄弟", "夫妻", "子女", "財帛", "疾厄",
                    "遷移", "僕役", "官祿", "田宅", "福德", "父母",
                ],
                ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"],
            )
        ],
    }


def test_ziwei_validation_accepts_valid_chart():
    validate_ziwei_chart(_valid_ziwei_chart())  # 不拋錯


@pytest.mark.parametrize(
    "mutate, fragment",
    [
        (lambda c: c.pop("palaces"), "十二宮"),
        (lambda c: c.update(palaces=c["palaces"][:11]), "十二宮"),
        (lambda c: c["palaces"][0].pop("earthlyBranch"), "缺少欄位"),
        (lambda c: c["palaces"][2].update(majorStars=None), "主星格式"),
        (lambda c: c.update(palaces="x"), "非陣列"),
    ],
)
def test_ziwei_validation_rejects_malformed(mutate, fragment):
    chart = _valid_ziwei_chart()
    mutate(chart)
    with pytest.raises(ValueError, match=fragment):
        validate_ziwei_chart(chart)


async def test_ziwei_thread_mode_validates_before_streaming(make_user, auth_headers):
    """畸形盤面在建立時即被拒（422/400 層級），不會建立紀錄"""
    user = make_user(username="ziwei-bad-user")
    headers = auth_headers(user.username)

    bad_chart = {"palaces": []}

    async with api_client() as client:
        response = await client.post(
            "/api/ziwei",
            json={
                "name": "小明",
                "gender": "male",
                "birth_date": "1990-01-01T00:00:00",
                "birth_location": "台北",
                "query_type": "natal",
                "question": "今年運勢",
                "chart_data": bad_chart,
                "mode": "thread",
            },
            headers=headers,
        )
    assert response.status_code in (400, 422)


# --- Prompt 快照：無預烤詳解殘留 ---


def test_liuyao_compact_format_has_no_baked_readings():
    from app.services.prompts import build_liuyao_context

    chart = {
        "time": "2026-08-25 12:00:00",
        "bazi": "丙午年 丙申月 辛未日 甲午時",
        "kongwang": "戌亥",
        "guashen": "兌",
        "benguaming": "澤山咸",
        "bianguaming": "無變卦",
        "gua_type": "六世卦",
        "shensha": [],
        "yaogua": [3, 3, 2, 2, 3, 3],
    }
    context = build_liuyao_context("測試", "male", "self", chart)

    assert "卦辭：咸亨，利貞，取女吉。" in context  # 精簡參考保留
    assert "象傳：" in context
    # 預烤詳解段落不得出現
    for baked in ("諸事：", "愛情：", "事業：", "財運：", "詳解："):
        assert baked not in context, f"不應預烤 {baked}"


def test_tarot_compact_format_lines():
    cards = [
        {"id": 0, "name": "The Fool", "name_cn": "愚者", "reversed": False, "position": "past"},
        {"id": 7, "name": "The Chariot", "name_cn": "戰車", "reversed": True, "position": "present"},
        {"id": 19, "name": "The Sun", "name_cn": "太陽", "reversed": False, "position": "future"},
    ]
    text = format_tarot_cards_compact(cards)
    assert text.splitlines()[1] == "1. 過去｜愚者（The Fool）｜正位"
    assert "2. 現在｜戰車（The Chariot）｜逆位" in text


def test_build_tarot_messages_uses_matching_system_file():
    system, user = build_tarot_messages("q", "celtic_cross", [])
    assert "凱爾特" in system or "牌陣" in system
    assert "對話模式" in system  # CONVERSATION_RULES 已附加


def test_ziwei_compact_lists_twelve_palaces():
    chart = _valid_ziwei_chart()
    _, user = build_ziwei_messages("運勢", chart, birth_details={"name": "小明", "gender": "male"})
    assert "命宮｜甲子｜主星:紫微(廟)" in user
    assert "身宮" in user
