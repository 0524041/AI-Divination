# 資料庫設計文件

本專案使用 **SQLite** 作為數據庫，數據庫文件預設位於後端目錄下的 `divination.db`。

## 數據模型 (ER 摘要)

### 1. `users` (用戶表)
儲存系統用戶的所有基本資訊。
- `id` (PK): 自動增量 ID。
- `username`: 用戶名（唯一索引）。
- `password_hash`: 經過 bcrypt 加密的密鑰。
- `role`: 角色（`admin` 或 `user`）。
- `created_at`: 註冊時間。
- `last_login`: 最後登錄時間。

### 2. `api_keys` (API 密鑰與個人配置)
儲存用戶個人的 AI 配置資訊。
- `id` (PK): 自動增量 ID。
- `user_id` (FK): 關聯 `users.id`。
- `provider`: 提供者（`gemini` 或 `local`）。
- `api_key_encrypted`: 加密後的 API 密鑰。
- `config_json`: 儲存個人化的 JSON 配置（如 Local AI 的特定 URL 或模型名稱）。
- `created_at`: 創建時間。

### 3. `history` (占卜歷史記錄)
儲存所有算命結果。
- `id` (PK): 自動增量 ID。
- `user_id` (FK): 關聯 `users.id`（刪除用戶將級聯刪除歷史）。
- `question`: 用戶提出的問題。
- `gender`: 求測者性別。
- `target`: 占卜對象。
- `result_json`: 算命排盤生成的原始 JSON 數據（包含爻象細節）。
- `interpretation`: AI 生成的命理解讀內容。
- `ai_model`: 最終使用的 AI 模型名稱。
- `is_favorite`: 是否標記為收藏。
- `date_str`: 用於限制次數的日期字符串 (`YYYY-MM-DD`)。
- `created_at`: 創建時間。

### 4. `settings` (全域系統設定)
簡單的鍵值對錶，用於管理員配置。
- `key` (PK): 設定名稱。
- `value`: 設定內容。
- **常用 Key**:
    - `daily_limit`: 每日免費占卜次數。
    - `system_prompt`: 全域 AI 系統人設提示詞。
    - `ai_provider`: 預設 AI 提供者。
    - `local_api_url`: 全域 Local API 地址。
    - `local_model_name`: 全域 Local AI 模型名稱。

### 5. `request_queue` (請求隊列)
(預留) 用於處理高並發時的請求管理。
- `status`: `pending`, `processing`, `completed`, `failed`。

## 資料庫索引
為了提升查詢性能，系統在以下欄位建立了索引：
- `history(user_id)`
- `history(date_str)`
- `request_queue(status)`
- `api_keys(user_id)`
