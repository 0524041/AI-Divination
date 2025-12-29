# 修復總結：用戶設定與 AI 可用性檢查

## 🎯 修復的問題

### 1. **設定架構混亂**
**之前**：
- `settings` 表是系統級（admin 才能改）
- 但應該是用戶級設定

**修復後**：
- ✅ `api_keys` 表存儲用戶個人配置
  - `provider`: 'local' 或 'gemini'
  - `api_key_encrypted`: 加密的 API Key (Gemini 用)
  - `config_json`: JSON 配置 (Local AI 用)
    ```json
    {
      "api_url": "http://192.168.50.160:1234/v1",
      "model_name": "qwen/qwen3-8b"
    }
    ```

### 2. **寫死的模型名稱**
**之前**：
- AI 服務硬編碼 `qwen/qwen3-8b`
- 用戶無法選擇模型

**修復後**：
- ✅ 從用戶配置讀取 `model_name`
- ✅ 如果沒配置才 fallback 到系統設定

### 3. **缺少 AI 可用性檢查**
**之前**：
- 直接調用 AI，失敗才報錯
- 用戶不知道是否已配置

**修復後**：
- ✅ `/api/divinate` 調用前先檢查配置
- ✅ 新增 `/api/check-ai-availability` 端點供前端主動檢查

### 4. **不必要的限制次數功能**
**之前**：
- `daily_limit` 設定
- `get_daily_usage_count()` 函數
- `/api/divinate` 中的檢查邏輯

**修復後**：
- ✅ 完全移除 daily_limit 相關代碼

---

## 📊 修改清單

### 後端文件

#### 1. `backend/app/routes.py`
**移除**：
- ❌ `get_daily_usage_count` import
- ❌ `/api/divinate` 中的 daily_limit 檢查
- ❌ `/api/settings` GET/POST 中的 daily_limit 處理

**新增/修改**：
- ✅ `/api/divinate` 現在要求前端必須傳 `provider`
- ✅ `/api/divinate` 調用 AI 前檢查用戶配置
- ✅ 新增 `/api/check-ai-availability` 端點

#### 2. `backend/app/core/database.py`
**移除**：
- ❌ `_init_default_settings()` 中的 daily_limit 初始化
- ❌ `get_daily_usage_count()` 函數

#### 3. `backend/app/services/ai.py`
**修改**：
- ✅ `call_ai()` 從 `user_local_config['api_url']` 和 `user_local_config['model_name']` 讀取
- ✅ 之前是 `url` 和 `model`，現在統一為 `api_url` 和 `model_name`

---

## 🔄 新的流程

### 用戶配置 AI（設定頁面）

#### Local AI 配置
```bash
POST /api/user/api-keys
{
  "provider": "local",
  "config": {
    "api_url": "http://192.168.50.160:1234/v1",
    "model_name": "qwen/qwen3-8b"
  }
}
```

#### Gemini 配置
```bash
POST /api/user/api-keys
{
  "provider": "gemini",
  "api_key": "AIzaSy..."
}
```

### 前端檢查 AI 可用性

#### 方式 1: 主動檢查（推薦）
```typescript
// 在用戶進入六爻頁面時
const response = await fetch('/api/check-ai-availability', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({
    provider: 'local',  // 或 'gemini'
    test_connection: false  // Gemini 不測試，Local AI 可選
  })
});

const result = await response.json();

if (!result.available) {
  // 顯示提示：請先去設定配置 AI
  alert(result.error);
  // 引導用戶到設定頁面
  router.push('/settings');
}
```

#### 方式 2: 調用算命時自動檢查（現有方式）
```typescript
// 發起算命請求
const response = await fetch('/api/divinate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({
    question: "我的運勢如何？",
    coins: [1, 2, 1, 2, 3, 1],
    provider: 'local',  // 必須指定！
    gender: '男',
    target: '自己'
  })
});

if (response.status === 400) {
  const error = await response.json();
  if (error.error_type === 'missing_config') {
    // 引導用戶去設定
    alert('請先配置 AI');
    router.push('/settings');
  }
}
```

---

## 🎮 用戶體驗改進

### 1. **設定頁面應該顯示**

#### Local AI 區塊
```
[ ] Local AI
  API URL:  [http://192.168.50.160:1234/v1    ]
  
  [測試連線] 按鈕 → 顯示可用模型列表
  
  模型名稱: [下拉選單: qwen/qwen3-8b, llama3, ...]
  
  [保存配置]
```

#### Gemini 區塊
```
[ ] Gemini
  API Key:  [●●●●●●●●●●●●●●●●●●●●●●●●    ]
  
  ℹ️ API Key 會加密存儲在服務器
  
  [保存配置]
```

### 2. **六爻頁面應該顯示**

```
選擇 AI 智能體:
  ( ) Local AI - qwen/qwen3-8b
  ( ) Gemini - gemini-3-flash-preview

[如果未配置，顯示警告]
⚠️ 請先在設定中配置 AI 提供者

[開始占卜] 按鈕
```

### 3. **錯誤提示優化**

當用戶未配置就嘗試算命：

