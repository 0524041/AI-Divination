# 後端功能與服務文檔

本專案後端採用 **Flask** 框架編寫，提供 RESTful API，並負責核心的六爻算命排盤邏輯與 AI 集成。

## 系統架構

### 1. API 路由 (`routes.py`)
- **認證模組**: 處理登入、註冊、登出、密碼更新。
- **占卜介面 (`/api/divinate`)**: 
    - 接收前端搖卦數據。
    - 調用 `perform_divination` 服務。
    - 啟動非同步線程 (`run_ai_background`) 執行 AI 解讀，以避免長連接超時。
- **歷史與管理**: 提供歷史記錄查詢、用戶管理、神祕學配置管理等。
- **測試工具**: 提供 API 端點測試 Local AI 的連線可用性。

### 2. 六爻核心服務 (`services/divination_core.py`)
這是專案最核心的算法庫，將傳統的易經占卜術數與現代代碼結合。
- **`LiuYaoChart` 類**:
    - **納甲**: 根據上下卦確定乾、坤、震、巽、坎、離、艮、兌對應的地支。
    - **尋宮安世**: 實現「八宮世系表」算法，確定卦象所屬卦宮、世爻與應爻位置。
    - **安六親**: 根據卦宮五行與爻地支五行的屬性關係（生我者父母、我生者子孫等）排佈六親。
    - **安六神**: 根據起卦日的日干排佈青龍、朱雀、勾陳、螣蛇、白虎、玄武。
    - **神煞計算**: 計算驛馬、桃花、空亡等重要信號。
    - **五行與八字**: 整合 `lunar-python` 庫計算農曆、天干地支五行強度。

### 3. AI 集成服務 (`services/ai.py`)
- **多模型支持**:
    - **Gemini**: 使用 Google Generative AI 端點（核心模型：Gemini 1.5 Flash）。
    - **Local AI**: 支持任何相容 OpenAI API 格式的本地模型（如 DeepSeek, Qwen）。
- **流程管控**:
    - 自動組合系統提示詞（大師人設）與算命結果。
    - 支持處理具備思考過程的模型（預保留 `<think>` 標籤）。
    - **優先級處理**: 優先使用用戶個人提供的 API Key，如無則回退至系統配置。

### 4. 資料庫服務 (`core/database.py`)
- 封裝所有的 SQLite 操作。
- 提供 `add_history`, `update_history_interpretation` 等數據持久化函數。
- 負責系統啟動時的自動遷移與預設設置初始化。

## 關鍵子模組
- **`utils/auth.py`**: 提供 JWT 或 Session 裝飾器進行權限控制（`login_required`, `admin_required`）。
- **`models/user.py`**: 封裝用戶密鑰加密與 CRUD 邏輯。
