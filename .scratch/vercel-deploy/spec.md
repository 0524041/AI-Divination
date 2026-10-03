# Spec: Vercel 雙專案部署 ＋ Neon 資料庫遷移

Status: ready-for-agent

## Problem Statement

目前整站跑在單機（`start.sh` 同時起 Next.js + uvicorn），資料庫是本機 SQLite 檔案，生產資料實際落在另一台機器（`ssh wsl-work` 上的生產目錄）裡。若要搬上 Vercel（前後端各一個專案）搭配 Neon Postgres，現有架構有四處硬傷：SQLite 寫死的引擎與遷移邏輯、本機檔案式密鑰、import 時就執行的遷移副作用、以及 Serverless 下會失效的 in-memory 串流佔位與 WebSocket。需要分階段把本地架構先調整成「Vercel 可部署的形狀」，再把生產 DB 遷進 Neon，最後接上自動部署。

## Solution

分四個階段、以「拆成兩個 Vercel 專案」為前提推進：先從生產機備份資料庫與密鑰並開好 Neon 專案；再把本地架構改成同時支援 SQLite（本地開發）與 Neon Postgres（目標環境）的形狀並完成資料遷移；接著處理 CORS 並通盤補上 Vercel/Neon 所需調整；最後以 GitHub Workflow 接上 Vercel 自動部署。過程中對話串流的 SSE 契約與領域行為保持不變。

## User Stories

### 階段 0 — 生產資料備份與 Neon 開通

1. As a 維運者, I want 從生產機拉回資料庫檔案做本地備份, so that 遷移失敗時可以還原。
2. As a 維運者, I want 同步拉回生產機的密鑰檔（JWT 與加密金鑰）, so that 備份的資料庫內容可以被解密讀取。
3. As a 維運者, I want 確認備份檔大小與完整性, so that 知道它放不放得進 Neon Object storage 的 0.5G 額度。
4. As a 維運者, I want 照 Neon 指示完成專案綁定與設定初始化（含 preview bucket `uploads` 設為 private）, so that 後續遷移與預覽環境有統一入口。

### 階段 1 — 本地架構調整 ＋ 資料庫遷移到 Neon

5. As a 後端開發者, I want 資料庫引擎依連線字串自動切換 SQLite / Postgres, so that 本地開發沿用 SQLite、目標環境連 Neon，同一份程式碼兩邊可跑。
6. As a 後端開發者, I want 所有 SQLite 專用邏輯（執行緒檢查參數、外鍵 pragma、sqlite3 直連遷移）在 Postgres 下自動跳過, so that 連 Neon 時不會報錯。
7. As a 後端開發者, I want 應用啟動時不再有 import 層級的遷移副作用, so that Serverless cold start 不會超時或重複建表。
8. As a 後端開發者, I want 所有密鑰與連線設定改由環境變數注入、缺一即啟動失敗, so that Vercel 唯讀檔案系統上也能啟動，且不再依賴本機密鑰檔。
9. As a 維運者, I want 把生產備份的占卜紀錄、對話訊息、使用者、用量紀錄完整遷入 Neon, so that 上線後歷史資料不斷層。
10. As a 維運者, I want 遷移是冪等的、可重跑的, so that 中斷後可以接著跑而不產生重複資料。
11. As a 使用者, I want 遷移到 Neon 後，我的占卜紀錄與對話內容完整無缺, so that 換基礎設施對我是透明的。
12. As a 後端開發者, I want 本地用 Neon 連線字串跑通既有測試, so that 證明 Postgres 相容性。

### 階段 2 — CORS 與 Vercel/Neon 通盤調整

13. As a 前端開發者, I want 後端 API 位址改由環境變數注入、不再寫死 localhost, so that 本地與 Vercel 預覽／正式環境各連各的後端。
14. As a 前端開發者, I want 後端 CORS 只放行已知的正式與預覽域名, so that 任意網站不能拿著使用者 token 呼叫 API。
15. As a 使用者, I want 部署到 Vercel 後，解盤與追問的串流體驗與現在一致（meta → 逐字 → done）, so that 遷移不改變占卜流程。
16. As a 後端開發者, I want 同一占卜紀錄的併發串流保護在多實例下依然有效, so that Serverless 擴容後不會出現兩條解盤互相覆寫。
17. As a 前端開發者, I want 線上人數顯示在沒有 WebSocket 的環境下有降級方案, so that Vercel 上不支援長連線時頁面不報錯。
18. As a 後端開發者, I want 後端有 Vercel 可識別的 Serverless 入口與部署設定, so that 後端專案可以獨立部署、獨立設超時。
19. As a 維運者, I want 通盤檢查還有哪些 Vercel/Neon 特有調整（超時上限、連線池、SSL、預覽分支）, so that 上線當天沒有遺漏。

