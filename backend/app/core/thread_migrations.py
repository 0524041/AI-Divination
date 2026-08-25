"""
Thread 遷移腳本（ADR-0002，Ticket 03）

把既有 History.interpretation 轉為該紀錄的首則 assistant 訊息：
- <think>...</think> 抽出至獨立欄位
- 空解盤/失敗狀態的紀錄不產生訊息
- 幂等：已有訊息的紀錄跳過，可安全重跑

以模組執行：uv run python -m app.core.thread_migrations
應用程式啟動時亦會自動執行一次。
"""

import sys

from sqlalchemy.orm import Session

from app.core.database import Base, SessionLocal
from app.models.history import History
from app.models.thread_message import ThreadMessage, extract_think


def migrate_history_to_messages(db: Session) -> int:
    """遷移所有尚無訊息且有解盤內容的紀錄；回傳建立訊息數"""
    created = 0
    records = db.query(History).all()

    for record in records:
        has_messages = (
            db.query(ThreadMessage)
            .filter(ThreadMessage.record_id == record.id)
            .first()
            is not None
        )
        if has_messages:
            continue
        if not record.interpretation or not record.interpretation.strip():
            continue

        think, content = extract_think(record.interpretation)
        db.add(
            ThreadMessage(
                record_id=record.id,
                role="assistant",
                content=content,
                think=think,
                model=record.ai_model,
            )
        )
        created += 1

    db.commit()
    return created


def run_thread_migrations() -> None:
    """啟動入口：確保表存在並執行遷移"""
    Base.metadata.create_all(bind=SessionLocal.kw["bind"])
    with SessionLocal() as db:
        count = migrate_history_to_messages(db)
        if count:
            print(f"✓ Thread 遷移完成：{count} 則解盤轉為首則訊息")


if __name__ == "__main__":
    run_thread_migrations()
    sys.exit(0)
