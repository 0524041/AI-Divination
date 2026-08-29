"""
Provider 預設清單測試（spec: ai-model-selection）

內建服務清單（比照 OpenCode 內部清單做法）：
- 以 repo 內靜態檔維護，含 base_url、建議模型與 per-model 呼叫參數
- Agnes 的思考參數必為字串型 reasoning_effort（數值型被 Agnes 閘道拒絕）
- Gemini 走官方 OpenAI 相容層（使用者不必分辨 SDK 差異）
"""

from app.services.ai_provider import ModelCallParams
from app.services.presets import get_preset, load_presets, preset_model_params


def test_load_presets_contains_known_services():
    ids = {p["id"] for p in load_presets()}

    assert {"agnes", "gemini", "openai", "openrouter", "ollama", "lmstudio", "custom"} <= ids


def test_every_preset_has_required_fields():
    for preset in load_presets():
        assert preset["id"] and preset["name"], preset
        assert "base_url" in preset
        assert isinstance(preset.get("models", []), list)


def test_agnes_preset_uses_string_reasoning_effort():
    preset = get_preset("agnes")

    assert preset["base_url"] == "https://apihub.agnes-ai.com/v1"
    model = next(m for m in preset["models"] if m["id"] == "agnes-2.0-flash")
    assert model["params"]["reasoning_param"] == "reasoning_effort"
    assert model["params"]["reasoning_value"] in ("low", "medium", "high")


def test_gemini_preset_uses_official_openai_compat_url():
    preset = get_preset("gemini")

    assert preset["base_url"] == "https://generativelanguage.googleapis.com/v1beta/openai"
    assert any(m["id"] == "gemini-3.6-flash" for m in preset["models"])


def test_local_presets_disable_reasoning_param():
    """本機模型伺服器（Ollama 等）明確不送思考參數"""
    for preset_id in ("ollama", "lmstudio"):
        preset = get_preset(preset_id)
        for model in preset["models"]:
            assert model["params"]["reasoning_param"] is None, preset_id


def test_preset_model_params_returns_call_params():
    params = preset_model_params("agnes", "agnes-2.0-flash")

    assert isinstance(params, ModelCallParams)
    assert params.reasoning_param == "reasoning_effort"
    assert params.reasoning_value in ("low", "medium", "high")


def test_preset_model_params_disabled_reasoning():
    params = preset_model_params("ollama", "llama3")

    assert params is not None
    assert params.reasoning_param is None


def test_preset_model_params_unknown_returns_none():
    assert preset_model_params("agnes", "no-such-model") is None
    assert preset_model_params("no-such-preset", "any") is None


def test_preset_model_without_params_returns_none():
    """preset 模型未標 params → 不覆蓋（回 None，交給全域預設）"""
    params = preset_model_params("gemini", "gemini-3.6-flash")

    assert params is None
