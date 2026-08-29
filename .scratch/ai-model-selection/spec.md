# AI 設定重塑：Provider 連線 × 模型選擇

Status: ready-for-agent
Created: 2026-08-29
Origin: 對話規劃 session（2026-08-29），基於 ADR-0001（OpenAI-compatible BYOK）與 ADR-0002（record-as-thread SSE）
Related: `.scratch/ai-chat-refactor/spec.md`（上一輪重構，本 spec 是其 AI 接入部分的延伸重塑）

## Problem Statement

使用者覺得目前的 AI 設定與模型選擇混亂、不直覺：

1. **概念三義**：設定頁裡「AI 設定 / Provider / 模型」混用。同一筆設定同時代表「服務」與「一組 provider+model+key」，使用者無法為一個服務維護多個模型。`AIConfig` 同時有 `model` 與 `local_model` 兩個欄位，語意依 provider 而異（OpenAI 的模型 id 竟存在 `local_model`）。
2. **選擇語意錯位**：占卜頁揭盤步驟的 AI 選擇器寫著「影響本次解盤」，實際上是改伺服器端全域的 `is_active` 旗標，影響之後所有占卜與對話。
3. **新增 AI 設定要自己判斷類型**：目前要選 gemini / openai / local 三種類型、各自不同的表單，使用者得知道自己的服務走哪種格式。常見 AI 工具（如 OpenCode、models.dev）的做法是維護一份內建服務清單，選服務 → 填 key → 自動帶出連線方式與模型。
4. **免費模型只有一個且不可管理**：系統免費模型只有 Agnes 種子那一個 model id，admin 無法為同一個系統端點維護多個免費模型。
5. **模型行為參數寫死**：reasoning 參數格式（字串 `reasoning_effort` vs 數值、`thinking_level`）、溫度、max tokens 全部硬編碼在 adapter 常數裡，不同模型需要的參數不同，使用者無從調整。
6. **雙架構並存**：legacy 模式（`mode='legacy'`、非串流輪詢、預設 OpenCode）與 thread 模式（SSE、預設 Agnes）兩條管線各自為政，「預設 AI」在兩邊指向不同服務。前端實際上已全走 thread 模式。

## Solution

**設定頁管「連線」，對話/占卜頁選「模型」**——比照常見 AI agent 工具的二層式設計：

- **連線層（Connection）**：設定頁管理一組組 `{名稱, base_url, API key}` 的連線。新增連線時從**內建服務預設清單（presets）**挑選（Agnes、Gemini、OpenAI、OpenRouter、Ollama、LM Studio…），系統自動帶出 base_url 與連線格式，使用者只需填 key。所有連線一律走 OpenAI-compatible 介面（ADR-0001 既有決策，Gemini 用官方相容端點）。
- **模型層（Model）**：每個連線維護一份**模型清單**——由「連線測試自動探測 `/v1/models`」+「preset 建議清單」合併產生，使用者可**勾選哪些要顯示、哪些要隱藏**，可手動新增，並可為每個模型微調呼叫參數（reasoning 參數格式、溫度、max tokens）。
- **選擇層（Selector）**：占卜揭盤步驟與對話面板的下拉改為列「模型」（依連線分組：「系統免費模型」/「我的服務」）。選擇結果**綁定在該次占卜紀錄上**（首解請求時傳給後端並寫入 history），追問與重試沿用同一組；另可設「我的預設模型」作為每次占卜的初始值。
- **系統免費模型清單化**：系統端點支援多模型（種子時探測 Agnes `/models` 全部納入），admin 可維護；訪客固定使用系統免費模型。
- **Legacy 全面移除**：刪除 `mode='legacy'` 管線、四個 legacy provider class、`OPENCODE_API_KEY` 雙預設，單一解析路徑。

## User Stories

### 設定頁 — 連線管理

