# 08 — API client 收斂、SSE hook 與 ThreadPanel

**What to build:** 前端核心三件套：①統一 API client（收斂散落 fetch 的擴充階段，舊呼叫暫留）②useThreadStream hook——包裝既有 SSE 連線能力（連線、delta 累積、心跳感知、中止、錯誤重試）③ThreadPanel 元件——訊息氣泡列表、串流游標、think 即時摺疊、單一 Markdown sanitised 渲染點、輸入框、provider/model 切換器、中止/重試控制。以 dev-only 展示路由即可演示完整對話體驗。

**Blocked by:** 07

**Status:** ready-for-agent

- [ ] API client 擴充：SSE 連線工廠＋型別化端點方法；既有 secureApiRequest 行為保留
- [ ] useThreadStream：狀態機 idle/connecting/streaming/aborted/error/done
- [ ] ThreadPanel 完整互動＋行動版版面
- [ ] dev-only demo 頁接假資料可演示

## 測試項目（Seam③）
1. useThreadStream 對 mock SSE：連線→delta 依序累積→done；中途 abort；error 事件；斷線不静默（狀態可見）
2. ThreadPanel 送出：樂觀插入 user 訊息、送出中輸入框禁用
3. think 區塊：串流中即時累積、摺疊切換不遺失內容
4. 中止按鈕：串流中出現、點擊後狀態正確
5. 重試：最後一則 assistant 訊息重新請求
6. provider 切換器：選項來源與選擇事件
7. Markdown 渲染：唯一 sanitise 出口；惡意輸入被淨化
8. a11y：訊息列表角色、live region 宣告新訊息
