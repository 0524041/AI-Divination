# API 安全機制說明

## 概述

本系統實施了全面的 API 安全機制，防止以下攻擊：
- ✅ **重定向攻擊** - 防止 API 請求被重定向到惡意服務器
- ✅ **CSRF 攻擊** - 通過請求簽名驗證防止跨站請求偽造
- ✅ **重放攻擊** - 使用時間戳和 nonce 防止請求重放
- ✅ **中間人攻擊** - 請求簽名確保數據完整性
- ✅ **來源驗證** - 白名單機制確保只有授權來源可以訪問

## 安全特性

### 1. 請求簽名機制

每個 API 請求都包含 HMAC-SHA256 簽名：

```
簽名內容 = HMAC-SHA256(API路徑 + 時間戳 + 隨機數, 共享密鑰)
```

**請求頭示例：**
```
X-Request-Signature: <HMAC-SHA256 簽名>
X-Request-Timestamp: <Unix 時間戳>
X-Request-Nonce: <隨機字符串>
```

### 2. 來源白名單

後端配置只接受來自特定域名的請求：

```python
ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000"
]
```

### 3. Server-Sent Events (SSE) 安全通訊

對於長時間運行的請求（如 AI 生成），使用 SSE 替代輪詢：

**優勢：**
- 單向數據流，服務器主動推送
- 不會被重定向攻擊影響
- 內建重連機制
- 更低的延遲和帶寬消耗

### 4. 防止重放攻擊

- 每個請求必須包含時間戳
- 時間戳與服務器時間差不能超過 5 分鐘
- 每個請求使用唯一的 nonce

### 5. 防止重定向攻擊

前端客戶端配置：
```typescript
fetch(url, {
  redirect: 'manual'  // 不自動跟隨重定向
})
```

並驗證響應狀態碼，如檢測到重定向立即拋出錯誤。

## 配置步驟

### 後端配置

1. **自動生成密鑰**（首次運行時自動生成）

```bash
cd backend
python -m uvicorn app.main:app --reload
```

系統會自動生成以下文件：
- `.secret_key` - JWT 密鑰
- `.encryption_key` - 加密密鑰
- `.api_signature_key` - API 請求簽名密鑰

2. **配置環境變量**（可選）

創建 `backend/.env` 文件：
```env
# API 安全配置
ALLOWED_ORIGINS=["http://localhost:3000","https://yourdomain.com"]
API_RATE_LIMIT=100

# 其他配置
DEBUG=True
```

### 前端配置

1. **獲取 API 簽名密鑰**

前端啟動時會自動從服務器獲取配置。也可以手動配置：

```bash
cd frontend
cp .env.local.example .env.local
```

編輯 `.env.local`：
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
# 可選：手動設置簽名密鑰（開發環境）
NEXT_PUBLIC_API_SIGNATURE_KEY=<從後端 .api_signature_key 文件複製>
```

2. **生產環境配置**

生產環境中，建議：
- 使用 HTTPS
- 設置環境變量而非 .env 文件
- 不要在客戶端暴露簽名密鑰（由服務器通過安全渠道提供）

## 使用方法

### 前端 API 調用

**舊方式（不安全）：**
```typescript
const res = await fetch('/api/auth/me', {
  headers: { Authorization: `Bearer ${token}` }
});
```

**新方式（安全）：**
```typescript
import { apiGet, apiPost } from '@/lib/api-client';

// GET 請求
const res = await apiGet('/api/auth/me');

// POST 請求
const res = await apiPost('/api/divination/liuyao', {
  question: "今天運勢如何？",
  hexagrams: [...]
});
```

### 使用 React Hook

```typescript
import { useApiClient } from '@/hooks/useApiClient';

function MyComponent() {
  const api = useApiClient();
  
  useEffect(() => {
    if (api.ready) {
      // API 客戶端已準備好
      fetchData();
    }
  }, [api.ready]);
  
  const fetchData = async () => {
    const res = await api.get('/api/data');
    const data = await res.json();
  };
}
```

### SSE 長連接

**適用場景：** AI 生成、實時數據推送

```typescript
import { SecureSSEConnection } from '@/lib/api-client';

const sse = new SecureSSEConnection();

await sse.connect(
  '/api/divination/liuyao/stream',
  (event) => {
    // 接收數據
    const data = JSON.parse(event.data);
    console.log('Received:', data);
  },
  (error) => {
    // 錯誤處理
    console.error('SSE error:', error);
  }
);

