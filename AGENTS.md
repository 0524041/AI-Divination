# AGENTS.md — AI-Divination Development Guide

Guide for AI coding agents working on the **AI-Divination (玄覺空間)** codebase.

## Overview

A full-stack web application combining traditional Chinese divination (I Ching / Liu Yao, Zi Wei Dou Shu) and Tarot with AI-powered interpretation.

## Tech Stack

| Layer    | Technology                                                            |
| -------- | --------------------------------------------------------------------- |
| Frontend | Next.js 14 (App Router) + TypeScript + Tailwind CSS + Vercel Analytics |
| Backend  | FastAPI + Python 3.12（本機 3.12.15） + SQLAlchemy                        |
| Database | SQLite（本地開發／測試）／Neon Postgres（正式環境）                      |
| AI       | OpenAI-compatible API（系統預設 Agnes；使用者可 BYOK 自訂端點）          |
| Deploy   | Vercel（前後端各一專案）＋ Neon Postgres                                 |
| Versions | Frontend v1.4.3, Backend v2.0.0                                        |

## Project Layout

```
AI-Divination/
├── frontend/                   # Next.js app — Vercel Project 1（Root = frontend/）
│   ├── src/app/                # App Router pages & root layout
│   ├── src/components/         # ui/, features/, layout/, ziwei/
│   ├── src/contexts/           # React contexts（Auth、Theme）
│   ├── src/hooks/              # useThreadStream、useAIModels、useOnlineCount
│   ├── src/lib/                # api-client、astro、tarot-data、tokens
│   ├── e2e/                    # Playwright E2E 冒煙
│   ├── playwright.config.ts
│   ├── next.config.js          # CSP／安全 headers、/api rewrite（僅本地）
│   ├── vercel.json             # ignoreCommand（有變更才建置）
│   └── .npmrc                  # legacy-peer-deps（@vercel/analytics optional peer）
├── backend/                    # FastAPI — Vercel Project 2（Root = backend/）
│   ├── api/index.py            # Vercel Serverless ASGI 入口（托管 app.main:app）
│   ├── app/
│   │   ├── api/                # FastAPI route handlers
│   │   ├── core/               # Config、database（SQLite／Postgres 雙引擎）
│   │   ├── models/             # SQLAlchemy ORM models
│   │   ├── services/           # AI provider、thread 管線、端點解析
│   │   └── utils/              # auth、encryption、security、sse
│   ├── migrations/             # 舊 SQLite 手工遷移
│   ├── scripts/                # migrate_sqlite_to_neon.py 等
│   ├── prompts/                # AI system prompts（*.md）
│   ├── tests/                  # pytest（測試 DB、假 OpenAI-compatible 伺服器）
│   ├── vercel.json             # routes → api/index.py、maxDuration、ignoreCommand
│   └── requirements.txt        # 由 uv.lock 匯出（Vercel 安裝用）
├── scripts/
│   └── vercel-ignored-build-step.sh
├── .github/workflows/ci.yml    # CI（驗證用，不負責部署）
├── docs/adr/                   # Architecture Decision Records
├── .scratch/                   # Issue tracker（local markdown）
├── start.sh                    # 本地 Smart Deploy
└── AGENTS.md                   # This file
```

## Deployment（正式環境）

### 拓撲

| 項目 | 值 |
| ---- | -- |
| Vercel Project（前端） | `ai-divination-frontend`（Root `frontend/`，Framework Next.js） |
| Vercel Project（後端） | `ai-divination-backend`（Root `backend/`，Framework FastAPI） |
| Git repo / branch | `0524041/AI-Divination` / `master` |
| 前端正式網域 | https://ai-divination-akspace.vercel.app |
| 後端正式網域 | https://ai-divination-rust-ten.vercel.app |

- 兩個 Vercel Project 都連同一個 GitHub repo；**push `master` 即自動部署**。
- 部署由 **Vercel Git Integration** 執行。`.github/workflows/ci.yml` 只做驗證，**不負責部署**（repo 內沒有 deploy workflow）。
- 瀏覽器**直連後端網域**（`NEXT_PUBLIC_API_URL`），API 走 CORS；Next.js 的 `/api/*` rewrite 只在本地開發（未設 `NEXT_PUBLIC_API_URL`）時使用。
- 後端是 **Vercel Serverless**：`backend/api/index.py` 以 ASGI 託管 `app.main:app`，`backend/vercel.json` 將所有路由導向它，`maxDuration` 為 **60 秒**。
- 兩專案都有 `ignoreCommand`（`scripts/vercel-ignored-build-step.sh`）：只有**自己目錄**有變更才建置；純文件或另一邊的變更會顯示 `Canceled`（這是正常的跳過，不是失敗）。
- CI 的 action 全部使用 Node 24 runtime（checkout@v5、setup-node@v5、setup-uv@v7、upload-artifact@v7、paths-filter@v4）。

