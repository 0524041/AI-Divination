"""
AI 設定模型
"""

import json
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text

from app.core.database import Base


class AIConfig(Base):
    """AI 服務連線（spec: ai-model-selection）

    一筆 = 一個 OpenAI-compatible 服務連線：{name, base_url, api_key}，
    並維護自己的模型清單（models JSON：[{id, label, enabled, params}]）。
    舊欄位（provider/model/local_url/local_model/is_active）保留供舊資料查詢，
    新程式碼不再讀寫。
    """

    __tablename__ = "ai_configs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    provider = Column(String(20), nullable=True)  # (舊) 'gemini' | 'local' | 'openai'
    name = Column(String(50), nullable=True)  # 用戶自訂的 AI 服務名稱
    model = Column(String(100), nullable=True)  # (舊) AI 模型名稱
    api_key_encrypted = Column(Text, nullable=True)  # API Key (加密)
    local_url = Column(String(255), nullable=True)  # (舊) Local AI URL
    local_model = Column(String(100), nullable=True)  # (舊) 向後相容
    is_active = Column(Boolean, default=False)  # (舊) 全域啟用旗標，已由偏好取代
    # --- 新欄位（連線×模型） ---
    base_url = Column(String(255), nullable=True)  # OpenAI-compatible 服務位址
    models = Column(Text, nullable=True)  # JSON: [{id, label?, enabled, params?}]
    preset_id = Column(String(30), nullable=True)  # 對應 presets.json 的服務 id
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    @property
    def effective_model(self) -> str:
        """獲取有效的模型名稱（優先使用 model，其次 local_model；舊資料相容）"""
        return self.model or self.local_model or ""

    def models_list(self) -> list[dict]:
        """解析 models JSON；格式錯誤視為空清單"""
        if not self.models:
            return []
        try:
            entries = json.loads(self.models)
        except (json.JSONDecodeError, TypeError):
            return []
        return entries if isinstance(entries, list) else []

    def set_models_list(self, entries: list[dict]) -> None:
        self.models = json.dumps(entries, ensure_ascii=False)

    def enabled_model_ids(self) -> list[str]:
        return [m["id"] for m in self.models_list() if m.get("enabled", True)]

    def model_entry(self, model_id: str) -> dict | None:
        """取得指定模型的清單項目（含 params）"""
        return next(
            (m for m in self.models_list() if m.get("id") == model_id), None
        )


class UserAIPreference(Base):
    """使用者的 AI 偏好（spec: ai-model-selection）

    我的預設模型：default_connection_id 為 NULL 時代表系統免費模型。
    取代舊 ai_configs.is_active 全域旗標。
    """

    __tablename__ = "user_ai_preferences"

    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    default_connection_id = Column(Integer, nullable=True)
    default_model_id = Column(String(100), nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