1. As a 使用者, I want 新增連線時從內建服務清單中挑選（如 Agnes、Gemini、OpenAI、OpenRouter、Ollama）, so that 我不用研究各服務的 API 格式與端點網址
2. As a 使用者, I want 選了服務後系統自動填好 base_url, so that 我只需要貼上 API key
3. As a 使用者, I want 清單中沒有的服務可以選「自訂」並手填 base_url, so that 任何 OpenAI-compatible 服務都能接入
4. As a 使用者, I want 對任一連線執行連線測試, so that 我能確認 key 與網址正確
5. As a 使用者, I want 連線測試自動抓回該服務的模型清單, so that 我不用手打模型 id
6. As a 使用者, I want 為連線命名（如「我的 OpenRouter」）, so that 多個連線能分辨
7. As a 使用者, I want 刪除或停用連線, so that 不再用的服務不會占著畫面
8. As a 使用者, I want 系統提供的連線（Agnes）以唯讀方式呈現, so 我知道免費額度來自哪裡但不能改壞它

### 設定頁 — 模型清單管理

9. As a 使用者, I want 每個連線下有一份模型清單, so that 一個服務可以有多個可用模型
10. As a 使用者, I want 勾選/取消勾選模型清單中的模型來決定哪些出現在選擇器、哪些隱藏, so that 選擇器只出現我真正會用的模型
11. As a 使用者, I want 手動新增模型 id（探測不到或不支援 /models 列表時）, so that 沒有清單 API 的服務也能用
12. As a 使用者, I want 為個別模型調整呼叫參數（reasoning/思考程度參數格式與值、溫度、最大輸出）, so that 思考型模型與一般模型都能正確調用
13. As a 使用者, I want 模型參數預設由系統依 preset 帶好, so that 我大多時候不用懂參數也能用
14. As a 使用者, I want 設定「我的預設模型」, so that 每次占卜不用重新選

### 占卜與對話 — 模型選擇

15. As a 使用者, I want 揭盤步驟的下拉列出「模型」而不是「AI 設定」、並依「系統免費模型／我的服務」分組, so that 我選的就是實際在跑的模型
16. As a 使用者, I want 揭盤前選的模型只影響這一卦的解盤與後續追問, so that 換卦時自動回到我的預設，不會被上次選擇意外綁架
17. As a 使用者, I want 同一卦的追問與重試沿用該卦綁定的模型, so that 對話上下文與模型能力一致
18. As a 使用者, I want 在對話面板中切換模型後，之後的追問用新模型, so that 難題可以中途換強模型
19. As a 使用者, I want 看到每則回應實際使用的模型名稱, so that 我知道現在是誰在回答
20. As a 使用者, I want 切換模型時所有選擇器顯示一致的狀態, so that 不會出現兩個下拉各說各話
21. As a 訪客, I want 使用系統免費模型完成占卜與有限追問, so that 不用註冊就能體驗
22. As a 訪客, I want 看到清楚標示的免費模型清單, so that 我知道哪些是系統提供的

### 管理

23. As a 管理者, I want 為系統端點維護多個免費模型（而非單一 model id）, so that 免費使用者有選擇、我能控制額度花在哪
24. As a 管理者, I want 指定系統端點的哪個模型為預設免費模型, so that 新使用者與訪客落在成本可控的模型上
25. As a 管理者, I want 用量統計持續到「模型」粒度, so that 我知道哪個模型最燒錢（延續既有 ai_request_logs）

### 架構清理（使用者不可見但影響品質）

26. As a 維護者, I want 移除 legacy 模式管線與其 OpenCode 預設, so that 「預設 AI」只有一個定義
27. As a 維護者, I want 移除四個 legacy provider class 與 google SDK 依賴, so that AI 層只剩一個 OpenAI-compatible adapter
28. As a 維護者, I want 前端移除未被使用的 SSE 舊元件、AI 選擇邏輯集中一處, so that 前端不再有多份重複實作

## Implementation Decisions