### Neon Postgres

| 項目 | 值 |
| ---- | -- |
| Organization | `org-dawn-boat-59522712`（見 `.neon`） |
| Project | `bitter-wind-49153041` |
| 正式分支 | `production` |
| 區域 | `aws-ap-southeast-1`（Singapore） |

- 本地／測試：SQLite（`DATABASE_URL=sqlite:///...`），零配置。
- 正式：Neon Postgres；引擎由 `DATABASE_URL` 的 scheme 自動切換（`backend/app/core/database.py`）。
- **後端 Vercel Function 必須與 Neon 同區**：`backend/vercel.json` 的 `regions: ["sin1"]`。改回預設 `iad1` 會讓每個 DB 查詢多約 200ms（登入／admin 歷史頁特別明顯）。
- **`DATABASE_URL` 必須使用 Neon pooled 連線**（`-pooler`）；`DATABASE_URL_UNPOOLED` 只供遷移／管理用途。SSL 由連線字串的 `sslmode=require` 決定。
- Serverless cold start **不跑啟動遷移**：後端 Vercel env 設 `SKIP_STARTUP_MIGRATIONS=1`，避免多實例重複建表／遷移。
- Postgres schema 由 ORM／遷移腳本建立；SQLite 專用的 `run_migrations()` 在 Postgres 下自動跳過。
- 資料遷移：`backend/scripts/migrate_sqlite_to_neon.py`
  - 保留主鍵、結束後重設 sequence、目標有資料時預設拒絕（需 `--overwrite`）。
  - 建議先在 Neon `dev` 分支彩排，核對筆數後再跑 `production`。
  - 需要正式的 `ENCRYPTION_KEY`／`SECRET_KEY` 才能解開加密欄位。

### Vercel 環境變數

**後端 `ai-divination-backend`（Production）**

| Key | 說明 |
| --- | ---- |
| `DATABASE_URL` | Neon **pooled** Postgres 連線字串（`sslmode=require`） |
| `DATABASE_URL_UNPOOLED` | Neon 直連字串（遷移用；執行期不需要） |
| `SECRET_KEY` | JWT 簽名金鑰（缺失即啟動失敗） |
| `ENCRYPTION_KEY` | Fernet 欄位加密金鑰（缺失即啟動失敗） |
| `ENVIRONMENT` | `production` |
| `SKIP_STARTUP_MIGRATIONS` | `1` |
| `ALLOWED_ORIGINS` | 前端精確網域（逗號分隔；**不可 `*`**） |
| `AGNES_API_KEY` / `AGNES_BASE_URL` / `AGNES_MODEL_ID` | 系統預設 AI 端點種子 |
| `AI_PROBE_MODELS` | 種子化時是否探測 `/models`（可設 `false`） |
| `DEBUG` | 生產保持未設／`false`（關閉 `/docs`、`/openapi.json`） |

**前端 `ai-divination-frontend`（Production）**

| Key | 說明 |
| --- | ---- |
| `NEXT_PUBLIC_API_URL` | 後端正式網域（**build-time 內嵌**，變更後需重新部署） |
| `NEXT_PUBLIC_ENABLE_PRESENCE` | 選填；Vercel 不支援 WebSocket，預設不啟用 |

> `NEXT_PUBLIC_*` 會被打包進瀏覽器 bundle，**不可放任何密鑰**。

### 部署流程

```bash
# 1) 本地驗證（與 CI 相同）
cd backend && uv run ruff check app/ tests/ && uv run pytest tests/ -q
cd frontend && npx tsc --noEmit && npm run lint && npm run test:run
cd frontend && NEXT_PUBLIC_API_URL= npm run build && npm run test:e2e

# 2) 推上 master → GitHub Actions CI + Vercel 自動部署
git push origin master
```

- **只會重建有變更的專案**：`backend/**` 變更才重建後端、`frontend/**` 變更才重建前端；其他路徑（文件、`.scratch/`）會 `Canceled` 跳過。
- CI（`.github/workflows/ci.yml`）在部署前先跑：
  - 後端：`compileall` → `ruff` → `pytest`
  - 前端：`tsc` → `lint` → `vitest` → **production build** → **Playwright E2E**（對 production build 斷言無 runtime／CSP 錯誤）
  - `dorny/paths-filter` 只在對應目錄（或 CI 設定）變更時才跑該 job。
