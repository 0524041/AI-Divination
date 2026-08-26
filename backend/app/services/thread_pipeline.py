"""
Thread 解盤串流管線（ADR-0002，Ticket 04 tracer bullet）

單一管線服務三種占卜的「首解串流」與（Ticket 06 起）追問：
- 事件序列：meta → delta* → done | error
- 心跳：閒置時送 SSE 註解行保活
- 完成後持久化 ThreadMessage、同步 History.interpretation（舊頁相容）、記用量
- 上游錯誤 → error 事件 + 紀錄標記 error + 用量記帳
"""

import asyncio
import json
import logging
import time
from collections.abc import AsyncIterator
from datetime import datetime

from app.core.database import SessionLocal
from app.models.ai_request_log import AIRequestLog
from app.models.history import History
from app.models.thread_message import ThreadMessage
from app.models.user import User
from app.services import endpoints as endpoint_service
from app.services.ai_provider import AIProviderError
from app.services.prompts import build_liuyao_messages
from app.services.tokens import CONTEXT_TOKEN_BUDGET, estimate_messages_tokens

logger = logging.getLogger(__name__)

# 同一紀錄同時僅允許一條活躍解盤串流
_active_streams: set[int] = set()

HEARTBEAT_INTERVAL_SECONDS = 15.0

# 訪客每日 AI 回應上限（含首次解盤與追問；只計 AI 回應）
GUEST_DAILY_MESSAGE_LIMIT = 10

# 追問時送出的追問對話滑窗（則數；不含 system、盤面與解盤錨點）
FOLLOWUP_HISTORY_WINDOW = 12


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


def _sse_ping() -> str:
    return ": ping\n\n"


async def _pump_deltas(
    provider,
    messages: list[dict],
    *,
    heartbeat_interval: float,
) -> AsyncIterator[tuple[str, dict | None]]:
    """以背景任務消費上游串流；閒置逾時僅回報心跳，不取消上游。

    舊作法以 wait_for 包 __anext__()，逾時的 CancelledError 會直接殺死
    provider 的 async generator——上游首 token 慢於心跳間隔即靜默斷流，
    產出空回覆。改為 producer task + Queue：逾時只讓消費端發心跳，
    上游連線與已收到的內容完整保留。

    產出 ("delta", delta) 或 ("ping", None)；上游失敗時 raise AIProviderError。
    """
    queue: asyncio.Queue = asyncio.Queue()

    async def _produce() -> None:
        try:
            async for delta in provider.stream_messages(messages):
                queue.put_nowait(("delta", delta))
        except AIProviderError as exc:
            queue.put_nowait(("error", exc))
        except Exception as exc:  # 防禦：非分類例外同樣轉為 error 事件而非靜默結束
            queue.put_nowait(("error", AIProviderError("upstream", f"串流異常：{exc}")))
        finally:
            queue.put_nowait(("done", None))

    producer = asyncio.create_task(_produce())
    try:
        while True:
            try:
                kind, payload = await asyncio.wait_for(
                    queue.get(), timeout=heartbeat_interval
                )
            except asyncio.TimeoutError:
                yield ("ping", None)
                continue
            if kind == "done":
                return
            if kind == "error":
                raise payload
            yield (kind, payload)
    finally:
        producer.cancel()
        try:
            await producer
        except asyncio.CancelledError:
            pass


def _build_first_messages(record: History) -> tuple[str, str]:
    """依占卜類型組出首次解盤訊息"""
    chart_data = json.loads(record.chart_data)

    if record.divination_type == "liuyao":
        return build_liuyao_messages(
            question=record.question,
            gender=record.gender,
            target=record.target,
            chart_data=chart_data,
        )

    if record.divination_type == "tarot":
        from app.services.prompts import build_tarot_messages

        cards = chart_data.get("cards", [])
        spread_type = chart_data.get("spread_type", "three_card")
        return build_tarot_messages(
            question=record.question, spread_type=spread_type, cards=cards
        )

    if record.divination_type == "ziwei":
        from app.services.prompts import build_ziwei_messages

        return build_ziwei_messages(
            question=record.question,
            chart_data=chart_data,
            birth_details=chart_data.get("birth_details"),
            query_context=chart_data.get("query_type"),
        )

    raise NotImplementedError(f"類型 {record.divination_type} 尚未接入新管線")


def stream_is_active(record_id: int) -> bool:
    return record_id in _active_streams


def acquire_stream_slot(record_id: int) -> bool:
    """同步佔位（路由層用），避免 lazy-generator 競態"""
    if record_id in _active_streams:
        return False
    _active_streams.add(record_id)
    return True


