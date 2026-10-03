# Spec: Vercel 架構強化（P0 可靠性／資安 ＋ P1 效能）

Status: done（P0/P1 code 第 1 批；架構項 10/13/14 延後）

## Results（2026-10-03）

**已上線程式碼改動**

- 後端：串流佔位心跳可恢復（stale 90s、接管時重置 `processing→pending`）、SSE 認證 header 優先（query fallback）、retry 補上佔位、CORS 收斂（`allow_credentials=False`、明確 methods/headers）、API 安全 headers 改嚴格空政策、歷史清單 `summary`＋UTC、`ensure_default_seed(probe=False)` 讀取路徑不探測。
- 前端：移除簽名殘留與 query token、presence 改 opt-in、歷史清單 `summary=1`（複製時補抓詳情）、輪詢自適應退避＋分頁隱藏暫停、p5 動畫 reduced-motion／visibility 節流、移除冗餘依賴、tarot 圖片 lazy、`next.config` 安全 headers 與 `poweredByHeader:false`。
- 驗證：後端 ruff 乾淨、pytest 全綠（含新增測試）；前端 `tsc`／`lint`／vitest 49 項、`next build` 全綠。

**待人手動（ticket 06）**：Vercel CORS 域名、Neon pooled URL、邊緣限流／Turnstile、憑證輪替。

**未做（另行討論）**：tickets 10、13、14。

**後續修正（2026-10-03，第二輪）**

- 正式環境 CSP 擋下 p5 的 eval（`EvalError`）：`@p5-wrapper/react` 打包內含 core-js regenerator，在無 `'unsafe-eval'` 時執行 `Function("r","regeneratorRuntime = r")` 拋出未捕捉錯誤。改以**零依賴 canvas** 重寫 `BackgroundCanvas`，移除 `p5` 與 `@p5-wrapper/react`（約 1MB），維持嚴格 CSP。
- CI 強化（ticket 15）：部署前 `next build`＋Playwright E2E 冒煙（對 production build 斷言無 runtime／CSP 錯誤）；後端 `compileall`；`dorny/paths-filter` 只在相關目錄變更時跑；Vercel 兩專案加 `ignoreCommand`，只有自己目錄有變更才建置。
- `ai-divination-akspace` 專案（同 repo 的第三個、rootDirectory 為空）已刪除（ticket 16）；現存 Vercel 專案僅 frontend／backend。

**部署驗證（2026-10-03，commit c57726c）**

- CI（GitHub Actions）成功；前端 `ai-divination-frontend` 與後端 `ai-divination-backend` 兩個 Vercel 專案皆 Ready（Production）。
- 後端 `GET /health` → 200 `{"status":"ok"}`，回應含嚴格 CSP（`default-src 'none'`）、`X-Content-Type-Options`、`Referrer-Policy`，不再有 `X-XSS-Protection`。
- 前端公開網域回應 200，含 CSP（`connect-src 'self' <後端網域>`、`frame-ancestors 'none'`）、`X-Frame-Options: DENY`、`Referrer-Policy`、`Permissions-Policy`、HSTS，且無 `X-Powered-By`。
- CORS：允許來源回 `Access-Control-Allow-Origin`；非白名單來源（`evil.example`）preflight 回 400 且不帶 allow-origin。
- 公開 API `GET /api/auth/check-init` → 200 `{"initialized":true}`。


## Problem Statement

網站已上 Vercel（前端與後端各一專案）＋ Neon Postgres，但拓撲本身有三個結構性事實造成浪費與風險：

1. **後端是無狀態 Serverless（`maxDuration=60`），卻承載長時間 AI SSE 串流**，且所有「進行中狀態」放在行程記憶體。
2. **瀏覽器跨網域直連後端**（`NEXT_PUBLIC_API_URL`），每個帶 `Authorization` 的請求都走 CORS，且無法共用連線／Edge 快取。
3. **限流、串流佔位、線上人數、性能記錄都是行程內狀態**，多實例下失效或無界成長。

由此產生：串流逾時被殺 → 紀錄卡 `processing`、`thread_stream_slots` 卡 10 分鐘（409）；JWT 走 localStorage 又被塞進 SSE query string；CSP 形同虛設且只掛在 API 回應；清單 API 回傳完整解盤全文；歷史頁 3 秒輪詢；前端 bundle 過重。

## Solution

以「不動資料模型與 SSE 契約（ADR-0002）」為前提，先做一輪**低風險、程式碼層**的強化：

- **P0（可靠性＋資安）**：串流佔位改心跳可恢復、SSE 認證改 `Authorization` header、移除失效簽名殘留、收緊 CORS／CSP 並補前端安全 headers、線上人數預設停用。
- **P1（效能／網路）**：清單 API 改摘要＋統一 UTC、輪詢改自適應退避、端點種子化的網路探測移出請求路徑、前端瘦身與 `next.config` 清理。

