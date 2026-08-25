# 玄覺空間平台重構：AI 對話化 × 全面視覺改版

Status: ready-for-agent
Created: 2026-08-25
Origin: /grill-with-docs session（16 項決策，詳見 docs/adr/0001、0002 與 CONTEXT.md）

## Problem Statement

使用者完成一次占卜後，拿到一份一次性解盤文字就結束了——想進一步追問「世爻空亡具體影響什麼」「第二張牌逆位會不會翻轉結論」，網站沒有任何管道。AI 的能力被浪費：演算法層把卦辭詳解預先咀嚼成凍結文字塞進 prompt，AI 只能複述而不能發揮推理；回應以 2 秒輪詢整段取回，等待體感差。

對管理者而言：免費預設模型寫死在程式碼裡（且兩處預設值互相矛盾），想換供應商得改程式碼重新部署；看不到誰在用、用了多少、哪個模型燒最多錢。

對訪客而言：想用自己的 OpenRouter/OpenAI key 卻只有單一設定入口，體驗與正式使用者割裂。

整個網站的 UI 是三個各自為政的頁面：三套 step 狀態機、四份重複的 Markdown/think/複製分享邏輯、31 處原生 fetch、64 處 alert()、壞掉的動畫 class、硬編碼色票、死碼元件——視覺上不像同一個產品。

## Solution

**占卜紀錄即 Thread**：每次占卜產生一個可續聊的對話。首次解盤經 SSE 逐 token 串流呈現（等待感由各占卜類型的儀式動畫承擔），其後使用者可無限追問，每則回應同樣串流、可隨時中止。盤面以緊湊結構化資料交給 AI，解讀完全交給 AI 發揮。

**AI 接入統一**：所有非 OAuth 供應商一律走 OpenAI-compatible 端點（base_url + key + model）。使用者自帶自訂端點（BYOK），訪客與未設定者使用管理者在 /admin 指定的預設模型；每一次請求留存量紀錄，admin 可看總量、每人排行、每日趨勢、模型分布，並隨時切換預設端點。

**全面視覺改版**：「墨與金」東方玄學精緻化方向（雙主題保留），統一流程骨架（選占卜 → 問事 → 儀式 → 揭盤 → 對話），三種占卜只客製儀式場景與盤面呈現；Radix headless + CVA 重造元件庫；framer-motion 動效。

## User Stories

### 對話核心

1. As a 使用者, I want 解盤內容逐字串流顯示, so that 我不用盯著假進度條乾等
2. As a 使用者, I want 在解盤下方直接輸入追問並得到串流回應, so that 我能深入理解自己的卦
3. As a 使用者, I want 追問時 AI 記得整個盤面與先前對話, so that 我不用重複背景
4. As a 使用者, I want 中止正在生成的回應, so that 我不用等一個已不需要的回答
5. As a 使用者, I want 重新生成最後一則失敗或不滿意的回應, so that 我不用重佔一次
6. As a 使用者, I want 看到 AI 的思考過程摺疊區塊（串流中即時累積）, so that 主文閱讀不被干擾但可深究
7. As a 使用者, I want 從歷史列表重開任何一個占卜紀錄繼續追問, so that 昨天的卦今天還能接著聊
8. As a 使用者, I want 回應出錯時看到明確原因（key 錯誤／額度用盡／逾時）而非通用失敗, so that 我知道該修什麼

### 占卜流程

9. As a 使用者, I want 三種占卜遵循同一套直覺流程（問事→儀式→揭盤→對話）, so that 學會一種就會全部
10. As a 使用者, I want 六爻擲幣由網站演算法決定並以儀式動畫呈現, so that 我信任結果不是前端造假
11. As a 使用者, I want 塔羅洗牌抽牌由網站後端決定, so that 牌組不可被竄改
12. As a 使用者, I want 紫微排盤結果即時呈現並漸進點亮星曜, so that 排盤本身就有觀賞價值
13. As a 使用者, I want 揭盤後直接在同一視圖看到盤面細節與對話, so that 不用在彈窗與頁面間跳來跳去
14. As a 使用者, I want 問事階段的問題聚焦引導（例如感情/事業分類提示）, so that 我的問題適合占卜

### AI 接入

15. As a 使用者, I want 新增自訂端點（base_url + key + model）並測試連線, so that 我能用自己 OpenRouter/OpenAI/本地模型的 key
16. As a 使用者, I want 從我的端點清單或系統預設之間切換, so that 不同情境用不同模型
17. As a 使用者, I want 在同一對話中途切換 provider/model, so that 難題換強模型、閒聊用快的
18. As a 訪客, I want 用免費預設模型完整體驗占卜與有限追問, so that 我能評估是否註冊
19. As a 訪客, I want 接近每日額度上限時收到明確提示, so that 額度用完不會錯愕
20. As a 訪客, I want 額度用盡時被引導註冊, so that 我知道如何解鎖