def release_stream_slot(record_id: int) -> None:
    _active_streams.discard(record_id)


async def stream_interpretation_preclaimed(
    record_id: int,
    *,
    user_id: int,
    heartbeat_interval: float = HEARTBEAT_INTERVAL_SECONDS,
) -> AsyncIterator[str]:
    """slot 已由路由層佔用；直接跑內部串流，不再重複檢查"""
    try:
        async for event in _stream_inner(
            record_id, user_id=user_id, heartbeat_interval=heartbeat_interval
        ):
            yield event
    finally:
        pass  # slot 由 API 層 finally 釋放


# ========== 訪客限額（集中單一 enforcement point） ==========


class QuotaExceeded(Exception):
    def __init__(self, used: int, limit: int):
        self.used = used
        self.limit = limit
        super().__init__(f"訪客每日上限 {limit} 則 AI 回應，今日已使用 {used} 則")


def count_ai_responses_today(db, user_id: int) -> int:
    """今日（UTC 日）已產出的 AI 回應數"""
    midnight = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    return (
        db.query(AIRequestLog)
        .filter(
            AIRequestLog.user_id == user_id,
            AIRequestLog.ok.is_(True),
            AIRequestLog.created_at >= midnight,
        )
        .count()
    )


def enforce_guest_quota(db, user: User) -> None:
    """訪客限額檢查；超出 raise QuotaExceeded。登入使用者不受限。"""
    if user.role != "guest":
        return
    used = count_ai_responses_today(db, user.id)
    if used >= GUEST_DAILY_MESSAGE_LIMIT:
        raise QuotaExceeded(used=used, limit=GUEST_DAILY_MESSAGE_LIMIT)


def guest_quota_status(db, user_id: int) -> dict:
    """額度餘量資訊（供 API 提示）；db 由呼叫端管理"""
    user = db.query(User).filter(User.id == user_id).first()
    if user is None or user.role != "guest":
        return {"limited": False}
    used = count_ai_responses_today(db, user_id)
    remaining = max(GUEST_DAILY_MESSAGE_LIMIT - used, 0)
    return {
        "limited": True,
        "used": used,
        "remaining": remaining,
        "limit": GUEST_DAILY_MESSAGE_LIMIT,
    }


# ========== 追問串流 ==========


async def stream_followup(
    record_id: int,
    *,
    user_id: int,
    question: str,
    heartbeat_interval: float = HEARTBEAT_INTERVAL_SECONDS,
    persist_user: bool = True,
    preclaimed: bool = False,
) -> AsyncIterator[str]:
    """追問：持久化 user 訊息 → 串流回應 → 持久化 assistant 訊息

    重試路徑傳 persist_user=False（問題已存在，避免重複）；
    路由層已預佔 slot 時傳 preclaimed=True（略過內部檢查）。
    """
    if not preclaimed:
        if record_id in _active_streams:
            raise RuntimeError("此紀錄已有進行中的解盤串流")
        _active_streams.add(record_id)
    try:
        async for event in _stream_followup_inner(
            record_id,
            user_id=user_id,
            question=question,
            heartbeat_interval=heartbeat_interval,
            persist_user=persist_user,
        ):
            yield event
    finally:
        _active_streams.discard(record_id)