**架構層改動（同源 API 代理、後端改常駐容器、async DB driver）本輪不做**，另立 ticket 待後續討論（見 13、14）。

## Ticket Index

| # | 標題 | 類型 | 本輪 |
| - | ---- | ---- | ---- |
| 01 | 串流佔位心跳可恢復，逾時不再卡 10 分鐘 | code | ✅ |
| 02 | SSE 認證改走 Authorization header | code | ✅ |
| 03 | 移除失效的 API 簽名殘留 | code | ✅ |
| 04 | 收緊 CORS／CSP，補前端安全 headers | code | ✅ |
| 05 | Serverless 下線上人數 WebSocket 預設停用 | code | ✅ |
| 06 | Vercel／Neon 環境與邊緣防護設定 | ops（人） | ⏳ 待人手動 |
| 07 | 歷史清單改摘要 payload ＋ 統一 UTC | code | ✅ |
| 08 | 歷史頁輪詢改自適應退避 | code | ✅ |
| 09 | 端點種子化的網路探測移出請求路徑 | code | ✅ |
| 10 | 串流管線同步 DB 呼叫移出 event loop | code | 🚫 延後（與 14 綁定） |
| 11 | 前端瘦身（bundle／圖片／動畫） | code | ✅ |
| 12 | next.config 清理與安全 headers | code | ✅ |
| 13 | 同源 API 代理（架構） | 架構 | 🚫 延後討論 |
| 14 | 後端常駐容器／async DB（架構） | 架構 | 🚫 延後討論 |
| 15 | CI 部署前編譯＋E2E，並只在有變更時觸發 | code | ✅ |
| 16 | 修正／清理 `ai-divination-akspace` 專案 | ops（人） | ✅ 已刪除 |

## Decisions

- **不動 ADR-0002**：SSE 事件序列（meta → delta* → done|error）、佔位互斥的 409 語意、訪客額度規則維持不變。
- **不動 ADR-0001**：AI 接入仍為 OpenAI-compatible。
- **向後相容**：SSE 端點在一段時間內仍接受 query `token`，但前端改送 header；待前端上線後即可移除 fallback。
- **CSP 以 enforcing 上線**（非 report-only）：保留 `'unsafe-inline'`（Next.js inline bootstrap 需要），生產移除 `'unsafe-eval'`，並以 `connect-src`／`frame-ancestors`／`object-src`／`base-uri` 收斂外洩面。
- **「今天」一律 UTC**，對齊 `thread_pipeline.py` 既有的 `datetime.utcnow()`。

## Manual Ops（ticket 06，需人在 dashboard 完成）

1. **CORS 精確域名**：後端 Vercel env `ALLOWED_ORIGINS` 設為前端正式網域（＋預覽網域，若需要），不可用 `*`。
2. **Neon pooled URL**：確認後端 `DATABASE_URL` 使用 `-pooler` 連線字串；`DATABASE_URL_UNPOOLED` 僅供遷移。
3. **停用 presence**：前端 Vercel env 設 `NEXT_PUBLIC_ENABLE_PRESENCE` 不存在或 `false`（code 改為預設關）。
4. **邊緣限流＋機器人防護**：在 Vercel（或前置 Cloudflare）對 `POST /api/auth/*`、`GET /api/records/*` 加 rate limit；訪客登入建議加 Turnstile。
5. **輪替洩漏風險憑證**：本機 `.env.local` 曾裸放 Neon Object Storage AWS 金鑰，建議輪替一次。
6. **HSTS**：確認 Vercel 對自訂網域送出 `Strict-Transport-Security`。

## Testing Decisions

- 後端：沿用 `backend/tests/`（假 OpenAI-compatible 伺服器、測試 DB）。新增／調整：串流佔位 stale 接管與心跳刷新、SSE header 認證、清單 summary 欄位、UTC 統計。
- 前端：`npm run test:run`（vitest）。調整 api-client 測試（移除 skipSignature）、history 輪詢、presence 預設。
- 部署驗證：CI 全綠 → push `master` → Vercel 雙專案自動部署 → 手動跑一條「建紀錄 → 首解串流 → 追問」。

## Out of Scope

- 同源 API 代理、後端常駐容器、async DB 驅動（tickets 13、14）。
- SSE 事件協議、資料模型、領域詞彙變更。
- 自訂網域、TLS 申請、Neon autoscaling 調優。
- next/font 自託管 CJK 字型（build 風險高，另議）。

## Further Notes

- `next.config.js` 的 `/api/:path*` rewrite 仍為**本地開發必需**（`NEXT_PUBLIC_API_URL` 未設時相對路徑代理到 `localhost:8000`），**不可刪**。
- 前端 `public/tarot-cards/` 78 張 JPG 約 2.9MB；`TarotCardFace` 目前用原生 `<img>`。
- `iztro` 於 client（`src/lib/astro.ts`）用於紫微排盤；`BackgroundCanvas` 以 `@p5-wrapper/react` 全站跑動畫。
