"""
User model - 使用者資料模型
"""
import bcrypt
from ..core.database import get_db_connection

def hash_password(password: str) -> str:
    """密碼雜湊"""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def check_password(password: str, password_hash: str) -> bool:
    """驗證密碼"""
    return bcrypt.checkpw(password.encode('utf-8'), password_hash.encode('utf-8'))

def create_user(username: str, password: str, role: str = 'user') -> int:
    """建立新使用者"""
    conn = get_db_connection()
    try:
        password_hash = hash_password(password)
        c = conn.cursor()
        c.execute(
            'INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)',
            (username, password_hash, role)
        )
        user_id = c.lastrowid
        conn.commit()
        return user_id
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()

def authenticate_user(username: str, password: str) -> dict:
    """驗證使用者身份"""
    conn = get_db_connection()
    user = conn.execute('SELECT * FROM users WHERE username = ?', (username,)).fetchone()
    
    if user and check_password(password, user['password_hash']):
        conn.execute('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', (user['id'],))
        conn.commit()
        conn.close()
        return dict(user)
    
    conn.close()
    return None

def get_user(user_id: int) -> dict:
    """根據 ID 取得使用者"""
    conn = get_db_connection()
    user = conn.execute(
        'SELECT id, username, role, created_at, last_login FROM users WHERE id = ?', 
        (user_id,)
    ).fetchone()
    conn.close()
    return dict(user) if user else None

def get_all_users() -> list:
    """取得所有使用者（管理員用）"""
    conn = get_db_connection()
    users = conn.execute(
        'SELECT id, username, role, created_at, last_login FROM users ORDER BY id'
    ).fetchall()
    conn.close()
    return [dict(user) for user in users]

def update_user_password(user_id: int, new_password: str) -> None:
    """更新使用者密碼"""
    conn = get_db_connection()
    password_hash = hash_password(new_password)
    conn.execute('UPDATE users SET password_hash = ? WHERE id = ?', (password_hash, user_id))
    conn.commit()
    conn.close()

def update_user_role(user_id: int, role: str) -> None:
    """更新使用者角色"""
    conn = get_db_connection()
    conn.execute('UPDATE users SET role = ? WHERE id = ?', (role, user_id))
    conn.commit()
    conn.close()

def delete_user(user_id: int) -> None:
    """刪除使用者"""
    conn = get_db_connection()
    conn.execute('DELETE FROM users WHERE id = ?', (user_id,))
    conn.commit()
    conn.close()


# ============= API Keys =============
from ..utils.auth import encrypt_api_key, decrypt_api_key

def get_user_api_keys(user_id: int) -> dict:
    """獲取用戶的 API keys (只返回是否有設置)"""
    conn = get_db_connection()
    keys = conn.execute(
        'SELECT provider FROM api_keys WHERE user_id = ?',
        (user_id,)
    ).fetchall()
    conn.close()
    
    result = {'gemini': False, 'local': False}
    for k in keys:
        result[k['provider']] = True
    
    return result


def add_api_key(user_id: int, provider: str, api_key: str) -> None:
    """新增或更新 API key"""
    encrypted = encrypt_api_key(api_key) if api_key else None
    
    conn = get_db_connection()
    # 先刪除舊的
    conn.execute(
        'DELETE FROM api_keys WHERE user_id = ? AND provider = ?',
        (user_id, provider)
    )
    # 再新增
    if encrypted:
        conn.execute(
            'INSERT INTO api_keys (user_id, provider, api_key_encrypted) VALUES (?, ?, ?)',
            (user_id, provider, encrypted)
        )
    conn.commit()
    conn.close()


def delete_api_key(user_id: int, provider: str) -> None:
    """刪除 API key"""
    conn = get_db_connection()
    conn.execute(
        'DELETE FROM api_keys WHERE user_id = ? AND provider = ?',
        (user_id, provider)
    )
    conn.commit()
    conn.close()


def get_user_api_key(user_id: int, provider: str) -> str:
    """獲取解密後的 API key"""
    conn = get_db_connection()
    row = conn.execute(
        'SELECT api_key_encrypted FROM api_keys WHERE user_id = ? AND provider = ?',
        (user_id, provider)
    ).fetchone()
    conn.close()
    
    if row and row['api_key_encrypted']:
        return decrypt_api_key(row['api_key_encrypted'])
    return None
