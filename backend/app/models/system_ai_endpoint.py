"""
系統預設 AI 端點模型（ADR-0001）

管理者可新增/編輯/停用系統級端點並指定其中之一為預設，
供訪客與未設定自訂端點的使用者使用。
"""

from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text

from app.core.database import Base


class SystemAIEndpoint(Base):
    """系統預設 AI 端點表"""

    __tablename__ = "system_ai_endpoints"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), nullable=False)
    base_url = Column(String(255), nullable=False)  # OpenAI-compatible，建議含 /v1
    api_key_encrypted = Column(Text, nullable=False)
    model = Column(String(100), nullable=False)
    is_default = Column(Boolean, default=False, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
