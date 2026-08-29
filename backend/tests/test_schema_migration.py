"""
資料遷移測試（spec: ai-model-selection）

舊 ai_configs（provider/model/local_url/local_model）→ 新連線模型
（base_url / models JSON / preset_id）：
- local 的 local_url → base_url，model/local_model → models JSON（enabled=true）
- gemini/openai 依 provider 映射到官方 OpenAI 相容 base_url 與 preset_id
舊 system_ai_endpoints（單一 model）→ models JSON + default_model。
"""

import json
import sqlite3

from app.core.schema_migrations import migrate_ai_model_columns

OLD_AI_CONFIGS = """
CREATE TABLE ai_configs (
    id INTEGER PRIMARY KEY,
    user_id INTEGER,
    provider VARCHAR(20) NOT NULL,
    name VARCHAR(50),
    model VARCHAR(100),
    api_key_encrypted TEXT,
    local_url VARCHAR(255),
    local_model VARCHAR(100),
    is_active BOOLEAN,
    created_at DATETIME,
    updated_at DATETIME
)
"""

OLD_SYSTEM_ENDPOINTS = """
CREATE TABLE system_ai_endpoints (
    id INTEGER PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    base_url VARCHAR(255) NOT NULL,
    api_key_encrypted TEXT NOT NULL,
    model VARCHAR(100) NOT NULL,
    is_default BOOLEAN,
    is_active BOOLEAN,
    created_at DATETIME,
    updated_at DATETIME
)
"""


def _old_db():
    conn = sqlite3.connect(":memory:")
    conn.execute(OLD_AI_CONFIGS)
    conn.execute(OLD_SYSTEM_ENDPOINTS)
    conn.executemany(
        "INSERT INTO ai_configs (user_id, provider, model, local_url, local_model) "
        "VALUES (?, ?, ?, ?, ?)",
        [
            (1, "gemini", "gemini-3.5-flash", None, None),
            (1, "local", None, "http://localhost:11434/v1", "llama3"),
            (1, "openai", None, None, "gpt-x"),
        ],
    )
    conn.execute(
        "INSERT INTO system_ai_endpoints (name, base_url, api_key_encrypted, model, "
        "is_default, is_active) VALUES ('Agnes 預設', 'https://x/v1', 'enc', "
        "'agnes-2.0-flash', 1, 1)"
    )
    conn.commit()
    return conn


def test_migrates_local_url_to_base_url_and_models():
    conn = _old_db()
    migrate_ai_model_columns(conn)

    cols = [r[1] for r in conn.execute("PRAGMA table_info(ai_configs)")]
    assert "base_url" in cols and "models" in cols and "preset_id" in cols

    local = conn.execute(
        "SELECT base_url, preset_id, models FROM ai_configs WHERE provider='local'"
    ).fetchone()
    assert local[0] == "http://localhost:11434/v1"
    assert local[1] == "custom"
    models = json.loads(local[2])
    assert models == [{"id": "llama3", "enabled": True}]


def test_migrates_provider_configs_to_compat_base_url():
    conn = _old_db()
    migrate_ai_model_columns(conn)

    gemini = conn.execute(
        "SELECT base_url, preset_id FROM ai_configs WHERE provider='gemini'"
    ).fetchone()
    assert gemini[0] == "https://generativelanguage.googleapis.com/v1beta/openai"
    assert gemini[1] == "gemini"

    openai = conn.execute(
        "SELECT base_url, preset_id, models FROM ai_configs WHERE provider='openai'"
    ).fetchone()
    assert openai[0] == "https://api.openai.com/v1"
    assert openai[1] == "openai"
    assert json.loads(openai[2]) == [{"id": "gpt-x", "enabled": True}]


def test_migrates_system_endpoint_to_models_list():
    conn = _old_db()
    migrate_ai_model_columns(conn)

    cols = [r[1] for r in conn.execute("PRAGMA table_info(system_ai_endpoints)")]
    assert "models" in cols and "default_model" in cols

    row = conn.execute(
        "SELECT models, default_model FROM system_ai_endpoints"
    ).fetchone()
    assert json.loads(row[0]) == [{"id": "agnes-2.0-flash", "enabled": True}]
    assert row[1] == "agnes-2.0-flash"


def test_migration_is_idempotent():
    conn = _old_db()
    migrate_ai_model_columns(conn)
    migrate_ai_model_columns(conn)  # 不應噴錯、不應重複轉換

    models = conn.execute(
        "SELECT models FROM ai_configs WHERE provider='local'"
    ).fetchone()[0]
    assert json.loads(models) == [{"id": "llama3", "enabled": True}]
