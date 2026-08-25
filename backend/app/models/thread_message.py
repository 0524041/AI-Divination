"""
Thread 訊息模型（ADR-0002）

占卜紀錄為 Thread 根節點；本表承載 解盤＋其後所有追問與回應。
首則 assistant 訊息即解盤（由遷移腳本自 History.interpretation 轉入，
或由新 SSE 管線寫入）。
"""

from datetime import datetime

from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)

from app.core.database import Base


class ThreadMessage(Base):
    """Thread 訊息表"""

    __tablename__ = "thread_messages"

    id = Column(Integer, primary_key=True, index=True)
    record_id = Column(
        Integer,
        ForeignKey("history.id", ondelete="CASCADE"),
        nullable=False,
    )
    role = Column(String(10), nullable=False)  # 'user' | 'assistant'
    content = Column(Text, nullable=False)  # 正文（不含 think 區塊）
    think = Column(Text, nullable=True)  # 助手訊息的思考過程
    model = Column(String(100), nullable=True)  # 助手訊息：產出此訊息的模型
    prompt_tokens = Column(Integer, nullable=True)
    completion_tokens = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        # 時間排序查詢（載入整個 thread）
        Index("ix_thread_messages_record_id", "record_id", "id"),
    )


def extract_think(text: str) -> tuple[str | None, str]:
    """從舊版解盤文字抽出 <think>...</think> 區塊

    回傳 (think 或 None, 去除 think 後的正文)。
    相容多個/跨行 think 區塊。
    """
    import re

    pattern = re.compile(r"<think>(.*?)</think>", re.DOTALL)
    thinks = pattern.findall(text)
    cleaned = pattern.sub("", text).strip()

    if not thinks:
        return None, cleaned
    return "\n".join(t.strip() for t in thinks).strip(), cleaned
