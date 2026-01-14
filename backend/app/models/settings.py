"""
AI 設定模型
"""

from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.core.database import Base


class AIConfig(Base):
    """AI 設定表"""

    __tablename__ = "ai_configs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    provider = Column(String(20), nullable=False)  # 'gemini' | 'local' | 'openai'
    name = Column(String(50), nullable=True)  # 用戶自訂的 AI 服務名稱
    model = Column(String(100), nullable=True)  # AI 模型名稱 (適用於所有 provider)
    api_key_encrypted = Column(Text, nullable=True)  # Gemini/OpenAI API Key (加密)
    local_url = Column(String(255), nullable=True)  # Local AI URL
    local_model = Column(String(100), nullable=True)  # Local AI Model (向後相容，優先使用 model)
    is_active = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    @property
    def effective_model(self) -> str:
        """獲取有效的模型名稱（優先使用 model，其次 local_model）"""
        return self.model or self.local_model or ""
