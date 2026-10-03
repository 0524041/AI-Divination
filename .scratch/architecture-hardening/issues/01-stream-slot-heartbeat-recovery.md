# 01 — 串流佔位心跳可恢復，逾時不再卡 10 分鐘

**What to build:** `thread_stream_slots` 的 stale 判定改為「以串流期間的心跳刷新 `acquired_at`」為準；函式被 Vercel 逾時硬殺時，佔位能在短時間內被接管，而非固定卡 10 分鐘。接管 stale 佔位時，把仍為 `processing` 的對應紀錄重置回 `pending`，避免列表永久顯示「處理中」。

**Why:** `STREAM_SLOT_STALE_SECONDS = 600` 搭配 `maxDuration=60`，一旦逾時，使用者重試會拿到 409 長達 10 分鐘。

**Status:** done

- [ ] 新增 `touch_stream_slot(record_id)`，串流心跳（ping）時刷新 `acquired_at`
- [ ] 縮短 stale 門檻並與心跳間隔保持餘裕（心跳上限收斂）
- [ ] 接管 stale 佔位時重置該紀錄 `processing → pending`
- [ ] 錯誤／空回覆路徑維持既有釋放（`_sse_response` finally）

## 測試項目
1. 活躍串流持續心跳 → 佔位不被搶
2. 停止心跳超過門檻 → 新請求可接管
3. 接管時 `processing` 紀錄被重置為 `pending`

## Notes
`acquire_stream_slot` 為路由層同步佔位，維持語意不變（衝突 409）。
