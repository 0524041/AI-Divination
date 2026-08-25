"""
pytest 共用夾具

提供：
- 測試專用資料庫（每個測試乾淨、與開發資料隔離）
- 帶認證的 FastAPI 測試客戶端
- 使用者/管理員建立工廠
- 假 OpenAI-compatible 伺服器夾具

注意：環境變數必須在任何 app 模組導入前設定，
conftest 於 pytest 收集階段最先載入，故置於檔案頂部。
"""

import os
import tempfile

from cryptography.fernet import Fernet

# --- 環境隔離（務必在導入 app.* 之前） ---
_TMP_DIR = tempfile.mkdtemp(prefix="ai-divination-test-")
os.environ["DATABASE_URL"] = f"sqlite:///{_TMP_DIR}/test.db"
# 明確提供金鑰，避免測試觸碰/生成 backend 下的金鑰檔
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-pytest")
os.environ.setdefault("ENCRYPTION_KEY", Fernet.generate_key().decode())
os.environ.setdefault("OPENCODE_API_KEY", "test-opencode-key")
os.environ.setdefault("AGNES_API_KEY", "test-agnes-key")
os.environ.setdefault("AGNES_BASE_URL", "https://apihub.agnes-ai.com/v1")
os.environ.setdefault("AGNES_MODEL_ID", "agnes-2.0-flash")

import httpx  # noqa: E402
import pytest  # noqa: E402

from app.core.database import Base, SessionLocal  # noqa: E402
from app.models import User  # noqa: E402
from app.models.birth_data import UserBirthData  # noqa: E402, F401
from app.utils.auth import create_access_token, hash_password  # noqa: E402
from tests.fake_openai_server import FakeOpenAICompatServer  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def _schema():
    """整個測試 session 建立一次 schema"""
    Base.metadata.create_all(bind=SessionLocal.kw["bind"])
    yield


@pytest.fixture(autouse=True)
def clean_db(_schema):
    """每個測試前清空所有資料表，保證測試隔離"""
    with SessionLocal() as session:
        for table in reversed(Base.metadata.sorted_tables):
            session.execute(table.delete())
        session.commit()
    yield


@pytest.fixture
def client():
    """未認證的 FastAPI 測試客戶端（同步）"""
    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def make_user():
    """使用者建立工廠：make_user(username=..., password=..., role=...)"""

    def _make(
        username: str = "tester",
        password: str = "password123",
        role: str = "user",
        is_active: bool = True,
    ) -> User:
        user = User(
            username=username,
            password_hash=hash_password(password),
            role=role,
            is_active=is_active,
        )
        with SessionLocal() as session:
            session.add(user)
            session.commit()
            session.refresh(user)
        return user

    return _make


@pytest.fixture
def auth_headers():
    """產生指定使用者的 Bearer headers"""

    def _headers(username: str) -> dict[str, str]:
        token = create_access_token({"sub": username})
        return {"Authorization": f"Bearer {token}"}

    return _headers


@pytest.fixture
def auth_client(client, auth_headers):
    """已認證的測試客戶端工廠：auth_client(user) 回傳帶 Bearer 的客戶端"""

    def _wrap(user: User) -> httpx.AsyncClient:
        client.headers.update(auth_headers(user.username))
        return client

    return _wrap


@pytest.fixture
def fake_ai():
    """假 OpenAI-compatible 伺服器：fake_ai.base_url / respond_* / requests"""
    server = FakeOpenAICompatServer().start()
    try:
        yield server
    finally:
        server.stop()
