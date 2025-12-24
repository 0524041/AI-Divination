# AI Divination App (AI 算卦程式)

這是一個結合現代 AI 技術與傳統六爻占卜的算卦程式。支援 Google Gemini 與本地 AI 模型，透過 MCP 整合專業排盤工具。

![Home Page Screenshot](homepage_screenshot.png)

## 🎉 最新版本 v0.4.0

### 新功能
- **多用戶系統** - 用戶註冊、登入、權限管理
- **Admin 管理面板** - 新增/刪除用戶、查看所有歷史
- **雙 AI 支援** - 本地 AI (預設) 或 Gemini 雲端
- **API Key 管理** - 每個用戶獨立設定 Gemini Key
- **六爻教學頁面** - 正確問卦方式指南
- **前端搖卦動畫** - 六爻生成視覺化

### 預設帳號
```
用戶名: admin
密碼: admin123
```

---

## 特色

- **AI 智能解卦**: 支援 Gemini Flash 或本地 LLM
- **多用戶支援**: 獨立帳號、獨立歷史記錄
- **空靈美學 UI**: 深色玻璃擬態設計
- **專業排盤**: 整合 `divination-chart-mcp` MCP 工具
- **完整記錄**: 支援查看、收藏、刪除歷史
- **彈性設定**: 每日卦數限制、AI 模型切換

## 快速開始

### 1. 啟動應用

```bash
chmod +x start.sh
./start.sh
```

或使用 uv/python：
```bash
uv run server.py
# 或
python server.py
```

### 2. 訪問應用

瀏覽器打開 `http://localhost:8080`

### 3. 登入

使用預設帳號 `admin` / `admin123` 登入

### 4. 設定 AI

- **本地 AI (預設)**: 確保本地 LLM 服務運行在 `localhost:1234`
- **Gemini**: 在設定頁面輸入你的 API Key

---

## Release Notes

### v0.4.0 (2024-12-24)
**重大更新：多用戶系統**
- ✨ 用戶認證系統 (登入/登出)
- ✨ Admin 管理面板
- ✨ 用戶獨立 API Key 管理
- ✨ 六爻占卜教學頁面
- ✨ 前端搖卦動畫
- ✨ 雙 AI 模型支援 (Local/Gemini)
- 🔧 預設使用本地 AI
- 🔧 歷史記錄顯示問題字段

### v0.3.0
- 全新「空靈玄學」UI 主題
- 支援歷史紀錄刪除
- 動態打字效果

### v0.2.0
- 基礎占卜功能
- Gemini AI 整合
- MCP 排盤工具整合

---

## 技術棧

- **後端**: Flask + SQLite
- **前端**: Alpine.js + Vanilla CSS
- **AI**: Google Gemini / Local LLM (OpenAI Compatible)
- **占卜工具**: divination-chart-mcp

## License

MIT
