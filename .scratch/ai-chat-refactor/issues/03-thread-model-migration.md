# 03 — Thread 訊息模型與既有資料遷移

**What to build:** 占卜紀錄成為 Thread 根節點（ADR-0002）：新增訊息表（role、content、think、model、tokens、時間、FK 占卜紀錄）。遷移脚本把既有紀錄的解盤文字轉為首則 assistant 訊息（think 區塊抽出），幂等可重跑。產品行為不變——純資料層擴充。

**Blocked by:** None — can start immediately

**Status:** done（2026-08-25）

- [x] 訊息表 schema 就位（含 FK、索引、順序欄位）
- [x] 遷移脚本：interpretation → 首則 assistant 訊息，think 抽出至獨立欄位
- [x] 幂等：重跑不產生重複訊息
- [x] 既有 API 行為不變（歷史列表等回歸通過）

## 測試項目
1. Schema 限制：FK 約束、必填欄位、role 列舉
2. 遷移正確性：含 think／不含 think／空解盤／失敗狀態四種 legacy 列各自的遷移結果
3. 幂等性：連續執行兩次，訊息數不變
4. 排序穩定：遷移後同紀錄訊息順序確定且合理
5. 回歸：既有 history API 對遷移後資料仍回應正確

執行結果：61 passed（全套件）、ruff 全綠。啟動時自動執行冪等遷移；亦可手動 `uv run python -m app.core.thread_migrations`。