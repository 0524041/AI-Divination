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

def get_daily_usage_count():
    conn = get_db_connection()
    c = conn.cursor()
    today_str = datetime.now().strftime('%Y-%m-%d')
    c.execute('SELECT COUNT(*) FROM history WHERE date_str = ?', (today_str,))
    count = c.fetchone()[0]
    conn.close()
    return count

def add_history(question, result_json, interpretation):
    conn = get_db_connection()
    c = conn.cursor()
    today_str = datetime.now().strftime('%Y-%m-%d')
    c.execute('''
        INSERT INTO history (question, result_json, interpretation, date_str)
        VALUES (?, ?, ?, ?)
    ''', (question, json.dumps(result_json), interpretation, today_str))
    last_id = c.lastrowid
    conn.commit()
    conn.close()
    return last_id

def get_history():
    conn = get_db_connection()
    c = conn.cursor()
    c.execute('SELECT * FROM history ORDER BY created_at DESC')
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
<要求>
使用六爻工具 使用即時時間工具
要說明 搖到了哪六個卦 以及結合出什麼卦象 
根據卦象 結合問題 給我明確的解盤 不要模稜兩可
<問題>
{question}"""
    c.execute('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', ('system_prompt', default_prompt))
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
