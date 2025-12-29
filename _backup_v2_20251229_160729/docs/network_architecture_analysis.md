# 前後端分離架構網絡問題分析

## 🎯 問題總結

你遇到的核心問題是**誤解了前後端分離架構中 API 請求的執行位置**。

---

## ❌ 常見誤解

> "後端請求應該是前端 server 跟後端 server 進行的本地連線請求"

**這是錯的！**

在你的架構中，API 請求是在**用戶的瀏覽器**發出的，不是在 Next.js server 發出的。

---

## ✅ 實際架構分析

### 你的當前架構

```
┌─────────────────┐
│  用戶瀏覽器      │
│  (Client)       │
└────┬───────┬────┘
     │       │
     │       └─────────────┐
     │                     │
     ▼                     ▼
┌─────────────┐      ┌──────────────┐
│  Next.js    │      │  Flask       │
│  Frontend   │      │  Backend     │
│  :3000      │      │  :8080       │
└─────────────┘      └──────────────┘
```

### 關鍵點：瀏覽器直接請求後端

查看你的代碼 `frontend/src/lib/api.ts`:

```typescript
export const getBackendUrl = () => {
  if (typeof window === 'undefined') {
    return 'http://127.0.0.1:8080';
  }
  return `http://${window.location.hostname}:8080`;
};
```

**解讀**：
- `typeof window === 'undefined'` → 這是在 Next.js **服務端**執行時
- `window.location.hostname` → 這是在**瀏覽器端**執行時

當用戶在瀏覽器訪問網頁時：
- `window.location.hostname` 會是用戶看到的域名/IP
- API 請求會從**用戶的瀏覽器**直接發送到後端

---

## 🔍 場景分析

### 場景 1: localhost 開發 ✅

```
用戶訪問: http://localhost:3000
瀏覽器發現: window.location.hostname = "localhost"
API URL: http://localhost:8080
```

**流程**：
```
1. 用戶瀏覽器 → http://localhost:3000 (Next.js)
2. Next.js 返回前端頁面（HTML + JS）
3. 瀏覽器執行 JS，調用 API
4. 瀏覽器 → http://localhost:8080 (Flask)
5. Flask 返回數據
```

✅ **能正常工作**：因為前後端都在同一台機器，localhost 指向本機。

---

### 場景 2: 使用 192.168.50.160 (局域網 IP) ⚠️

```
用戶訪問: http://192.168.50.160:3000
瀏覽器發現: window.location.hostname = "192.168.50.160"
API URL: http://192.168.50.160:8080
```

**問題分析**：

#### 問題 A: Next.js HMR WebSocket 錯誤

- **HMR** (Hot Module Replacement) 是 Next.js 開發模式的熱更新功能
- Next.js 會嘗試通過 WebSocket 連接 `ws://192.168.50.160:3000/_next/webpack-hmr`
- 如果 Next.js server 綁定在 `0.0.0.0` 但沒有正確配置，可能會出現 WebSocket 連接問題

**解決方案**：
```bash
# 啟動 Next.js 時明確指定 host
cd frontend
next dev -H 0.0.0.0
# 或
npm run dev -- -H 0.0.0.0
```

#### 問題 B: CORS 錯誤

查看你的後端 `server.py`:

```python
CORS(app, supports_credentials=True, 
     origins=['http://localhost:3000', 'http://127.0.0.1:3000'])
```

**問題**：只允許 `localhost` 和 `127.0.0.1`，不允許 `192.168.50.160`！

當瀏覽器從 `http://192.168.50.160:3000` 發送請求到 `http://192.168.50.160:8080` 時：
- 瀏覽器會發送 `Origin: http://192.168.50.160:3000` header
- 後端 CORS 檢查失敗，拒絕請求

**解決方案**：
```python
# 開發環境允許所有來源
CORS(app, supports_credentials=True, 
     origins=['*'])

# 或明確指定
CORS(app, supports_credentials=True, 
     origins=[
         'http://localhost:3000', 
         'http://127.0.0.1:3000',
         'http://192.168.50.160:3000'
     ])
```

