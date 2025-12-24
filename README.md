# AI Divination App (AI 算卦程式)

這是一個結合現代 AI 技術與傳統六爻占卜的算卦程式。它使用 Google Gemini 3 Flash 預覽版模型作為核心，並透過 MCP (Model Context Protocol) 整合專業的排盤工具。

**v0.2.0 更新**：全新現代化介面，增加系統設定、歷史紀錄收藏與六爻規則說明。

## 特色

*   **AI 智能解掛**: 使用 Gemini 3 Flash 高階思考模式，提供有深度且人性化的解讀（自動前綴 "幫我算一掛" 以確保觸發模式）。
*   **現代化介面**: 採用 SPA 架構與流暢動畫，提供沈浸式體驗。
*   **專業排盤**: 整合 `divination-chart-mcp` 工具，進行準確的六爻排盤。
*   **彈性設定**: 可於介面中設定每日算卦次數（1, 3, 5, 10 或無上限）。
*   **六爻知識**: 內建基礎六爻規則與心態說明。

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

- **誠心問卦**: 輸入問題，點擊占卜。AI 將自動起卦分析。
- **歷史紀錄**: 查看過往紀錄，並可加入收藏。
- **六爻說明**: 閱讀算卦的基本規則與心態。
- **系統設定**: 調整每日算卦上限。

## 版本資訊

Current Version: **v0.2.0**