- 部署後煙霧測試：

  ```bash
  curl -s https://ai-divination-rust-ten.vercel.app/health        # {"status":"ok"}
  curl -sI https://ai-divination-akspace.vercel.app/ | grep -i content-security-policy
  ```

### 維運注意

- **CORS**：`ALLOWED_ORIGINS` 必須是精確的前端網域；不要用 `*` 或過寬的預覽萬用字元。
- **資安 headers**：
  - 前端 CSP 在 `frontend/next.config.js`（`script-src 'self' 'unsafe-inline'`）。**不要加 `'unsafe-eval'`**；若某套件需要 eval，應改寫或移除該套件（p5 曾因此被替換為零依賴 canvas）。
  - 後端 headers 在 `backend/app/middleware/security.py`。
- **限流／防濫用**：應用內限流（`app/utils/security.py`）是行程記憶體，Serverless 多實例下不可靠；應在 Vercel／Cloudflare 邊緣層加 rate limit。訪客登入建議加 Turnstile。
- **Vercel Analytics**：`<Analytics />` 已加在 `frontend/src/app/layout.tsx`；需在 Vercel 專案啟用 Web Analytics（已啟用）。腳本同源載入，CSP 不需額外放行。
- **npm peer 衝突**：`frontend/.npmrc` 設了 `legacy-peer-deps=true`，因為 `@vercel/analytics` 宣告了 optional 的 SvelteKit peer（npm 會解析成 vite 8，與本專案 vite 5／vitest 1.6 衝突）。不要為此升級 vite 8。
- **Serverless 限制**：後端函式上限 60 秒；長時間 AI 串流可能被截斷（見 `.scratch/architecture-hardening/` 的 tickets 10／13／14）。

## Local Development

### Master Control Script

`start.sh` 使用 **Smart Deploy**：以 `.deploy_state` 記錄上次部署狀態，啟動時偵測變更，有變更才執行對應動作（程式碼變更 → 重建前端；uv.lock 變更 → uv sync；package-lock.json 變更 → npm ci），無變更則直接啟動。此流程僅供本機／單機使用。

```bash
./start.sh                  # Smart Deploy: only rebuild/install when changed
./start.sh --force-build    # Force frontend rebuild
./start.sh --dev            # Development: hot-reload enabled
./start.sh --stop           # Stop all services
./start.sh --restart        # Restart (Smart: rebuild only when changed)
./start.sh --status         # Check running processes
./start.sh --logs -f        # Tail logs
./start.sh --build          # Force frontend rebuild
./start.sh --install        # Install dependencies only
./start.sh --reset          # ⚠️ Destructive — resets the database
```

### Local Run

```bash
# 初次
git clone <repo> && cd AI-Divination
cp backend/.env.example backend/.env   # 填入 AGNES_API_KEY（系統預設端點種子）
./start.sh

# 更新（無變更時秒速重啟，有變更自動 rebuild）
git pull && ./start.sh

# 無 git 的環境（rsync/scp 上傳後同樣有效，自動 fallback 到 checksum 偵測）
./start.sh
```

本地預設用 SQLite（`backend/divination.db`）；若要用 Neon 連線測試，將 `DATABASE_URL` 設為 Postgres 連線字串即可（引擎會自動切換）。

## Build & Test

### Frontend (from `frontend/`)

```bash
npm run dev              # Dev server with hot-reload
npm run build            # Production build（部署前必跑）
npm start                # Start production server
npm run lint             # ESLint check
npm test                 # Vitest (watch mode)
npm run test:run         # Vitest (single run, CI)
npm run test:e2e         # Playwright E2E（需先 build）
npx vitest <file>        # Run a single test file
npx vitest --grep "..."  # Run tests matching a pattern
```

> E2E 會啟動 `next start` 並驗證 production build。本機請先以空 API URL 建置，避免跨網域：
> `NEXT_PUBLIC_API_URL= npm run build && npm run test:e2e`

