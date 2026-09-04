"""
系統免費模型可見性測試（spec: ai-model-selection）

使用者下拉只看得到 Agnes 內建款（agnes-2.5-flash / agnes-2.0-flash）：
- 種子化：僅 preset 內建款 enabled，探測到的其他模型 disabled 供管理員開啟
- 資料遷移：既有 DB 的 Agnes 端點一次性收斂（marker 表防止覆蓋管理員後續調整）
- Admin API：probe-models 即時探測；PUT 可只改模型清單（留空金鑰＝沿用）
"""

import json
import sqlite3

from app.core.database import SessionLocal
from app.core.schema_migrations import migrate_ai_model_columns
from app.services.endpoints import ensure_default_seed
from app.services.presets import get_preset

# ========== 種子化 ==========


def test_seed_enables_only_preset_agnes_models():
    """種子化（探測關閉）：enabled 僅 preset agnes 款"""
    with SessionLocal() as db:
        endpoint = ensure_default_seed(db)

    visible = {m["id"] for m in (get_preset("agnes") or {}).get("models", [])}
    enabled = [m["id"] for m in endpoint.models_list() if m.get("enabled")]
    assert set(enabled) == visible
    assert "agnes-2.5-flash" in enabled


def test_seed_marks_probed_extras_disabled(monkeypatch):
    """種子化（探測開啟）：探測到的非內建款保留但 disabled"""
    import types

    import app.services.endpoints as endpoint_service

    fake_settings = types.SimpleNamespace(
        AGNES_API_KEY="test-agnes-key",
        AGNES_BASE_URL="https://apihub.agnes-ai.com/v1",
        AGNES_MODEL_ID="agnes-2.5-flash",
        AI_PROBE_MODELS=True,
    )
    monkeypatch.setattr(
        endpoint_service,
        "probe_models",
        lambda base_url, api_key: [
            "agnes-2.5-flash",
            "agnes-3.0-turbo",
            "agnes-experimental",
        ],
    )
    monkeypatch.setattr(
        endpoint_service, "get_settings", lambda: fake_settings
    )

    with SessionLocal() as db:
        endpoint = ensure_default_seed(db)

    entries = {m["id"]: m["enabled"] for m in endpoint.models_list()}
    assert entries["agnes-2.5-flash"] is True
    assert entries["agnes-2.0-flash"] is True
    assert entries["agnes-3.0-turbo"] is False
    assert entries["agnes-experimental"] is False


# ========== 資料遷移（既有 DB 收斂） ==========

AI_CONFIGS_TABLE = """
CREATE TABLE ai_configs (
    id INTEGER PRIMARY KEY,
    user_id INTEGER,
    provider VARCHAR(20),
    name VARCHAR(50),
    model VARCHAR(100),
    api_key_encrypted TEXT,
    local_url VARCHAR(255),
    local_model VARCHAR(100),
    is_active BOOLEAN,
    created_at DATETIME,
    updated_at DATETIME,
    base_url VARCHAR(255),
    models TEXT,
    preset_id VARCHAR(30)
)
"""

SYSTEM_ENDPOINTS_TABLE = """
CREATE TABLE system_ai_endpoints (
    id INTEGER PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    base_url VARCHAR(255) NOT NULL,
    api_key_encrypted TEXT NOT NULL,
    model VARCHAR(100) NOT NULL,
    models TEXT,
    default_model VARCHAR(100),
    is_default BOOLEAN,
    is_active BOOLEAN,
    created_at DATETIME,
    updated_at DATETIME
)
"""


def _db_with_agnes_endpoint():
    conn = sqlite3.connect(":memory:")
    conn.execute(AI_CONFIGS_TABLE)
    conn.execute(SYSTEM_ENDPOINTS_TABLE)
    conn.execute(
        "INSERT INTO system_ai_endpoints (name, base_url, api_key_encrypted, model, "
        "is_default, is_active, models) VALUES (?, ?, ?, ?, 1, 1, ?)",
        (
            "Agnes 預設",
            "https://apihub.agnes-ai.com/v1",
            "enc",
            "agnes-2.5-flash",
            json.dumps(
                [
                    {"id": "agnes-2.5-flash", "enabled": True},
                    {"id": "agnes-3.0-turbo", "enabled": True},
                    {"id": "agnes-experimental", "enabled": True},
                ]
            ),
        ),
    )
    conn.commit()
    return conn


def test_migration_disables_non_preset_agnes_models():
    """既有 Agnes 端點：非內建款一次性 disabled，內建款維持 enabled"""
    conn = _db_with_agnes_endpoint()
    migrate_ai_model_columns(conn)

    entries = {
        m["id"]: m["enabled"]
        for m in json.loads(
            conn.execute("SELECT models FROM system_ai_endpoints").fetchone()[0]
        )
    }
    assert entries == {
        "agnes-2.5-flash": True,
        "agnes-3.0-turbo": False,
        "agnes-experimental": False,
    }


