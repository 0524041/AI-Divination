"""
系統預設 AI 端點模型（ADR-0001）

管理者可新增/編輯/停用系統級端點並指定其中之一為預設，
供訪客與未設定自訂端點的使用者使用。
"""

import json
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text

from app.core.database import Base


class SystemAIEndpoint(Base):
    """系統預設 AI 端點表（ADR-0001；模型清單化見 spec: ai-model-selection）

    管理者可新增/編輯/停用系統級端點；一個端點可提供多個免費模型
    （models JSON：[{id, label?, enabled}]），並指定 default_model
    作為訪客與未設定者的預設。
    """

    __tablename__ = "system_ai_endpoints"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), nullable=False)
    base_url = Column(String(255), nullable=False)  # OpenAI-compatible，建議含 /v1
    api_key_encrypted = Column(Text, nullable=False)
    model = Column(String(100), nullable=False)  # (舊) 單一模型欄位，遷移後併入 models
    models = Column(Text, nullable=True)  # JSON: [{id, label?, enabled}]
    default_model = Column(String(100), nullable=True)  # 預設免費模型；NULL 時回退 model
    is_default = Column(Boolean, default=False, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def models_list(self) -> list[dict]:
        """解析 models JSON；空值時以舊 model 欄位單項呈現"""
        if not self.models:
            return [{"id": self.model, "enabled": True}]
        try:
            entries = json.loads(self.models)
        except (json.JSONDecodeError, TypeError):
            return [{"id": self.model, "enabled": True}]
        return entries if isinstance(entries, list) else []

    def set_models_list(self, entries: list[dict]) -> None:
        self.models = json.dumps(entries, ensure_ascii=False)

    def enabled_model_ids(self) -> list[str]:
        return [m["id"] for m in self.models_list() if m.get("enabled", True)]

    def effective_default_model(self) -> str:
        return self.default_model or self.model
