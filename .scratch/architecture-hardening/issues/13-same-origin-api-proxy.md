# 13 — [架構] 同源 API 代理

**What to build:** 讓瀏覽器只打同源 `/api/*`，由 Next.js／Vercel 邊緣代理到後端（或後端改用子網域），消除 CORS preflight、統一 origin、可上 Edge 快取與中間層限流。

**Why:** 跨網域直連是 preflight、連線無法共用、無法邊緣快取與統一中間層防護的根因。

**Status:** deferred（後續討論調整架構）

## 討論要點
- Vercel `rewrites` 外部代理對 SSE 的串流行為與函式時長限制
- 代理多一跳的延遲與成本
- 與 ticket 14（常駐容器）的搭配

## Out of scope（本輪）
架構層改動，待與 ticket 14 一併決策。