### 資料模型

1. **連線（沿用並重整 `ai_configs` 表）**：`{name, base_url, api_key_encrypted, models(JSON), is_system(bool, 唯讀標記)}`。移除 provider 三分支（gemini/openai/local）與 `model`/`local_model` 欄位的依賴。Gemini 以官方 OpenAI 相容端點 `https://generativelanguage.googleapis.com/v1beta/openai` 作為 preset 的 base_url，不再有獨立 provider type。
2. **連線的模型清單**：`models` 為 JSON 陣列 `[{id, label?, enabled, params?}]`。`enabled=false` 的模型不出現在選擇器。`params` 為選填的呼叫參數覆蓋（見第 6 點）。
3. **使用者偏好**：新增「我的預設模型」=`(default_connection_id, default_model_id)`，取代現行 `ai_configs.is_active` 全域旗標。
4. **系統端點（`system_ai_endpoints`）**：新增 `models(JSON)` 與 `default_model` 欄位，一個系統端點可提供多個免費模型。種子化時探測 Agnes `GET /v1/models`，全部寫入並 `enabled`，admin 可維護（延續既有 admin endpoints CRUD）。
5. **占卜紀錄綁定（`history`）**：新增 `ai_connection_id`（nullable），既有 `ai_model` 欄位存放模型 id。首解 stream 請求攜帶使用者選擇的 `(connection_id, model_id)`，後端驗證後寫入；followup/retry 讀取紀錄上的綁定。舊紀錄相容：`ai_provider == "default"` 或 NULL → 解析到系統預設（端點+default_model）。
6. **模型呼叫參數解析順序**：`連線內該模型的 params` > `preset 中該模型的 params` > `adapter 全域預設`。參數項目：`reasoning`（參數名稱與值的格式，涵蓋 `reasoning_effort` 字串、數值型 effort、以及不送思考參數的模型）、`temperature`、`max_output_tokens`。adapter 從硬編碼常數改為接受 per-request 參數物件，預設值不變（維持現有行為）。

### Provider 預設清單（presets catalog）

7. **以版本控管的靜態檔案維護**（比照 OpenCode 內部清單 / models.dev 的做法）：後端一份 `presets` 資料檔（JSON/YAML，入 repo），不進 DB。每個 preset：`{id, name, base_url, docs_url, models: [{id, label, params}]}`。
8. **首批 preset**：Agnes（`apihub.agnes-ai.com/v1`，含已知可用模型與其 reasoning 參數格式——注意 Agnes 閘道拒收數值型 effort，只收 `low/medium/high`）、Gemini（官方相容端點）、OpenAI、OpenRouter、Ollama（`http://localhost:11434/v1`）、LM Studio（`http://localhost:1234/v1`）、自訂（空白表單）。preset 僅是「建議」——使用者仍可改 base_url 與模型清單。
9. **SSRF 防護延續**：自訂 URL 的 sanitize 規則（admin 才可 localhost）沿用現有實作。

### API 契約

10. **`GET /api/settings/ai/models`**（新）：聚合回傳選擇器所需清單 `[{connection_id, connection_name, model_id, source: "system"|"user", params?}]`；訪客只回系統免費模型。前端選擇器與設定頁共用此單一來源。
11. **`PUT /api/settings/ai/{id}/models`**（新）：整批更新連線的模型清單（含 enabled 勾選、手動新增、params）。
12. **`POST /api/settings/ai/test`**（既有，擴充）：對任何連線（不限 local）探測 `/v1/models`，回傳候選模型 id 清單，供「合併到清單」流程使用。
13. **首解綁定**：`GET /api/records/{id}/stream`（及 followup/retry 的首次請求）接受 `connection_id` + `model_id` 參數；後端驗證（連線屬於該使用者，或為系統端點的 enabled 模型）後寫入 `history`。訪客僅接受系統模型。
14. **移除**：占卜端點的 `mode` 參數與 legacy 分支、`PUT /api/settings/ai/use-default`、`PUT /api/settings/ai/{id}/activate`（由偏好與 per-record 綁定取代）。

