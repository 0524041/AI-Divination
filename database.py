import sqlite3
import json
from datetime import datetime
import os

DB_NAME = "divination.db"

def get_db_connection():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            question TEXT NOT NULL,
            result_json TEXT,
            interpretation TEXT,
            is_favorite BOOLEAN DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            date_str TEXT NOT NULL
        )
    ''')
    conn.commit()
    conn.close()

def get_daily_usage_count(user_id=1):
    conn = get_db_connection()
    c = conn.cursor()
    today_str = datetime.now().strftime('%Y-%m-%d')
    c.execute('SELECT COUNT(*) FROM history WHERE date_str = ? AND user_id = ?', (today_str, user_id))
    count = c.fetchone()[0]
    conn.close()
    return count

def add_history(question, result_json, interpretation, user_id=1):
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

def get_history(user_id=None):
    """Get history, optionally filtered by user_id. If user_id is None, returns all (admin)"""
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

def delete_history(record_id):
    conn = get_db_connection()
    c = conn.cursor()
    c.execute('DELETE FROM history WHERE id = ?', (record_id,))
    conn.commit()
    conn.close()

def toggle_favorite(record_id, is_favorite):
    conn = get_db_connection()
    c = conn.cursor()
    c.execute('UPDATE history SET is_favorite = ? WHERE id = ?', (is_favorite, record_id))
    conn.commit()
    conn.close()

def init_settings():
    conn = get_db_connection()
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT
        )
    ''')
    # Default settings
    c.execute('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', ('daily_limit', '5'))
    # Default System Prompt (will be populated by server if missing, or here. Let's put a placeholder or basic one here to ensure key exists)
    # Actually server.py will have the full text. Let's just ensure the key is there if needed, 
    # but init_settings is called on import. 
    # Let's insert the default prompt here to be safe.
    default_prompt = """<角色>
你現在是一個算命老師 正在使用六爻算命
<背景>
為了協助你解盤，系統已經預先執行了「六爻排盤」與「時間查詢」工具，並會將結果提供給你。
<要求>
請根據提供的【卦象結果】與【當前時間】，結合【使用者的問題】進行解卦。
1. 說明起卦時間(干支)。
2. 說明本卦、變卦及其卦象含義。
3. 根據卦象與爻辭，直接回答使用者的問題。
4. 給予明確的指引，不要模稜兩可。
<問題>
{question}"""
    c.execute('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', ('system_prompt', default_prompt))
    
    # New Settings for Local AI
    c.execute('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', ('ai_provider', 'gemini'))
    c.execute('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', ('local_api_url', 'http://localhost:1234/v1'))
    c.execute('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', ('local_model_name', 'qwen/qwen3-8b'))
    
    conn.commit()
    conn.close()

def get_setting(key, default=None):
    conn = get_db_connection()
    c = conn.cursor()
    c.execute('SELECT value FROM settings WHERE key = ?', (key,))
    row = c.fetchone()
    conn.close()
    return row['value'] if row else default

def set_setting(key, value):
    conn = get_db_connection()
    c = conn.cursor()
    c.execute('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', (key, str(value)))
    conn.commit()
    conn.close()

# Call init_settings when this module is imported/initialized
init_settings()
