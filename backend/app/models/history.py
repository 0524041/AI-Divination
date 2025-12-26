"""
History model - 歷史記錄資料模型
"""
import json
from datetime import datetime
from ..core.database import get_db_connection

def get_daily_usage_count(user_id: int = 1) -> int:
    """取得使用者今日使用次數"""
    conn = get_db_connection()
    c = conn.cursor()
    today_str = datetime.now().strftime('%Y-%m-%d')
    c.execute('SELECT COUNT(*) FROM history WHERE date_str = ? AND user_id = ?', (today_str, user_id))
    count = c.fetchone()[0]
    conn.close()
    return count

def add_history(question: str, result_json: dict, interpretation: str, user_id: int = 1) -> int:
    """新增占卜歷史記錄"""
    conn = get_db_connection()
    c = conn.cursor()
    today_str = datetime.now().strftime('%Y-%m-%d')
    c.execute('''
        INSERT INTO history (user_id, question, result_json, interpretation, date_str)
        VALUES (?, ?, ?, ?, ?)
    ''', (user_id, question, json.dumps(result_json), interpretation, today_str))
    last_id = c.lastrowid
    conn.commit()
    conn.close()
    return last_id

def get_history(user_id: int = None) -> list:
    """取得歷史記錄，若 user_id 為 None 則回傳全部（管理員）"""
    conn = get_db_connection()
    c = conn.cursor()
    if user_id:
        c.execute('SELECT * FROM history WHERE user_id = ? ORDER BY created_at DESC', (user_id,))
    else:
        c.execute('SELECT h.*, u.username FROM history h LEFT JOIN users u ON h.user_id = u.id ORDER BY h.created_at DESC')
    rows = c.fetchall()
    history = [dict(row) for row in rows]
    conn.close()
    return history

def delete_history(record_id: int) -> None:
    """刪除歷史記錄"""
    conn = get_db_connection()
    c = conn.cursor()
    c.execute('DELETE FROM history WHERE id = ?', (record_id,))
    conn.commit()
    conn.close()

def toggle_favorite(record_id: int, is_favorite: bool) -> None:
    """切換收藏狀態"""
    conn = get_db_connection()
    c = conn.cursor()
    c.execute('UPDATE history SET is_favorite = ? WHERE id = ?', (is_favorite, record_id))
    conn.commit()
    conn.close()
