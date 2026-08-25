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
import time
from collections.abc import AsyncIterator

from app.core.database import SessionLocal
from app.models.history import History
from app.models.thread_message import ThreadMessage
from app.services import endpoints as endpoint_service
from app.services.ai_provider import AIProviderError
from app.services.prompts import build_liuyao_messages

# 同一紀錄同時僅允許一條活躍解盤串流
_active_streams: set[int] = set()

HEARTBEAT_INTERVAL_SECONDS = 15.0


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


def _sse_ping() -> str:
    return ": ping\n\n"


def _build_first_messages(record: History) -> tuple[str, str]:
    """依占卜類型組出首次解盤訊息；未支援類型明確報錯（Ticket 05 擴充）"""
    if record.divination_type != "liuyao":
        raise NotImplementedError(f"類型 {record.divination_type} 尚未接入新管線")

    chart_data = json.loads(record.chart_data)
    system, user_message = build_liuyao_messages(
        question=record.question,
        gender=record.gender,
        target=record.target,
        chart_data=chart_data,
    )
    return system, user_message


def stream_is_active(record_id: int) -> bool:
    return record_id in _active_streams


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
        },
    )

    content_parts: list[str] = []
    think_parts: list[str] = []
    started = time.monotonic()
    delta_iter = provider.stream_messages(messages).__aiter__()

    try:
        while True:
            try:
                delta = await asyncio.wait_for(
                    delta_iter.__anext__(), timeout=heartbeat_interval
                )
            except asyncio.TimeoutError:
                yield _sse_ping()
                continue
            except StopAsyncIteration:
                break

            text = delta.get("text", "")
            if delta.get("type") == "thinking":
                think_parts.append(text)
            else:
                content_parts.append(text)
            yield _sse("delta", {"type": delta.get("type"), "text": text})

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
        return

    content = "".join(content_parts)
    think = "".join(think_parts) or None
    usage = provider.last_usage

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
    legacy_interpretation: str,
) -> ThreadMessage:
    """完成後一次性寫入：ThreadMessage＋History 同步（狀態/interpretation）"""
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