---

### 場景 3: Port Forwarding 到公網 (219.22.60.3) ❌

```
用戶訪問: http://219.22.60.3:3000
瀏覽器發現: window.location.hostname = "219.22.60.3"
API URL: http://219.22.60.3:8080
```

**你的配置**：
- ✅ 3000 port → 已轉發
- ❌ 8080 port → **沒有轉發**

**流程**：
```
1. 外部用戶 → http://219.22.60.3:3000
2. 路由器轉發 → 內網 192.168.50.160:3000 (Next.js)
3. Next.js 返回前端頁面
4. 瀏覽器執行 JS，嘗試調用 API
5. 瀏覽器 → http://219.22.60.3:8080 ❌
   路由器拒絕（8080 沒有轉發規則）
6. API 請求失敗
```

**為什麼會斷線**：

因為 **API 請求是在用戶的瀏覽器發出的**，不是在你的服務器發出的！

```
錯誤理解:
  Next.js Server → Flask Server (本地連線) ✅
  
實際情況:
  用戶瀏覽器 → Flask Server (需要通過公網) ❌
```

---

## 🛠️ 完整解決方案

### 方案 1: 同時轉發前後端 Port (推薦)

```bash
# 路由器 Port Forwarding 設定
外部 219.22.60.3:3000 → 內部 192.168.50.160:3000 (前端)
外部 219.22.60.3:8080 → 內部 192.168.50.160:8080 (後端)
```

**修改 CORS 配置**：
```python
# server.py
CORS(app, supports_credentials=True, 
     origins=[
         'http://localhost:3000',
         'http://127.0.0.1:3000',
         'http://192.168.50.160:3000',
         'http://219.22.60.3:3000'
     ])
```

---

### 方案 2: 使用 Nginx 反向代理 (生產環境推薦)

只開放 **一個 port** (80 或 443)，用 Nginx 路由：

```nginx
# /etc/nginx/sites-available/divination
server {
    listen 80;
    server_name 219.22.60.3;

    # 前端
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # 後端 API
    location /api/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

**修改前端 API 配置**：
```typescript
// frontend/src/lib/api.ts
export const getBackendUrl = () => {
  if (typeof window === 'undefined') {
    return 'http://127.0.0.1:8080';
  }
  // 使用相對路徑，讓 Nginx 處理路由
  return '';  // API 路徑變成 /api/xxx，由 Nginx 轉發
};
```

**Port Forwarding**：
```bash
外部 219.22.60.3:80 → 內部 192.168.50.160:80 (Nginx)
```

**優點**：
- ✅ 只開放一個 port，更安全
- ✅ 統一管理流量
- ✅ 可以輕鬆添加 SSL (HTTPS)
- ✅ 可以做負載均衡、限流等

---

### 方案 3: Next.js 作為全棧應用 (架構改造)

使用 Next.js 的 **API Routes** 功能，讓 Next.js server 代理後端請求：

```typescript
// frontend/src/app/api/[...path]/route.ts
import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = 'http://127.0.0.1:8080';

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const path = params.path.join('/');
  const url = new URL(request.url);
  
  const response = await fetch(`${BACKEND_URL}/api/${path}${url.search}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      // 轉發 cookies 等
    },
    credentials: 'include',
  });
  
  return NextResponse.json(await response.json());
}

export async function POST(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const path = params.path.join('/');
  const body = await request.json();
  
  const response = await fetch(`${BACKEND_URL}/api/${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    credentials: 'include',
  });
  
  return NextResponse.json(await response.json());
}
```

**修改前端 API 配置**：
```typescript
// frontend/src/lib/api.ts
export const getBackendUrl = () => {
  // 所有環境都使用前端的 API Routes
  return '';
};

const API_BASE = '/api';  // 變成相對路徑
```

**流程變化**：
```
之前:
  用戶瀏覽器 → Flask (直接)

現在:
  用戶瀏覽器 → Next.js → Flask (代理)
