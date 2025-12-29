"""
核心配置模組
"""
import os
import secrets
from pathlib import Path
from pydantic_settings import BaseSettings
from functools import lru_cache

# 專案根目錄
BASE_DIR = Path(__file__).resolve().parent.parent.parent


class Settings(BaseSettings):
    """應用程式配置"""
    
    # 應用程式
    APP_NAME: str = "AI-Divination"
    DEBUG: bool = True
    
    # 資料庫
    DATABASE_URL: str = f"sqlite:///{BASE_DIR}/divination.db"
    
    # JWT 設定
    SECRET_KEY: str = ""
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 天
    
    # 加密金鑰 (用於加密 API Key)
    ENCRYPTION_KEY: str = ""
    
    class Config:
        env_file = ".env"
        extra = "ignore"
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._ensure_keys()
    
    def _ensure_keys(self):
        """確保金鑰存在"""
        secret_key_file = BASE_DIR / ".secret_key"
        encryption_key_file = BASE_DIR / ".encryption_key"
        
        # JWT Secret Key
        if not self.SECRET_KEY:
            if secret_key_file.exists():
                self.SECRET_KEY = secret_key_file.read_text().strip()
            else:
                self.SECRET_KEY = secrets.token_urlsafe(32)
                secret_key_file.write_text(self.SECRET_KEY)
        
        # Encryption Key
        if not self.ENCRYPTION_KEY:
            if encryption_key_file.exists():
                self.ENCRYPTION_KEY = encryption_key_file.read_text().strip()
            else:
                from cryptography.fernet import Fernet
                self.ENCRYPTION_KEY = Fernet.generate_key().decode()
                encryption_key_file.write_text(self.ENCRYPTION_KEY)


@lru_cache()
def get_settings() -> Settings:
    """取得快取的設定實例"""
    return Settings()
