"""
對話體驗打磨測試（chat-polish spec）

涵蓋：
- Prompt 片段組裝快照：首次解盤帶格式模板；追問絕不帶
- 追問上下文 48k 預算：錨點與盤面恆在、超額自最舊追問捨棄
- Token 估算函式（中英混排）
- 資料邊界：48k 字元級內容寫入→讀回等長
"""

import json

import pytest

from app.core.database import SessionLocal
from app.models import AIRequestLog, History, ThreadMessage
from app.services.prompts import (
    build_liuyao_messages,
    build_system_prompt,
    build_tarot_messages,
    build_ziwei_messages,
    prompt_file_for,
)
from app.services.tokens import (
    CONTEXT_TOKEN_BUDGET,
    estimate_messages_tokens,
    estimate_tokens,
)

pytestmark = pytest.mark.asyncio


def _make_record(user_id: int, **overrides) -> int:
    with SessionLocal() as db:
        record = History(
            user_id=user_id,
            divination_type=overrides.get("divination_type", "liuyao"),
            question=overrides.get("question", "原始問題：事業"),
            gender="male",
            chart_data=overrides.get(
                "chart_data", json.dumps({"benguaming": "澤山咸"})
            ),
            status="completed",
            interpretation=overrides.get("interpretation", "首解內容"),
        )
        db.add(record)
        db.commit()
        db.refresh(record)
        rid = record.id
        if overrides.get("with_anchor", True):
            db.add(ThreadMessage(record_id=rid, role="assistant", content="首解內容"))
            db.commit()
    return rid


# --- Prompt 片段組裝快照 ---


@pytest.mark.parametrize(
    "divination_type,build_first",
    [
        ("liuyao", lambda: build_liuyao_messages("事業？", "male", "self", {"benguaming": "澤山咸"})),
        ("tarot", lambda: build_tarot_messages("事業？", "three_card", [])),
        (
            "ziwei",
            lambda: build_ziwei_messages("運勢？", json.loads(_valid_chart_json())),
        ),
    ],
)
def test_first_interpretation_system_includes_format_template(divination_type, build_first):
    """首次解盤的 system 含輸出格式模板"""
    system, _ = build_first()
    assert "# Output Format" in system


@pytest.mark.parametrize("divination_type", ["liuyao", "tarot", "ziwei"])
def test_followup_system_excludes_format_template(make_user, divination_type):
    """追問的 system 不含任何「輸出結構/Output Format」字樣且含對話模式規則"""
    user = make_user(username=f"fmt-{divination_type}")
    chart = (
        json.dumps({"spread_type": "single", "cards": [{"id": 0, "name": "The Fool", "name_cn": "愚者", "reversed": False, "position": "single"}]})
        if divination_type == "tarot"
        else _valid_chart_json() if divination_type == "ziwei"
        else json.dumps({"benguaming": "澤山咸"})
    )
    rid = _make_record(user.id, divination_type=divination_type, chart_data=chart)

    from app.services.thread_pipeline import build_followup_messages

    with SessionLocal() as db:
        record = db.query(History).filter(History.id == rid).first()
        _, messages = build_followup_messages(record, "追問")

    system = messages[0]["content"]
    assert "Output Format" not in system
    assert "最終輸出結構" not in system
    assert "對話模式" in system


def test_followup_system_has_no_placeholder_leftover(make_user):
    """紫微拆檔後基底不再殘留佔位符"""
    user = make_user(username="ziwei-placeholder")
    rid = _make_record(user.id, divination_type="ziwei", chart_data=_valid_chart_json())

    from app.services.thread_pipeline import build_followup_messages

    with SessionLocal() as db:
        record = db.query(History).filter(History.id == rid).first()
        _, messages = build_followup_messages(record, "流年呢？")

    system = messages[0]["content"]
    assert "{{" not in system
    assert "完整命盤】提供" not in system


def test_prompt_file_for_maps_tarot_spread():
    assert prompt_file_for("tarot", {"spread_type": "celtic_cross"}) == "tarot_system_prompt_celtic_cross.md"
    assert prompt_file_for("tarot", {}) == "tarot_system_prompt_single.md"
    assert prompt_file_for("liuyao").endswith("liuyao_system.md")
    assert prompt_file_for("ziwei").endswith("ziwei_system.md")


# --- Token 估算 ---


def test_estimate_tokens_empty_and_ascii():
    assert estimate_tokens("") == 0
    assert estimate_tokens("abcd") == 1  # 4 ASCII ≈ 1 token
    assert estimate_tokens("abcde") == 2  # 進位