// 取消連接
await sse.cancel();
```

## 安全最佳實踐

### 開發環境

1. ✅ 使用 `localhost` 而非局域網 IP
2. ✅ 定期輪換密鑰（測試環境）
3. ✅ 啟用 CORS 但限制來源

### 生產環境

1. ✅ **必須使用 HTTPS**
2. ✅ 設置嚴格的 CORS 策略
3. ✅ 啟用 Rate Limiting
4. ✅ 使用環境變量管理密鑰
5. ✅ 定期審計 API 訪問日誌
6. ✅ 實施 IP 白名單（可選）
7. ✅ 啟用 Strict-Transport-Security (HSTS)

### 密鑰管理

**❌ 不要：**
- 將密鑰提交到 Git
- 在客戶端硬編碼密鑰
- 在日誌中輸出密鑰

**✅ 應該：**
- 使用 `.gitignore` 排除密鑰文件
- 使用環境變量或密鑰管理服務
- 定期輪換密鑰
- 為不同環境使用不同密鑰

## 安全響應頭

系統自動添加以下安全響應頭：

```
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Content-Security-Policy: default-src 'self'
```

生產環境建議額外添加：
```
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

## 監控和日誌

所有安全事件都會被記錄：

```python
# 記錄的安全事件
- 未授權的來源訪問
- 無效的請求簽名
- 過期的時間戳
- 重定向嘗試
```

查看日誌：
```bash
# 後端日誌
tail -f backend/logs/security.log

# 或在應用日誌中查找
grep "Security check failed" backend/logs/app.log
```

## 常見問題

### Q: 為什麼我的請求被拒絕？

**A:** 檢查以下項目：
1. API 簽名密鑰是否正確
2. 系統時間是否同步（時間差不能超過 5 分鐘）
3. 請求來源是否在白名單中

### Q: 如何添加新的允許來源？

**A:** 編輯 `backend/app/core/config.py`：
```python
ALLOWED_ORIGINS: list[str] = [
    "http://localhost:3000",
    "https://your-domain.com"
]
```

### Q: 生產環境需要修改什麼？

**A:** 
1. 更新 `ALLOWED_ORIGINS` 為實際域名
2. 啟用 HTTPS
3. 設置環境變量而非 .env 文件
4. 配置反向代理（Nginx/Caddy）的安全設置

### Q: 如何測試安全機制？

**A:** 使用提供的測試腳本：
```bash
# 測試重定向攻擊防護
python test_tools/test_redirect_attack.py

# 測試請求簽名
python test_tools/test_signature.py
```

## 架構圖

```
┌─────────────┐         ┌──────────────┐
│   Browser   │         │  Attacker    │
└──────┬──────┘         └──────┬───────┘
       │                       │
       │ 1. Request            │ 2. Redirect
       │    with Signature     │    Attempt
       ▼                       ▼
┌──────────────────────────────────────┐
│     Frontend (Next.js)               │
│  ┌────────────────────────────────┐  │
│  │  API Security Client           │  │
│  │  - Generate Signature          │  │
│  │  - Verify Redirect ❌          │  │
│  │  - Validate Response           │  │
│  └────────────────────────────────┘  │
└──────────────┬───────────────────────┘
               │ 3. Signed Request
               │    + Timestamp + Nonce
               ▼
┌──────────────────────────────────────┐
│     Backend (FastAPI)                │
│  ┌────────────────────────────────┐  │
│  │  Security Middleware           │  │
│  │  - Verify Origin ✓             │  │
│  │  - Verify Signature ✓          │  │
│  │  - Check Timestamp ✓           │  │
│  │  - Prevent Replay ✓            │  │
│  └────────────────────────────────┘  │
│               │                       │
│               ▼                       │
│  ┌────────────────────────────────┐  │
│  │  API Routes                    │  │
│  │  - /api/auth/*                 │  │
│  │  - /api/divination/*           │  │
│  │  - /api/tarot/* (SSE)          │  │
│  └────────────────────────────────┘  │
└──────────────────────────────────────┘
```

## 遷移指南

從舊的不安全 API 遷移：

1. **更新 imports**
```typescript
// 舊
import { fetch } from 'next';

// 新
import { apiGet, apiPost } from '@/lib/api-client';
```

2. **替換 fetch 調用**
```typescript
// 舊
const res = await fetch('/api/endpoint', {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify(data)
});

// 新
const res = await apiPost('/api/endpoint', data);
```

3. **使用 SSE 替代輪詢**
```typescript
// 舊（輪詢）
const pollResult = async () => {
  while (!done) {
    const res = await fetch('/api/status');
    await sleep(1000);
  }
};

// 新（SSE）
const sse = new SecureSSEConnection();
await sse.connect('/api/stream', (event) => {
  // 實時接收數據
});
```

## 支持

如有安全問題或建議，請聯繫開發團隊。

**重要：** 請勿公開披露安全漏洞，請通過私密渠道報告。