```

**優點**：
- ✅ 前端只需要開放一個 port
- ✅ 後端可以完全內網，不對外開放
- ✅ 不需要處理 CORS 問題
- ✅ 可以在 Next.js 層做認證、限流等

**缺點**：
- ❌ 增加一層代理，略微增加延遲
- ❌ Next.js server 承擔更多流量

---

## 📊 方案對比

| 方案 | 安全性 | 配置難度 | 性能 | 適用場景 |
|------|--------|----------|------|----------|
| **方案1: 雙 Port** | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | 快速測試、開發環境 |
| **方案2: Nginx** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | **生產環境推薦** |
| **方案3: Next.js 代理** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | 全棧應用、內網後端 |

---

## 🎓 核心概念總結

### 前後端分離的本質

```
傳統 SSR (如 Django, Flask with Jinja):
  客戶端 → Server (渲染 HTML) → 客戶端

現代前後端分離 (React/Next.js + Flask):
  客戶端 → Frontend Server (返回 JS) → 客戶端執行 JS → Backend API
```

### 關鍵理解

1. **Next.js 在這裡主要是靜態資源服務器**
   - 它提供 HTML、CSS、JS 文件
   - 這些 JS 文件在**用戶瀏覽器**執行
   
2. **API 請求在瀏覽器發出**
   - 不是 Next.js server 發出
   - 瀏覽器需要能直接訪問後端 API
   
3. **網絡可達性要求**
   ```
   用戶瀏覽器 → 前端 (必須可達)
   用戶瀏覽器 → 後端 (必須可達)
   前端 ↔ 後端 (不需要)
   ```

4. **CORS 存在的原因**
   - 瀏覽器安全限制
   - 跨域請求需要後端明確允許
   - 如果用 Nginx 或 Next.js 代理，可以避免 CORS

---

## 🔧 立即修復你的問題

### Step 1: 修改 CORS 配置

```bash
cd /home/liewei/workspace/AI-Divination
```

編輯 `server.py` (如果還在用舊版) 或 `backend/app/main.py`:

```python
# 開發環境：允許所有來源
CORS(app, supports_credentials=True, origins=['*'])

# 或生產環境：明確指定
CORS(app, supports_credentials=True, 
     origins=[
         'http://localhost:3000',
         'http://127.0.0.1:3000',
         'http://192.168.50.160:3000',
         'http://219.22.60.3:3000',
         # 如果有域名
         'https://yourdomain.com'
     ])
```

### Step 2: 正確啟動前端

```bash
cd frontend
# 綁定到所有網絡接口
npm run dev -- -H 0.0.0.0
```

### Step 3: 正確啟動後端

```bash
# Flask 綁定到所有網絡接口
cd /home/liewei/workspace/AI-Divination
python server.py  # 確保內部有 app.run(host='0.0.0.0', port=8080)
```

### Step 4: Port Forwarding (如果要公網訪問)

在路由器設定：
```
外部 219.22.60.3:3000 → 內部 192.168.50.160:3000
外部 219.22.60.3:8080 → 內部 192.168.50.160:8080
```

---

## ✅ 驗證方法

### 本地測試

```bash
# 1. 啟動後端
cd /home/liewei/workspace/AI-Divination
python server.py

# 2. 啟動前端
cd frontend
npm run dev -- -H 0.0.0.0

# 3. 測試
curl http://192.168.50.160:8080/api/current-user
curl http://192.168.50.160:3000
```

### 瀏覽器測試

1. 打開瀏覽器開發者工具 (F12)
2. 訪問 `http://192.168.50.160:3000`
3. 查看 **Network** 標籤
4. 觀察 API 請求：
   - Request URL 應該是 `http://192.168.50.160:8080/api/xxx`
   - 如果有 CORS 錯誤，會在 Console 看到紅字

---

## 📚 延伸閱讀

- [MDN: CORS](https://developer.mozilla.org/zh-TW/docs/Web/HTTP/CORS)
- [Next.js: API Routes](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
- [Nginx 反向代理配置](https://nginx.org/en/docs/http/ngx_http_proxy_module.html)
