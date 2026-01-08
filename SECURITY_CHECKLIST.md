# ✅ 安全機制配置檢查清單

在啟動應用前，請確認以下項目：

## 後端配置

- [ ] 後端已安裝所有依賴
  ```bash
  cd backend
  pip list | grep -E "fastapi|uvicorn|cryptography"
  ```

- [ ] 密鑰文件已生成
  ```bash
  ls -la backend/.secret_key
  ls -la backend/.encryption_key
  ls -la backend/.api_signature_key
  ```

- [ ] 安全中間件已啟用
  ```bash
  grep "APISecurityMiddleware" backend/app/main.py
  ```

- [ ] CORS 配置正確
  ```bash
  grep "ALLOWED_ORIGINS" backend/app/core/config.py
  ```

## 前端配置

- [ ] 環境變量已配置
  ```bash
  cat frontend/.env.local
  ```
  
- [ ] API 客戶端文件存在
  ```bash
  ls -la frontend/src/lib/api-client.ts
  ```

- [ ] 前端依賴已安裝
  ```bash
  cd frontend && npm list
  ```

## 測試

- [ ] 後端可以啟動
  ```bash
  cd backend
  python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
  # 訪問 http://localhost:8000/health
  ```

- [ ] 前端可以啟動
  ```bash
  cd frontend
  npm run dev
  # 訪問 http://localhost:3000
  ```

- [ ] 安全測試通過
  ```bash
  python test_tools/test_api_security.py
  ```

## 快速修復

### 如果密鑰未生成

```bash
cd backend
python -c "import secrets; print(secrets.token_urlsafe(32))" > .api_signature_key
```

### 如果前端配置缺失

```bash
cd frontend
cp .env.local.example .env.local
# 然後從後端複製密鑰
```

### 如果啟動失敗

```bash
# 清理並重新安裝
./start.sh --clean-cache
./start.sh
```

## 完成！

當所有項目都勾選後，你的應用已配置完成！

```bash
# 啟動應用
./start.sh

# 訪問
# 前端: http://localhost:3000
# API: http://localhost:8000
# 文檔: http://localhost:8000/docs
```