### 階段 3 — CI 流程 ＋ GitHub Workflow 自動部署

20. As a 開發者, I want PR 與 main 推播時自動跑後端測試與前端測試, so that 壞掉的程式碼在合併前就被發現。
21. As a 開發者, I want CI 同時跑前後端 lint（ruff／ESLint）與型別檢查, so that 風格與型別錯誤不進主分支。
22. As a 維運者, I want CI 失敗時擋下合併與部署, so that 壞掉的程式碼上不了正式環境。
23. As a 維運者, I want main 分支合併後前後端自動部署到 Vercel, so that 不用手動按部署。
24. As a 開發者, I want PR 自動產生預覽部署（含前端預覽與後端預覽或指向共用預覽後端）, so that 合併前可以實際點開驗證。

## Implementation Decisions

- 部署拓撲：同一 Git repo import 兩次，兩個 Vercel Project（前端 Root 指向前端目錄、後端 Root 指向後端目錄），各自獨立的建置命令、環境變數與網域。
- 資料庫：生產資料來源是 `wsl-work` 生產目錄內的 SQLite 檔（實測約 5.4M）與其 JWT／加密金鑰檔，本地開發用 DB（約 2.5M）僅供對照、不作為遷移來源。先 `scp` 拉回備份（含金鑰，否則加密欄位無法讀），再遷入 Neon `production` 分支。
- Neon 開通照官方綁定流程（CLI 登入、skills、MCP、link 到指定專案 production 分支、config 初始化，preview 的 uploads bucket 設 private）。注意：Object storage 的 0.5G 額度是放檔案／媒體與備份用的，Postgres 資料本身不佔該額度；5.4M 備份僅佔約 1%。
- DB 相容策略：ORM 模型維持不變，引擎建立邏輯按 URL scheme 分流；SQLite 專用設定只在 SQLite 下啟用；Postgres 下啟用連線健康檢查與回收、強制 SSL。既有 SQLite 手工遷移在 Postgres 下停用，後續新增 schema 變更走正式遷移工具。
- 設定策略：所有密鑰（JWT 簽名、欄位加密、AI 端點 key）與資料庫連線字串一律來自環境變數，缺失時啟動即明確報錯；刪除「啟動時自動生成並寫檔」的行為。
- 啟動副作用：移除模組載入時執行的建表與資料搬移，改為顯式入口（部署／本地腳本呼叫），Serverless 入口保持純淨。
- API 契約凍結（ADR-0002）：占卜紀錄即對話根節點、SSE 事件序列、追問／重試語意、訪客額度規則全部不變；前端串流狀態機不需重寫。
- 併發保護：in-memory 的串流佔位改為以資料庫狀態為準（或等效的跨實例可見機制），語意不變（同一紀錄同時只一條活躍串流，衝突回 409）。
- 即時通道：WebSocket 線上人數在 Vercel 環境降級（移除或改輪詢），不阻塞主流程；SSE 串流保留，但接受平台超時上限，必要時縮短心跳並在 spec 外另立 ticket 處理超長解盤。
- 前端：後端位址與 WebSocket 位址全面改由公開環境變數注入；Next.js rewrite 的目標改為該變數，本地預設值維持指向本機後端。
- CORS：後端允許來源改為環境變數注入的精確域名清單（含正式與預覽），不使用萬用字元；token 走 query param 的現況不變（EventSource 限制），但部署後需確認平台日誌不完整記錄 query string。
- CI/CD：`.github/workflows/` 新增 `ci.yml`（PR 與 main 推播觸發：後端 `pytest`＋`ruff`、前端 `vitest run`＋`lint`＋`tsc --noEmit`），測試失敗即紅燈；另立 `deploy-*.yml` 在 main 合併且 CI 通過後觸發兩個 Vercel Project 的部署；預覽環境策略（後端是否每 PR 一份）在實作時決定，預設前端預覽可指向共用預覽後端以節省資源。

## Testing Decisions

- 好的測試只測外部行為（API 回應形狀、SSE 事件序列、資料是否完整搬入），不測引擎內部實作。
- 後端：沿用既有的管線測試（解盤／追問／重試／額度）作為 Postgres 相容性的主驗證——同一套測試分別對 SQLite 與 Neon 連線字串跑通即算過關；遷移腳本用既有的遷移測試模式（冪等、空解盤跳過、已有訊息跳過）覆蓋。
- 後端：新增設定測試——缺必要環境變數時啟動明確失敗；Postgres 下不觸發任何 SQLite 專用邏輯。
- 前端：沿用既有的 vitest 模式，覆蓋後端位址注入（相對路徑 vs 絕對路徑）與 WebSocket 降級（無 WS 環境不報錯）。
- 部署驗證：以健康檢查端點與一條端到端占卜（建紀錄 → 首解串流 → 追問）在預覽環境手動驗收一次；用量紀錄有寫入即算 AI 計費鏈正常。

