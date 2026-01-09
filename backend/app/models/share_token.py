"""
分享 Token 模型
"""
from datetime import datetime, timedelta
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


class ShareToken(Base):
    """分享 Token 表 - 用於公開分享占卜結果"""
    __tablename__ = "share_tokens"
    
    id = Column(Integer, primary_key=True, index=True)
    token = Column(String(32), unique=True, nullable=False, index=True)
    history_id = Column(Integer, ForeignKey("history.id", ondelete="CASCADE"), nullable=False)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationship
    history = relationship("History", backref="share_tokens")
    
    @classmethod
    def generate_token(cls) -> str:
        """生成隨機 Token"""
        import secrets
        return secrets.token_urlsafe(12)  # 16 字元 URL 安全 Token
    
    @classmethod
    def create_expiry(cls, days: int = 7) -> datetime:
        """生成過期時間"""
        return datetime.utcnow() + timedelta(days=days)
    
    def is_expired(self) -> bool:
        """檢查是否已過期"""
        return datetime.utcnow() > self.expires_at
