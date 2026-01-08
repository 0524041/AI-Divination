# 🔒 安全機制修復總結

## 問題描述

原系統存在嚴重的重定向攻擊漏洞：
- ❌ 前後端通訊可能被重定向到惡意 API
- ❌ 攻擊者可返回相同格式但不合規的內容
- ❌ 缺乏請求來源驗證
- ❌ 無請求簽名機制

## 解決方案

### 1. 後端安全層

#### 新增文件
- `backend/app/middleware/security.py` - API 安全中間件
- `backend/app/utils/sse.py` - SSE 安全通訊工具

#### 修改文件
- `backend/app/core/config.py` - 添加安全配置
- `backend/app/main.py` - 啟用安全中間件
- `backend/app/api/auth.py` - 添加客戶端配置端點

#### 安全機制
✅ **來源白名單驗證**
```python
ALLOWED_ORIGINS = ["http://localhost:3000", ...]
```

✅ **請求簽名驗證**
```python
signature = HMAC-SHA256(path + timestamp + nonce, secret_key)
```

✅ **防重放攻擊**
- 時間戳驗證（5分鐘窗口）
- 唯一 nonce 檢查

✅ **安全響應頭**
```python
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Content-Security-Policy: default-src 'self'
```

### 2. 前端安全層

#### 新增文件
- `frontend/src/lib/api-client.ts` - 安全 API 客戶端
- `frontend/src/lib/api-init.ts` - API 初始化
- `frontend/src/hooks/useApiClient.ts` - React Hook
- `frontend/.env.local.example` - 環境配置示例

#### 修改文件
- `frontend/src/app/page.tsx` - 使用安全 API
- `frontend/src/app/login/page.tsx` - 使用安全 API

#### 安全機制
✅ **請求簽名生成**
```typescript
const signature = await generateSignature(path, timestamp, nonce);
```

✅ **防重定向**
```typescript
fetch(url, { redirect: 'manual' })
```

✅ **URL 白名單驗證**
```typescript
const allowedHosts = ['localhost', '127.0.0.1'];
if (!allowedHosts.includes(urlObj.hostname)) {
  throw new Error('Unauthorized API endpoint');
}
```

✅ **SSE 安全連接**
```typescript
class SecureSSEConnection {
  // 安全的長連接實現
}
```

### 3. 配置與工具

#### 新增文件
- `configure_security.sh` - 自動配置腳本
- `test_tools/test_api_security.py` - 安全測試
- `docs/API_SECURITY.md` - 完整安全文檔
- `docs/SECURITY_QUICKSTART.md` - 快速開始（已更新）

#### 更新文件
- `.gitignore` - 添加密鑰文件
- `README.md` - 添加安全特性說明

## 使用方法

### 配置

```bash
# 方法 1: 自動配置（推薦）
./configure_security.sh

# 方法 2: 手動配置
# 1. 啟動後端生成密鑰
cd backend && python -m uvicorn app.main:app

# 2. 配置前端
cd frontend
cp .env.local.example .env.local
# 編輯 .env.local 填入配置
```

### 啟動

```bash
./start.sh
```

### 測試

```bash
# 測試安全機制
python test_tools/test_api_security.py

# 預期結果：
# ✓ 拒絕無簽名請求
# ✓ 拒絕錯誤簽名
# ✓ 拒絕過期時間戳
# ✓ 拒絕未授權來源
# ✓ 接受有效簽名請求
```

## 前端 API 調用示例

### 舊方式（不安全）❌

```typescript
const res = await fetch('/api/endpoint', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify(data)
});
```

### 新方式（安全）✅

```typescript
import { apiPost } from '@/lib/api-client';

const res = await apiPost('/api/endpoint', data);
```

### 使用 React Hook

```typescript
import { useApiClient } from '@/hooks/useApiClient';

function MyComponent() {
  const api = useApiClient();
  
  const fetchData = async () => {
    if (api.ready) {
      const res = await api.get('/api/data');
      const data = await res.json();
    }
  };
}
```

### SSE 長連接

```typescript
import { SecureSSEConnection } from '@/lib/api-client';

const sse = new SecureSSEConnection();
await sse.connect('/api/stream', (event) => {
  console.log('Received:', JSON.parse(event.data));
});

// 取消連接
await sse.cancel();
```

