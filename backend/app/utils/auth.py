"""
Authentication utilities - 認證工具
"""
from functools import wraps
from flask import session, jsonify
from cryptography.fernet import Fernet
import os

from ..core.database import get_db_connection

# Encryption key for API keys
ENCRYPTION_KEY = os.getenv('ENCRYPTION_KEY', Fernet.generate_key())
cipher = Fernet(ENCRYPTION_KEY) if isinstance(ENCRYPTION_KEY, bytes) else Fernet(ENCRYPTION_KEY.encode() if isinstance(ENCRYPTION_KEY, str) else ENCRYPTION_KEY)

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