async def _stream_followup_inner(
    record_id: int,
    *,
    user_id: int,
    question: str,
    heartbeat_interval: float,
    persist_user: bool = True,
) -> AsyncIterator[str]:
    with SessionLocal() as db:
        record = db.query(History).filter(History.id == record_id).first()
        if record is None:
            yield _sse("error", {"kind": "not_found", "message": "紀錄不存在"})
            return

        try:
            resolved = endpoint_service.resolve_endpoint(
                db, user_id=user_id, use_system=(record.ai_provider == "default")
            )
        except LookupError as exc:
            yield _sse("error", {"kind": "no_endpoint", "message": str(exc)})
            return

    # 先落一則 user 訊息（即使後續失敗，問題也不會丟失）
    if persist_user:
        with SessionLocal() as db:
            db.add(ThreadMessage(record_id=record_id, role="user", content=question))
            db.commit()

    _, messages = build_followup_messages(record, question)
    context_tokens_estimate = estimate_messages_tokens(messages)
    logger.info(
        "followup context assembled: record_id=%s messages=%d estimated_tokens≈%d / %d",
        record_id,
        len(messages),
        context_tokens_estimate,
        CONTEXT_TOKEN_BUDGET,
    )

    yield _sse(
        "meta",
        {
            "record_id": record_id,
            "endpoint_name": resolved.name,
            "model": resolved.model,
            # 組裝後的整體上下文估算（含 system＋盤面＋錨點），供前端預算條顯示
            "context_tokens": context_tokens_estimate,
        },
    )

    provider = resolved.make_provider()
    content_parts: list[str] = []
    think_parts: list[str] = []
    started = time.monotonic()

    try:
        async for kind, delta in _pump_deltas(
            provider, messages, heartbeat_interval=heartbeat_interval
        ):
            if kind == "ping":
                yield _sse_ping()
                continue
            text = (delta or {}).get("text", "")
            if (delta or {}).get("type") == "thinking":
                think_parts.append(text)
            else:
                content_parts.append(text)
            yield _sse("delta", {"type": (delta or {}).get("type"), "text": text})

    except AIProviderError as exc:
        endpoint_service.log_ai_request(
            user_id=user_id,
            resolved=resolved,
            ok=False,
            error_kind=exc.kind,
            duration_ms=int((time.monotonic() - started) * 1000),
        )
        yield _sse("error", {"kind": exc.kind, "message": str(exc)})
        await provider.aclose()
        return

    content = "".join(content_parts)
    think = "".join(think_parts) or None
    usage = provider.last_usage
    await provider.aclose()

    # 空回覆防護：上游正常結束但零內容時，回 error 而非持久化空的 assistant 訊息
    if not content.strip() and not (think or "").strip():
        logger.warning(
            "followup empty response: record_id=%s model=%s duration_ms=%d",
            record_id,
            resolved.model,
            int((time.monotonic() - started) * 1000),
        )
        endpoint_service.log_ai_request(
            user_id=user_id,
            resolved=resolved,
            ok=False,
            error_kind="upstream",
            duration_ms=int((time.monotonic() - started) * 1000),
        )
        yield _sse(
            "error",
            {"kind": "upstream", "message": "AI 未回傳內容，請重試或更換模型。"},
        )
        return

    persisted = _persist_assistant_message(
        record_id,
        content=content,
        think=think,
        model=resolved.model,
        prompt_tokens=usage.prompt_tokens if usage else None,
        completion_tokens=usage.completion_tokens if usage else None,
        legacy_interpretation=None,  # 追問不覆寫首解欄位
    )
    endpoint_service.log_ai_request(
        user_id=user_id,
        resolved=resolved,
        ok=True,
        prompt_tokens=usage.prompt_tokens if usage else None,
        completion_tokens=usage.completion_tokens if usage else None,
        duration_ms=int((time.monotonic() - started) * 1000),
    )

    yield _sse(
        "done",
        {
            "record_id": record_id,
            "message_id": persisted.id,
            "content": content,
            "think": think,
            "model": resolved.model,
            "prompt_tokens": usage.prompt_tokens if usage else None,
            "completion_tokens": usage.completion_tokens if usage else None,
        },
    )


async def retry_last_response(
    record_id: int,
    *,
    user_id: int,
    heartbeat_interval: float = HEARTBEAT_INTERVAL_SECONDS,
    preclaimed: bool = False,
) -> AsyncIterator[str]:
    """重試：刪除最後一則 assistant 訊息，以其前一則 user 問題重新生成"""
    with SessionLocal() as db:
        last = (
            db.query(ThreadMessage)
            .filter(ThreadMessage.record_id == record_id)
            .order_by(ThreadMessage.id.desc())
            .first()
        )
        if last is None:
            yield _sse("error", {"kind": "invalid_state", "message": "沒有可重試的回應"})
            return

        if last.role == "assistant":
            # 找最後的 user 問題，移除助手訊息（替換語意）
            previous_user = (
                db.query(ThreadMessage)
                .filter(
                    ThreadMessage.record_id == record_id,
                    ThreadMessage.role == "user",
                    ThreadMessage.id < last.id,
                )
                .order_by(ThreadMessage.id.desc())
                .first()
            )
            question = (
                previous_user.content
                if previous_user
                else record_question_of(db, record_id) or ""
            )
            db.delete(last)
            db.commit()
        else:
            # 最後一則是 user（上次生成中斷）：直接重新作答，不重複落問題
            question = last.content

    if not question:
        yield _sse("error", {"kind": "invalid_state", "message": "找不到原問題"})
        return

    async for event in stream_followup(
        record_id,
        user_id=user_id,
        question=question,
        heartbeat_interval=heartbeat_interval,
        persist_user=False,
        preclaimed=preclaimed,
    ):
        yield event


