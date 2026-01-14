"""生辰八字資料模型"""

from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey
from app.core.database import Base


class UserBirthData(Base):
    """使用者生辰八字資料表"""

    __tablename__ = "user_birth_data"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name = Column(String(100), nullable=False)
    gender = Column(String(10), nullable=False)
    birth_date = Column(DateTime, nullable=False)
    birth_location = Column(String(50), nullable=False)
    is_twin = Column(Boolean, default=False)
    twin_order = Column(String(10), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
