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
    connect_args={"check_same_thread": False},  # SQLite 需要
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
    from app.models import user, history, settings as settings_model, share_token

    # 建立表
    Base.metadata.create_all(bind=engine)
    print("✓ 資料庫表已建立")


def run_migrations():
    """執行資料庫遷移 (檢查並添加缺失的欄位)"""
    import sqlite3
    from pathlib import Path

    db_path = Path(settings.DATABASE_URL.replace("sqlite:///", ""))
    if not db_path.exists():
        return

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    migrations = [
        {
            "table": "ai_configs",
            "column": "name",
            "sql": "ALTER TABLE ai_configs ADD COLUMN name VARCHAR(50)",
        },
    ]

    try:
        for migration in migrations:
            cursor.execute(f"PRAGMA table_info({migration['table']})")
            columns = [col[1] for col in cursor.fetchall()]

            if migration["column"] not in columns:
                cursor.execute(migration["sql"])
                print(f"✓ 遷移完成: {migration['table']}.{migration['column']}")

        conn.commit()
    except sqlite3.Error as e:
        print(f"✗ 遷移失敗: {e}")
        conn.rollback()
    finally:
        conn.close()
