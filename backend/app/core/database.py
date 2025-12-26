"""
Database module - 資料庫操作
"""
import sqlite3
import json
from datetime import datetime
from pathlib import Path
from .config import get_config

config = get_config()

def get_db_connection():
    """建立資料庫連接"""
    conn = sqlite3.connect(str(config.DATABASE_PATH))
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """初始化資料庫結構"""
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
            ai_model TEXT DEFAULT 'unknown',
            is_favorite BOOLEAN DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            date_str TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    ''')
    
    # 升級：如果表已存在但沒有 ai_model 欄位，新增它
    try:
        c.execute('ALTER TABLE history ADD COLUMN ai_model TEXT DEFAULT "unknown"')
    except sqlite3.OperationalError:
        pass  # 欄位已存在
    
    # 升級：新增 gender 欄位 (求測者性別)
    try:
        c.execute('ALTER TABLE history ADD COLUMN gender TEXT')
    except sqlite3.OperationalError:
        pass  # 欄位已存在
    
    # 升級：新增 target 欄位 (占卜對象)
    try:
        c.execute('ALTER TABLE history ADD COLUMN target TEXT')
    except sqlite3.OperationalError:
        pass  # 欄位已存在
    
    # Settings table
    c.execute('''
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT
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
    
    # Initialize default settings
    _init_default_settings(c)
    
    conn.commit()
    conn.close()

def _init_default_settings(cursor):
    """初始化預設設定"""
    # Default settings - 預設無上限
    cursor.execute('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', ('daily_limit', 'unlimited'))
    
    # Load System Prompt from file
    try:
        prompt_path = config.PROMPTS_DIR / 'system_prompt.md'
        if prompt_path.exists():
            with open(prompt_path, 'r', encoding='utf-8') as f:
                default_prompt = f.read()
        else:
            default_prompt = """你現在是一個算命老師，正在使用六爻算命。{question}"""
    except Exception as e:
        print(f"Error loading system prompt file: {e}")
        default_prompt = "{question}"
        
    cursor.execute('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', ('system_prompt', default_prompt))
    
    # Settings for Local AI
    cursor.execute('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', ('ai_provider', 'local'))
    cursor.execute('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', ('local_api_url', 'http://localhost:1234/v1'))
    cursor.execute('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', ('local_model_name', 'qwen/qwen3-8b'))


# ============= Settings Functions =============
def get_setting(key: str, default: str = None) -> str:
    """取得設定值"""
    conn = get_db_connection()
    row = conn.execute('SELECT value FROM settings WHERE key = ?', (key,)).fetchone()
    conn.close()
    return row['value'] if row else default


def set_setting(key: str, value: str) -> None:
    """設定值"""
    conn = get_db_connection()
    conn.execute(
        'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
        (key, value)
    )
    conn.commit()
    conn.close()


# ============= History Functions =============
def add_history(question: str, result_json: dict, interpretation: str, user_id: int = 1, ai_model: str = 'unknown', gender: str = None, target: str = None) -> int:
    """新增歷史記錄"""
    conn = get_db_connection()
    date_str = datetime.now().strftime('%Y-%m-%d')
    
    cursor = conn.execute(
        '''INSERT INTO history (user_id, question, result_json, interpretation, ai_model, date_str, gender, target)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)''',
        (user_id, question, json.dumps(result_json, ensure_ascii=False), interpretation, ai_model, date_str, gender, target)
    )
    history_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return history_id


def get_history(user_id: int = None) -> list:
    """取得歷史記錄"""
    conn = get_db_connection()
    
    if user_id is None:
        # Admin: get all with username
        rows = conn.execute('''
            SELECT h.*, u.username 
            FROM history h 
            LEFT JOIN users u ON h.user_id = u.id 
            ORDER BY h.created_at DESC
        ''').fetchall()
    else:
        rows = conn.execute(
            'SELECT * FROM history WHERE user_id = ? ORDER BY created_at DESC',
            (user_id,)
        ).fetchall()
    
    conn.close()
    return [dict(row) for row in rows]


def delete_history(history_id: int) -> None:
    """刪除歷史記錄"""
    conn = get_db_connection()
    conn.execute('DELETE FROM history WHERE id = ?', (history_id,))
    conn.commit()
    conn.close()


def toggle_favorite(history_id: int, is_favorite: bool) -> None:
    """切換收藏狀態"""
    conn = get_db_connection()
    conn.execute(
        'UPDATE history SET is_favorite = ? WHERE id = ?',
        (1 if is_favorite else 0, history_id)
    )
    conn.commit()
    conn.close()


def update_history_interpretation(history_id: int, interpretation: str, ai_model: str) -> None:
    """更新歷史記錄的解卦結果"""
    conn = get_db_connection()
    conn.execute(
        'UPDATE history SET interpretation = ?, ai_model = ? WHERE id = ?',
        (interpretation, ai_model, history_id)
    )
    conn.commit()
    conn.close()


def get_daily_usage_count(user_id: int) -> int:
    """取得用戶今日使用次數"""
    conn = get_db_connection()
    date_str = datetime.now().strftime('%Y-%m-%d')
    row = conn.execute(
        'SELECT COUNT(*) as count FROM history WHERE user_id = ? AND date_str = ?',
        (user_id, date_str)
    ).fetchone()
    conn.close()
    return row['count'] if row else 0
