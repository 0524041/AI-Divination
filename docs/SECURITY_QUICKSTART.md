# 🔒 安全性快速指南

## 已自動修復的問題 ✅

執行 `./fix_security.sh` 後，以下問題已修復：

1. ✅ 敏感檔案權限設定為 600
   - `.secret_key`
   - `.encryption_key`
   - `divination.db`

2. ✅ `.gitignore` 已更新，防止敏感檔案被提交

3. ✅ 已檢查並確認沒有敏感檔案被 Git 追蹤

---

## 需要手動修復的問題

### 1. 🔴 更新 CORS 設定（高優先級）

**問題**：目前只允許 localhost，生產環境無法存取

**修復方法**：

編輯 [backend/app/main.py](backend/app/main.py)：

```python
# 找到這段
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    ...
)

# 改為
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://akspace99.dpdns.org",  # ← 添加你的域名
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],  # 明確指定
    allow_headers=["Content-Type", "Authorization"],  # 明確指定
)
```

---

### 2. 🔴 添加 Rate Limiting（高優先級）

**問題**：沒有速率限制，容易被暴力破解

**修復方法**：

#### 步驟 1：在 main.py 添加 Middleware

編輯 [backend/app/main.py](backend/app/main.py)：

```python
# 在最上面添加 import
from app.utils.security import SecurityHeadersMiddleware

# 在 CORS middleware 之後添加
app.add_middleware(SecurityHeadersMiddleware)
```

#### 步驟 2：在登入 API 添加限制

編輯 [backend/app/api/auth.py](backend/app/api/auth.py)：

```python
# 在最上面添加
from app.utils.security import check_rate_limit
from fastapi import Request

# 修改登入函數
@router.post("/login", response_model=TokenResponse)
async def login(
    request: Request,  # ← 添加這個
    data: LoginRequest,
    _: None = Depends(lambda r: check_rate_limit(r, max_requests=5, window_seconds=60)),  # ← 添加這個
    db: Session = Depends(get_db)
):
    # 原有的登入邏輯不變
    ...
```

這樣就限制每個 IP 每分鐘最多嘗試登入 5 次。

---

### 3. 🟡 加強密碼強度（中優先級）

**問題**：目前只要求 6 個字元，太弱

**修復方法**：

編輯 [backend/app/api/auth.py](backend/app/api/auth.py)：

```python
# 在最上面添加
from app.utils.security import validate_password_strength

# 在 init_admin 函數中添加驗證
@router.post("/init", response_model=TokenResponse)
def init_admin(request: InitRequest, db: Session = Depends(get_db)):
    # 在建立 admin 之前添加
    valid, error_msg = validate_password_strength(request.password)
    if not valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_msg
        )
    
    # 原有的邏輯...
```

同樣在 `register` 函數中添加。

---

### 4. 🟡 啟用 HTTPS（中優先級）

**問題**：HTTP 明文傳輸不安全

**修復方法（使用 Nginx）**：

#### 安裝 Nginx 和 Certbot

```bash
sudo apt update
sudo apt install nginx certbot python3-certbot-nginx
```

#### 配置 Nginx

創建配置文件 `/etc/nginx/sites-available/ai-divination`：

```nginx
server {
    listen 80;
    server_name akspace99.dpdns.org;

    # 前端
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # 後端 API
    location /api {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    location /docs {
        proxy_pass http://localhost:8000;
    }
}
```

#### 啟用配置並取得 SSL 憑證

```bash
# 啟用網站
sudo ln -s /etc/nginx/sites-available/ai-divination /etc/nginx/sites-enabled/

# 測試配置
sudo nginx -t

# 重啟 Nginx
sudo systemctl restart nginx

# 取得 SSL 憑證（自動配置 HTTPS）
sudo certbot --nginx -d akspace99.dpdns.org
```

Certbot 會自動配置 HTTPS 並設定自動續約。

---

## 快速檢查清單

### 🔍 上線前必須檢查

- [ ] CORS 設定包含生產域名
- [ ] 啟用 HTTPS
- [ ] 添加 Rate Limiting
- [ ] 檔案權限正確（600）
- [ ] 敏感檔案已在 .gitignore
- [ ] 加強密碼強度驗證

### 🔍 建議檢查

- [ ] 添加安全 Headers
- [ ] 定期備份資料庫
- [ ] 監控異常登入
- [ ] 設定防火牆規則

---

## 測試安全性

### 測試 Rate Limiting

```bash
# 快速發送多個登入請求
for i in {1..10}; do
  curl -X POST http://localhost:8000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"test","password":"wrong"}'
  echo ""
done

# 應該在第 6 次看到 429 Too Many Requests
```

### 測試 CORS

```bash
# 從不同域名測試（應該被拒絕）
curl -X GET http://localhost:8000/api/auth/check-init \
  -H "Origin: http://evil.com"

# 查看回應 headers 中的 Access-Control-Allow-Origin
```

### 檢查安全 Headers

```bash
curl -I http://localhost:8000/

# 應該看到：
# X-Content-Type-Options: nosniff
# X-Frame-Options: DENY
# X-XSS-Protection: 1; mode=block
```

---

## 定期維護

### 每週

- 檢查日誌中的異常登入嘗試
- 備份資料庫

### 每月

- 更新套件依賴
- 檢查 SSL 憑證有效期
- 審查存取日誌

### 每季

- 完整的安全審計
- 更新密碼政策

---

## 緊急應變

### 如果發現安全問題

1. **立即停止服務**
   ```bash
   ./start.sh --stop
   ```

2. **檢查日誌**
   ```bash
   tail -n 100 backend/logs/*.log
   ```

3. **備份資料庫**
   ```bash
   cp backend/divination.db backend/divination.db.backup
   ```

4. **修復問題後重啟**
   ```bash
   ./start.sh
   ```

### 如果帳號被盜用

1. 重設該用戶密碼
2. 撤銷所有 Token（需要重新登入）
3. 檢查異常操作記錄
4. 通知用戶

---

## 參考資料

- 完整分析：[SECURITY_ANALYSIS.md](SECURITY_ANALYSIS.md)
- 安全工具：[backend/app/utils/security.py](../backend/app/utils/security.py)
- 修復腳本：[fix_security.sh](../fix_security.sh)

---

## 快速修復指令

```bash
# 1. 執行自動修復
./fix_security.sh

# 2. 手動修改 CORS 設定
# 編輯 backend/app/main.py

# 3. 重啟服務
./start.sh --restart

# 4. 測試
curl -I https://akspace99.dpdns.org
```
