"""
Schema 遷移（spec: ai-model-selection）

舊欄位 → 新連線模型的就地轉換（SQLite，幂等）：
- ai_configs：+base_url、+models(JSON)、+preset_id；
  provider/local_url/model/local_model 資料轉換到新欄位
- system_ai_endpoints：+models(JSON)、+default_model

舊欄位保留不刪（SQLite 改欄成本高、便於回滾），新程式碼不再讀寫。
"""

import json
import re
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
    tables = {
        r[0]
        for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")
    }
    if table not in tables:
        return  # 更舊的 DB 可能沒有此表（由 create_all 建立）
    cols = [r[1] for r in conn.execute(f"PRAGMA table_info({table})")]
    if column not in cols:
        conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {decl}")


def _models_json(model_ids: list[str]) -> str:
    return json.dumps([{"id": m, "enabled": True} for m in model_ids if m])


def migrate_ai_model_columns(conn: sqlite3.Connection) -> None:
    """將 ai_configs / system_ai_endpoints / history 遷移到連線×模型模型（幂等）

    步驟（每步皆幂等）：
    1. 補齊可能缺少的欄位（相容更舊格式）
    2. 修復舊版遷移（位置式複製）造成的欄位錯位
    3. 舊資料轉換（provider/local_url/model → base_url/models/preset_id）
    4. provider NOT NULL 的舊表重建為 nullable（以欄位「名稱」對映複製）
    """
    # --- 1. 補齊欄位 ---
    for column, decl in (
        ("name", "VARCHAR(50)"),
        ("model", "VARCHAR(100)"),
        ("local_url", "VARCHAR(255)"),
        ("local_model", "VARCHAR(100)"),
        ("is_active", "BOOLEAN"),
    ):
        _add_column(conn, "ai_configs", column, decl)
    _add_column(conn, "ai_configs", "base_url", "VARCHAR(255)")
    _add_column(conn, "ai_configs", "models", "TEXT")
    _add_column(conn, "ai_configs", "preset_id", "VARCHAR(30)")
    _add_column(conn, "system_ai_endpoints", "models", "TEXT")
    _add_column(conn, "system_ai_endpoints", "default_model", "VARCHAR(100)")
    _add_column(conn, "history", "ai_connection_id", "INTEGER")

    # --- 2. 修復欄位錯位 ---
    _repair_scrambled_columns(conn)

    # --- 3. ai_configs 資料轉換：僅處理 base_url 尚為 NULL 的舊列 ---
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
            "UPDATE ai_configs SET base_url = ?, models = ?, preset_id = ?, "
            "model = COALESCE(model, ?) WHERE id = ?",
            (base_url, models, preset_id, model or local_model, row_id),
        )

    # --- system_ai_endpoints 資料轉換：models 尚為 NULL 的舊列 ---
    tables = {
        r[0]
        for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")
    }
    if "system_ai_endpoints" in tables:
        rows = conn.execute(
            "SELECT id, model FROM system_ai_endpoints WHERE models IS NULL"
        ).fetchall()
        for row_id, model in rows:
            conn.execute(
                "UPDATE system_ai_endpoints SET models = ?, default_model = ? WHERE id = ?",
                (_models_json([model]), model, row_id),
            )

    # --- 4. provider NOT NULL 重建 ---
    _make_provider_nullable(conn)

    # --- 5. Agnes 系統端點模型可見性收斂（一次性） ---
    _lock_agnes_system_models(conn)

    conn.commit()


_DATETIME_PREFIX = re.compile(r"^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}")

_REPAIR_KEYS = (
    "id",
    "name",
    "model",
    "api_key_encrypted",
    "local_url",
    "local_model",
    "is_active",
    "created_at",
    "updated_at",
)


def _looks_datetime(value) -> bool:
    return isinstance(value, str) and bool(_DATETIME_PREFIX.match(value))


def _looks_scrambled(row: dict) -> bool:
    """偵測欄位錯位：is_active 裝 datetime、created_at 裝非 datetime、
    local_model 裝 datetime——正常資料不會出現這些形狀"""
    return (
        _looks_datetime(row["is_active"])
        or (row["created_at"] is not None and not _looks_datetime(row["created_at"]))
        or _looks_datetime(row["local_model"])
    )