### 解析路徑（單一化）

15. **`resolve_endpoint(db, connection_id, model_id)`**：唯一入口。傳入明確的連線+模型（來自 record 綁定或系統預設）；連線已被刪除時 fallback 系統預設並記錄。`thread_pipeline` 與所有 AI 呼叫皆走此路徑，`ai_tasks.py` 的 `resolve_ai_config` 隨 legacy 一起移除。

### 前端

16. **設定頁重構為兩區**：「服務連線」清單（preset 選擇器新增流程、測試、模型清單維護：勾選顯示/隱藏、手動新增、參數微調）＋「預設模型」。移除三 provider 各自的表單分支。
17. **`AISelector` 改為 `ModelSelector` 受控元件**：props 傳入當前選擇與 onChange，資料來自 `GET /api/settings/ai/models`；不再自行呼叫 activate/use-default API。占卜頁（reveal 步驟）選擇結果存頁面 state，首解請求時帶上；對話面板切換則更新後續 followup 使用的模型（並同步回頁面 state）。
18. **狀態集中**：以一個 hook（或 context）統一抓模型清單與選擇狀態，解決多實例不同步；provider/模型顯示名稱邏輯集中一處；API 呼叫統一走 `api-client`。

### 移除清單

19. **後端**：`mode='legacy'` 流程與占卜端點的 mode 參數、`services/ai_tasks.py`、`services/ai.py` 四個 provider class 與 `get_ai_service` 工廠（`test_connection` 的探測邏輯併入新流程）、google SDK 依賴、`OPENCODE_API_KEY` 與其預設邏輯、`use-default`/`activate` 端點。
20. **前端**：`SecureSSEConnection`（未被使用的 EventSource 版 SSE）、三份重複的 provider 顯示邏輯、AISelector 的自我 fetch 模式。
21. **環境變數**：修正 `.env` 的 `BASE_URL`/`MODEL_ID` 為 `AGNES_BASE_URL`/`AGNES_MODEL_ID`；`.env.example` 移除 `OPENCODE_API_KEY`（NVIDIA 已棄用項一併清掉）。

### 測試接縫（seams）

22. **主接縫：後端 HTTP API + `resolve_endpoint` 服務層**（pytest + 既有 conftest 的假 OpenAI-compatible 伺服器夾具）。測：models 聚合 API、模型清單 CRUD、首解綁定與 followup 沿用、舊紀錄相容、per-model 參數解析、legacy 移除後占卜端點行為。不 mock 內部實作細節，只驗證 API 外部行為。
23. **副接縫：前端元件測試**（vitest，mock api-client；先例：`AISelector.test.tsx`）。測：ModelSelector 分組渲染與選擇回呼、設定頁連線/模型清單編輯流程、訪客唯讀行為。

## Testing Decisions

- **只測外部行為**：API 回應形狀、SSE 事件序列、錯誤分類（auth/quota/timeout/upstream）、模型參數最終送出的請求內容（由假伺服器捕獲驗證），不測內部函式呼叫次數。
- **後端**（pytest，夾具沿用 `conftest.py` 的測試 DB 與假 OpenAI-compatible 伺服器）：
  - models 聚合 API：登入者含系統+自訂、訪客僅系統、disabled 模型不出現。
  - 連線模型清單 PUT：enabled/params 持久化、非法模型 id 拒絕。
  - 首解綁定：stream 帶 (connection_id, model_id) → history 寫入 → followup/retry 沿用同一組；帶他人連線 → 拒絕；舊紀錄（ai_provider="default"/NULL）→ 系統預設。
  - 參數解析：preset 帶 Agnes 字串型 effort、連線覆蓋為數值型 → 假伺服器收到對應 payload。
  - legacy 移除：占卜端點不再接受 mode、回應結構不變。
