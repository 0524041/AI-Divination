# 串流渲染升級：Streamdown 取代 marked+DOMPurify 核心

Status: ready-for-agent
Created: 2026-08-26
Origin: chat-polish 驗收後之效能優化討論（SSE 逐字串流已通，渲染層為下個瓶頸）
Parent: .scratch/chat-polish/spec.md（本 spec 不改變其任何架構決策）

## Problem Statement

AI 回應是逐字串流的，但前端渲染器對每個 delta 都把**整份累積內容**重新 parse、sanitize、並以 innerHTML 整段替換 DOM：

1. **O(n²) 成本**：解盤動輒上千字＋GFM 表格，串流越到後段每 token 成本越高，長回應明顯卡頓。
2. **半截語法閃爍**：串流中未閉合的 `**粗體`、表格列、code fence 會先呈錯誤樣貌、收到閉合符號才跳成正確樣子。
3. **可能阻塞互動**：同步 parse 大字串會擠壓使用者輸入與捲動的回應性。

此問題影響全站所有 AI 回應渲染場景：三類占卜的追問對話、首解串流視圖、分享頁。

## Solution

以 Vercel **Streamdown** 取代渲染核心（marked + DOMPurify + dangerouslySetInnerHTML）。MarkdownRenderer 維持全站唯一渲染入口與既有 props 契約，內部改為：

- **streaming 模式**（串流中）：block 切分＋memoization（每 token 只重渲染尾端 block）、remend 引擎即時補閉未完成語法、React Transition 包裝不阻塞使用者操作。
- **static 模式**（已完成內容）：單趟渲染，零串流開銷——用於分享頁與歷史內容。

保留現有行為契約：單換行轉 `<br>`（補 remark-breaks）、`<think>` 提取與摺疊、AI 整份包 code fence 的剝殼處理、`.markdown-content` 全域樣式掛點、sanitize 安全底線。

## User Stories

1. As a 追問的使用者, I want 長篇解盤串流到後段時畫面依然流暢, so that 閱讀過程不被卡頓打斷
2. As a 使用者, I want 串流中的粗體、表格、程式碼區塊從第一個字就呈現正確樣貌, so that 內容不會閃爍變形
3. As a 手機使用者, I want AI 串流時我仍能順暢打字與捲動, so that 回應生成不干擾我的操作
4. As a 查看分享頁的使用者, I want 完成的解盤以最低開銷渲染, so that 頁面載入快且省電
5. As a 使用者, I want 換行排版行為與改版前完全一致, so that 解盤的段落節奏不被破壞
6. As a 使用者, I want 「AI 思考過程」摺疊區塊照常運作, so that 我可以按需展開推理內容
7. As a 重視安全的營運者, I want AI 輸出中的惡意 HTML/script 一律被清除, so that 使用者不受注入攻擊
8. As a 開發者, I want Markdown 維持單一渲染出口且行為集中可測, so that 未來調整只動一處
9. As a 開發者, I want 渲染核心由活躍維護的套件承擔, so that 不需自行養增量 parser 的正確性測試
10. As a 桌面使用者, I want 表格在氣泡寬度內正常顯示並可橫向捲動, so that 寬表不撐破版面

## Implementation Decisions

1. **採用 streamdown 套件**（Vercel 官方，peer deps React ≥18，與現行 React 18.2 相容）。評估結論：block memoization、remend 補閉、sanitize+harden 三項皆為高 DIY 成本項，套件化划算。
2. **相容層策略**：MarkdownRenderer 為唯一入口；既有 props（content / className / showThinkingProcess / thinkingLabel）語義不變，**新增 `streaming?: boolean`（預設 false）**。上層呼叫端僅需多傳一個 prop。
3. **模式分配**：ThreadPanel（追問）與 DivinationChat（首解串流）於串流進行中傳 `streaming`；串流結束後與 SharePage 皆走 static 模式（避免串流→完成的切換閃爍由 isAnimating 收尾控制）。
4. **內容前置層搬移**：`<think>` 提取與「AI 把整份包在 ``` 內」的剝殼邏輯，從 lib 層 parse 函式移入元件的前置處理，先淨化再餵 Streamdown；`dangerouslySetInnerHTML` 與 async parse useEffect 一併移除（同步渲染，loading skeleton 不再需要）。
5. **換行行為**：加入 remark-breaks 維持「單換行 = `<br>`」（現行 marked `breaks:true` 語義）；GFM 表格由 Streamdown 內建。
6. **Sanitize 政策映射**：現行 DOMPurify 的 `ADD_TAGS: span`、`ADD_ATTR: class/style` 映射到 Streamdown 的 allowedTags／sanitize schema；script、事件屬性維持預設阻擋；rehype-harden 提供連結防護。
7. **Tailwind 3.4 相容**：走 Streamdown 編譯好的 styles.css 匯入路線（不依賴專案 Tailwind 版本）；元件 wrapper 保留 `markdown-content` class，globals.css 既有元素選擇器繼續生效；套件自帶 class 造成的覆蓋差異於 globals.css 收斂。
8. **依賴清理**：marked、dompurify 及其 types 若無其他引用則自 package.json 移除；bundle 目標增加 ≤ ~25KB gz。
9. **Mermaid／KaTeX plugins 本輪不啟用**（保持依賴最小；介面上 Streamdown 以 plugin 形式支援，日後可加）。
10. **已知 trade-off 接受**：跨 block 參考式連結不解析（所有同型實作共通限制；模型輸出皆為 inline 連結，實際影響趨零）。

## Testing Decisions

- **Seam**：MarkdownRenderer 元件本身（全站唯一渲染出口）。既有先例：ThreadPanel.test.tsx 的 vitest + testing-library 模式。
- **渲染正確性**：標題／粗體／清單／GFM 表格／code block 輸入 → 斷言對應元素存在於 DOM。
- **換行回歸**：含單換行的段落 → 渲染結果包含 `<br>`（防止 remark 替換造成的靜默排版劣化）。
- **think 回歸**：`<think>…</think>` 內容不出現在主體、摺疊標題（thinkingLabel）存在且可展開。
- **剝殼回歸**：整份包 ```markdown 的輸入 → 不顯示柵欄符號。
- **安全**：`<script>` 與 `onclick` 屬性輸入 → DOM 中不存在該元素／屬性。
- **串流行為（外部觀察）**：content 分多次 setState 模擬串流 → 中途與結束皆渲染正確、無拋錯；不針對 memoization 內部機制做白盒斷言（那是套件的責任）。
- **全量驗證**：`npm run test:run`＋`npm run lint`＋`npm run build`；手動驗收：六爻／塔羅／紫微各跑一輪首解＋追問串流、分享頁開啟比對改版前截圖。

## Out of Scope

- Mermaid 圖表與 KaTeX 數學式渲染
- 超長對話的虛擬捲動（viewport virtualization）
- 後端 SSE 協議或管線變更
- MarkdownRenderer 以外的 UI／樣式系統重構
- 思考過程（reasoning_content）的串流視覺化增強

## Further Notes

- 評估依據：Streamdown 官方文件（streaming/memoization/remend/block API）、Chrome《Best practices to render streamed LLM responses》、多家增量渲染器（stream-md、optimark、incremark、flowdown）比較；DIY 路線（marked lexer block split + HTML 快取）可行但需自養 remend 正確性與安全 schema，長期維運成本高於套件化。
- 本輪完成後，「串流渲染」鏈路（後端 pump → SSE → 前端增量渲染）即為完整閉環；chat-polish 第一二輪遺留的渲染層債務清償完畢。
