# 06 — [ops] Vercel／Neon 環境與邊緣防護設定

**What to build:** 需要人在 dashboard／CLI 完成、程式碼無法覆蓋的設定。

**Why:** 應用內限流與記憶體狀態在多實例 Serverless 下失效；CORS／連線池／防濫用必須在平台層設定。

**Status:** ready-for-human

- [ ] 後端 Vercel env `ALLOWED_ORIGINS` = 前端正式網域（＋必要預覽網域），**不含 `*`**
- [ ] 確認後端 `DATABASE_URL` 為 Neon **pooled**（`-pooler`）連線；`DATABASE_URL_UNPOOLED` 僅供遷移
- [ ] 前端 Vercel env `NEXT_PUBLIC_ENABLE_PRESENCE` 不存在或 `false`
- [ ] 邊緣限流：`POST /api/auth/*`、`GET /api/records/*`
- [ ] 訪客登入加 Turnstile／機器人防護
- [ ] 輪替本機曾裸放的 Neon Object Storage AWS 金鑰
- [ ] 確認自訂網域有 HSTS

## 驗收
- [ ] 從非白名單網域呼叫 API，回應**不含** `Access-Control-Allow-Origin`
- [ ] 併發打登入端點超過門檻 → 429
