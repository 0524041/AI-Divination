"""
Application configuration - 應用程式配置
"""
import os
import secrets
from pathlib import Path


def _get_or_create_key(env_name: str, key_file: str, length: int = 32) -> str:
    """從環境變數或文件獲取金鑰，如果都不存在則生成新的（開發用）"""
    # 優先使用環境變數
    key = os.getenv(env_name)
    if key:
        return key
    
    # 嘗試從文件讀取
    key_path = Path(__file__).resolve().parent.parent.parent.parent / key_file
    if key_path.exists():
        return key_path.read_text().strip()
    
    # 生成新金鑰並保存（開發環境用）
    new_key = secrets.token_hex(length)
    try:
        key_path.write_text(new_key)
        print(f"[Security] Generated new {env_name}, saved to {key_file}")
    except Exception:
        pass  # 無法寫入文件，使用臨時金鑰
    return new_key


class Config:
    """Base configuration class"""
    
    # 路徑設定
    # backend/app/core/config.py -> backend/app/core -> backend/app -> backend -> project_root
    BACKEND_DIR = Path(__file__).resolve().parent.parent.parent  # backend/
    BASE_DIR = BACKEND_DIR.parent  # project_root/
    
    # Flask 設定 - 使用持久化金鑰避免重啟後 session 失效
    SECRET_KEY = _get_or_create_key('SECRET_KEY', '.secret_key', 32)
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'
    SESSION_COOKIE_SECURE = False  # 如果是 HTTP 訪問 IP，必須為 False
    PERMANENT_SESSION_LIFETIME = 86400  # 24 hours
    
    # CORS 設定
    # 當 supports_credentials=True 時，origins 不能為 "*"
    # 使用的正則表達式允許所有來源（開發環境用）
    import re
    CORS_ORIGINS = re.compile(r"https?://.*")
    
    # 資料庫設定 (在專案根目錄)
    DATABASE_PATH = BASE_DIR / 'divination.db'
    
    # AI 模型設定
    GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
    MODEL_ID = "gemini-2.0-flash-thinking-exp-01-21"
    
    # 占卜設定
    DEFAULT_DAILY_LIMIT = 10
    RATE_LIMIT_INTERVAL = 5  # 秒
    
    # 加密金鑰 - 用於加密 API Keys（持久化避免重啟後無法解密）
    ENCRYPTION_KEY = _get_or_create_key('ENCRYPTION_KEY', '.encryption_key', 32)
    
    # Prompt 目錄 (優先使用 backend/prompts，fallback 到根目錄的 prompts)
    PROMPTS_DIR = BACKEND_DIR / 'prompts'


class DevelopmentConfig(Config):
    """Development configuration"""
    DEBUG = True


class ProductionConfig(Config):
    """Production configuration"""
    DEBUG = False


def get_config():
    """Get configuration based on environment"""
    env = os.getenv('FLASK_ENV', 'development')
    configs = {
        'development': DevelopmentConfig,
        'production': ProductionConfig
    }
    return configs.get(env, DevelopmentConfig)()
