# 09 — 六爻頁流程重建（第一條前端垂直切片）

**What to build:** 以統一流程骨架（選占卜 → 問事 → 儀式 → 揭盤 → 對話）重寫六爻頁：銅錢翻擲儀式動畫（framer-motion，可跳過、尊重 reduced-motion）、揭盤視圖（卦象表格元件重繪於新 token）、接入 ThreadPanel 與全新 SSE 後端管線。骨架元件（Stepper/問事容器/儀式 slot）自此票抽出供 10/11 重用。舊六爻頁替換。

**Blocked by:** 05, 06, 08

**Status:** done（2026-08-25）

- [x] 流程骨架共用元件抽出
- [x] 問事表單（性別/對象/問題聚焦）新樣式＋驗證
- [x] 銅錢儀式動畫（六擲節奏、跳過、reduced-motion 降級）
- [x] 揭盤視圖：本卦/變卦/六親六神世應空亡 新視覺表格
- [x] 解盤即 ThreadPanel：串流、追問、中止、重試全接通
- [x] 移除本頁輪詢、手刻 modal、重複 markdown/copy/share 邏輯

## 測試項目（Seam③＋mock 後端）
1. 步驟機：各步推進與返回；直接深連結行為
2. 表單驗證：空問題/超長問題攔截
3. 儀式動畫：完成後自動進揭盤；跳過立即進；reduced-motion 直接揭盤
4. 串流顯示：mock SSE 下 delta 即時渲染、think 摺疊、完成後可追問
5. 持久化：重新整理後從 threads 重開同一紀錄內容一致
6. 行動版 viewport 版面
7. a11y：焦點管理跨步驟合理
