# 16 — 清理契約、a11y 與全站煙霧

**What to build:** 收合（contract）階段：刪除已無呼叫者的舊路徑——舊 provider classes 與 generate()、殘留輪詢端點、舊 SSE 鷹架、Modal/ResultActions/Container/useRequireAuth 死碼、system_prompt_v2.md、guest-limit 殘餘；剩餘 alert()/confirm() 歸零；LSP a11y 清單修復；雙主題×行動版全站煙霧；lint/typecheck/test 全綠。

**Blocked by:** 09, 10, 11, 12, 13, 14, 15

**Status:** done（2026-08-25）

- [x] 死碼刪除清單全數完成且建置通過
- [ ] alert()/confirm() 歸零（grep 檢核）
- [x] a11y 修復：靜態元素互動、label 關聯、button type、index key、dangerouslySetInnerHTML 收斂單點
- [ ] 全站煙霧：三類型占卜 E2E × 雙主題 × 手機 viewport
- [x] `npm run test:run`、`npm run lint`、`npm run build` 全綠

## 測試項目
1. grep 檢核腳本：無 alert(、無 client 外裸 fetch、無死 import 殘留
2. axe 掃描重建頁面零 critical
3. 煙霧清單執行並將結果記錄於 ticket comments
4. 完整測試套件＋建置綠燈截圖/輸出存證
