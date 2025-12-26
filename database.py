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
    
    # Users table (with default admin)
    c.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT DEFAULT 'user' CHECK(role IN ('admin', 'user')),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_login TIMESTAMP
        )
    ''')
    
    # API keys table
    c.execute('''
        CREATE TABLE IF NOT EXISTS api_keys (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            provider TEXT NOT NULL CHECK(provider IN ('gemini', 'local')),
            api_key_encrypted TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    ''')
    
    # Request queue table
    c.execute('''
        CREATE TABLE IF NOT EXISTS request_queue (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            question TEXT NOT NULL,
            coins TEXT NOT NULL,
            status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'completed', 'failed')),
            position INTEGER,
            result TEXT,
            error TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            started_at TIMESTAMP,
            completed_at TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    ''')
    
    # History table (with user_id foreign key)
    c.execute('''
        CREATE TABLE IF NOT EXISTS history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER DEFAULT 1,
            question TEXT NOT NULL,
            result_json TEXT,
            interpretation TEXT,
            is_favorite BOOLEAN DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            date_str TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    ''')
    
    # Create indices
    c.execute('CREATE INDEX IF NOT EXISTS idx_history_user_id ON history(user_id)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_history_date ON history(date_str)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_queue_status ON request_queue(status)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_queue_user ON request_queue(user_id)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_apikeys_user ON api_keys(user_id)')
    
    # Create default admin if not exists (password: admin123)
    import bcrypt
    admin_hash = bcrypt.hashpw('admin123'.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    c.execute('INSERT OR IGNORE INTO users (id, username, password_hash, role) VALUES (1, ?, ?, ?)',
              ('admin', admin_hash, 'admin'))
    
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
    # Load System Prompt from file
    try:
        prompt_path = os.path.join(os.path.dirname(__file__), 'prompts', 'system_prompt.md')
        if os.path.exists(prompt_path):
            with open(prompt_path, 'r', encoding='utf-8') as f:
                default_prompt = f.read()
        else:
            # Fallback if file missing
            default_prompt = """你現在是一個算命老師，正在使用六爻算命。{question}"""
    except Exception as e:
        print(f"Error loading system prompt file: {e}")
        default_prompt = "{question}"
        
    c.execute('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', ('system_prompt', default_prompt))
    
    # New Settings for Local AI
    c.execute('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', ('ai_provider', 'local'))
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
