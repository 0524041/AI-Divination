#!/usr/bin/env python3
"""SQLite → Postgres（Neon）資料遷移（T3）

用法：
    uv run python scripts/migrate_sqlite_to_neon.py --source /path/divination.db --dest postgresql://... [--overwrite]

- 來源：生產備份的 SQLite 檔；目標：Neon 連線字串（務必顯式傳入，不設預設值）
- 保留主鍵 id（關聯不斷）；結束後重設 PG sequence，避免後續寫入撞 id
- 目標已有資料時拒絕執行，除非加 --overwrite（TRUNCATE ... CASCADE 後重灌）
- 跳過 migration_markers（SQLite 手工遷移的 bookkeeping，PG 用不到）
- 先在 dev 分支 dry-run，確認筆數一致後才跑 production

需要生產加密金鑰對應的 ENCRYPTION_KEY／SECRET_KEY 在環境中，
否則遷過去的加密欄位在新環境解不開（本腳本不碰加解密，只原樣搬運）。
"""

from __future__ import annotations

import argparse
import sys

from sqlalchemy import MetaData, create_engine, text

# 匯入全部模型以註冊 schema（順序＝FK 依賴順序）
from app.models import User  # noqa: F401
from app.models.ai_request_log import AIRequestLog  # noqa: F401
from app.models.birth_data import UserBirthData  # noqa: F401
from app.models.history import History  # noqa: F401
from app.models.settings import AIConfig, UserAIPreference  # noqa: F401
from app.models.share_token import ShareToken  # noqa: F401
from app.models.stream_slot import StreamSlot  # noqa: F401（註冊用，不遷移：執行期狀態）
from app.models.system_ai_endpoint import SystemAIEndpoint  # noqa: F401
from app.models.thread_message import ThreadMessage  # noqa: F401
from app.core.database import Base

SKIP_TABLES = {"migration_markers", "thread_stream_slots"}


def _table_names() -> list[str]:
    return [
        t.name for t in Base.metadata.sorted_tables if t.name not in SKIP_TABLES
    ]


def _counts(engine, tables: list[str]) -> dict[str, int]:
    out: dict[str, int] = {}
    with engine.connect() as conn:
        for name in tables:
            out[name] = conn.execute(text(f'SELECT COUNT(*) FROM "{name}"')).scalar()
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", required=True, help="來源 SQLite 檔路徑")
    ap.add_argument("--dest", required=True, help="目標 Postgres 連線字串")
    ap.add_argument("--overwrite", action="store_true",
                    help="目標有資料時先清空再遷（預設拒絕執行）")
    args = ap.parse_args()

    if not args.dest.startswith("postgresql"):
        print("✗ --dest 必須是 postgresql:// 連線字串", file=sys.stderr)
        return 2

    src = create_engine(f"sqlite:///{args.source}")
    dst = create_engine(args.dest, pool_pre_ping=True)

    src_meta = MetaData()
    src_meta.reflect(bind=src)
    tables = _table_names()
    missing = [n for n in tables if n not in src_meta.tables]
    if missing:
        print(f"✗ 來源缺表：{missing}", file=sys.stderr)
        return 2

    # 確保目標 schema 存在
    Base.metadata.create_all(bind=dst)

    dest_counts = _counts(dst, tables)
    dirty = {k: v for k, v in dest_counts.items() if v}
    if dirty and not args.overwrite:
        print(f"✗ 目標已有資料（{dirty}），加 --overwrite 才會清空重灌", file=sys.stderr)
        return 2

    if args.overwrite:
        with dst.begin() as conn:
            conn.execute(
                text(f'TRUNCATE {", ".join(f"{n}" for n in tables)} CASCADE')
            )
        print("✓ 目標已清空")

    with src.connect() as sconn, dst.begin() as dconn:
        for name in tables:
            rows = sconn.execute(text(f'SELECT * FROM "{name}"')).mappings().all()
            if not rows:
                print(f"  - {name}: 0 筆（略過）")
                continue
            dconn.execute(
                src_meta.tables[name].insert(),
                [dict(r) for r in rows],
            )
            print(f"  - {name}: {len(rows)} 筆")

        # 重設 sequence（id 保留原值，後續寫入不撞號）
        for name in tables:
            table = Base.metadata.tables[name]
            pk = list(table.primary_key.columns)
            if len(pk) == 1 and pk[0].name == "id" and str(pk[0].type) == "INTEGER":
                dconn.execute(
                    text(
                        f"SELECT setval(pg_get_serial_sequence(:t, 'id'), "
                        f"COALESCE((SELECT MAX(id) FROM \"{name}\"), 1))"
                    ),
                    {"t": name},
                )

    print("--- 核對 ---")
    src_counts = _counts(src, tables)
    dest_counts = _counts(dst, tables)
    ok = True
    for name in tables:
        mark = "✓" if src_counts[name] == dest_counts[name] else "✗ MISMATCH"
        if src_counts[name] != dest_counts[name]:
            ok = False
        print(f"  {mark} {name}: 來源 {src_counts[name]} → 目標 {dest_counts[name]}")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
