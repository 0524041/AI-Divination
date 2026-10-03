"""
串流佔位模型（Vercel Serverless 對應）

同一占卜紀錄同時只允許一條活躍解盤串流。舊實作以行程內 set
記錄佔位，多實例下互相看不見；改以資料庫列為準，跨實例互斥
（主鍵衝突即代表有人先佔），逾時未釋放視為 stale 可接管。
"""

from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer

from app.core.database import Base


class StreamSlot(Base):
    """串流佔位表：存在＝該紀錄有進行中的串流"""

    __tablename__ = "thread_stream_slots"

    record_id = Column(
        Integer,
        ForeignKey("history.id", ondelete="CASCADE"),
        primary_key=True,
    )
    acquired_at = Column(DateTime, default=datetime.utcnow, nullable=False)