## Out of Scope

- 改變 SSE 事件協議、對話資料模型或領域詞彙（占卜紀錄／盤面／解盤／追問語意不動，不牴觸 ADR-0002）。
- 自訂網域與 TLS 憑證申請。
- Neon autoscaling、連線池上限調優、讀寫分離。
- 把 AI 供應商接入方式從 OpenAI-compatible 改掉（不牴觸 ADR-0001）。
- 行動 App 或第三方 OAuth 登入。
- 超長解盤超過 Vercel 函式超時上限時的續寫／斷點續傳機制（若驗收時發生，另立 ticket）。

## Further Notes

- 已知事實：生產 DB 約 5.4M、本地 DB 約 2.5M；生產目錄同時存有 JWT 與加密金鑰檔，三者必須一起拉回，否則加密欄位無法解密。遠端路徑拼寫含 `workspcae`，照抄不要「修正」。
- 風險：Vercel 函式執行時長上限（依方案 10s–60s）與 ADR-0002 的「SSE 全面取代輪詢」存在張力；本 spec 先保留 SSE，若預覽環境實測解盤被平台截斷，再另立 ticket 處理。
- 風險：Neon 標準版對 Vercel 做 IP 白名單不可行（出口 IP 浮動），安全依賴強密碼＋TLS＋最小權限 role；遷移用高權 role 只在本地使用，不進 Vercel env。
- 建議 ticket 切分（供 to-tickets 用）：T1 生產備份＋Neon 開通；T2 DB 雙引擎＋設定 env 化；T3 資料遷移＋驗證；T4 前端位址注入＋CORS；T5 無狀態化＋WS 降級＋部署入口；T6 CI＋Workflow 自動部署。
- 備份實績（2026-10-03）：已從 `wsl-work` 拉回生產 `divination.db`（5.4M，`integrity_check` 通過）＋ `.secret_key`／`.encryption_key`／`.env`，存放於 repo 外的 `AI-Divination-prod-backup/20261003/`；內容約 users 37、占卜紀錄 334、對話訊息 362、用量紀錄 46。放進 Object storage 也只佔約 1%。
- 遷移實績（T2–T3 同日）：雙引擎＋設定 env 化完成，pytest 192 項在 SQLite 與 Neon `dev` 分支皆全綠；遷移腳本（保留 id＋重設 sequence＋筆數核對）先彩排於 `dev` 驗證（盤面 JSON、加密欄位解密、sequence 皆正常），後正式寫入 `production` 分支並核對 37／334／362 一致。`dev` 分支保留供後續彩排用。
- T4 實績：前端新增 `resolveApiUrl`（`NEXT_PUBLIC_API_URL` 未設維持相對路徑＋本地 rewrite，有設直連後端域名），rewrite 目標 env 化；`AuthContext` 與 `useThreadStream` 兩個 raw fetch 點接入；兩個 mock `@/lib/api-client` 的測試補上新函式；新增 `api-client` 單元測試。前端 49 項全綠＋tsc／eslint 乾淨。後端 CORS 在 T2 已 env 化，待部署後以實際域名驗證。
- 部署拓撲確認：同一 Git repo 配兩個 Vercel Project 是標準 monorepo 做法，不拆 repo；兩邊各設 Root Directory（`frontend/`、`backend/`）＋各自 env；各專案設 Ignored Build Step 只在自己目錄變更時建置；repo 根的 `neon.ts`／`package.json` 只供本地與 CI 用，不進任一專案。
- T5 實績：串流佔位改 `thread_stream_slots` 表（主鍵互斥＋10 分鐘 stale 接管，併發語意與 409 不變）；WS hook 加 `NEXT_PUBLIC_ENABLE_PRESENCE` 開關＋5 次重試上限＋後端域名連線；後端部署入口（`api/index.py`＋`vercel.json` maxDuration 60＋`requirements.txt` 由 uv.lock 匯出）；`main.py` 啟動遷移加 `SKIP_STARTUP_MIGRATIONS` 開關。後端 192＋前端 49 全綠，管線測試另在 Neon `dev` 驗證通過；`production` 已補建新表。
- T6 實績：新增 `.github/workflows/ci.yml`（push／PR 觸發；後端 `uv sync`＋ruff＋pytest，前端 `npm ci`＋tsc＋lint＋vitest），YAML 已校驗；Vercel 雙專案接線與 env 清單見交接說明（dashboard 操作，先部署後端再填前端域名）。
