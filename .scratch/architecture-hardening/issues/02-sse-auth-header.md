# 02 — SSE 認證改走 Authorization header

**What to build:** `/api/records/*` 的認證優先讀 `Authorization: Bearer` header；query `token` 保留為向後相容 fallback。前端 `useThreadStream` 停止把 token 塞進 query string（它用 `fetch`，本來就能帶 header）。

**Why:** token 走 query string 會進 Vercel／代理 access log 與瀏覽器歷史，是不必要的洩漏面；且前端目前同時送 query＋header，重複曝露。

**Status:** done

- [ ] 後端新增 header 取 token，query 作為 fallback
- [ ] 前端移除 `urlWithToken` 的 query 附加
- [ ] 文件字串更新，移除「EventSource 限制」的過時說明

## 測試項目
1. 只帶 header → 通過認證
2. 只帶 query（舊客戶端）→ 仍可認證
3. 兩者皆無 → 401

## Notes
待前端全面上線後可移除 query fallback（另立小 ticket）。
