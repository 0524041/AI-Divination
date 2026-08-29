"""
Admin 系統端點多模型測試（spec: ai-model-selection）

系統端點支援多個免費模型（models JSON）與 default_model 指定；
訪客與未設定者解析到 default_model。
"""

import pytest

from app.core.database import SessionLocal
from app.services.endpoints import resolve_endpoint

pytestmark = pytest.mark.asyncio

ENDPOINT_PAYLOAD = {
    "name": "Agnes 主力",
    "base_url": "https://apihub.agnes-ai.com/v1",
    "api_key": "sk-admin-key",
    "model": "agnes-2.0-flash",
    "models": [
        {"id": "agnes-2.0-flash", "enabled": True},
        {"id": "agnes-2.5-pro", "enabled": True},
        {"id": "agnes-x", "enabled": False},
    ],
    "default_model": "agnes-2.5-pro",
}


def test_admin_can_manage_endpoint_models(client, auth_headers, make_user):
    make_user(username="admin-models", role="admin")
    headers = auth_headers("admin-models")

    created = client.post("/api/admin/endpoints", json=ENDPOINT_PAYLOAD, headers=headers)
    assert created.status_code == 200
    body = created.json()
    assert [m["id"] for m in body["models"]] == ["agnes-2.0-flash", "agnes-2.5-pro", "agnes-x"]
    assert body["default_model"] == "agnes-2.5-pro"

    listing = client.get("/api/admin/endpoints", headers=headers).json()
    assert listing[0]["default_model"] == "agnes-2.5-pro"


def test_non_admin_cannot_manage_endpoints(client, auth_headers, make_user):
    make_user(username="not-admin")
    response = client.post(
        "/api/admin/endpoints", json=ENDPOINT_PAYLOAD, headers=auth_headers("not-admin")
    )
    assert response.status_code in (401, 403)


async def test_resolve_uses_default_model_of_system_endpoint(
    client, auth_headers, make_user, fake_ai
):
    """無設定使用者/訪客 → 解析到端點的 default_model"""
    from app.services.endpoints import ensure_default_seed
    from app.utils.auth import encrypt_api_key

    with SessionLocal() as db:
        endpoint = ensure_default_seed(db)
        endpoint.base_url = fake_ai.base_url
        endpoint.model = "agnes-2.0-flash"
        endpoint.default_model = "agnes-2.5-pro"
        endpoint.set_models_list(
            [
                {"id": "agnes-2.0-flash", "enabled": True},
                {"id": "agnes-2.5-pro", "enabled": True},
            ]
        )
        endpoint.api_key_encrypted = encrypt_api_key("sk-test")
        db.commit()

    make_user(username="default-model-user")

    with SessionLocal() as db:
        resolved = resolve_endpoint(db)

    assert resolved.model == "agnes-2.5-pro"
    assert resolved.source == "system"