def record_question_of(db, record_id: int) -> str | None:
    record = db.query(History).filter(History.id == record_id).first()
    return record.question if record else None



def _compact_chart_block(record: History) -> str:
    """依占卜類型重組緊湊盤面區塊（追問上下文用，恆在）"""
    from app.services.prompts import (
        format_liuyao_chart_compact,
        format_tarot_cards_compact,
        format_ziwei_chart_compact,
        ziwei_birth_summary,
    )

    try:
        chart_data = json.loads(record.chart_data) if record.chart_data else {}
    except (TypeError, ValueError):
        return ""

    if record.divination_type == "liuyao":
        return format_liuyao_chart_compact(chart_data)
    if record.divination_type == "tarot":
        cards = chart_data.get("cards", [])
        return format_tarot_cards_compact(cards) if cards else ""
    if record.divination_type == "ziwei":
        return format_ziwei_chart_compact(
            chart_data, ziwei_birth_summary(chart_data.get("birth_details"))
        )
    return ""


def build_followup_messages(record: History, question: str) -> tuple[str, list[dict]]:
    """追問訊息組裝（chat-polish spec）

    組成＝常駐 system（不含輸出格式模板）＋【盤面】緊湊區塊
      ＋【先前的解盤】首則 assistant 全文（固定錨點）
      ＋最近 FOLLOWUP_HISTORY_WINDOW 則追問對話＋新問題。

    整體預算 CONTEXT_TOKEN_BUDGET tokens：盤面與錨點永不因超額被丟棄，
    超額時自最舊的追問對話開始捨棄。
    """
    from app.services.prompts import build_system_prompt, prompt_file_for

    try:
        chart_data = json.loads(record.chart_data) if record.chart_data else {}
    except (TypeError, ValueError):
        chart_data = {}
    system_prompt = build_system_prompt(
        prompt_file_for(record.divination_type, chart_data), include_format=False
    )

    with SessionLocal() as db:
        history = (
            db.query(ThreadMessage)
            .filter(ThreadMessage.record_id == record.id)
            .order_by(ThreadMessage.id)
            .all()
        )

    window = history[-FOLLOWUP_HISTORY_WINDOW:]
    messages: list[dict] = [{"role": "system", "content": system_prompt}]

    chart_block = _compact_chart_block(record)
    if chart_block:
        messages.append({"role": "user", "content": chart_block})

    # 固定錨點：首則解盤全文置於對話史前，不截斷、不丟棄
    first_assistant = next(
        (m for m in history if m.role == "assistant" and m.content), None
    )
    anchor_id = first_assistant.id if first_assistant is not None else None
    if first_assistant is not None:
        messages.append(
            {"role": "assistant", "content": f"【先前的解盤】{first_assistant.content}"}
        )

    followups = [
        {"role": message.role, "content": message.content}
        for message in window
        if message.id != anchor_id and message.content
    ]
    question_message = {"role": "user", "content": question}

    while followups:
        candidate = estimate_messages_tokens(messages + followups + [question_message])
        if candidate <= CONTEXT_TOKEN_BUDGET:
            break
        followups.pop(0)

    messages.extend(followups)
    messages.append(question_message)
    return record.question, messages


async def stream_interpretation(
    record_id: int,
    *,
    user_id: int,
    heartbeat_interval: float = HEARTBEAT_INTERVAL_SECONDS,
) -> AsyncIterator[str]:
    """對指定紀錄執行首次解盤並逐事件輸出 SSE 字串

    呼叫端需先驗證擁有權。併發第二條串流 raise RuntimeError。
    """
    if record_id in _active_streams:
        raise RuntimeError("此紀錄已有進行中的解盤串流")
    _active_streams.add(record_id)
    try:
        async for event in _stream_inner(
            record_id, user_id=user_id, heartbeat_interval=heartbeat_interval
        ):
            yield event
    finally:
        _active_streams.discard(record_id)


