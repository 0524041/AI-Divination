# AGENTS.md — AI-Divination Development Guide

Guide for AI coding agents working on the **AI-Divination (玄覺空間)** codebase.

## Overview

A full-stack web application combining traditional Chinese divination (I Ching / Liu Yao) and Tarot with AI-powered interpretation.

## Tech Stack

| Layer     | Technology                                                           |
| --------- | -------------------------------------------------------------------- |
| Frontend  | Next.js 14 (App Router) + TypeScript + Tailwind CSS                  |
| Backend   | FastAPI + Python 3.10+ + SQLite + SQLAlchemy                         |
| AI        | Google Gemini + Local LLMs (OpenAI-compatible API)                   |
| Versions  | Frontend v1.2.0, Backend v6.1.0                                      |

## Project Layout

```
AI-Divination/
├── frontend/          # Next.js application
│   ├── src/app/       # App Router pages
│   ├── src/components/# React components (ui/, features/, layout/)
│   ├── src/contexts/  # React contexts (AuthContext)
│   ├── src/hooks/     # Custom hooks
│   └── src/lib/       # Utilities (api-client, cn)
├── backend/
│   ├── app/
│   │   ├── api/       # FastAPI route handlers
│   │   ├── core/      # Config, database setup
│   │   ├── models/    # SQLAlchemy ORM models
│   │   ├── services/  # Business logic
│   │   └── utils/     # Helpers (auth, encryption)
│   └── prompts/       # AI system prompts (*.md)
├── scripts/           # Utility scripts
├── docs/              # Documentation
├── start.sh           # Master control script
└── AGENTS.md          # This file
```

## Build & Test

### Master Control Script

`start.sh` 使用 **Smart Deploy**：以 `.deploy_state` 記錄上次部署狀態，啟動時偵測變更，有變更才執行對應動作（程式碼變更 → 重建前端；uv.lock 變更 → uv sync；package-lock.json 變更 → npm ci），無變更則直接啟動。

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

#### Production Deploy Flow

```bash
# 初次部署
git clone <repo> && cd AI-Divination
cp backend/.env.example backend/.env   # 填入 OPENCODE_API_KEY
./start.sh

# 更新部署（無變更時秒速重啟，有變更自動 rebuild）
git pull && ./start.sh

# 無 git 的環境（rsync/scp 上傳後同樣有效，自動 fallback 到 checksum 偵測）
./start.sh
```

### Frontend (from `frontend/`)

```bash
npm run dev             # Dev server with hot-reload
npm run build           # Production build
npm start               # Start production server
npm run lint            # ESLint check
npm test                # Vitest (watch mode)
npm run test:run        # Vitest (single run, CI)
npx vitest <file>       # Run a single test file
npx vitest --grep "..." # Run tests matching a pattern
```

### Backend (from `backend/`)

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000           # Start server
uvicorn app.main:app --reload                               # With hot-reload
uv sync                                                     # Install deps (pyproject.toml)
python app/core/optimize_db.py                              # Database optimization
```

## Key Conventions

- **Frontend imports** use the `@/` path alias (e.g. `@/components/ui/Button`).
- **TypeScript strict mode** is enabled — all types must be properly handled.
- **API routes** are proxied through Next.js: `/api/*` → `http://localhost:8000/api/*`.
- **Authentication** uses JWT tokens stored in `localStorage` with Bearer header.
- **State management** relies on React Context + `useState` (no Redux/Zustand).
- **UI language** is Traditional Chinese throughout.
- **Database** is SQLite — be mindful of its limitations.
- **AI prompts** live in `backend/prompts/` — modify with care.

## Important Notes

1. Never commit API keys, passwords, or other secrets.
2. Run `npm run test:run` before committing frontend changes.
3. Follow existing code patterns for consistency.
4. When modifying AI prompts, verify both frontend and backend still agree on the response format.
