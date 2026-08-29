"""
Provider 預設清單（spec: ai-model-selection）

以 repo 內靜態檔（presets.json）維護常見服務的接入資訊：
base_url、建議模型清單與 per-model 呼叫參數。
比照 OpenCode 內部清單的做法——使用者從清單挑服務即完成連線格式設定，
不必分辨各家 SDK / API 差異（全部走 OpenAI-compatible，ADR-0001）。
"""

import json
from functools import lru_cache
from pathlib import Path

from app.services.ai_provider import ModelCallParams, call_params_from_dict

_PRESETS_PATH = Path(__file__).parent / "presets.json"


@lru_cache(maxsize=1)
def load_presets() -> list[dict]:
    """載入內建服務清單（id, name, base_url, requires_api_key, models）"""
    with open(_PRESETS_PATH, encoding="utf-8") as f:
        return json.load(f)["presets"]


def get_preset(preset_id: str) -> dict | None:
    """依 id 取得單一 preset；不存在回 None"""
    return next((p for p in load_presets() if p["id"] == preset_id), None)


def preset_model_params(preset_id: str, model_id: str) -> ModelCallParams | None:
    """preset 中該模型的呼叫參數

    - 模型未標 params 或 preset/模型不存在 → None（不覆蓋，交給上層預設）
    - params 中未出現的欄位保持 UNSET（不覆蓋）
    - "reasoning_param": null 表示明確停用思考參數
    """
    preset = get_preset(preset_id)
    if preset is None:
        return None
    model = next((m for m in preset.get("models", []) if m.get("id") == model_id), None)
    if model is None:
        return None
    return call_params_from_dict(model.get("params"))
