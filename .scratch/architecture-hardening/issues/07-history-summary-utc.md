# 07 — 歷史清單改摘要 payload ＋ 統一 UTC

**What to build:**

- `GET /api/history` 新增 `summary` 參數；`summary=1` 時不回傳完整 `interpretation`（`chart_data` 保留，列表顯示與複製需要）。
- 前端歷史列表改帶 `summary=1`；「複製」動作若缺 `interpretation`，即時抓 `GET /api/history/{id}` 補齊。
- `get_statistics` 的「今天」改用 UTC，對齊 `thread_pipeline.py`。

**Why:** 20 筆 × 完整解盤全文是列表最大的網路與反序列化浪費；統計與額度用不同時區會跨日誤差。

**Status:** done

- [ ] 後端 `summary` 參數與 schema 相容（`interpretation=None`）
- [ ] 前端 `fetchHistory` 帶 `summary=1`
- [ ] `handleCopy` 補抓 detail
- [ ] `today_count` 改 UTC

## 測試項目
1. `summary=1` 回應不含解盤全文、`chart_data` 保留
2. `summary=0`（預設）行為不變
3. 統計跨日以 UTC 邊界計數
