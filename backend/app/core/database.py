"""
資料庫配置與初始化

雙引擎：DATABASE_URL 的 scheme 決定後端——
- sqlite：本地開發／測試（單檔、零配置）
- postgresql：Neon（生產／預覽環境，強制經環境變數注入）

所有 SQLite 專用邏輯只在 SQLite 下啟用。
"""

from sqlalchemy import create_engine, event
from sqlalchemy.orm import declarative_base, sessionmaker

from .config import get_settings

settings = get_settings()

IS_SQLITE = settings.DATABASE_URL.startswith("sqlite")


def _create_engine():
    if IS_SQLITE:
        return create_engine(
            settings.DATABASE_URL,
            connect_args={"check_same_thread": False},  # SQLite 需要
        )
    # Postgres（Neon）：短連線健康檢查＋回收，避免 idle-in-transaction
    # 佔用 PgBouncer 連線池；SSL 由 URL 的 sslmode=require 決定
    return create_engine(
        settings.DATABASE_URL,
        pool_pre_ping=True,
        pool_recycle=300,
    )


# 建立引擎
engine = _create_engine()


if IS_SQLITE:
    # 啟用外鍵約束 (SQLite only)
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

    # 建立表
    Base.metadata.create_all(bind=engine)
    print("✓ 資料庫表已建立")


def run_migrations():
    """執行資料庫遷移 (檢查並添加缺失的欄位)

    僅 SQLite：手工 sqlite3 遷移；Postgres 的 schema 由 ORM 建表
    （後續改走正式遷移工具），此處直接跳過。
    """
    if not IS_SQLITE:
        return

    import sqlite3
    from pathlib import Path

    from app.core.schema_migrations import migrate_ai_model_columns

    db_path = Path(settings.DATABASE_URL.replace("sqlite:///", ""))
    if not db_path.exists():
        return

    conn = sqlite3.connect(db_path)
    try:
        migrate_ai_model_columns(conn)
    except sqlite3.Error as e:
        print(f"✗ 遷移失敗: {e}")
        conn.rollback()
    finally:
        conn.close()
