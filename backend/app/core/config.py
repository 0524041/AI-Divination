"""
Application configuration - 應用程式配置
"""
import os
from pathlib import Path

class Config:
    """Base configuration class"""
    
    # 路徑設定
    # backend/app/core/config.py -> backend/app/core -> backend/app -> backend -> project_root
    BACKEND_DIR = Path(__file__).resolve().parent.parent.parent  # backend/
    BASE_DIR = BACKEND_DIR.parent  # project_root/
    
    # Flask 設定
    SECRET_KEY = os.getenv('SECRET_KEY', os.urandom(24))
    SESSION_COOKIE_HTTPONLY = True
    PERMANENT_SESSION_LIFETIME = 86400  # 24 hours
    
    # CORS 設定
    CORS_ORIGINS = [
        'http://localhost:3000',
        'http://127.0.0.1:3000'
    ]
    
    # 資料庫設定 (在專案根目錄)
    DATABASE_PATH = BASE_DIR / 'divination.db'
    
    # AI 模型設定
    GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
    MODEL_ID = "gemini-2.0-flash-thinking-exp-01-21"
    
    # 占卜設定
    DEFAULT_DAILY_LIMIT = 10
    RATE_LIMIT_INTERVAL = 5  # 秒
    
    # 加密金鑰
    ENCRYPTION_KEY = os.getenv('ENCRYPTION_KEY')
    
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
