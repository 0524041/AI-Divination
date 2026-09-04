"""
核心配置模組
"""

import secrets
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings

# 專案根目錄
BASE_DIR = Path(__file__).resolve().parent.parent.parent


class Settings(BaseSettings):
    """應用程式配置"""

    # 應用程式
    APP_NAME: str = "AI-Divination"
    DEBUG: bool = False

    # 資料庫
    DATABASE_URL: str = f"sqlite:///{BASE_DIR}/divination.db"

    # JWT 設定
    SECRET_KEY: str = ""
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7

    # 加密金鑰
    ENCRYPTION_KEY: str = ""

    # 系統預設 AI 端點（Agnes）— 作為系統預設端點的種子資料
    AGNES_API_KEY: str = ""
    AGNES_BASE_URL: str = "https://apihub.agnes-ai.com/v1"
    AGNES_MODEL_ID: str = "agnes-2.5-flash"
    # 種子化時是否探測 /models 建立免費模型清單（測試環境關閉以避免外部網路）
    AI_PROBE_MODELS: bool = True

    # CORS 設定
    ALLOWED_ORIGINS: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]

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

        # 注意: API_REQUEST_SIGNATURE_KEY 已移除，不再使用簽名驗證


@lru_cache()
def get_settings() -> Settings:
    """取得快取的設定實例"""
    return Settings()
