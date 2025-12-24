"""
Authentication and user management module
"""
import bcrypt
from functools import wraps
from flask import session, redirect, url_for, jsonify
from database import get_db_connection
from cryptography.fernet import Fernet
import os

# Encryption key for API keys (store in environment variable in production)
ENCRYPTION_KEY = os.getenv('ENCRYPTION_KEY', Fernet.generate_key())
cipher = Fernet(ENCRYPTION_KEY)

def hash_password(password):
    """Hash a password using bcrypt"""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def check_password(password, password_hash):
    """Verify a password against a hash"""
    return bcrypt.checkpw(password.encode('utf-8'), password_hash.encode('utf-8'))

def encrypt_api_key(api_key):
    """Encrypt an API key"""
    if not api_key:
        return None
    return cipher.encrypt(api_key.encode()).decode()

def decrypt_api_key(encrypted_key):
    """Decrypt an API key"""
    if not encrypted_key:
        return None
    return cipher.decrypt(encrypted_key.encode()).decode()

def login_required(f):
    """Decorator to require login"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({"error": "Authentication required"}), 401
        return f(*args, **kwargs)
    return decorated_function

def admin_required(f):
    """Decorator to require admin role"""
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

def create_user(username, password, role='user'):
    """Create a new user"""
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

def authenticate_user(username, password):
    """Authenticate a user and return user data if successful"""
    conn = get_db_connection()
    user = conn.execute('SELECT * FROM users WHERE username = ?', (username,)).fetchone()
    
    if user and check_password(password, user['password_hash']):
        # Update last login
        conn.execute('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', (user['id'],))
        conn.commit()
        conn.close()
        return dict(user)
    
    conn.close()
    return None

def get_user(user_id):
    """Get user by ID"""
    conn = get_db_connection()
    user = conn.execute('SELECT id, username, role, created_at, last_login FROM users WHERE id = ?', (user_id,)).fetchone()
    conn.close()
    return dict(user) if user else None

def get_all_users():
    """Get all users (admin only)"""
    conn = get_db_connection()
    users = conn.execute('SELECT id, username, role, created_at, last_login FROM users ORDER BY id').fetchall()
    conn.close()
    return [dict(user) for user in users]

def update_user_password(user_id, new_password):
    """Update user password"""
    conn = get_db_connection()
    password_hash = hash_password(new_password)
    conn.execute('UPDATE users SET password_hash = ? WHERE id = ?', (password_hash, user_id))
    conn.commit()
    conn.close()

def delete_user(user_id):
    """Delete a user"""
    conn = get_db_connection()
    conn.execute('DELETE FROM users WHERE id = ?', (user_id,))
    conn.commit()
    conn.close()

def add_api_key(user_id, provider, api_key):
    """Add or update API key for a user"""
    conn = get_db_connection()
    encrypted_key = encrypt_api_key(api_key) if api_key else None
    
    # Check if key exists
    existing = conn.execute(
        'SELECT id FROM api_keys WHERE user_id = ? AND provider = ?',
        (user_id, provider)
    ).fetchone()
    
    if existing:
        conn.execute(
            'UPDATE api_keys SET api_key_encrypted = ? WHERE user_id = ? AND provider = ?',
            (encrypted_key, user_id, provider)
        )
    else:
        conn.execute(
            'INSERT INTO api_keys (user_id, provider, api_key_encrypted) VALUES (?, ?, ?)',
            (user_id, provider, encrypted_key)
        )
    
    conn.commit()
    conn.close()

def get_api_key(user_id, provider):
    """Get decrypted API key for a user"""
    conn = get_db_connection()
    row = conn.execute(
        'SELECT api_key_encrypted FROM api_keys WHERE user_id = ? AND provider = ?',
        (user_id, provider)
    ).fetchone()
    conn.close()
    
    if row and row['api_key_encrypted']:
        return decrypt_api_key(row['api_key_encrypted'])
    return None

def get_user_api_keys(user_id):
    """Get all API keys for a user (returns provider list, not actual keys)"""
    conn = get_db_connection()
    keys = conn.execute(
        'SELECT provider, created_at FROM api_keys WHERE user_id = ? ORDER BY created_at DESC',
        (user_id,)
    ).fetchall()
    conn.close()
    return [dict(k) for k in keys]

def delete_api_key(user_id, provider):
    """Delete an API key"""
    conn = get_db_connection()
    conn.execute('DELETE FROM api_keys WHERE user_id = ? AND provider = ?', (user_id, provider))
    conn.commit()
    conn.close()
