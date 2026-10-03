# 08 — 歷史頁輪詢改自適應退避

**What to build:** `pending/processing` 紀錄的靜默輪詢由固定 3 秒改為自適應退避（例如 5s → 10s → 20s，上限 30s），並在分頁隱藏（`document.hidden`）時暫停。

**Why:** 固定 3 秒對 Serverless 是持續的背景流量；多數情況秒級即完成，長尾不需要那麼密。

**Status:** done

- [ ] 以 `setTimeout` 遞增延遲取代 `setInterval(3000)`
- [ ] `visibilitychange` 時暫停／恢復
- [ ] 有任一 pending/processing 才輪詢（既有條件保留）

## 測試項目
1. 有 processing 項目時會排程下一輪、延遲遞增且有上限
2. 頁面隱藏時不發請求
