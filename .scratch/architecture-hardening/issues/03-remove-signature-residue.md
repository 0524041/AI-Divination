# 03 — 移除失效的 API 簽名殘留

**What to build:** 刪除前端 `skipSignature` 選項與呼叫端、`NEXT_PUBLIC_API_SIGNATURE_KEY`、以及後端註解中殘留的簽名說明。

**Why:** 簽名驗證已移除，但公開環境變數與 no-op 參數仍在，形成「以為有保護、其實公開」的陷阱。

**Status:** done

- [ ] `api-client.ts` 移除 `skipSignature`
- [ ] `login/page.tsx` 移除 `{ skipSignature: true }`
- [ ] `frontend/.env.local`、`.env.local.example` 移除 `NEXT_PUBLIC_API_SIGNATURE_KEY`
- [ ] `config.py` 殘留註解清理

## 測試項目
1. `npm run test:run` 全綠（api-client 測試移除相關斷言）
2. `tsc --noEmit` 無未使用參數錯誤

## Notes
後端 `.api_signature_key` 檔案的刪除與輪替由 ticket 06 負責。
