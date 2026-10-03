# 16 — 修正／清理 `ai-divination-akspace` 專案

**What to build:** `ai-divination-akspace` 每次 push 都建置失敗（`No Next.js version detected`），因為它的 **Root Directory 是空的（指向 repo 根目錄）**，但 framework 設為 Next.js，而 repo 根 `package.json` 只有 Neon 設定、沒有 `next`。

**Why:** 每次 production 部署都出現 `Production deployment failed` 噪音，且該專案沒有實際產出。

**Status:** done（2026-10-03 已刪除）

## 處理結果
已用 Vercel API `DELETE /v9/projects/prj_g0ycCLYfmd2vrfHKTiJHabcBK2Il` 刪除 `ai-divination-akspace`。
現存 Vercel 專案：`ai-divination-frontend`（root `frontend`）、`ai-divination-backend`（root `backend`）。
前端正式網域 `ai-divination-akspace.vercel.app` 不受影響（仍掛在 frontend 專案）。

## 證據
- `vercel api /v9/projects`：`ai-divination-akspace` 的 `rootDirectory: null`、`framework: nextjs`。
- 對照：`ai-divination-frontend` root `frontend`、`ai-divination-backend` root `backend`（皆正常）。
- `ai-divination-akspace.vercel.app` 目前是 **frontend 專案部署的 alias**；akspace 專案本身近期部署皆 Error。

## 選項（擇一）
1. **設 Root Directory = `frontend`**：若此專案要獨立服務 `akspace` 網域，這是最小修正。
2. **刪除專案**：若與 frontend 重複、無實際用途。
3. **移除 Git 連線**：保留專案但停止自動部署。

## 建議
先確認 `akspace` 網域是否真的要用這個專案；若只是誤建，選項 2 最乾淨。
