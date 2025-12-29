# ☯ AI 算命網頁 v5.0

結合傳統易經智慧與現代 AI 技術的智能算命網站。透過六爻占卜排盤，搭配 AI 大師進行專業解讀。

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Python](https://img.shields.io/badge/python-3.10+-blue.svg)
![Node.js](https://img.shields.io/badge/node.js-18+-green.svg)

## ✨ 功能特色

- 🔮 **六爻占卜**：傳統易經六爻排盤 + AI 智慧解讀
- 🤖 **多 AI 支援**：支援 Google Gemini 和本地 AI（LM Studio、Ollama 等 OpenAI 兼容 API）
- 📜 **歷史紀錄**：完整保存占卜紀錄，支援 Markdown 渲染
- 🧠 **思考過程**：展示 AI 思考過程（可摺疊），了解解盤邏輯
- 👥 **用戶系統**：多用戶支援，管理員可管理所有用戶
- ⚙️ **AI 設定**：可新增、編輯、切換多個 AI 配置
- 📱 **響應式設計**：支援手機、平板、電腦
- ⏱️ **超時處理**：5 分鐘 AI 超時保護，可隨時取消

## 🖼️ 截圖預覽

（待補充）

## 🛠️ 技術架構

### 前端
- **框架**：Next.js 14 (App Router)
- **語言**：TypeScript
- **樣式**：Tailwind CSS
- **圖標**：Lucide React
- **Markdown**：marked + DOMPurify

### 後端
- **框架**：FastAPI (Python 3.10+)
- **資料庫**：SQLite + SQLAlchemy ORM
- **認證**：JWT (python-jose) + bcrypt
- **套件管理**：uv

### AI 服務
- **Google Gemini**：雲端 AI，需要 API Key
- **Local AI**：本地 AI，支援 OpenAI 兼容 API（LM Studio、Ollama 等）

## 🚀 快速開始

### 系統需求

- Node.js 18+
- Python 3.10+（由 uv 自動管理）
- uv 套件管理器

### 安裝 uv（如尚未安裝）

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

### 啟動服務

```bash
# 一鍵啟動
./start.sh

# 查看狀態
./start.sh --status

# 查看日誌
./start.sh --logs

# 停止服務
./start.sh --stop

# 重置資料庫（清除所有數據）
./start.sh --reset

# 清除快取
./start.sh --clean-cache
```

啟動後訪問：
- **前端**：http://localhost:3000
- **後端 API**：http://localhost:8000
- **API 文檔**：http://localhost:8000/docs

## 📖 首次使用

1. 訪問 http://localhost:3000
2. 系統會引導你建立**管理員帳號**（記住密碼！）
3. 登入後前往**設定頁面**配置 AI 服務：
   - **Gemini**：填入你的 Google AI API Key
   - **Local AI**：填入本地 AI 服務的 URL 和模型名稱
4. 回到首頁，開始**六爻占卜**！

## �� 目錄結構

```
AI-Divination/
├── backend/                    # 後端 (FastAPI)
│   ├── app/
│   │   ├── api/               # API 路由
│   │   │   ├── auth.py        # 認證 API
│   │   │   ├── divination.py  # 占卜 API
│   │   │   ├── history.py     # 歷史紀錄 API
│   │   │   ├── settings.py    # 設定 API
│   │   │   └── admin.py       # 管理員 API
│   │   ├── core/              # 核心配置
│   │   ├── models/            # 資料模型
│   │   ├── services/          # 服務邏輯
│   │   │   ├── ai.py          # AI 服務
│   │   │   └── liuyao.py      # 六爻排盤
│   │   └── utils/             # 工具函數
│   ├── prompts/               # AI Prompt 模板
│   └── requirements.txt       # Python 依賴
├── frontend/                   # 前端 (Next.js)
│   └── src/
│       ├── app/               # 頁面
│       │   ├── page.tsx       # 首頁
│       │   ├── login/         # 登入頁
│       │   ├── liuyao/        # 六爻占卜頁
│       │   ├── history/       # 歷史紀錄頁
│       │   └── settings/      # 設定頁
│       └── lib/
│           └── markdown.ts    # Markdown 解析
├── docs/                       # 文檔
├── _legacy_backup/             # 舊版備份 (v1-v4)
├── start.sh                    # 啟動腳本
└── README.md
```

## 🔧 設定說明

### AI 設定

#### Google Gemini
1. 前往 [Google AI Studio](https://aistudio.google.com/) 取得 API Key
2. 在設定頁面新增 Gemini 配置，填入 API Key

#### Local AI（LM Studio）
1. 下載並安裝 [LM Studio](https://lmstudio.ai/)
2. 下載一個模型（建議 Qwen 或 DeepSeek）
3. 啟動本地伺服器（預設 http://localhost:1234/v1）
4. 在設定頁面新增 Local AI 配置，填入 URL 和模型名稱

### 環境變數（可選）

創建 `.env` 文件：

```env
# JWT 密鑰（可選，預設自動生成）
JWT_SECRET_KEY=your-secret-key

# 資料庫路徑（可選）
DATABASE_URL=sqlite:///./divination.db
```

## �� 版本歷史

### v5.0 (2025-12-29)
- 🔄 完全重構前後端架構
- ✨ 新增 AI 配置編輯功能
- ✨ 新增占卜頁面 AI 切換器
- ✨ 新增 AI 思考過程摺疊顯示
- ✨ 新增 5 分鐘超時保護
- ✨ 新增取消占卜功能
- 🐛 修復 Markdown 解析問題（處理 code block 包裝）
- 🐛 修復登入頁面圖標重疊問題
- 🔧 使用 uv 管理 Python 環境
- 🔧 改進 start.sh 腳本（支援多種命令）

### v4.0 (之前版本)
- 基礎六爻占卜功能
- 用戶認證系統
- AI 服務整合

## 🗺️ 開發計劃

- [x] 六爻占卜核心功能
- [x] 用戶認證系統
- [x] AI 服務整合（Gemini + Local）
- [x] 歷史紀錄 + Markdown 渲染
- [x] AI 思考過程顯示
- [ ] 紫微斗數 (Coming Soon)
- [ ] 八字命盤 (Coming Soon)
- [ ] 流年運勢 (Coming Soon)
- [ ] Docker 部署支援

## 🤝 貢獻

歡迎提交 Issue 和 Pull Request！

## 📄 授權

MIT License

## 🙏 致謝

- [六爻排盤算法](https://github.com/ichingtao/ichingshifa) - 六爻排盤核心
- [Google Gemini](https://ai.google.dev/) - AI 服務
- [Next.js](https://nextjs.org/) - React 框架
- [FastAPI](https://fastapi.tiangolo.com/) - Python API 框架
