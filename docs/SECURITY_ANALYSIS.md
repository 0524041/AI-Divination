# 🔒 AI-Divination 資安分析報告

## 目錄
1. [整體評估](#整體評估)
2. [認證與授權](#認證與授權)
3. [輸入驗證](#輸入驗證)
4. [資料庫安全](#資料庫安全)
5. [前後端連線](#前後端連線)
6. [敏感資料處理](#敏感資料處理)
7. [攻擊防護](#攻擊防護)
8. [發現的問題與建議](#發現的問題與建議)

---

## 整體評估

### ✅ 做得好的地方
- JWT Token 認證機制完善
- 密碼使用 bcrypt 雜湊
- API Key 有加密儲存
- SQL 使用 ORM（防 SQL 注入）
- Markdown 渲染有 DOMPurify 清理（防 XSS）
- 輸入有長度限制

### ⚠️ 需要改進的地方
- CORS 設定只允許 localhost（生產環境需調整）
- 缺少 Rate Limiting（防暴力破解）
- 密鑰儲存可以更安全
- 缺少 HTTPS 強制
- 沒有 CSRF 保護

---

## 認證與授權

### ✅ 目前實作（良好）

#### 1. 密碼安全
```python
# backend/app/utils/auth.py
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    """使用 bcrypt 雜湊密碼"""
    return pwd_context.hash(password)
```

**評估**：✅ **優秀**
- 使用 bcrypt（業界標準）
- 自動處理 salt
- 計算成本高，抵抗暴力破解

#### 2. JWT Token
```python
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=7*24*60))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm="HS256")
```

**評估**：✅ **良好**
- 使用 HS256 算法
- 有過期時間（7 天）
- Secret Key 自動生成

#### 3. API Key 加密
```python
from cryptography.fernet import Fernet

def encrypt_api_key(api_key: str) -> str:
    f = Fernet(settings.ENCRYPTION_KEY.encode())
    return f.encrypt(api_key.encode()).decode()
```

**評估**：✅ **良好**
- Gemini API Key 不以明文儲存
- 使用 Fernet 對稱加密

### ⚠️ 問題與建議

#### 問題 1：Token 過期時間太長
```python
ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 天
```

**風險**：Token 被盜用後，有效期長達 7 天

**建議**：
- 縮短為 1-2 天
- 實作 Refresh Token 機制
- 或加入 Token 撤銷機制

#### 問題 2：密鑰儲存在檔案系統
```python
secret_key_file = BASE_DIR / ".secret_key"
secret_key_file.write_text(self.SECRET_KEY)
```

**風險**：
- 檔案系統存取權限不當可能洩露
- Git 可能誤提交

**建議**：
```bash
# 確保密鑰檔案在 .gitignore 中
echo ".secret_key" >> .gitignore
echo ".encryption_key" >> .gitignore

# 設定正確的檔案權限
chmod 600 backend/.secret_key
chmod 600 backend/.encryption_key
```

#### 問題 3：缺少 Rate Limiting
**風險**：攻擊者可以暴力破解密碼

**建議**：添加登入速率限制

---

## 輸入驗證

### ✅ 目前實作（良好）

#### 1. 後端驗證
```python
# 問題輸入限制
question: str = Field(..., min_length=1, max_length=500)

# 用戶名限制
username: str = Field(..., min_length=3, max_length=50)

# 密碼最小長度
password: str = Field(..., min_length=6)
```

**評估**：✅ **良好**
- 使用 Pydantic Field 驗證
- 長度限制合理
- 自動拒絕無效輸入

#### 2. 前端驗證
```typescript
if (password !== confirmPassword) {
  setError('密碼不一致');
  return;
}
```

**評估**：⚠️ **基本**
- 有密碼確認
- 但缺少更詳細的驗證

### ⚠️ 問題與建議

#### 問題 1：密碼強度要求不足
```python
password: str = Field(..., min_length=6)  # 只有 6 個字元
```

**風險**：6 個字元的密碼容易被破解

**建議**：
- 最少 8 個字元
- 要求包含大小寫、數字、特殊符號
- 或提示使用者設定強密碼

#### 問題 2：前端缺少即時驗證
**建議**：添加即時輸入驗證

```typescript
const validatePassword = (pwd: string) => {
  if (pwd.length < 8) return '密碼至少 8 個字元';
  if (!/[A-Z]/.test(pwd)) return '需包含大寫字母';
  if (!/[a-z]/.test(pwd)) return '需包含小寫字母';
  if (!/[0-9]/.test(pwd)) return '需包含數字';
  return '';
};
```

#### 問題 3：問題長度限制可能不足
```python
question: str = Field(..., min_length=1, max_length=500)
```

**評估**：✅ 基本足夠，但可以考慮：
- 檢查是否包含惡意內容
- 過濾特殊字元

---

## 資料庫安全

### ✅ 目前實作（優秀）

#### 1. 使用 ORM（SQLAlchemy）
```python
user = db.query(User).filter(User.username == username).first()
history = db.query(History).filter(History.user_id == current_user.id).all()
```

**評估**：✅ **優秀**
- 自動防止 SQL 注入
- 參數化查詢
- 類型安全

#### 2. 外鍵約束
```python
@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
```

**評估**：✅ **良好**
- 啟用外鍵約束
- 確保資料完整性

#### 3. 資料隔離
```python
# 用戶只能存取自己的資料
query = db.query(History).filter(History.user_id == current_user.id)
```

**評估**：✅ **優秀**
- 正確實作多租戶隔離
- 防止未授權存取

### ⚠️ 問題與建議

#### 問題 1：資料庫檔案權限
**風險**：SQLite 檔案如果權限不當，可被直接讀取

**建議**：
```bash
# 設定資料庫檔案權限
chmod 600 backend/divination.db

# 確保只有運行程式的用戶可以存取
chown www-data:www-data backend/divination.db  # 根據實際用戶調整
```

#### 問題 2：缺少資料備份
**建議**：
```bash
# 定期備份資料庫
0 2 * * * sqlite3 /path/to/divination.db ".backup '/path/to/backup.db'"
```

#### 問題 3：敏感欄位查詢記錄
**建議**：避免在日誌中記錄敏感資料（密碼、API Key）

---

## 前後端連線

### ✅ 目前實作

#### 1. CORS 設定
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

**評估**：⚠️ **僅適用開發環境**
- localhost 正確
- 但生產環境需調整

#### 2. JWT Bearer Token
```typescript
const res = await fetch('/api/history', {
  headers: { 
    'Authorization': `Bearer ${token}` 
  }
});
```

**評估**：✅ **良好**
- 使用 Bearer Token
- Token 儲存在 localStorage

### ⚠️ 問題與建議

#### 問題 1：CORS 需要更新（生產環境）
**目前設定只允許 localhost**

**建議**：更新為生產域名
```python
# backend/app/main.py
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://akspace99.dpdns.org",  # 你的生產域名
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],  # 明確指定
    allow_headers=["Content-Type", "Authorization"],  # 明確指定
)
```

#### 問題 2：缺少 HTTPS
**風險**：
- HTTP 明文傳輸
- Token 可被攔截
- 中間人攻擊

**建議**：強制使用 HTTPS
```python
# 生產環境添加 HTTPS 重定向
from fastapi.middleware.httpsredirect import HTTPSRedirectMiddleware

if not settings.DEBUG:
    app.add_middleware(HTTPSRedirectMiddleware)
```

#### 問題 3：Token 儲存在 localStorage
**風險**：容易受到 XSS 攻擊

**目前實作**：
```typescript
localStorage.setItem('token', data.access_token);
```

**更安全的方案**：
- 使用 httpOnly Cookie（前端無法存取）
- 或 sessionStorage（關閉分頁就清除）

**建議改為**：
```python
# 後端設定 httpOnly Cookie
response.set_cookie(
    key="access_token",
    value=token,
    httponly=True,  # 防止 JavaScript 存取
    secure=True,    # 只在 HTTPS 傳輸
    samesite="lax"  # CSRF 保護
)
```

#### 問題 4：缺少 CSRF 保護
**風險**：跨站請求偽造攻擊

**建議**：
- 如果改用 Cookie，需要 CSRF Token
- 或繼續使用 Bearer Token（不受 CSRF 影響）

---

## 敏感資料處理

### ✅ 目前實作（良好）

#### 1. Gemini API Key 加密
```python
config.api_key_encrypted = encrypt_api_key(request.api_key)
```

**評估**：✅ **優秀**
- 不以明文儲存
- 使用 Fernet 加密

#### 2. 密碼雜湊
```python
password_hash = hash_password(password)
```

**評估**：✅ **優秀**
- 使用 bcrypt
- 不可逆

#### 3. API 回傳不包含敏感資料
```python
has_api_key=bool(c.api_key_encrypted),  # 只回傳是否有 Key，不回傳內容
```

**評估**：✅ **良好**

### ⚠️ 問題與建議

#### 問題 1：加密金鑰儲存
```python
ENCRYPTION_KEY: str = ""  # 儲存在檔案
```

**風險**：如果 `.encryption_key` 檔案洩露，所有加密資料可被解密

**建議**：
- 使用環境變數
- 或使用密鑰管理服務（如 AWS KMS）

```python
# 優先從環境變數讀取
import os
ENCRYPTION_KEY: str = os.getenv("ENCRYPTION_KEY", "")
```

#### 問題 2：日誌可能洩露資訊
**建議**：檢查並過濾日誌

```python
# 不要記錄敏感資料
# ✗ logger.info(f"User login: {username} with password {password}")
# ✓ logger.info(f"User login attempt: {username}")
```

---

## 攻擊防護

### ✅ 目前實作

#### 1. SQL 注入防護
- ✅ 使用 SQLAlchemy ORM
- ✅ 參數化查詢

#### 2. XSS 防護
```typescript
// frontend/src/lib/markdown.ts
const DOMPurify = (await import('dompurify')).default;
mainHtml = DOMPurify.sanitize(rawHtml, {
  USE_PROFILES: { html: true },
  ADD_TAGS: ['span'],
  ADD_ATTR: ['class', 'style'],
});
```

**評估**：✅ **優秀**
- 使用 DOMPurify 清理 HTML
- 防止惡意腳本注入

### ⚠️ 缺少的防護

#### 1. Rate Limiting（速率限制）
**風險**：
- 暴力破解密碼
- DoS 攻擊
- API 濫用

**建議**：添加 Rate Limiting

```python
# 安裝
# pip install slowapi

from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# 在登入 API 加上限制
@router.post("/login")
@limiter.limit("5/minute")  # 每分鐘最多 5 次
async def login(request: Request, ...):
    ...
```

#### 2. 輸入清理
**建議**：額外清理特殊字元

```python
import html

def sanitize_input(text: str) -> str:
    """清理用戶輸入"""
    # HTML 轉義
    text = html.escape(text)
    # 移除控制字元
    text = ''.join(c for c in text if c.isprintable() or c.isspace())
    return text.strip()
```

#### 3. Content Security Policy (CSP)
**建議**：添加 CSP Header

```python
from fastapi.middleware.trustedhost import TrustedHostMiddleware

app.add_middleware(
    TrustedHostMiddleware, 
    allowed_hosts=["localhost", "akspace99.dpdns.org"]
)

@app.middleware("http")
async def add_security_headers(request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Content-Security-Policy"] = "default-src 'self'"
    return response
```

---

## 發現的問題與建議（總結）

### 🔴 高優先級（必須修復）

1. **更新 CORS 設定以支援生產域名**
   ```python
   allow_origins=["https://akspace99.dpdns.org"]
   ```

2. **啟用 HTTPS 並強制重定向**
   - 取得 SSL 憑證（Let's Encrypt）
   - 配置反向代理（Nginx）

3. **添加 Rate Limiting 防止暴力破解**
   - 登入：5 次/分鐘
   - 占卜：10 次/分鐘

4. **設定正確的檔案權限**
   ```bash
   chmod 600 backend/.secret_key
   chmod 600 backend/.encryption_key
   chmod 600 backend/divination.db
   ```

### 🟡 中優先級（建議修復）

5. **加強密碼強度要求**
   - 最少 8 個字元
   - 包含大小寫、數字、特殊符號

6. **縮短 Token 過期時間**
   - 從 7 天改為 1-2 天
   - 或實作 Refresh Token

7. **改用 httpOnly Cookie 儲存 Token**
   - 防止 XSS 攻擊竊取 Token

8. **添加安全 Headers**
   - X-Content-Type-Options
   - X-Frame-Options
   - Content-Security-Policy

### 🟢 低優先級（有時間再做）

9. **實作資料庫自動備份**

10. **添加登入日誌與異常登入檢測**

11. **實作兩步驟驗證（2FA）**

12. **添加帳戶鎖定機制**（多次登入失敗後鎖定）

---

## 快速修復清單

我已經為你準備好了修復腳本，接下來會為你創建實作檔案。

### 執行順序：
1. 更新 CORS 設定
2. 添加 Rate Limiting
3. 添加安全 Headers
4. 設定檔案權限
5. 加強密碼驗證

這些修改都是向後相容的，不會影響現有功能。
