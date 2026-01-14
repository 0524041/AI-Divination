"""
資料庫遷移腳本：為 ai_configs 表添加 model 欄位
執行方式：python backend/migrations/add_ai_config_model.py
"""

import sqlite3
from pathlib import Path


def migrate():
    # 資料庫路徑 (根據 config.py 的配置)
    db_path = Path(__file__).parent.parent / "divination.db"

    if not db_path.exists():
        print(f"❌ 資料庫不存在: {db_path}")
        return

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # 檢查 model 欄位是否已存在
        cursor.execute("PRAGMA table_info(ai_configs)")
        columns = [column[1] for column in cursor.fetchall()]

        if "model" in columns:
            print("✅ model 欄位已存在，無需遷移")
            return

        print("🔄 開始遷移...")

        # 添加 model 欄位
        cursor.execute("""
            ALTER TABLE ai_configs
            ADD COLUMN model VARCHAR(100)
        """)

        conn.commit()
        print("✅ 遷移完成！已為 ai_configs 表添加 model 欄位")

    except sqlite3.Error as e:
        print(f"❌ 遷移失敗: {e}")
        conn.rollback()
    finally:
        conn.close()


if __name__ == "__main__":
    migrate()