### 管理

21. As a 管理者, I want 新增/編輯/停用系統級端點並指定其中之一為預設模型, so that 免費額度花在哪由我控制
22. As a 管理者, I want 測試系統端點連線, so that 換預設前確認它活的
23. As a 管理者, I want 看總請求數、每人用量排行、每日趨勢、各模型分布, so that 我掌握成本結構
24. As a 管理者, I want 用量資料永久留存, so that 長期趨勢可比較
25. As a 管理者, I want 在獨立的管理專區完成上述一切（含既有用戶管理搬入）, so that 管理功能不與個人設定混雜

### 視覺與一致性

26. As a 使用者, I want 全站一致的「墨與金」視覺語言與雙主題, so that 這看起來是一個精緻的產品
27. As a 使用者, I want 流程轉場與微互動有連貫的動效, so that 占卜有儀式感而不卡頓
28. As a 行動版使用者, I want 所有新介面在手機上可用, so that 我隨時隨地能占卜
29. As a 使用者, I want 操作回饋用 toast/dialog 而非瀏覽器 alert, so that 介面不打斷心流
30. As a 使用者, I want 分享連結呈現完整對話流（含盤面摘要）, so that 收到的人能讀懂整個脈絡
31. As a 使用者, I want 表單錯誤、載入狀態全站樣式一致, so that 我不會困惑哪裡出錯了

## Implementation Decisions

### 後端 — AI Provider 層（ADR-0001）

1. **單一 adapter**：以一個 OpenAI-compatible client 取代現有四個 provider class。設定三元組 `{name, base_url, api_key(加密), model, auth_type}`；`auth_type` 本輪僅 `"api_key"`，為未來 OAuth 預留。
2. **兩層設定來源**：(a) 使用者自訂端點——沿用現有加密 ai_configs 表與測試連線機制；(b) 系統預設端點——新表，admin CRUD＋is_default 旗標，訪客與未設定 BYOK 者解析到此。首次啟動時若表為空，以環境變數既有 key 種子化一筆預設。
3. **串流介面**：provider 介面改為接受 messages 陣列、回傳 async delta iterator；統一錯誤映射（401→金鑰錯誤、429→額度、逾時、上游 5xx）。Gemini 改走其官方 OpenAI 相容端點，移除 google SDK 依賴。
4. **用量紀錄**：每次 AI 請求寫入一列 `{user, 端點設定, model, prompt/completion tokens, 成功否, 錯誤類別, 時間}`，永久保留；admin 統計由此聚合。

### 後端 — Thread 與串流（ADR-0002）

5. **資料模型**：新訊息表 `{record_id FK, role(user|assistant), content, think, 端點設定 id, model, tokens, created_at}`；History 表保留為占卜紀錄根節點（問題、盤面、類型、狀態），原 interpretation 欄位遷移後廢棄。
6. **遷移**：既有紀錄的自動遷移腳本把 interpretation 轉為首則 assistant 訊息（think 區塊照舊抽出）；一次性執行、可重跑（幂等）。
7. **單一串流管線**：新增 per-record SSE 端點。建立占卜紀錄的回應立即返回（含盤面），前端接著開 SSE——首則解盤串流送達；之後每一則追問 POST 後於同一 SSE 通道接收。pending/processing 輪詢機制整個移除。心跳保活；中止＝關閉生成任務（cancel token）。
8. **Prompt 架構**：system prompt 由模組化片段組裝（角色＋知識庫＋規則＋安全檢核），不再單檔巨型模板；首輪注入緊湊結構化盤面＋精簡卦辭參考（移除預烤的諸事/愛情/財運詳解段落）；追問輪＝system＋盤面摘要＋最近 N 則對話史（滑窗）。三種占卜的注入格式統一為繁中結構化。
9. **占卜演算法收斂**：六爻擲幣維持後端；塔羅抽牌移至後端（洗牌演算＋正逆位由伺服器決定，回傳完整牌陣）；紫微維持前端 iztro 排盤但後端做 schema 驗證（欄位齊全性、合理範圍）。三份複製貼上的背景任務合併為單一管線；取消語意統一。
10. **限額**：訪客每日上限 10 則 **AI 回應**（含首解與追問），集中單一 enforcement point；登入使用者暫不限額。既有 guest 機制併入此處。
11. **清理**：刪除未被引用的舊版 prompt、宣告未實作的 stream stub、return 後死碼、sqlite URL 正規化的重複實作。

