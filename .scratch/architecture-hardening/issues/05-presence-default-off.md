# 05 — Serverless 下線上人數 WebSocket 預設停用

**What to build:** `useOnlineCount` 改為 **opt-in**（`NEXT_PUBLIC_ENABLE_PRESENCE === 'true'` 才連線），預設不發起 WebSocket。

**Why:** Vercel 不支援長連線；目前預設啟用，未設 env 時瀏覽器會對後端重試 WS 5 次（每次 5 秒）後才放棄，純屬浪費與 console 噪音。

**Status:** done

- [ ] 改 `PRESENCE_ENABLED` 預設值
- [ ] 更新註解

## 測試項目
1. 未設 env → 不呼叫 `new WebSocket`
2. env 設 `true` → 既有行為不變
