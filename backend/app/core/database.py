"""
資料庫配置與初始化
"""
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, declarative_base
from .config import get_settings

settings = get_settings()

# 建立引擎
engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False}  # SQLite 需要
)

# 啟用外鍵約束 (SQLite)
@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()

# Session 工廠
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 基礎模型類
Base = declarative_base()


def get_db():
    """取得資料庫 session (依賴注入用)"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """初始化資料庫 (建立所有表)"""
    # 導入所有模型以註冊
    from app.models import user, history, settings as settings_model
    
    # 建立表
    Base.metadata.create_all(bind=engine)
    print("✓ 資料庫表已建立")
