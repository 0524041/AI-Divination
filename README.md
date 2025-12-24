# AI Divination App (AI 算卦程式)

這是一個結合現代 AI 技術與傳統六爻占卜的算卦程式。它使用 Google Gemini 3 Flash 預覽版模型作為核心，並透過 MCP (Model Context Protocol) 整合專業的排盤工具，為使用者提供詳細的卦象分析與解讀。

本專案設計為個人使用，需自行串接 API Key。

## 特色

*   **AI 智能解掛**: 使用 Gemini 3 Flash 高階思考模式，提供有深度且人性化的解讀。
*   **專業排盤**: 整合 `divination-chart-mcp` 工具，進行準確的六爻排盤。
*   **歷史紀錄**: 自動保存算卦紀錄，方便隨時回顧。
*   **每日限制**: 內建每日算卦次數限制（預設 5 次），避免過度依賴或 API 超額使用。

## 使用方式

### 1. 環境設定

本專案使用 Google Gemini API，您需要先申請一組 API Key。

設定環境變數 `GEMINI_API_KEY`：

**Mac/Linux:**
```bash
export GEMINI_API_KEY="您的_API_KEY"
```

**Windows (PowerShell):**
```powershell
$env:GEMINI_API_KEY="您的_API_KEY"
```

### 2. 安裝依賴與啟動

本專案建議使用 `uv` 進行套件管理與啟動，但也支援標準 Python 環境。

#### 方法一：使用啟動腳本 (推薦)

專案內建 `start.sh` 腳本，會自動檢查並使用 `uv` 執行。

```bash
chmod +x start.sh
./start.sh
```

#### 方法二：使用 uv 直接啟動

```bash
uv run server.py
```

#### 方法三：傳統 pip 安裝

如果您沒有安裝 `uv`，可以使用 pip 安裝依賴後啟動：

```bash
pip install flask google-genai
python server.py
```

### 3. 開始算卦

啟動後，開啟瀏覽器訪問 `http://localhost:8080` 即可看到操作介面。

## 版本資訊

Current Version: **v0.1.0**
