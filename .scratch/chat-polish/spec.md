# 對話體驗打磨：Prompt 分離 × 擲幣重做 × 版面放寬

Status: ready-for-agent
Created: 2026-08-26
Origin: 上輪重構驗收後使用者回饋（三項）
Parent: .scratch/ai-chat-refactor/spec.md（本 spec 為其第二輪增修，不改變既有架構決策）

## Problem Statement

1. **追問被格式綁架**：三類型的 system prompt 內含「最終輸出結構」模板，且對話模式規則每輪附加——導致追問時 AI 也想擠出完整解盤報告骨架，答非所問。
2. **擲幣動畫失去儀式感**：每擲僅 600ms 且未呈現「三枚銅錢正反組合定爻」的核心過程，快到看不清結果——違背六爻「丟六次、看正反面」的占卜本質。
3. **對話版面過窄**：容器 max-w-3xl 加上氣泡 max-w-[80%] 雙重限縮，桌面上解盤 Markdown 表格被擠壓，手機也浪費可用寬度。

## Solution

Prompt 重構為「片段組裝」：角色/知識/安全為常駐基底，「輸出格式」抽成獨立片段**只在首次解盤拼接**；追問的上下文＝常駐 system＋緊湊盤面＋首則大師解盤全文（固定錨點）＋最近 12 則追問滑窗，並以 48k tokens 為整體預算做截斷與 UI 顯示。擲幣動畫按真實儀式重做（三銅錢×六擲×正反面組合，逐爻堆疊）。對話版面桌面放寬至 896px 容器、氣泡 85%，手機近滿寬。

## User Stories

1. As a 使用者, I want 追問時 AI 直接回答問題而非重吐報告骨架, so that 對話自然流暢
2. As a 使用者, I want 看到目前對話的上下文用量與上限（如「3.2k / 48k tokens」）, so that 我知道還能聊多深
3. As a 使用者, I want 對話很長時系統自動保留盤面與首解、只丟最舊的追問, so that 關鍵資訊永不消失
4. As a 使用者, I want 擲幣動畫呈現每次三枚銅錢的正反面與組合判定（如老陽 ⚊ 動）, so that 占卜過程可信且有儀式感
5. As a 使用者, I want 六爻逐爻由初爻往上堆疊成小卦象, so that 我能看著卦象長出來
6. As a 使用者, I want 跳過動畫與 reduced-motion 降級, so that 急用或無障礙需求不受影響
7. As a 桌面使用者, I want 解盤內容有充足的閱讀寬度（表格不擠壓）, so that 長篇解讀好讀
8. As a 手機使用者, I want 訊息佔滿可用寬度, so that 小螢幕不浪費空間

## Implementation Decisions

### Prompt 片段化（三類型）

1. 各類型 system prompt 拆為兩層：**常駐基底**（角色＋知識庫＋安全檢核＋對話模式規則）與 **首次解盤限定**（輸出格式模板）。組裝器提供「首次」與「追問」兩種組合；追問絕不帶格式模板。
2. 順帶清理六爻基底中「必須引用諸事/愛情/事業/財運/詳解」的段落（該資料已不再注入，留著只會誘導幻引）；紫微以佔位符截斷的做法改為正式拆檔。

### 追問上下文與 48k 預算

3. 追問訊息序列＝常駐 system＋`【盤面】`緊湊區塊＋`【先前的解盤】`首則 assistant 全文（錨點，不截斷 1500 字——改為納入預算計算）＋最近 12 則對話＋新問題；錨點與盤面**永不因超額被丟棄**，超額時自最舊的追問對話開始捨棄。
4. Token 估算：字元數粗估（CJK ≈1 字/token、ASCII ≈4 字元/token），單一純函式供前後端共用語意；後端在組裝後落 log 欄位（duration/tokens 既有），前端顯示估算值即可，不做精確 tokenizer。
5. 預算上限 **48,000 tokens**（整個請求 messages 總和）；UI 於 ThreadPanel 輸入框上方顯示進度條＋文字「上下文約 X.Xk / 48k」，>80% 轉朱砂色警示。
6. 資料層確認：ThreadMessage.content/think、History.interpretation/chart_data 皆為 TEXT（SQLite 無長度限制），48k token 量級的內容可完整存取；AIRequestLog.tokens 為 Integer 亦足夠——實作時以此清單各加一條邊界測試（寫入→讀回等長）。

### 擲幣動畫重做

7. 流程：六次擲幣（由初爻到上爻），每次三枚方孔銅錢以 framer-motion 旋轉落下、逐一翻面定格顯示「字／背」→ 組合判定名稱浮出（3 字＝老陽 ⚊ 動、2 字 1 背＝少陰 ⚋…依序全四種）→ 該爻加入側欄小卦象堆疊。
8. 節奏：每擲約 2 秒（含落定停頓），總長約 12 秒；「跳過」立即完成全部爻並進揭盤；`useReducedMotion` 時跳過動畫僅快速文字序列。硬幣視覺以 CSS 繪製圓形方孔銅錢（金銅色 token），不引入圖檔。

### 版面放寬

9. 對話容器：桌面 max-w-4xl（896px）、手機滿寬減 24px 邊距；assistant 氣泡放寬至 max-w-[85%]（桌面）/滿寬（手機），user 氣泡維持右靠但同樣放寬。
10. 解盤 Markdown 內表格套横向捲動容器，避免撐破氣泡。

## Testing Decisions

- **Prompt 組裝**（Seam① 快照）：首次解盤的 system 含格式模板；追問的 system **不含**任何「輸出結構/Output Format」字樣且含對話模式規則；三類型各一。
- **上下文預算**：單元測試估算函式（中英混排）；組裝測試——塞入超量長歷史後，斷言（錨點存在、盤面存在、最舊追問被丟、新問題在最後、總估算 ≤ 48k）。
- **UI**：ThreadPanel 測試渲染預算條文字與 >80% 警示 class；DivinationChat 容器 class 斷言（max-w-4xl）。
- **擲幣**：元件測試——完成後六爻名稱序列正確、skip 立即 onComplete、reduced-motion 不跑動畫幀。
- **資料邊界**：48k 字元級內容寫入 ThreadMessage/History 後讀回等長（SQLite TEXT 驗證）。

## Out of Scope

- 真實 tokenizer 接入（維持字元粗估）
- 對話中途切換 provider（仍列於前份 spec 已知差距 #1，另行處理）
- legacy 輪詢管線收合

## Further Notes

- 執行順序建議：prompt 片段化＋追問組裝（後端）→ 上下文預算＋UI 顯示 → 擲幣動畫重做 → 版面放寬；每步 `uv run pytest tests/ -q`＋`npm run test:run` 全綠。
- 完成後本輪同時消除前份 spec 已知差距中「liuyao_system.md 自相矛盾」一項。
