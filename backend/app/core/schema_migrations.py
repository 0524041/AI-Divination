"""
Schema 遷移（spec: ai-model-selection）

舊欄位 → 新連線模型的就地轉換（SQLite，幂等）：
- ai_configs：+base_url、+models(JSON)、+preset_id；
  provider/local_url/model/local_model 資料轉換到新欄位
- system_ai_endpoints：+models(JSON)、+default_model

舊欄位保留不刪（SQLite 改欄成本高、便於回滾），新程式碼不再讀寫。
"""

import json
import sqlite3

# 舊 provider 名稱 → OpenAI 相容 base_url 與 preset id
_LEGACY_PROVIDER_MAP = {
    "gemini": (
        "https://generativelanguage.googleapis.com/v1beta/openai",
        "gemini",
    ),
    "openai": ("https://api.openai.com/v1", "openai"),
}


def _add_column(conn: sqlite3.Connection, table: str, column: str, decl: str) -> None:
    cols = [r[1] for r in conn.execute(f"PRAGMA table_info({table})")]
    if column not in cols:
        conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {decl}")


def _models_json(model_ids: list[str]) -> str:
    return json.dumps([{"id": m, "enabled": True} for m in model_ids if m])


def migrate_ai_model_columns(conn: sqlite3.Connection) -> None:
    """將 ai_configs / system_ai_endpoints / history 遷移到連線×模型模型（幂等）"""
    _add_column(conn, "ai_configs", "base_url", "VARCHAR(255)")
    _add_column(conn, "ai_configs", "models", "TEXT")
    _add_column(conn, "ai_configs", "preset_id", "VARCHAR(30)")
    _add_column(conn, "system_ai_endpoints", "models", "TEXT")
    _add_column(conn, "system_ai_endpoints", "default_model", "VARCHAR(100)")
    _add_column(conn, "history", "ai_connection_id", "INTEGER")

    # --- ai_configs 資料轉換：僅處理 base_url 尚為 NULL 的舊列 ---
    rows = conn.execute(
        "SELECT id, provider, local_url, model, local_model FROM ai_configs "
        "WHERE base_url IS NULL"
    ).fetchall()
    for row_id, provider, local_url, model, local_model in rows:
        if local_url:
            base_url = local_url
            preset_id = "custom"
        else:
            base_url, preset_id = _LEGACY_PROVIDER_MAP.get(provider, (None, None))
        models = _models_json([model or local_model or ""])
        conn.execute(
            "UPDATE ai_configs SET base_url = ?, models = ?, preset_id = ? WHERE id = ?",
            (base_url, models, preset_id, row_id),
        )

    # --- system_ai_endpoints 資料轉換：models 尚為 NULL 的舊列 ---
    rows = conn.execute(
        "SELECT id, model FROM system_ai_endpoints WHERE models IS NULL"
    ).fetchall()
    for row_id, model in rows:
        conn.execute(
            "UPDATE system_ai_endpoints SET models = ?, default_model = ? WHERE id = ?",
            (_models_json([model]), model, row_id),
        )

    _make_provider_nullable(conn)

    conn.commit()


def _make_provider_nullable(conn: sqlite3.Connection) -> None:
    """既有 DB 的 ai_configs.provider 是 NOT NULL（新程式碼不再寫入）→ 重建表

    SQLite 無法直接修改欄位約束，採標準重建流程；新表 schema 與 ORM 對齊。
    """
    cols = conn.execute("PRAGMA table_info(ai_configs)").fetchall()
    provider = next((c for c in cols if c[1] == "provider"), None)
    if provider is None or not provider[3]:  # 已是 nullable
        return

    # 依 ORM 欄位順序重建（SELECT * 依賴欄位順序一致）
    conn.executescript(
        """
        CREATE TABLE ai_configs_new (
            id INTEGER PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
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
        );
        INSERT INTO ai_configs_new SELECT * FROM ai_configs;
        DROP TABLE ai_configs;
        ALTER TABLE ai_configs_new RENAME TO ai_configs;
        CREATE INDEX IF NOT EXISTS ix_ai_configs_id ON ai_configs (id);
        """
    )
