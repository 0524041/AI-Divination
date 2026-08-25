"""
AI 用量紀錄模型（ADR-0001）

每一次 AI 請求一列，永久保留；admin 統計（總量、每人排行、每日趨勢、
模型分布）由此聚合。成功與失敗的請求都記錄。
"""

from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Index, Integer, String

from app.core.database import Base


class AIRequestLog(Base):
    """AI 請求用量紀錄表"""

    __tablename__ = "ai_request_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    endpoint_id = Column(
        Integer,
        ForeignKey("system_ai_endpoints.id", ondelete="SET NULL"),
        nullable=True,
    )
    endpoint_name = Column(String(50), nullable=True)  # 快照，端點刪除後統計仍可讀
    model = Column(String(100), nullable=False)
    ok = Column(Boolean, nullable=False, default=True)
    error_kind = Column(String(20), nullable=True)  # auth | quota | timeout | upstream
    prompt_tokens = Column(Integer, nullable=True)
    completion_tokens = Column(Integer, nullable=True)
    duration_ms = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    __table_args__ = (Index("ix_ai_request_logs_created_ok", "created_at", "ok"),)
