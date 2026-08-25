# 15 — 首頁、登入與分享頁改版

**What to build:** 首頁占卜入口卡（新視覺＋進場動效）；login 四合一表單（登入/註冊/初始化/訪客）重造於新元件庫、行為不變；分享頁改渲染「盤面摘要＋訊息流」（廢除數分隔線解析文字的 hack）；guest-limit 孤兒路由移除，額度狀態改由 ThreadPanel 內 toast/dialog 呈現。

**Blocked by:** 06, 08, 12

**Status:** done（2026-08-25）

- [x] 首頁改版（含姓名學卡維持 disabled 呈現）
- [x] login 重造（行為不變）
- [x] 分享 API 回傳訊息流＋公開渲染（未認證可讀）
- [x] guest-limit 路由移除＋額度 toast 接線

## 測試項目
1. login 四流程回歸：註冊/登入/初始化/訪客 行為與 token 處理不變
2. 分享頁：有效 token 未登入可讀完整對話流＋盤面摘要；過期/無效 token 狀態
3. 分享內容不含任何金鑰或他人紀錄
4. 額度耗盡時 ThreadPanel 提示文案與引導註冊
5. 首頁卡導航與 disabled 態