def test_estimate_tokens_cjk_and_mixed():
    assert estimate_tokens("占卜") == 2  # CJK 1 字/token
    assert estimate_tokens("測試abc測試") == 4 + 1  # 4 CJK + 3 ASCII
    fullwidth = "！？"
    assert estimate_tokens(fullwidth) == 2


def test_estimate_messages_tokens_counts_all():
    messages = [{"role": "system", "content": "a" * 40}, {"role": "user", "content": "問題"}]
    assert estimate_messages_tokens(messages) == 10 + 4 + 2 + 4


# --- 上下文預算組裝 ---


async def test_followup_budget_drops_oldest_followups_first(make_user):
    """塞入超量長歷史後：錨點存在、盤面存在、最舊追問被丟、新問題在最後、總估算 ≤ 48k"""
    from app.services.thread_pipeline import build_followup_messages

    user = make_user(username="budget-user")
    filler = "問" * 4500  # 每則 ≈ 4500+ tokens，12 則即超出 48k
    with SessionLocal() as db:
        record = History(
            user_id=user.id,
            divination_type="liuyao",
            question="原問題",
            chart_data=json.dumps({"benguaming": "澤山咸"}),
            status="completed",
            interpretation="首解",
        )
        db.add(record)
        db.commit()
        db.refresh(record)
        rid = record.id
        db.add(ThreadMessage(record_id=rid, role="assistant", content="首解全文"))
        for i in range(14):
            db.add(ThreadMessage(record_id=rid, role="user", content=f"追問{i}{filler}"))
            db.add(ThreadMessage(record_id=rid, role="assistant", content=f"回應{i}{filler}"))
        db.commit()

    with SessionLocal() as db:
        record = db.query(History).filter(History.id == rid).first()
        _, messages = build_followup_messages(record, "最新追問")

    contents = [m["content"] for m in messages]
    joined = "\n".join(contents)

    assert contents[-1] == "最新追問"
    assert any(c.startswith("【先前的解盤】") for c in contents)
    assert any(c.startswith("【盤面】") for c in contents)
    assert "追問0" not in joined  # 最舊追問被捨棄
    assert any(c.startswith("回應13") for c in contents)  # 最新追問保留
    assert len(messages) < 1 + 1 + 1 + 12 + 1  # 部分滑窗已被預算裁剪
    assert estimate_messages_tokens(messages) <= CONTEXT_TOKEN_BUDGET


# --- 串流心跳不得殺死上游串流（慢思考模型） ---


def _seed_default_endpoint(fake_ai) -> None:
    from app.services.endpoints import ensure_default_seed
    from app.utils.auth import encrypt_api_key

    with SessionLocal() as db:
        endpoint = ensure_default_seed(db)
        endpoint.base_url = fake_ai.base_url
        endpoint.model = "fake-model"
        endpoint.api_key_encrypted = encrypt_api_key("sk-test")
        db.commit()


async def _collect_sse(agen) -> list[tuple[str, dict]]:
    events: list[tuple[str, dict]] = []
    async for raw in agen:
        if raw.startswith(": ping"):
            events.append(("ping", {}))
            continue
        name = None
        for line in raw.splitlines():
            if line.startswith("event: "):
                name = line.removeprefix("event: ").strip()
            elif line.startswith("data: ") and name:
                events.append((name, json.loads(line.removeprefix("data: "))))
                name = None
    return events


async def test_slow_first_chunk_survives_heartbeat(make_user, fake_ai):
    """上游首 token 慢於心跳間隔時：發 ping 保活，內容仍完整送達（不得靜默空回覆）"""
    from app.services.thread_pipeline import stream_followup

    _seed_default_endpoint(fake_ai)
    user = make_user(username="slow-first-chunk")
    rid = _make_record(user.id)
    fake_ai.respond_stream_items([("thinking", "長推理"), ("text", "完整答案")])
    fake_ai.stream_delay = 2.0  # 首個 delta 前 2 秒 > 心跳 0.5s

    events = await _collect_sse(
        stream_followup(rid, user_id=user.id, question="追問", heartbeat_interval=0.5)
    )

    names = [n for n, _ in events]
    assert "ping" in names, f"應有心跳事件，實際：{names}"
    done = dict(events)["done"]
    assert done["content"] == "完整答案"
    assert done["think"] == "長推理"


