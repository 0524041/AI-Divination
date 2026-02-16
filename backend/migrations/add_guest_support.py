"""
Add guest support to users table
"""

import sqlite3
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DB_PATH = BASE_DIR / "divination.db"


def migrate():
    """Add guest_identifier column to users table"""
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()

    try:
        cursor.execute("PRAGMA table_info(users)")
        columns = [col[1] for col in cursor.fetchall()]

        if "guest_identifier" not in columns:
            print("Adding guest_identifier column...")
            cursor.execute("""
                ALTER TABLE users 
                ADD COLUMN guest_identifier VARCHAR(64)
            """)

            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_users_guest_identifier 
                ON users(guest_identifier)
            """)

            conn.commit()
            print("Migration completed successfully!")
        else:
            print("guest_identifier column already exists, skipping migration.")

    except Exception as e:
        conn.rollback()
        print(f"Migration failed: {e}")
        sys.exit(1)
    finally:
        conn.close()


if __name__ == "__main__":
    migrate()