```javascript
{
  "error": "請先在設定中配置 Local AI (API URL 和模型)",
  "error_type": "missing_config"  // 前端可根據此做引導
}
```

前端可以這樣處理：
```typescript
if (error.error_type === 'missing_config' || error.error_type === 'missing_api_key') {
  // 彈出友善提示
  showDialog({
    title: '需要配置 AI',
    message: error.error,
    buttons: [
      { text: '去設定', action: () => router.push('/settings') },
      { text: '取消', action: () => {} }
    ]
  });
}
```

---

## 🧪 測試建議

### 1. 測試 Local AI 配置
```bash
# 1. 保存配置
curl -X POST http://localhost:8080/api/user/api-keys \
  -H "Content-Type: application/json" \
  -b "cookies.txt" \
  -d '{
    "provider": "local",
    "config": {
      "api_url": "http://192.168.50.160:1234/v1",
      "model_name": "qwen/qwen3-8b"
    }
  }'

# 2. 檢查可用性
curl -X POST http://localhost:8080/api/check-ai-availability \
  -H "Content-Type: application/json" \
  -b "cookies.txt" \
  -d '{
    "provider": "local",
    "test_connection": true
  }'

# 3. 測試算命
curl -X POST http://localhost:8080/api/divinate \
  -H "Content-Type: application/json" \
  -b "cookies.txt" \
  -d '{
    "question": "測試問題",
    "coins": [1,2,1,2,3,1],
    "provider": "local"
  }'
```

### 2. 測試 Gemini 配置
```bash
# 1. 保存 API Key
curl -X POST http://localhost:8080/api/user/api-keys \
  -H "Content-Type: application/json" \
  -b "cookies.txt" \
  -d '{
    "provider": "gemini",
    "api_key": "AIzaSy..."
  }'

# 2. 檢查可用性（不測試連線）
curl -X POST http://localhost:8080/api/check-ai-availability \
  -H "Content-Type: application/json" \
  -b "cookies.txt" \
  -d '{
    "provider": "gemini"
  }'

# 3. 測試算命
curl -X POST http://localhost:8080/api/divinate \
  -H "Content-Type: application/json" \
  -b "cookies.txt" \
  -d '{
    "question": "測試問題",
    "coins": [1,2,1,2,3,1],
    "provider": "gemini"
  }'
```

### 3. 測試未配置的情況
```bash
# 在未配置時嘗試算命，應該返回 400 錯誤
curl -X POST http://localhost:8080/api/divinate \
  -H "Content-Type: application/json" \
  -b "cookies.txt" \
  -d '{
    "question": "測試問題",
    "coins": [1,2,1,2,3,1],
    "provider": "local"
  }'

# 預期回應:
# {
#   "error": "請先在設定中配置 Local AI (API URL 和模型)",
#   "error_type": "missing_config"
# }
```

---

## 📝 前端需要修改的地方

### 1. 設定頁面 (Settings.tsx)
- 添加 Local AI 配置表單（API URL + 模型選擇）
- 添加 Gemini API Key 輸入框
- 調用 `/api/test-local-ai` 測試連線並獲取模型列表
- 調用 `/api/user/api-keys` POST 保存配置

### 2. 六爻頁面 (Divination.tsx)
- 添加 AI 提供者選擇器
- 進入頁面時調用 `/api/check-ai-availability` 檢查
- 未配置時顯示引導提示
- 發送 `/api/divinate` 請求時必須包含 `provider`

### 3. API Client (lib/api.ts)
```typescript
// 新增方法
async checkAiAvailability(provider: 'local' | 'gemini', testConnection: boolean = false) {
  return this.request('/api/check-ai-availability', {
    method: 'POST',
    body: JSON.stringify({ provider, test_connection: testConnection })
  });
}

// 修改 divinate 方法
async divinate(data: {
  question: string;
  coins: number[];
  provider: 'local' | 'gemini';  // 新增必填
  gender?: string;
  target?: string;
}) {
  return this.request('/api/divinate', {
    method: 'POST',
    body: JSON.stringify(data)
  });
}
```

---

## ✅ 修復完成檢查表

- [x] 移除所有 daily_limit 相關代碼
- [x] 修改 /api/divinate 添加 AI 可用性檢查
- [x] 修改 call_ai 使用用戶配置的模型
- [x] 新增 /api/check-ai-availability 端點
- [x] 修復 user_local_config key 名稱（api_url, model_name）
- [ ] 前端：設定頁面添加 AI 配置表單
- [ ] 前端：六爻頁面添加 AI 選擇器
- [ ] 前端：添加 AI 可用性檢查邏輯
- [ ] 測試：Local AI 完整流程
- [ ] 測試：Gemini 完整流程

---

## 🎉 總結

現在的架構清晰多了：

1. ✅ **用戶級設定**：每個用戶有自己的 AI 配置
2. ✅ **主動檢查**：前端可以提前知道 AI 是否可用
3. ✅ **友善錯誤**：明確的錯誤類型和引導提示
4. ✅ **靈活模型**：用戶可以自由選擇模型
5. ✅ **無限制**：移除了不必要的算命次數限制

用戶體驗大幅提升！🚀
