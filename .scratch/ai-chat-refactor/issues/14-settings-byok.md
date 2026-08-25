# 14 — Settings 與 BYOK 管理

**What to build:** settings 頁於新元件庫上重造：自訂端點清單（新增/編輯/刪除/測試連線/設為使用中）、model 欄可從該端點拉取清單或手動填寫、帳號密碼區塊。admin tab 依 13 移除。

**Blocked by:** 08

**Status:** ready-for-agent

- [ ] 自訂端點 CRUD UI＋測試連線
- [ ] model picker：/v1/models 拉取＋手填 fallback
- [ ] 使用中切換：下一筆占卜即用新端點
- [ ] 帳號密碼區塊新樣式

## 測試項目（Seam③）
1. CRUD 往返：金鑰輸入後不再以明文出現於任何回顯
2. 測試連線的成功/失敗回饋（mock client）
3. model 拉取失敗→手填仍可用
4. 切換使用中→建立新占卜的請求攜帶正確設定（mock 驗證）
5. 表單驗證：URL 格式、必填
