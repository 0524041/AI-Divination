"""
Authentication utilities - 認證工具
"""
from functools import wraps
from flask import session, jsonify
from cryptography.fernet import Fernet
import base64
import hashlib

from ..core.database import get_db_connection
from ..core.config import get_config

# 從 config 獲取加密金鑰並轉換為 Fernet 格式
config = get_config()
_raw_key = config.ENCRYPTION_KEY

# Fernet 需要 32 bytes base64 編碼的金鑰
# 將任意長度的 hex 金鑰轉換為 Fernet 格式
def _get_fernet_key(raw_key: str) -> bytes:
    """將 hex 金鑰轉換為 Fernet 格式"""
    # 使用 SHA256 確保得到 32 bytes
    key_bytes = hashlib.sha256(raw_key.encode()).digest()
    return base64.urlsafe_b64encode(key_bytes)

cipher = Fernet(_get_fernet_key(_raw_key))

def login_required(f):
    """裝飾器：需要登入"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({"error": "Authentication required"}), 401
        return f(*args, **kwargs)
    return decorated_function

def admin_required(f):
    """裝飾器：需要管理員權限"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({"error": "Authentication required"}), 401
        
        conn = get_db_connection()
        user = conn.execute('SELECT role FROM users WHERE id = ?', (session['user_id'],)).fetchone()
        conn.close()
        
        if not user or user['role'] != 'admin':
            return jsonify({"error": "Admin access required"}), 403
        
        return f(*args, **kwargs)
    return decorated_function

def encrypt_api_key(api_key: str) -> str:
    """加密 API Key"""
    if not api_key:
        return None
    return cipher.encrypt(api_key.encode()).decode()

def decrypt_api_key(encrypted_key: str) -> str:
    """解密 API Key"""
    if not encrypted_key:
        return None
    return cipher.decrypt(encrypted_key.encode()).decode()