### 前端 — 元件與流程

12. **Primitives 重造**：Radix UI headless（Dialog/DropdownMenu/Tabs/Toast/Tooltip/Switch 等）+ CVA variants + 既有 CSS tokens = 新 ui 元件庫；補齊 barrel export；Modal/ResultActions/Container/useRequireAuth 死碼移除。
13. **墨與金主題**：token 層重整（雙主題），清除 ZiweiChart/share/CoinTossing 共 160+ 處硬編碼色票；移除 `.glass-card/.btn-gold/.input-dark` 平行樣式語言與 globals.css 字重 !important hack；安裝缺失的 animate 基礎（以 framer-motion 為主）。
14. **統一流程骨架**：共用 Stepper、問事表單容器、儀式場景 slot、揭盤視圖、ThreadPanel；三種占卜頁變薄，只提供儀式場景（六爻銅錢翻擲／塔羅扇形洗牌抽牌／紫微星盤漸亮）與盤面渲染。
15. **ThreadPanel**：訊息列表（user/assistant 氣泡）、串流游標、think 即時摺疊、Markdown 渲染統一走單一共用元件、輸入框、provider 切換器、中止/重試按鈕。
16. **API 層收斂**：31 處原生 fetch 收斂到統一 client；新增 SSE hook 包裝既有 SecureSSEConnection；64 處 alert()/confirm() 換 Toast/Dialog。
17. **頁面重建**：home（占卜選擇）、login、liuyao/tarot/ziwei（薄殼）、history→threads 列表（可重開續聊）、settings（BYOK 管理＋帳號）、admin（新）、share（訊息流渲染）、guest-limit 孤兒路由處置（併入額度 toast 引導）。
18. **動效**：framer-motion 承担轉場與微互動；p5.js 背景粒子重做為更輕量的實作；尊重 prefers-reduced-motion（既有基礎保留）。
19. **a11y**：修復靜態元素互動、label 未關聯、缺 button type、array index key、dangerouslySetInnerHTML 收斂至單一 sanitised 渲染點。

## Testing Decisions

- **好測試的定義**：只測外部行為——API 回應契約、SSE 事件序列（delta/done/error 順序）、限額行為、遷移幂等性、thread 訊息順序完整性；不測內部實作細節。
- **Seam ①（主力）— HTTP API**：以 FastAPI 測試客戶端覆蓋：紀錄建立→SSE 串流→追問→中止→重試全週期；訪客限額計數；admin 端點 CRUD＋統計聚合；塔羅後端抽牌的合法性；紫微 schema 驗證拒收畸形資料。
- **Seam ② — Provider adapter**：對假 OpenAI-compatible server（stub transport）驗證請求形狀（messages/model/參數）、串流 delta 解析、錯誤映射（401/429/timeout/upstream）。
- **Seam ③ — 前端元件**：vitest + jsdom，沿用既有 Button/AISelector/Navbar 測試模式。覆蓋：ThreadPanel 串流渲染與 think 摺疊、中止/重試互動、流程骨架步驟推進、primitives 基本 a11y 行為。
- **遷移驗證**：以夾帶舊格式資料的 fixture DB 驗證遷移脚本正確性與幂等。

## Out of Scope

- OAuth 連接器實作（僅留 auth_type 擴充點）
- ChatGPT 網頁版 token 支援（違反 ToS，明確不做）
- 自由聊天模式（不占卜的純對話）
- 姓名學或其他新占卜類型
- 登入使用者的付費/計費機制（僅建好用量數據地基）
- 更換資料庫引擎（維持 SQLite）
- 後端框架/認證機制更換

## Further Notes

- **執行順序**（單一 spec、連續執行、每階段可驗證）：
  - Phase 1 後端地基：provider 層、用量紀錄、thread 模型＋遷移、SSE 管線、prompt 重構、塔羅後端化
  - Phase 2 前端核心：tokens 重整、primitives 重造、api-client/SSE hook 收斂、ThreadPanel
  - Phase 3 三占卜頁流程重建＋儀式動畫＋盤面視圖
  - Phase 4 threads/admin/settings/share/login/home 頁面
  - Phase 5 清理（死碼/alert 替換掃尾）＋ a11y ＋全站煙霧
- 每階段結束跑 `npm run test:run` 與手動煙霧（start.sh --dev）；backend 無測試框架，Phase 1 需先引入 pytest 作為 Seam ①② 的承載。
- 部署流程（start.sh smart deploy）不受影響；OPENCODE_API_KEY 環境變數轉為種子資料後仍保留向後相容。