def test_migration_marker_prevents_overriding_admin_changes():
    """marker 表記錄已執行：管理員之後手動開啟的模型不會被再次關閉"""
    conn = _db_with_agnes_endpoint()
    migrate_ai_model_columns(conn)

    # 管理員手動重新開啟 agnes-3.0-turbo
    entries = json.loads(
        conn.execute("SELECT models FROM system_ai_endpoints").fetchone()[0]
    )
    for entry in entries:
        if entry["id"] == "agnes-3.0-turbo":
            entry["enabled"] = True
    conn.execute(
        "UPDATE system_ai_endpoints SET models = ?",
        (json.dumps(entries),),
    )
    conn.commit()

    migrate_ai_model_columns(conn)  # 再跑一次不應覆蓋

    after = {
        m["id"]: m["enabled"]
        for m in json.loads(
            conn.execute("SELECT models FROM system_ai_endpoints").fetchone()[0]
        )
    }
    assert after["agnes-3.0-turbo"] is True


def test_migration_leaves_non_agnes_endpoints_alone():
    """非 Agnes 端點不受影響"""
    conn = _db_with_agnes_endpoint()
    conn.execute(
        "INSERT INTO system_ai_endpoints (name, base_url, api_key_encrypted, model, "
        "is_default, is_active, models) VALUES ('其他', 'https://api.example.com/v1', "
        "'enc', 'm1', 0, 1, ?)",
        (json.dumps([{"id": "m1", "enabled": True}, {"id": "m2", "enabled": True}]),),
    )
    conn.commit()
    migrate_ai_model_columns(conn)

    models = conn.execute(
        "SELECT models FROM system_ai_endpoints WHERE name='其他'"
    ).fetchone()[0]
    assert json.loads(models) == [
        {"id": "m1", "enabled": True},
        {"id": "m2", "enabled": True},
    ]


# ========== Admin API ==========


def test_admin_probe_models_route(client, auth_headers, make_user, fake_ai):
    """GET probe-models 回傳即時探測結果"""
    make_user(username="admin-probe", role="admin")
    headers = auth_headers("admin-probe")

    created = client.post(
        "/api/admin/endpoints",
        json={
            "name": "假伺服器",
            "base_url": f"{fake_ai.base_url}/v1",
            "api_key": "sk-admin",
            "model": "fake-model",
        },
        headers=headers,
    )
    endpoint_id = created.json()["id"]

    fake_ai.models_response = {"object": "list", "data": [{"id": "m-a"}, {"id": "m-b"}]}
    response = client.get(
        f"/api/admin/endpoints/{endpoint_id}/probe-models", headers=headers
    )
    assert response.status_code == 200
    assert response.json() == {"models": ["m-a", "m-b"]}


def test_admin_update_models_without_api_key(client, auth_headers, make_user, fake_ai):
    """PUT 可只改模型清單；api_key 留空＝沿用原金鑰"""
    make_user(username="admin-models-edit", role="admin")
    headers = auth_headers("admin-models-edit")

    created = client.post(
        "/api/admin/endpoints",
        json={
            "name": "假伺服器",
            "base_url": fake_ai.base_url,
            "api_key": "sk-keep-me",
            "model": "fake-model",
        },
        headers=headers,
    )
    endpoint_id = created.json()["id"]

    updated = client.put(
        f"/api/admin/endpoints/{endpoint_id}",
        json={
            "name": "假伺服器",
            "base_url": fake_ai.base_url,
            "api_key": "",
            "model": "fake-model",
            "models": [{"id": "fake-model", "enabled": True}, {"id": "m-x", "enabled": False}],
            "default_model": "fake-model",
        },
        headers=headers,
    )
    assert updated.status_code == 200
    body = updated.json()
    assert [m["id"] for m in body["models"]] == ["fake-model", "m-x"]
    assert body["default_model"] == "fake-model"
    assert body["key_preview"].endswith("e-me") or body["key_preview"].startswith("••••")


def test_admin_update_still_accepts_new_api_key(client, auth_headers, make_user):
    """PUT 帶新金鑰時照常替換"""
    make_user(username="admin-key-rotate", role="admin")
    headers = auth_headers("admin-key-rotate")

    created = client.post(
        "/api/admin/endpoints",
        json={
            "name": "端點",
            "base_url": "https://api.example.com/v1",
            "api_key": "sk-old",
            "model": "m1",
        },
        headers=headers,
    )
    endpoint_id = created.json()["id"]
    assert created.json()["key_preview"].endswith("old")

    updated = client.put(
        f"/api/admin/endpoints/{endpoint_id}",
        json={
            "name": "端點",
            "base_url": "https://api.example.com/v1",
            "api_key": "sk-new-key",
            "model": "m1",
        },
        headers=headers,
    )
    assert updated.json()["key_preview"].endswith("key")


def test_create_endpoint_requires_api_key(client, auth_headers, make_user):
    """新增端點仍需 API Key"""
    make_user(username="admin-create", role="admin")
    headers = auth_headers("admin-create")

    response = client.post(
        "/api/admin/endpoints",
        json={"name": "端點", "base_url": "https://api.example.com/v1", "model": "m1"},
        headers=headers,
    )
    assert response.status_code == 400
