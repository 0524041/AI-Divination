"""
歷史紀錄模型
"""
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey
from app.core.database import Base


class History(Base):
    """歷史紀錄表"""
    __tablename__ = "history"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    divination_type = Column(String(50), nullable=False)  # 'liuyao' | 'ziwei' | ...
    question = Column(Text, nullable=False)
    gender = Column(String(10), nullable=True)  # 'male' | 'female'
    target = Column(String(20), nullable=True)  # 'self' | 'parent' | 'friend' | 'other'
    chart_data = Column(Text, nullable=False)  # JSON: 盤面數據
    interpretation = Column(Text, nullable=True)  # AI 解盤結果
    ai_provider = Column(String(20), nullable=True)  # 'gemini' | 'local'
    ai_model = Column(String(100), nullable=True)
    status = Column(String(20), default="pending")  # 'pending' | 'processing' | 'completed' | 'cancelled' | 'error'
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
