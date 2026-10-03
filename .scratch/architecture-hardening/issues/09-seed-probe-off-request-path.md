# 09 — 端點種子化的網路探測移出請求路徑

**What to build:** `ensure_default_seed` 增加 `probe` 參數；讀取路徑（`/api/settings/ai/models`、`/ai/default-info`）呼叫時 `probe=False`，只寫入 preset 模型，不做同步 `httpx` 打外部 `/models`（5 秒逾時）。

**Why:** 空庫首次請求會在 async 端點內同步阻塞 event loop 最多 5 秒（`azure`…`probe_models` 用同步 `httpx.Client`）。

**Status:** done

- [ ] `ensure_default_seed(db, probe=True)`；讀取路徑傳 `probe=False`
- [ ] 管理端「測試／新增端點」仍可探測（保留原行為）

## 測試項目
1. 讀取模型清單不觸發外部 `/models` 探測
2. 既有種子化幂等行為不變
