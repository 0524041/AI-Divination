# 15 — CI 部署前編譯＋E2E 冒煙，並只在有變更時觸發

**What to build:**

- CI 在部署前先跑 **production build**（`next build`）與 **Playwright E2E 冒煙**（對 production build 驗證頁面可載入且無 runtime／CSP 錯誤）。
- 後端加編譯檢查（`python -m compileall`）。
- CI 以路徑過濾，只有 `backend/**`／`frontend/**`（或 CI 設定）變更才跑對應 job。
- Vercel 兩專案加 `ignoreCommand`，只有自己目錄有變更才建置。

**Why:** 先前 CSP 移除 `'unsafe-eval'` 後，p5 在正式環境拋出 eval 錯誤卻沒有在 CI 被攔下；文件／設定變更也會觸發無謂的 Vercel 重建。

**Status:** done

- [x] `frontend/e2e/smoke.spec.ts`：登入頁與認證閘門，斷言無 CSP／runtime 錯誤
- [x] `playwright.config.ts`：對 `next start`（production build）執行
- [x] ci.yml：changes job＋`dorny/paths-filter`；frontend 加 `npm run build`＋E2E；backend 加 compileall
- [x] `scripts/vercel-ignored-build-step.sh`＋前後端 `vercel.json` 的 `ignoreCommand`

## 驗收
- [x] 本機 E2E 2 項通過
- [ ] 推播後 CI 於部署前完成 build＋E2E
- [ ] 純文件變更的 push 不再觸發 Vercel 重建
