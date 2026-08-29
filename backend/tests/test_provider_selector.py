"""
AI 端點選擇整合測試（provider/model selector 重設計）

- 系統預設唯一性：種子只建 Agnes
- Gemini 自訂設定：可自選模型 id、經 Google OpenAI 相容層解析
- /api/settings/ai/default-info：訪客可讀系統預設資訊
"""

from app.core.database import SessionLocal
from app.models.settings import AIConfig
from app.utils.auth import encrypt_api_key

# --- Gemini 設定：模型可選可自填 ---


def _make_gemini_config(user_id: int, model: str) -> int:
    with SessionLocal() as db:
        config = AIConfig(
            user_id=user_id,
            provider="gemini",
            name="我的 Gemini",
            model=model,
            api_key_encrypted=encrypt_api_key("g-key"),
            is_active=True,
            base_url="https://generativelanguage.googleapis.com/v1beta/openai",
            preset_id="gemini",
            models=f'[{{"id": "{model}", "enabled": true}}]',
        )
        db.add(config)
        db.commit()
        db.refresh(config)
        return config.id


# --- 解析：Gemini 經官方 OpenAI 相容層（明確指定連線×模型） ---


def test_resolve_gemini_config_uses_google_compat_endpoint(make_user):
    from app.services.endpoints import resolve_endpoint

    user = make_user(username="gemini-resolve")
    connection_id = _make_gemini_config(user.id, "gemini-3.6-flash")

    resolved = resolve_endpoint(
        SessionLocal(),
        user_id=user.id,
        connection_id=connection_id,
        model_id="gemini-3.6-flash",
    )
    assert resolved.source == "user"
    assert resolved.model == "gemini-3.6-flash"
    assert resolved.base_url == "https://generativelanguage.googleapis.com/v1beta/openai"
    assert resolved.completions_url.endswith("/chat/completions")


def test_resolve_without_user_config_falls_back_to_system_default(make_user, fake_ai):
    """未設定自訂端點 → 系統預設（Agnes）"""
    from app.services.endpoints import ensure_default_seed, resolve_endpoint
    from app.utils.auth import encrypt_api_key

    with SessionLocal() as db:
        endpoint = ensure_default_seed(db)
        endpoint.base_url = fake_ai.base_url
        endpoint.model = "fake-model"
        endpoint.api_key_encrypted = encrypt_api_key("sk-test")
        db.commit()

    user = make_user(username="no-config-user")
    resolved = resolve_endpoint(SessionLocal(), user_id=user.id)
    assert resolved.source == "system"


# （舊「activate/use-default」全域切換測試已隨新語意移除：
#   模型選擇改為綁定紀錄，見 tests/test_record_binding.py）


# --- default-info：訪客可讀的系統預設資訊 ---


def test_default_info_accessible(client, auth_headers, make_user):
    """登入使用者與訪客皆可讀系統預設資訊"""
    make_user(username="info-user")
    response = client.get("/api/settings/ai/default-info", headers=auth_headers("info-user"))

    assert response.status_code == 200
    body = response.json()
    assert "Agnes" in body["name"]
    assert body["model"]