## 安全特性對比

| 功能 | v5.0 (舊版) | v6.0 (新版) |
|------|-------------|-------------|
| 請求簽名 | ❌ | ✅ HMAC-SHA256 |
| 來源驗證 | ❌ | ✅ 白名單機制 |
| 防重定向 | ❌ | ✅ 自動檢測 |
| 防重放 | ❌ | ✅ 時間戳+Nonce |
| SSE 通訊 | ❌ | ✅ 安全長連接 |
| 安全頭部 | 部分 | ✅ 完整 |
| 密鑰管理 | 手動 | ✅ 自動生成 |

## 需要遷移的頁面

以下前端頁面需要更新使用安全 API 客戶端：

- ✅ `frontend/src/app/page.tsx` - 已更新
- ✅ `frontend/src/app/login/page.tsx` - 已更新
- ⚠️ `frontend/src/app/settings/page.tsx` - **待更新**
- ⚠️ `frontend/src/app/history/page.tsx` - **待更新**
- ⚠️ `frontend/src/app/liuyao/page.tsx` - **待更新**
- ⚠️ `frontend/src/app/tarot/page.tsx` - **待更新**

## 遷移步驟

對於每個頁面：

1. **添加 import**
```typescript
import { apiGet, apiPost } from '@/lib/api-client';
// 或
import { useApiClient } from '@/hooks/useApiClient';
```

2. **替換 fetch 調用**
```typescript
// 舊
const res = await fetch('/api/endpoint', { ... });

// 新
const res = await apiPost('/api/endpoint', data);
```

3. **測試功能**
- 確認正常登入
- 確認 API 調用成功
- 檢查瀏覽器控制台無錯誤

## 生產環境部署

### 必須修改的配置

1. **CORS 白名單**
```python
# backend/app/core/config.py
ALLOWED_ORIGINS: list[str] = [
    "https://your-domain.com"  # 替換為實際域名
]
```

2. **使用 HTTPS**
```python
# backend/app/middleware/security.py
# 取消註釋 HSTS 頭部
response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
```

3. **環境變量**
```bash
# 不使用 .env 文件，使用系統環境變量
export API_REQUEST_SIGNATURE_KEY="your-production-key"
export SECRET_KEY="your-production-jwt-key"
export ENCRYPTION_KEY="your-production-encryption-key"
```

4. **前端配置**
```bash
# 不在客戶端暴露簽名密鑰
# 讓前端通過 /api/auth/client-config 動態獲取（僅首次）
unset NEXT_PUBLIC_API_SIGNATURE_KEY
```

## 監控與日誌

安全事件會被記錄在應用日誌中：

```bash
# 查看安全警告
grep "Security check failed" backend/logs/*.log

# 查看未授權訪問
grep "Unauthorized origin" backend/logs/*.log

# 查看無效簽名
grep "Invalid signature" backend/logs/*.log
```

## 常見問題

### Q: 為什麼我的請求被拒絕？

**A:** 檢查：
1. API 簽名密鑰是否正確
2. 系統時間是否同步
3. 請求來源是否在白名單中

### Q: 如何添加新的允許來源？

**A:** 編輯 `backend/app/core/config.py`：
```python
ALLOWED_ORIGINS: list[str] = [
    "http://localhost:3000",
    "https://your-new-domain.com"
]
```

### Q: 生產環境需要注意什麼？

**A:**
- ✅ 必須使用 HTTPS
- ✅ 設置環境變量
- ✅ 配置正確的 CORS 白名單
- ✅ 定期輪換密鑰
- ✅ 監控安全日誌

## 文檔

- 📖 [完整安全文檔](API_SECURITY.md)
- 🚀 [快速開始](SECURITY_QUICKSTART.md)
- 📝 [主 README](../README.md)

## 支持

如發現安全問題，請通過私密渠道報告，不要公開披露。

## 版本歷史

- **v6.0** (2026-01-08)
  - ✅ 實施 API 請求簽名
  - ✅ 添加來源白名單驗證
  - ✅ 防止重定向攻擊
  - ✅ 實施 SSE 安全通訊
  - ✅ 完整的安全文檔

- **v5.0** (之前)
  - ✅ 基本的 JWT 認證
  - ✅ 密碼加密
  - ✅ 部分安全頭部