- **前端**（vitest）：ModelSelector 分組（系統免費模型/我的服務）、受控選擇回呼、訪客固定系統模型；設定頁模型勾選/隱藏與手動新增。提交前 `npm run test:run` 全綠。

## Out of Scope

- OAuth 型接入（Google 登入取 token 等）——ADR-0001 預留的 `auth_type` 欄位不做實作。
- 佔卜演算法層、prompts 內容、SSE 管線本身（`thread_pipeline` 的串流/心跳/上下文組裝）——僅改動其端點解析來源。
- 舊紀錄 `interpretation` 的 fallback 顯示（前端讀取歷史資料的相容邏輯保留不動）。
- admin 用量統計的呈現方式（粒度已到 model，UI 不重做）。
- preset 清單的自動線上更新（models.dev 之類的外部目錄同步）——本輪以 repo 靜態檔維護。
- `ziwei`/`bazi` 等新占卜類型擴充。

## Further Notes

- **Aha 決策紀錄**：
  1. 模型選擇**綁定在首解請求**（而非建卦時）：建卦流程（input 步驟）不動，reveal 步驟的選擇在第一次 stream 請求時隨參數送達並持久化——改動最小、語意正確。
  2. **系統免費模型清單化**：種子時探測 Agnes `/v1/models` 全數納入，admin 可增刪；解決「免費模型只有一個」。
  3. **legacy 直接移除**（前端已全走 thread 模式），不做相容墊片。
  4. （實作期間追加）**移除「localhost/私有網路僅限管理員」限制**：本機服務（Ollama、LM Studio）開放所有使用者連線——使用者明確指示。`sanitize_url` 保留 URL 格式驗證。
  5. （實作期間追加）占卜端點的 `mode`/`use_default_ai` 欄位**完全移除**（pydantic 忽略未知欄位，舊前端帶 `mode:'thread'` 不會壞）。
  6. 訪客於 stream 帶使用者 `connection_id` 時**靜默回落系統免費模型**（不報錯，避免洩漏他人連線存在性）。
  7. 新增 `AI_PROBE_MODELS` 環境變數：種子化時的 `/models` 探測開關（測試環境必須關閉）。
- **範圍外留待後續**（review 發現的 spec gap）：連線「停用」狀態（story 7 僅做了刪除）、設定頁以唯讀項目呈現系統連線（story 8，目前僅在選擇器分組呈現）。
- **OpenCode Go 相容性限制**（docs/zh-tw/go）：同一 base_url 下模型分屬三種協定——`/v1/chat/completions`（GLM、Kimi、LongCat、DeepSeek、MiMo、Hy 系列）✅ 支援；`/v1/messages`（Anthropic 型：MiniMax、Qwen3.x）與 `/v1/responses`（Grok 4.6、GPT 5.6 Luna、Muse Spark）❌ 本管線不支援。`opencode` preset 的建議模型清單僅含相容模型；手動加入不相容模型會在串流時收到 upstream 錯誤。未來如需支援，需在模型層增加「協定」欄位與對應 adapter。`GET /v1/models` 無需授權即可列出。
- **已知風險**：
  - Agnes 閘道對 `reasoning_effort` 只接受字串（`low/medium/high`），數值型會被拒——preset 與參數解析必須把這件事編進模型預設，測試需涵蓋。
  - `ai_configs` 的 model/local_model 遷移需寫轉換（local_url→base_url、兩個模型欄位→models JSON），舊資料一律設 `enabled=true` 以免使用者既有模型消失。
  - 連線刪除後，綁定該連線的舊紀錄追問需 fallback 系統預設而非報錯。
- 實作順序建議：Phase 0 熱修（env 變數名）→ Phase 1 後端資料模型+API → Phase 2 前端設定頁與 ModelSelector → Phase 3 legacy 移除與清理。每階段獨立可驗證。
