# 04 — 收緊 CORS／CSP，補前端安全 headers

**What to build:**

- 後端 CORS：`allow_credentials=False`、明確 methods 與 headers（僅 `Authorization`、`Content-Type`）。
- 後端安全 headers：移除過時的 `X-XSS-Protection` 與在 API 上無意義的寬鬆 CSP，保留 `X-Content-Type-Options`、加入 `Referrer-Policy`。
- 前端（Vercel 靜態服務）補上真正的 CSP 與安全 headers：`frame-ancestors 'none'`、`object-src 'none'`、`base-uri 'self'`、`connect-src` 限縮 `self`＋後端網域、`img-src 'self' data: blob:`；生產移除 `'unsafe-eval'`。

**Why:** 前端 HTML 目前完全沒有安全 headers，可被 iframe 點擊劫持；後端 CSP `connect-src *`＋`unsafe-eval` 幾乎無防護力。

**Status:** done

- [ ] `backend/app/middleware/security.py` 調整 headers
- [ ] `backend/app/main.py` CORS 收斂
- [ ] `frontend/next.config.js` 新增 `headers()`（見 ticket 12）
- [ ] `POST /api/settings/ai/test` 等仍可運作（不需 `X-Requested-With`）

## 測試項目
1. 後端：CORS preflight 對允許來源回正確 header、非允許來源不回 `Access-Control-Allow-Origin`
2. 前端：build 後頁面回應含 CSP 與 `X-Frame-Options`

## Notes
CSP 用 enforcing，但保留 `'unsafe-inline'` 以相容 Next.js inline bootstrap；若實測有資源被擋，再以 report-only 收斂。