async def _stream_inner(
    record_id: int,
    *,
    user_id: int,
    heartbeat_interval: float,
) -> AsyncIterator[str]:
    with SessionLocal() as db:
        record = db.query(History).filter(History.id == record_id).first()
        if record is None:
            yield _sse("error", {"kind": "not_found", "message": "紀錄不存在"})
            return
        if record.status == "completed" and record.interpretation:
            yield _sse(
                "error",
                {"kind": "already_completed", "message": "此紀錄已完成解盤"},
            )
            return

        try:
            resolved = endpoint_service.resolve_endpoint(
                db,
                user_id=user_id if record.ai_provider != "default" else None,
                use_system=(record.ai_provider == "default"),
            )
            system_prompt, user_message = _build_first_messages(record)
        except NotImplementedError as exc:
            yield _sse("error", {"kind": "upstream", "message": str(exc)})
            return
        except LookupError as exc:
            yield _sse("error", {"kind": "no_endpoint", "message": str(exc)})
            return

        record.status = "processing"
        db.commit()

    provider = resolved.make_provider()
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_message},
    ]

    yield _sse(
        "meta",
        {
            "record_id": record_id,
            "endpoint_name": resolved.name,
            "model": resolved.model,
            # 首解組裝後的整體上下文估算，供前端預算條顯示
            "context_tokens": estimate_messages_tokens(messages),
        },
    )

    content_parts: list[str] = []
    think_parts: list[str] = []
    started = time.monotonic()

    try:
        async for kind, delta in _pump_deltas(
            provider, messages, heartbeat_interval=heartbeat_interval
        ):
            if kind == "ping":
                yield _sse_ping()
                continue
            text = (delta or {}).get("text", "")
            if (delta or {}).get("type") == "thinking":
                think_parts.append(text)
            else:
                content_parts.append(text)
            yield _sse("delta", {"type": (delta or {}).get("type"), "text": text})

    except AIProviderError as exc:
        _finalize_record(
            record_id, status="error", interpretation=None, model=resolved.model
        )
        endpoint_service.log_ai_request(
            user_id=user_id,
            resolved=resolved,
            ok=False,
            error_kind=exc.kind,
            duration_ms=int((time.monotonic() - started) * 1000),
        )
        yield _sse("error", {"kind": exc.kind, "message": str(exc)})
        await provider.aclose()
        return

    content = "".join(content_parts)
    think = "".join(think_parts) or None
    usage = provider.last_usage
    await provider.aclose()

    # 空回覆防護：不持久化、標記紀錄失敗，讓前端顯示可重試的錯誤
    if not content.strip() and not (think or "").strip():
        logger.warning(
            "first interpretation empty response: record_id=%s model=%s",
            record_id,
            resolved.model,
        )
        _finalize_record(
            record_id, status="error", interpretation=None, model=resolved.model
        )
        endpoint_service.log_ai_request(
            user_id=user_id,
            resolved=resolved,
            ok=False,
            error_kind="upstream",
            duration_ms=int((time.monotonic() - started) * 1000),
        )
        yield _sse(
            "error",
            {"kind": "upstream", "message": "AI 未回傳內容，請重試或更換模型。"},
        )
        return

    persisted = _persist_assistant_message(
        record_id,
        content=content,
        think=think,
        model=resolved.model,
        prompt_tokens=usage.prompt_tokens if usage else None,
        completion_tokens=usage.completion_tokens if usage else None,
        legacy_interpretation=(
            f"<think>{think}</think>{content}" if think else content
        ),
    )
    endpoint_service.log_ai_request(
        user_id=user_id,
        resolved=resolved,
        ok=True,
        prompt_tokens=usage.prompt_tokens if usage else None,
        completion_tokens=usage.completion_tokens if usage else None,
        duration_ms=int((time.monotonic() - started) * 1000),
    )

    yield _sse(
        "done",
        {
            "record_id": record_id,
            "message_id": persisted.id,
            "content": content,
            "think": think,
            "model": resolved.model,
            "prompt_tokens": usage.prompt_tokens if usage else None,
            "completion_tokens": usage.completion_tokens if usage else None,
        },
    )


def _persist_assistant_message(
    record_id: int,
    *,
    content: str,
    think: str | None,
    model: str,
    prompt_tokens: int | None,
    completion_tokens: int | None,
    legacy_interpretation: str | None = None,
) -> ThreadMessage:
    """完成後一次性寫入：ThreadMessage；legacy_interpretation 非 None 時同步 History"""
    with SessionLocal() as db:
        message = ThreadMessage(
            record_id=record_id,
            role="assistant",
            content=content,
            think=think,
            model=model,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
        )
        db.add(message)

        if legacy_interpretation is not None:
            record = db.query(History).filter(History.id == record_id).first()
            if record is not None:
                record.status = "completed"
                record.interpretation = legacy_interpretation

        db.commit()
        db.refresh(message)
        return message


def _finalize_record(
    record_id: int,
    *,
    status: str,
    interpretation: str | None,
    model: str,
) -> None:
    with SessionLocal() as db:
        record = db.query(History).filter(History.id == record_id).first()
        if record is not None:
            record.status = status
            if interpretation is not None:
                record.interpretation = interpretation
            record.ai_model = model
            db.commit()
