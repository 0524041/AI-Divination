# 02 — Provider adapter 與端點設定層

**What to build:** 以單一 OpenAI-compatible provider（base_url + key + model，ADR-0001）作為「擴充」階段與舊四個 provider class 並存——舊路徑暫時不動。包含：使用者自訂端點沿用既有加密儲存；新系統預設端點表（可指定預設模型；首次啟動以環境變數 key 種子化）；解析順序＝使用者使用中自訂端點 → 系統預設；每次 AI 請求寫入用量紀錄（永久保留）。

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] 單一 provider class：接受 messages 陣列、回傳 async delta iterator、統一錯誤映射（401→金鑰錯誤、429→額度、逾時、上游 5xx）
- [ ] 系統預設端點表＋種子化邏輯（幂等）＋is_default 解析
- [ ] 使用者自訂端點解析（active 設定）與金鑰解密接線
- [ ] 用量紀錄表＋每次請求記帳（成功與失敗都記）
- [ ] 舊 provider classes 與既有解盤路徑完全不受影響（回歸測試通過）

## 測試項目（Seam②：假伺服器）
1. 請求形狀：messages 順序、model、auth header、content-type 正確
2. 串流解析：delta 依序聚合、[DONE] 正常終止、空 delta 容錯
3. 錯誤映射：401/429/逾時/上游5xx 各自映射到語意化錯誤類別
4. 用量紀錄：成功請求記 prompt/completion tokens；失敗請求記錯誤類別；無漏記
5. 解析順序：無任何設定→系統預設；有 active 自訂端點→覆蓋預設；自訂端點停用→回落預設
6. 金鑰加密往返；種子化重跑不重複建立
7. 回歸：既有三條解盤背景任務在夾具下仍可完成（舊路徑未壞）
