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

OLD_HISTORY = """
CREATE TABLE history (
    id INTEGER PRIMARY KEY,
    user_id INTEGER,
    divination_type VARCHAR(50),
    question TEXT,
    chart_data TEXT,
    interpretation TEXT,
    ai_provider VARCHAR(20),
    ai_model VARCHAR(100),
    status VARCHAR(20),
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
    conn.execute(OLD_HISTORY)
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


def test_makes_provider_nullable_for_legacy_databases():
    """既有 DB 的 provider 是 NOT NULL（新程式碼不再寫入）→ 重建為 nullable"""
    conn = _old_db()
    before = [r for r in conn.execute("PRAGMA table_info(ai_configs)") if r[1] == "provider"]
    assert before[0][3] == 1  # notnull

    migrate_ai_model_columns(conn)

    after = [r for r in conn.execute("PRAGMA table_info(ai_configs)") if r[1] == "provider"]
    assert after[0][3] == 0  # nullable
    # 資料保留
    count = conn.execute("SELECT COUNT(*) FROM ai_configs").fetchone()[0]
    assert count == 3


def test_migrates_history_ai_connection_id():
    """既有 history 表補 ai_connection_id 欄位（spec 決策 5）"""
    conn = _old_db()
    migrate_ai_model_columns(conn)

    cols = [r[1] for r in conn.execute("PRAGMA table_info(history)")]
    assert "ai_connection_id" in cols


# --- 欄位錯位修復（舊版遷移用位置複製造成的損害） ---


# 新 schema 但值錯位——模擬已受害資料庫的實際狀態（如 admin id=80 那筆）
SCRAMBLED_SCHEMA = """
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


def _scrambled_db():
    conn = sqlite3.connect(":memory:")
    conn.execute(SCRAMBLED_SCHEMA)
    # 錯位模式：name=加密key、created_at=服務名、updated_at=模型id、
    # local_model=created_at、is_active=updated_at、local_url=is_active
    conn.execute(
        "INSERT INTO ai_configs (id, user_id, provider, name, model, api_key_encrypted, "
        "local_url, local_model, is_active, created_at, updated_at, base_url, models, preset_id) "
        "VALUES (80, 1, 'gemini', 'gAAAA-key', NULL, NULL, '1', "
        "'2026-08-29 12:13:57', '2026-08-29 14:29:15', 'Gemini', 'gemini-3.6-flash', "
        "'https://generativelanguage.googleapis.com/v1beta/openai', "
        "'[{\"id\": \"gemini-3.6-flash\", \"enabled\": true}]', 'gemini')"
    )
    # 健康列（修復後新增的）：不應被誤動
    conn.execute(
        "INSERT INTO ai_configs (id, user_id, provider, name, base_url, models, preset_id, "
        "is_active, created_at, updated_at) "
        "VALUES (81, 1, NULL, '我的服務', 'https://x/v1', '[]', 'custom', 0, "
        "'2026-08-29 15:00:00', '2026-08-29 15:00:00')"
    )
    conn.commit()
    return conn


def test_repairs_scrambled_columns():
    conn = _scrambled_db()
    migrate_ai_model_columns(conn)

    row = conn.execute(
        "SELECT name, model, api_key_encrypted, local_url, local_model, is_active, "
        "created_at, updated_at FROM ai_configs WHERE id=80"
    ).fetchone()
    assert row[0] == "Gemini"                     # name ← 原_created_at
    assert row[1] == "gemini-3.6-flash"           # model ← 原_updated_at
    assert row[2] == "gAAAA-key"                  # api_key_encrypted ← 原_name
    assert row[3] is None                         # local_url ← 原_model
    assert row[4] is None                         # local_model ← 原_api_key
    assert row[5] in ("1", 1)                     # is_active ← 原_local_url
    assert row[6] == "2026-08-29 12:13:57"        # created_at ← 原_local_model
    assert row[7] == "2026-08-29 14:29:15"        # updated_at ← 原_is_active

    # 健康列不受影響
    healthy = conn.execute(
        "SELECT name, is_active FROM ai_configs WHERE id=81"
    ).fetchone()
    assert healthy[0] == "我的服務"
    assert healthy[1] in ("0", 0, None)