### Backend (from `backend/`)

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000   # Start server
uvicorn app.main:app --reload                      # With hot-reload
uv sync                                            # Install deps (pyproject.toml)
uv run pytest tests/ -q                            # Run backend tests
uv run ruff check app/ tests/                      # Lint
uv run python -m compileall -q app                 # Compile check
uv run python scripts/migrate_sqlite_to_neon.py --help  # 資料遷移
```

### Testing conventions

- Backend：pytest（`backend/tests/`，夾具見 `conftest.py`：測試 DB、假 OpenAI-compatible 伺服器）。
- Frontend：`npm run test:run`（vitest）於提交前必跑；`npm run test:e2e`（Playwright）驗證 production build 無 runtime／CSP 錯誤。
- Thread SSE API 契約與占卜管線請見 `docs/adr/0002`、`.scratch/ai-chat-refactor/spec.md`。
- 架構強化與部署閘門的決策與 tickets 見 `.scratch/architecture-hardening/`。

## Key Conventions

- **Frontend imports** use the `@/` path alias（例如 `@/components/ui/Button`）。
- **TypeScript strict mode** is enabled — all types must be properly handled.
- **API 位址**：
  - 本地：未設 `NEXT_PUBLIC_API_URL` 時走相對路徑 `/api/*`，由 `next.config.js` rewrite 到 `http://localhost:8000`。
  - 正式：瀏覽器直連 `NEXT_PUBLIC_API_URL`（後端 Vercel 網域），由後端 CORS 白名單保護。
- **Authentication**：JWT 存 `localStorage`，以 `Authorization: Bearer` header 傳送；SSE 端點優先讀 header（query `token` 僅為舊客戶端 fallback）。
- **State management**：React Context + `useState`（無 Redux／Zustand）。
- **UI language**：全站繁體中文。
- **Database**：雙引擎 — 本地 SQLite、正式 Neon Postgres；撰寫查詢時避免 SQLite 專有語法（`run_migrations` 等 SQLite 專用邏輯只在 SQLite 下啟用）。
- **AI prompts** 位於 `backend/prompts/` — 修改時務必確認前後端對回應格式的共識。
- **Security headers**：前端 CSP 在 `next.config.js`、後端在 `app/middleware/security.py`；不要為了讓套件跑起來而放寬到 `'unsafe-eval'`。
- **字型**：內文用系統中文字型（PingFang TC／Microsoft JhengHei）；標題 `Noto Serif TC` 由 `next/font` 自架（weight 600）。不要改回 Google Fonts `<link>` 載入 Inter／Noto Sans TC（曾造成單頁 858KB 字型）。
- **重 chunk 延後載入**：`streamdown`（Markdown）與 `framer-motion` 以 `next/dynamic` 切分；不要把 `DivinationChat`、`ThreadDialog` 或儀式元件改回靜態 import，否則首屏會多下載約 180KB gz。
- **Vercel Analytics**：`<Analytics />` 只在 `src/app/layout.tsx` 掛一次。

## Important Notes

1. Never commit API keys, passwords, or other secrets. `.env*`、`.vercel` 已被 gitignore。
2. 提交前跑：`uv run pytest`、`npm run test:run`、`npm run build`（必要時 `npm run test:e2e`）。
3. 遵循既有程式模式（Context、`@/` alias、Traditional Chinese UI）。
4. 修改 AI prompts 時，確認前後端對回應格式仍一致。
5. `NEXT_PUBLIC_*` 是公開變數，會進瀏覽器 bundle。
6. 正式環境的 DB 遷移請走 `backend/scripts/migrate_sqlite_to_neon.py`，並先在 Neon `dev` 分支彩排。
7. 不要手動在 Vercel 上重新建立專案；本 repo 只對應 `ai-divination-frontend` 與 `ai-divination-backend` 兩個 Project。
8. **依賴安全**：`requirements.txt` 由 `uv export --no-dev --format requirements-txt` 產生（含 hashes），Vercel 會以 hash 驗證套件。`certifi` 下限由 `backend/pyproject.toml` 的 `[tool.uv].constraint-dependencies` 鎖在 `>=2026.10.19`（2026-10 emSign CA 事件），不要移除。
9. **本機工具鏈**：uv `>=0.13.4`、pip `>=26.2.2`、本機 Python `3.12.15`；CI 也使用 `3.12.15` 與 Vercel 的 `python3.12` 對齊。

## Agent skills

### Issue tracker

Issues 以 local markdown 檔案存在 `.scratch/<feature>/`。See `docs/agents/issue-tracker.md`.

### Triage labels

使用五個預設角色標籤：`needs-triage`、`needs-info`、`ready-for-agent`、`ready-for-human`、`wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context：root `CONTEXT.md` + `docs/adr/`. See `docs/agents/domain.md`.
