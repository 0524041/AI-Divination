"""
設定 API 測試（spec: ai-model-selection）

連線×模型重塑：
- GET /api/settings/ai/presets：內建服務清單
- POST/PUT/GET /api/settings/ai：連線 CRUD（新格式 name/base_url/api_key/preset_id）
- PUT /api/settings/ai/{id}/models：連線的模型清單維護（顯示/隱藏、參數）
- GET /api/settings/ai/models：聚合模型清單（系統＋使用者；訪客僅系統）
- PUT /api/settings/ai/default-model：我的預設模型
- 舊 activate/use-default 端點移除
"""

from app.core.database import SessionLocal

# --- presets ---


def test_presets_requires_auth(client):
    assert client.get("/api/settings/ai/presets").status_code == 401


def test_list_presets(client, auth_headers, make_user):
    make_user(username="presets-user")
    response = client.get("/api/settings/ai/presets", headers=auth_headers("presets-user"))

    assert response.status_code == 200
    ids = {p["id"] for p in response.json()}
    assert {"agnes", "gemini", "openai", "openrouter", "ollama", "lmstudio", "custom"} <= ids
    gemini = next(p for p in response.json() if p["id"] == "gemini")
    assert gemini["base_url"]


# --- 連線 CRUD（新格式） ---


def test_create_connection(client, auth_headers, make_user):
    make_user(username="conn-create")
    response = client.post(
        "/api/settings/ai",
        json={
            "name": "我的 OpenRouter",
            "base_url": "https://openrouter.ai/api/v1",
            "api_key": "sk-or-test",
            "preset_id": "openrouter",
        },
        headers=auth_headers("conn-create"),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "我的 OpenRouter"
    assert body["base_url"] == "https://openrouter.ai/api/v1"
    assert body["preset_id"] == "openrouter"
    assert body["has_api_key"] is True
    assert body["models"] == []


def test_create_connection_requires_base_url(client, auth_headers, make_user):
    make_user(username="conn-nourl")
    response = client.post(
        "/api/settings/ai",
        json={"name": "x"},
        headers=auth_headers("conn-nourl"),
    )
    assert response.status_code == 400


def test_create_connection_allows_local_url(client, auth_headers, make_user):
    """本機服務（Ollama 等）開放所有使用者連線"""
    make_user(username="conn-local")
    response = client.post(
        "/api/settings/ai",
        json={"name": "本機 Ollama", "base_url": "http://localhost:11434/v1", "preset_id": "ollama"},
        headers=auth_headers("conn-local"),
    )
    assert response.status_code == 200
    assert response.json()["base_url"] == "http://localhost:11434/v1"


def test_list_and_update_connections(client, auth_headers, make_user):
    make_user(username="conn-list")
    headers = auth_headers("conn-list")
    created = client.post(
        "/api/settings/ai",
        json={"name": "舊名", "base_url": "https://api.openai.com/v1"},
        headers=headers,
    ).json()

    listing = client.get("/api/settings/ai", headers=headers).json()
    assert [c["id"] for c in listing] == [created["id"]]

    updated = client.put(
        f"/api/settings/ai/{created['id']}",
        json={"name": "新名", "base_url": "https://openrouter.ai/api/v1", "api_key": "sk-new"},
        headers=headers,
    )
    assert updated.status_code == 200
    assert updated.json()["name"] == "新名"
    assert updated.json()["has_api_key"] is True


def test_delete_connection(client, auth_headers, make_user):
    make_user(username="conn-del")
    headers = auth_headers("conn-del")
    created = client.post(
        "/api/settings/ai",
        json={"name": "待刪", "base_url": "https://api.openai.com/v1"},
        headers=headers,
    ).json()

    assert client.delete(f"/api/settings/ai/{created['id']}", headers=headers).status_code == 200
    assert client.get("/api/settings/ai", headers=headers).json() == []


# --- 模型清單維護 ---


def _create_connection(client, headers, **overrides):
    payload = {"name": "我的服務", "base_url": "https://api.openai.com/v1"}
    payload.update(overrides)
    return client.post("/api/settings/ai", json=payload, headers=headers).json()


def test_update_connection_models(client, auth_headers, make_user):
    make_user(username="conn-models")
    headers = auth_headers("conn-models")
    created = _create_connection(client, headers)

    response = client.put(
        f"/api/settings/ai/{created['id']}/models",
        json={
            "models": [
                {"id": "m-fast", "enabled": True},
                {
                    "id": "m-strong",
                    "enabled": True,
                    "params": {"reasoning_param": "reasoning_effort", "reasoning_value": "high"},
                },
                {"id": "m-hidden", "enabled": False},
            ]
        },
        headers=headers,
    )
    assert response.status_code == 200

    listing = client.get("/api/settings/ai", headers=headers).json()
    models = listing[0]["models"]
    assert [m["id"] for m in models] == ["m-fast", "m-strong", "m-hidden"]
    assert models[2]["enabled"] is False
    assert models[1]["params"]["reasoning_value"] == "high"


def test_update_connection_models_rejects_blank_id(client, auth_headers, make_user):
    make_user(username="conn-blank")
    headers = auth_headers("conn-blank")
    created = _create_connection(client, headers)

    response = client.put(
        f"/api/settings/ai/{created['id']}/models",
        json={"models": [{"id": "  ", "enabled": True}]},
        headers=headers,
    )
    assert response.status_code == 400


def test_update_models_of_other_users_connection_rejected(
    client, auth_headers, make_user
):
    make_user(username="conn-owner")
    make_user(username="conn-attacker")
    owner_headers = auth_headers("conn-owner")
    attacker_headers = auth_headers("conn-attacker")
    created = _create_connection(client, owner_headers)

    response = client.put(
        f"/api/settings/ai/{created['id']}/models",
        json={"models": [{"id": "m", "enabled": True}]},
        headers=attacker_headers,
    )
    assert response.status_code == 404


# --- 聚合模型清單 ---


def test_models_aggregation_merges_system_and_user(client, auth_headers, make_user):
    from app.services.endpoints import ensure_default_seed

    make_user(username="agg-user")
    headers = auth_headers("agg-user")
    with SessionLocal() as db:
        ensure_default_seed(db)
    created = _create_connection(client, headers)
    client.put(
        f"/api/settings/ai/{created['id']}/models",
        json={
            "models": [
                {"id": "m-fast", "enabled": True},
                {"id": "m-hidden", "enabled": False},
            ]
        },
        headers=headers,
    )

    response = client.get("/api/settings/ai/models", headers=headers)
    assert response.status_code == 200
    body = response.json()

    entries = body["models"]
    system = [e for e in entries if e["source"] == "system"]
    user = [e for e in entries if e["source"] == "user"]
    assert system and all(e["connection_id"] is None for e in system)
    assert any(e["model_id"] == "agnes-2.0-flash" for e in system)
    assert [(e["connection_id"], e["model_id"]) for e in user] == [
        (created["id"], "m-fast")
    ]
    assert not any(e["model_id"] == "m-hidden" for e in entries)


def test_models_aggregation_guest_sees_only_system(client, auth_headers, make_user):
    from app.services.endpoints import ensure_default_seed

    make_user(username="guest-user", role="guest")
    with SessionLocal() as db:
        ensure_default_seed(db)

    response = client.get(
        "/api/settings/ai/models", headers=auth_headers("guest-user")
    )
    assert response.status_code == 200
    body = response.json()
    assert body["models"]
    assert all(e["source"] == "system" for e in body["models"])


# --- 我的預設模型 ---


def test_default_model_roundtrip(client, auth_headers, make_user):
    from app.services.endpoints import ensure_default_seed

    make_user(username="pref-user")
    headers = auth_headers("pref-user")
    with SessionLocal() as db:
        ensure_default_seed(db)
    created = _create_connection(client, headers)
    client.put(
        f"/api/settings/ai/{created['id']}/models",
        json={"models": [{"id": "m-fast", "enabled": True}]},
        headers=headers,
    )

    response = client.put(
        "/api/settings/ai/default-model",
        json={"connection_id": created["id"], "model_id": "m-fast"},
        headers=headers,
    )
    assert response.status_code == 200

    body = client.get("/api/settings/ai/models", headers=headers).json()
    assert body["default"] == {"connection_id": created["id"], "model_id": "m-fast"}

    # 切回系統免費模型
    client.put(
        "/api/settings/ai/default-model",
        json={"connection_id": None, "model_id": "agnes-2.0-flash"},
        headers=headers,
    )
    body = client.get("/api/settings/ai/models", headers=headers).json()
    assert body["default"] == {"connection_id": None, "model_id": "agnes-2.0-flash"}


def test_default_model_rejects_foreign_connection(client, auth_headers, make_user):
    make_user(username="pref-owner")
    make_user(username="pref-attacker")
    owner_headers = auth_headers("pref-owner")
    attacker_headers = auth_headers("pref-attacker")
    created = _create_connection(client, owner_headers)
    client.put(
        f"/api/settings/ai/{created['id']}/models",
        json={"models": [{"id": "m-fast", "enabled": True}]},
        headers=owner_headers,
    )

    response = client.put(
        "/api/settings/ai/default-model",
        json={"connection_id": created["id"], "model_id": "m-fast"},
        headers=attacker_headers,
    )
    assert response.status_code == 404


def test_default_model_rejects_hidden_model(client, auth_headers, make_user):
    make_user(username="pref-hidden")
    headers = auth_headers("pref-hidden")
    created = _create_connection(client, headers)
    client.put(
        f"/api/settings/ai/{created['id']}/models",
        json={"models": [{"id": "m-hidden", "enabled": False}]},
        headers=headers,
    )

    response = client.put(
        "/api/settings/ai/default-model",
        json={"connection_id": created["id"], "model_id": "m-hidden"},
        headers=headers,
    )
    assert response.status_code == 400


# --- 舊端點移除 ---


def test_activate_and_use_default_removed(client, auth_headers, make_user):
    make_user(username="legacy-api-user")
    headers = auth_headers("legacy-api-user")

    assert (
        client.put("/api/settings/ai/1/activate", headers=headers).status_code == 404
    )
    assert (
        client.put("/api/settings/ai/use-default", headers=headers).status_code in (404, 422)
    )