def test_repair_is_idempotent():
    conn = _scrambled_db()
    migrate_ai_model_columns(conn)
    first = conn.execute(
        "SELECT name, model, api_key_encrypted, created_at, updated_at FROM ai_configs WHERE id=80"
    ).fetchone()

    migrate_ai_model_columns(conn)  # 再跑一次不會二次位移
    second = conn.execute(
        "SELECT name, model, api_key_encrypted, created_at, updated_at FROM ai_configs WHERE id=80"
    ).fetchone()

    assert first == second
    assert second[0] == "Gemini"


# --- 更舊資料庫格式 ---


# 物理欄位順序不同的舊表（name/model 是後期 ALTER 加在尾端、api_key 在前）
OLD_ALT_ORDER_SCHEMA = """
CREATE TABLE ai_configs (
    id INTEGER PRIMARY KEY,
    user_id INTEGER,
    provider VARCHAR(20) NOT NULL,
    api_key_encrypted TEXT,
    local_url VARCHAR(255),
    local_model VARCHAR(100),
    is_active BOOLEAN,
    created_at DATETIME,
    updated_at DATETIME,
    name VARCHAR(50),
    model VARCHAR(100)
)
"""


def test_alt_order_old_db_migrates_by_column_name():
    """欄位物理順序不同的舊 DB：以欄位「名稱」對映遷移，不會錯位"""
    conn = sqlite3.connect(":memory:")
    conn.execute(OLD_ALT_ORDER_SCHEMA)
    conn.execute(
        "INSERT INTO ai_configs (user_id, provider, api_key_encrypted, is_active, "
        "created_at, updated_at, name, model) VALUES "
        "(1, 'gemini', 'gAAAA-old', 1, '2026-01-01 00:00:00', '2026-01-02 00:00:00', "
        "'我的 Gemini', 'gemini-3.6-flash')"
    )
    conn.commit()

    migrate_ai_model_columns(conn)

    row = conn.execute(
        "SELECT name, model, api_key_encrypted, base_url, models, preset_id FROM ai_configs"
    ).fetchone()
    assert row[0] == "我的 Gemini"
    assert row[1] == "gemini-3.6-flash"
    assert row[2] == "gAAAA-old"  # key 沒有被換掉
    assert row[3] == "https://generativelanguage.googleapis.com/v1beta/openai"
    assert json.loads(row[4]) == [{"id": "gemini-3.6-flash", "enabled": True}]
    assert row[5] == "gemini"

    provider = [r for r in conn.execute("PRAGMA table_info(ai_configs)") if r[1] == "provider"]
    assert provider[0][3] == 0  # nullable


def test_very_old_db_missing_columns_migrates():
    """更舊格式（連 name/model 都沒有）：自動補欄位並完成遷移"""
    conn = sqlite3.connect(":memory:")
    conn.execute(
        """
        CREATE TABLE ai_configs (
            id INTEGER PRIMARY KEY,
            user_id INTEGER,
            provider VARCHAR(20) NOT NULL,
            api_key_encrypted TEXT,
            local_url VARCHAR(255),
            local_model VARCHAR(100),
            is_active BOOLEAN,
            created_at DATETIME,
            updated_at DATETIME
        )
        """
    )
    conn.execute(
        "INSERT INTO ai_configs (user_id, provider, api_key_encrypted, local_url, "
        "local_model, is_active) VALUES (1, 'local', 'k', 'http://localhost:11434/v1', 'llama3', 1)"
    )
    conn.commit()

    migrate_ai_model_columns(conn)

    row = conn.execute(
        "SELECT base_url, models, preset_id, name, model FROM ai_configs"
    ).fetchone()
    assert row[0] == "http://localhost:11434/v1"
    assert json.loads(row[1]) == [{"id": "llama3", "enabled": True}]
    assert row[2] == "custom"
    assert row[4] == "llama3"  # 舊 model 欄位補上後從 local_model 轉換
