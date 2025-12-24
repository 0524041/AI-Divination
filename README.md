# AI Divination App (AI 算卦程式)

這是一個結合現代 AI 技術與傳統六爻占卜的算卦程式。它使用 Google Gemini 3 Flash 預覽版模型作為核心，並透過 MCP (Model Context Protocol) 整合專業的排盤工具。

![Home Page Screenshot](homepage_screenshot.png)

**v0.3.0 更新**：
*   **介面風格**：全新「空靈玄學」主題，沈浸式深色設計。
*   **功能升級**：支援歷史紀錄刪除、問題輸入框動態打字效果。

## 特色

*   **AI 智能解掛**: 使用 Gemini 3 Flash 高階思考模式，提供有深度且人性化的解讀。
*   **空靈美學 UI**: 採用深色玻璃擬態 (Glassmorphism) 設計，搭配舒適的襯線字體與光影動畫。
*   **專業排盤**: 整合 `divination-chart-mcp` 工具。
*   **完整記錄**: 支援查看、收藏與刪除過往算卦紀錄。
*   **彈性設定**: 可自定義每日算卦次數。

## 使用方式

### 1. 環境設定

需設定 Google Gemini API Key：

**Mac/Linux:**
```bash
export GEMINI_API_KEY="您的_API_KEY"
```

**Windows (PowerShell):**
```powershell
$env:GEMINI_API_KEY="您的_API_KEY"
```

### 2. 啟動應用

專案內建 `start.sh` (Mac/Linux) 自動使用 `uv` 啟動：

```bash
chmod +x start.sh
./start.sh
```

或直接運行：

```bash
uv run server.py
# 或
python server.py
```

### 3. 操作指引

瀏覽器訪問 `http://localhost:8080`。

- **誠心問卦**: 首頁輸入框會引導您輸入問題，點擊起卦即可。
- **歷史紀錄**: 隨時回顧，不滿意的紀錄可進行刪除。
- **六爻說明**: 了解算卦的基本心法。

## 版本資訊

Current Version: **v0.3.0**
