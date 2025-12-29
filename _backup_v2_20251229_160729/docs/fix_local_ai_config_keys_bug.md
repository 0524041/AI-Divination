# Bug 修復：Local AI 配置 Key 名稱不一致

## 🐛 問題描述

用戶 willy 遇到的問題：
1. 在設定頁面配置了 Local AI，但算卦頁面還是顯示 `qwen3-8b` 而不是配置的模型
2. 點擊算卦時報錯 400，提示「請先在設定中配置 Local AI」

## 🔍 根本原因

前後端配置的 key 名稱不一致：

### 前端保存時（錯誤）
```typescript
// frontend/src/app/settings/page.tsx (舊)
await saveBackendApiKey('local', undefined, {
  url: localSettings.local_api_url,      // ❌ 錯誤的 key
  model: localSettings.local_model_name  // ❌ 錯誤的 key
});
```

### 後端期望格式
```python
# backend/app/routes.py
api_url = user_local_config.get('api_url')      # ✅ 期望這個 key
model_name = user_local_config.get('model_name') # ✅ 期望這個 key
```

### 前端讀取時（也錯誤）
```typescript
// frontend/src/components/LiuYaoPage.tsx (舊)
backendApiKeys.configs.local?.url    // ❌ 試圖讀取錯誤的 key
backendApiKeys.configs.local?.model  // ❌ 試圖讀取錯誤的 key
```

## ✅ 修復方案

### 1. 修復前端保存邏輯
**文件**: `frontend/src/app/settings/page.tsx`

```typescript
// 修復後
await saveBackendApiKey('local', undefined, {
  api_url: localSettings.local_api_url,      // ✅ 正確
  model_name: localSettings.local_model_name // ✅ 正確
});
```

### 2. 修復前端讀取邏輯
**文件**: `frontend/src/components/LiuYaoPage.tsx`

```typescript
// 修復後 - 檢查配置
const hasLocalConfig = (settings?.local_api_url && settings?.local_model_name) ||
  (backendApiKeys.configs.local?.api_url && backendApiKeys.configs.local?.model_name);

// 修復後 - 顯示模型名稱
Local AI ({backendApiKeys.configs.local?.model_name?.split('/').pop() || ...})
```

### 3. 遷移現有資料庫配置
**腳本**: `migrations/fix_local_ai_config_keys.py`

```bash
cd /home/liewei/workspace/AI-Divination
python3 migrations/fix_local_ai_config_keys.py
```

這個腳本會自動轉換所有用戶的配置：
- `url` → `api_url`
- `model` → `model_name`

## 🧪 驗證修復

### 1. 檢查資料庫配置
```bash
python3 << 'EOF'
import sys, json
sys.path.insert(0, 'backend')
from app.core.database import get_db_connection

conn = get_db_connection()
keys = conn.execute('SELECT user_id, config_json FROM api_keys WHERE provider = "local"').fetchall()
for k in keys:
    config = json.loads(k['config_json'])
    print(f"用戶 {k['user_id']}: {config}")
conn.close()
EOF
```

應該看到：
```
用戶 2: {'api_url': 'http://192.168.1.163:1234/v1', 'model_name': 'deepseek/deepseek-r1-0528-qwen3-8b'}
```

### 2. 測試前端顯示
1. 登入 willy 帳戶
2. 進入算卦頁面
3. 檢查 Local AI 按鈕顯示：應該顯示 `deepseek-r1-0528-qwen3-8b` 而不是 `qwen3-8b`

### 3. 測試算卦功能
1. 選擇 Local AI
2. 輸入問題
3. 點擊算卦
4. 應該成功，不會再出現「請先配置」錯誤

## 📝 修改的文件

### 前端
1. `frontend/src/app/settings/page.tsx`
   - 修復保存 Local AI 配置時的 key 名稱

2. `frontend/src/components/LiuYaoPage.tsx`
   - 修復讀取和顯示 Local AI 配置時的 key 名稱（4 處）

### 後端
無需修改（後端邏輯已正確）

### 資料庫遷移
1. `migrations/fix_local_ai_config_keys.py`
   - 新增遷移腳本，轉換現有配置

## 🎯 影響範圍

### 受影響的用戶
- 所有在修復前配置過 Local AI 的用戶
- 配置會被自動遷移，用戶無需重新配置

### 未受影響的功能
- Gemini API Key 配置（使用不同的結構）
- 系統級設定（settings 表）
- 歷史記錄

## 🚀 部署步驟

1. **更新前端代碼**
   ```bash
   cd frontend
   npm run build
   ```

2. **執行資料庫遷移**
   ```bash
   cd /home/liewei/workspace/AI-Divination
   python3 migrations/fix_local_ai_config_keys.py
   ```

3. **重啟服務**
   ```bash
   ./start.sh
   ```

4. **驗證**
   - 測試現有用戶的 Local AI 配置
   - 測試新用戶配置 Local AI
   - 測試算卦功能

## 📊 測試結果

### willy 用戶測試
- ✅ 資料庫配置已更新
- ✅ 前端代碼已修復
- ⏳ 需要重啟前端服務並測試

### 預期結果
1. 算卦頁面顯示 `Local AI (deepseek-r1-0528-qwen3-8b)`
2. 點擊算卦成功調用 AI
3. 後端日誌顯示使用正確的模型：
   ```
   [AI Service] Using USER Local AI: deepseek/deepseek-r1-0528-qwen3-8b at http://192.168.1.163:1234/v1
   ```

## 💡 經驗教訓

1. **統一命名規範**：前後端應該使用相同的 key 名稱
2. **類型定義**：應該使用 TypeScript interface 定義配置結構
3. **早期測試**：應該在開發時就測試完整流程
4. **資料遷移**：修改資料結構時要考慮現有資料的遷移

## 🔮 後續改進建議

1. **添加 TypeScript 類型定義**
   ```typescript
   // types/index.ts
   interface LocalAIConfig {
     api_url: string;
     model_name: string;
   }
   
   interface BackendApiKeys {
     gemini: boolean;
     local: boolean;
     configs: {
       gemini?: any;
       local?: LocalAIConfig;
     };
   }
   ```

2. **添加配置驗證**
   - 前端保存前驗證 key 名稱
   - 後端接收時驗證必要欄位

3. **添加單元測試**
   - 測試配置保存和讀取
   - 測試不同格式的配置轉換