def _repair_scrambled_columns(conn: sqlite3.Connection) -> None:
    """修復舊版遷移（SELECT * 位置式複製）造成的欄位錯位（幂等）

    錯位映射（舊版遷移的實際結果）：
      name←api_key、created_at←name、updated_at←model、
      model←local_url、api_key_encrypted←local_model、
      local_url←is_active、local_model←created_at、is_active←updated_at
    本函式執行反向歸位；修復後偵測條件不再成立，故可重複執行。
    """
    rows = conn.execute(
        "SELECT id, name, model, api_key_encrypted, local_url, local_model, "
        "is_active, created_at, updated_at FROM ai_configs"
    ).fetchall()

    for row in rows:
        d = dict(zip(_REPAIR_KEYS, row))
        if not _looks_scrambled(d):
            continue

        is_active = d["local_url"]
        conn.execute(
            "UPDATE ai_configs SET name = ?, model = ?, api_key_encrypted = ?, "
            "local_url = ?, local_model = ?, is_active = ?, created_at = ?, "
            "updated_at = ? WHERE id = ?",
            (
                d["created_at"],          # name ← 原 created_at
                d["updated_at"],          # model ← 原 updated_at
                d["name"],                # api_key_encrypted ← 原 name
                d["model"],               # local_url ← 原 model
                d["api_key_encrypted"],   # local_model ← 原 api_key_encrypted
                1 if str(is_active) == "1" else 0,   # is_active ← 原 local_url (0/1)
                d["local_model"],         # created_at ← 原 local_model
                d["is_active"],           # updated_at ← 原 is_active
                d["id"],
            ),
        )


def _make_provider_nullable(conn: sqlite3.Connection) -> None:
    """既有 DB 的 ai_configs.provider 是 NOT NULL（新程式碼不再寫入）→ 重建表

    SQLite 無法直接修改欄位約束，採標準重建流程。
    重要：以欄位「名稱」對映複製（不可用 SELECT *——舊 DB 的物理欄位順序
    可能不同，位置式複製會造成欄位錯位）。
    """
    cols = conn.execute("PRAGMA table_info(ai_configs)").fetchall()
    provider = next((c for c in cols if c[1] == "provider"), None)
    if provider is None or not provider[3]:  # 已是 nullable
        return

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
        INSERT INTO ai_configs_new
            (id, user_id, provider, name, model, api_key_encrypted, local_url,
             local_model, is_active, created_at, updated_at, base_url, models, preset_id)
        SELECT
            id, user_id, provider, name, model, api_key_encrypted, local_url,
            local_model, is_active, created_at, updated_at, base_url, models, preset_id
        FROM ai_configs;
        DROP TABLE ai_configs;
        ALTER TABLE ai_configs_new RENAME TO ai_configs;
        CREATE INDEX IF NOT EXISTS ix_ai_configs_id ON ai_configs (id);
        """
    )


# Agnes 系統端點（舊版種子會把探測到的全部模型設 enabled，使用者全看得到）；
# 本遷移一次性收斂為僅 preset 內建款 enabled，其餘 disabled 供管理員手動開啟。
_AGNES_HOST_SUFFIX = "agnes-ai.com"
_LOCK_MARKER_KEY = "agnes_system_models_locked"


def _agnes_visible_model_ids() -> set[str]:
    """使用者可見的 Agnes 系統模型 id（presets.json 的 agnes 款）"""
    from app.services.presets import get_preset

    return {m["id"] for m in (get_preset("agnes") or {}).get("models", [])}


def _lock_agnes_system_models(conn: sqlite3.Connection) -> None:
    """將 Agnes 系統端點非內建款模型 disabled（一次性，冪等）

    以 migration_markers 表記錄已執行，避免覆蓋管理員之後的手動調整。
    """
    conn.execute(
        "CREATE TABLE IF NOT EXISTS migration_markers ("
        "key VARCHAR(60) PRIMARY KEY, applied_at DATETIME)"
    )
    marker = conn.execute(
        "SELECT 1 FROM migration_markers WHERE key = ?", (_LOCK_MARKER_KEY,)
    ).fetchone()
    if marker:
        return

    tables = {
        r[0]
        for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")
    }
    if "system_ai_endpoints" in tables:
        rows = conn.execute(
            "SELECT id, models FROM system_ai_endpoints "
            "WHERE models IS NOT NULL AND base_url LIKE ?",
            (f"%{_AGNES_HOST_SUFFIX}%",),
        ).fetchall()
        visible = _agnes_visible_model_ids()
        for row_id, models_json in rows:
            try:
                entries = json.loads(models_json)
            except (json.JSONDecodeError, TypeError):
                continue
            if not isinstance(entries, list):
                continue
            updated = [
                {**entry, "enabled": bool(entry.get("enabled")) and entry.get("id") in visible}
                if isinstance(entry, dict)
                else entry
                for entry in entries
            ]
            conn.execute(
                "UPDATE system_ai_endpoints SET models = ? WHERE id = ?",
                (json.dumps(updated, ensure_ascii=False), row_id),
            )

    conn.execute(
        "INSERT OR IGNORE INTO migration_markers (key, applied_at) VALUES (?, CURRENT_TIMESTAMP)",
        (_LOCK_MARKER_KEY,),
    )
