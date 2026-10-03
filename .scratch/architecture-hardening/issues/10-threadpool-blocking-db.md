# 10 — 串流管線同步 DB 呼叫移出 event loop

**What to build:** `thread_pipeline` 的 `async` 產生器內直接使用同步 SQLAlchemy session，會阻塞 event loop。將關鍵、可能耗時的呼叫以 `starlette.concurrency.run_in_threadpool` 包裝。

**Why:** 單一 Serverless 實例無法在同步 DB 呼叫期間服務其他並行請求；併發串流時尤其明顯。

**Status:** deferred（架構討論時一併處理）

- [ ] 盤點 `_stream_inner` / `_stream_followup_inner` 內的同步 DB 區塊
- [ ] 以 `run_in_threadpool` 包裝（先做 resolve／持久化等關鍵點）
- [ ] 大範圍改走 async driver 屬架構層，見 ticket 14

## 測試項目
1. 既有管線測試（首解／追問／重試／額度）全綠
2. 行為與事件序列不變

## Comments
本輪先做低風險的關鍵點包裝；全面 async 化留給 ticket 14，避免大範圍重構風險。

**2026-10-03：延後。** 本輪 P0/P1 先處理最高價值且低風險的阻塞點（ticket 09 已把 `ensure_default_seed` 的同步外部探測移出請求路徑）；全面 threadpool／async driver 化與 ticket 14 的常駐容器決策綁在一起，一併討論再做。
