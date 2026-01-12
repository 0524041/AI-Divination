# AI 服務名稱功能更新說明

## 功能概述

新增功能：允許用戶為 AI 服務設定自訂名稱，方便識別和管理多個相同類型的 AI 服務。

## 修改內容總結

### 1. 資料庫模型 (`backend/app/models/settings.py`)
- ✅ 添加 `name` 欄位 (VARCHAR(50), nullable)
- 用於儲存用戶自訂的 AI 服務名稱

### 2. 後端 API (`backend/app/api/settings.py`)
- ✅ `AIConfigRequest`: 添加 `name` 欄位 (Optional[str], max_length=50)
- ✅ `AIConfigResponse`: 添加 `name` 欄位 (Optional[str])
- ✅ 更新所有 CRUD endpoints 以支援名稱欄位

### 3. 前端設定頁面 (`frontend/src/app/settings/page.tsx`)
- ✅ `AIConfig` interface: 添加 `name: string | null` 欄位
- ✅ 添加 `newAIName` state 用於表單輸入
- ✅ 新增名稱輸入框在 AI 設定表單中
- ✅ 在 AI 服務列表中優先顯示自訂名稱
- ✅ 更新 `handleAddAIConfig` 和 `handleUpdateAIConfig` 以處理名稱

### 4. AI 選擇器組件 (`frontend/src/components/features/AISelector.tsx`)
- ✅ `AIConfig` interface: 添加 `name: string | null` 欄位
- ✅ 更新 `getDisplayName()`: 優先顯示自訂名稱，否則使用預設名稱

### 5. 資料庫遷移 (`backend/migrations/add_ai_config_name.py`)
- ✅ 建立遷移腳本用於添加 `name` 欄位到現有資料庫

## 使用方式

### 運行資料庫遷移

在添加新功能之前，需要先運行資料庫遷移腳本：

```bash
cd backend
python migrations/add_ai_config_name.py
```

### 使用者介面

1. **新增 AI 服務時設定名稱**：
   - 在設定頁面點擊「新增」AI 服務
   - 填寫 AI 服務資訊
   - 在「服務名稱 (選填)」欄位輸入自訂名稱
   - 留空則使用預設名稱

2. **編輯現有 AI 服務名稱**：
   - 在 AI 服務列表中點擊「編輯」按鈕
   - 修改「服務名稱」欄位
   - 點擊「更新設定」保存

3. **顯示效果**：
   - 設定頁面：顯示自訂名稱（如果有）或預設名稱
   - AI 選擇器：下拉選單中顯示自訂名稱（如果有）或預設名稱

## 預設名稱規則

如果用戶未設定自訂名稱，系統將使用以下預設名稱：

- **Gemini**: "Google Gemini"
- **OpenAI**: "OpenAI"
- **其他 AI**: "Local AI (模型名稱)"

## 範例

### 使用場景 1: 多個本地 AI 服務
- AI 服務 1: 名稱 = "Ollama 本地伺服器", URL = "http://localhost:11434", Model = "llama3"
- AI 服務 2: 名稱 = "LM Studio - Qwen", URL = "http://localhost:1234", Model = "qwen2.5:14b"

### 使用場景 2: 多個 Gemini API Key
- AI 服務 1: 名稱 = "個人 Gemini" (使用個人 API Key)
- AI 服務 2: 名稱 = "工作 Gemini" (使用公司 API Key)

## 注意事項

1. **名稱長度限制**: 最多 50 個字元
2. **選填欄位**: 名稱為選填，不影響現有功能
3. **向後兼容**: 現有資料庫記錄的 `name` 欄位為 `NULL`，會自動使用預設名稱
4. **自動修剪**: 系統會自動移除名稱前後的空白字元

## 技術細節

- 資料庫欄位類型: `VARCHAR(50)`
- API 驗證: 使用 Pydantic Field 驗證，max_length=50
- 前端驗證: HTML input maxLength=50
- 預設值: NULL (資料庫) / null (前端)

## 測試建議

1. ✅ 新增 AI 服務時填寫名稱
2. ✅ 新增 AI 服務時不填寫名稱（使用預設）
3. ✅ 編輯現有 AI 服務修改名稱
4. ✅ 在 AI 選擇器中查看自訂名稱顯示
5. ✅ 測試名稱長度限制（超過 50 字元）
6. ✅ 測試資料庫遷移腳本的冪等性（重複執行）
