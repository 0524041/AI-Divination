# 12 — next.config 清理與安全 headers

**What to build:**

- `poweredByHeader: false`
- `async headers()`：全站安全 headers（CSP 見 ticket 04）
- `images` 設定（若採 `next/image`；本輪先允許 `formats`）
- 保留 `/api/:path*` rewrite（本地開發必需），補註解說明

**Why:** 預設組態把 `X-Powered-By` 送給全世界，且前端缺安全 headers。

**Status:** done

- [ ] `poweredByHeader:false`
- [ ] `headers()` 實作
- [ ] 註解確認 rewrite 保留原因

## 測試項目
1. `next build` 成功
2. 靜態頁回應含 CSP、`X-Frame-Options`、`X-Content-Type-Options`，且不含 `X-Powered-By`
