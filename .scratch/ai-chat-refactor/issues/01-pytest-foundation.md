# 01 — pytest 測試地基與假 AI 伺服器夾具

**What to build:** 後端目前沒有任何自動化測試承載。建立 pytest 基礎建設：fixture 資料庫（既有 schema）、FastAPI 測試客戶端工具、以及一支假 OpenAI-compatible 伺服器夾具（可控回應單發完成／逐 delta 串流／各類錯誤）。不改變任何產品行為——這是後續所有後端票券的射擊場。

**Blocked by:** None — can start immediately

**Status:** done（2026-08-25）

- [x] `uv run pytest` 可執行，測試目錄與命名慣例就位（pytest/pytest-asyncio 已在 dev 依賴）
- [x] fixture DB 夾具：每個測試取得乾淨且含既有 schema 的資料庫
- [x] FastAPI 測試客戶端夾具：可帶認證打任一現存端點並取得回應
- [x] 假 OpenAI-compatible 伺服器夾具，可腳本化行為：
  - [x] 單發 JSON 完成
  - [x] SSE 逐 delta 串流＋`[DONE]` 終止
  - [x] 401 / 429 / 逾時 / 上游 5xx
- [x] 測試不觸網、不觸真實 key；全綠於本機

## 測試項目
1. ✅ 夾具自我驗證：四種假伺服器行為各自被一個 smoke test 覆蓋（另含 /v1/models）
2. ✅ 測試客戶端以真實使用者 token 打 `/api/auth/me` 取得 200；無 token 得 401
3. ✅ fixture DB 隔離性：跨測試資料不洩漏、所有註冊表皆在清空範圍

執行結果：24 passed（含既有 13 個單元測試）、ruff 全綠。
