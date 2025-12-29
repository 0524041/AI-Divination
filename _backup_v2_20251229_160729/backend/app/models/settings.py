"""
Settings model - 系統設定資料模型
"""
from ..core.database import get_db_connection

def get_setting(key: str, default: str = None) -> str:
    """取得設定值"""
    conn = get_db_connection()
    c = conn.cursor()
    c.execute('SELECT value FROM settings WHERE key = ?', (key,))
    row = c.fetchone()
    conn.close()
    return row['value'] if row else default

def set_setting(key: str, value: str) -> None:
    """設定值"""
    conn = get_db_connection()
    c = conn.cursor()
    c.execute('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', (key, str(value)))
    conn.commit()
    conn.close()

def get_all_settings() -> dict:
    """取得所有設定"""
    conn = get_db_connection()
    c = conn.cursor()
    c.execute('SELECT key, value FROM settings')
    rows = c.fetchall()
    conn.close()
    return {row['key']: row['value'] for row in rows}