async def test_empty_response_reports_error_instead_of_done(make_user, fake_ai):
    """上游連 content 也沒給時：回 error 事件，不持久化也不送空 done"""
    from app.services.thread_pipeline import stream_followup

    _seed_default_endpoint(fake_ai)
    user = make_user(username="empty-response")
    rid = _make_record(user.id)
    fake_ai.respond_stream([])  # 上游正常結束但零 delta

    events = await _collect_sse(
        stream_followup(rid, user_id=user.id, question="追問", heartbeat_interval=0.5)
    )

    assert events[-1][0] == "error"
    with SessionLocal() as db:
        msgs = (
            db.query(ThreadMessage)
            .filter(ThreadMessage.record_id == rid)
            .order_by(ThreadMessage.id)
            .all()
        )
        # 錨點＋user 問題照常持久化；不得新增空的 assistant 訊息
        assert [m.role for m in msgs] == ["assistant", "user"]


# --- meta 事件帶上下文估算 ---


async def test_followup_meta_reports_context_tokens(make_user, fake_ai):
    """meta 事件帶組裝後整體上下文估算（含 system＋盤面＋錨點）"""
    from app.services.thread_pipeline import stream_followup

    _seed_default_endpoint(fake_ai)

    user = make_user(username="ctx-meta-user")
    rid = _make_record(user.id)
    fake_ai.respond_stream(["好"])

    events = await _collect_sse(
        stream_followup(rid, user_id=user.id, question="追問")
    )

    meta = dict(events)["meta"]
    # 六爻常駐基底（角色＋知識庫）本身即數千 token
    assert meta["context_tokens"] > 1000
    assert dict(events)["done"]["content"] == "好"


# --- 資料邊界：48k 內容讀寫等長 ---


def test_thread_message_48k_content_roundtrip(make_user):
    user = make_user(username="big-thread-user")
    big_content = "卦" * 48_000
    big_think = "思" * 48_000
    with SessionLocal() as db:
        record = History(
            user_id=user.id,
            divination_type="liuyao",
            question="q",
            chart_data="{}",
            status="completed",
        )
        db.add(record)
        db.commit()
        db.refresh(record)
        message = ThreadMessage(
            record_id=record.id, role="assistant", content=big_content, think=big_think
        )
        db.add(message)
        db.commit()
        mid = message.id

    with SessionLocal() as db:
        message = db.query(ThreadMessage).filter(ThreadMessage.id == mid).first()
        assert len(message.content) == 48_000
        assert len(message.think) == 48_000


def test_history_48k_interpretation_and_chart_roundtrip(make_user):
    user = make_user(username="big-history-user")
    big_interp = "解" * 48_000
    big_chart = json.dumps({"data": "盤" * 46_000})  # JSON 字串層級亦為 TEXT
    with SessionLocal() as db:
        record = History(
            user_id=user.id,
            divination_type="ziwei",
            question="q",
            chart_data=big_chart,
            status="completed",
            interpretation=big_interp,
        )
        db.add(record)
        db.commit()
        rid = record.id

    with SessionLocal() as db:
        record = db.query(History).filter(History.id == rid).first()
        assert len(record.interpretation) == 48_000
        assert len(record.chart_data) == len(big_chart)


def test_ai_request_log_large_token_counts(fake_ai):
    log = AIRequestLog(model="fake-model", ok=True, prompt_tokens=48_000, completion_tokens=16_384)
    with SessionLocal() as db:
        db.add(log)
        db.commit()
        lid = log.id

    with SessionLocal() as db:
        log = db.query(AIRequestLog).filter(AIRequestLog.id == lid).first()
        assert log.prompt_tokens == 48_000
        assert log.completion_tokens == 16_384


def test_build_system_prompt_assembles_both_modes():
    """單元層：同一檔案兩種組合——首次含模板、追問不含"""
    name = prompt_file_for("liuyao")
    first = build_system_prompt(name, include_format=True)
    followup = build_system_prompt(name, include_format=False)
    assert "# Output Format" in first
    assert "# Output Format" not in followup
    assert "對話模式" in first and "對話模式" in followup
    assert len(followup) < len(first)


def _valid_chart_json() -> str:
    palaces = [
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
            ["命宮", "兄弟", "夫妻", "子女", "財帛", "疾厄", "遷移", "僕役", "官祿", "田宅", "福德", "父母"],
            ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"],
        )
    ]
    return json.dumps({"fiveElementsClass": "木三局", "zodiac": "虎", "palaces": palaces})
