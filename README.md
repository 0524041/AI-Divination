# ☯ AI 算命網頁 v6.0

🌐 **網站上線啦！歡迎大家測試：[https://akspace99.dpdns.org](https://akspace99.dpdns.org)**

🔒 **v6.0 重大更新：全面升級 API 安全機制，防止重定向攻擊和請求偽造！**

結合傳統易經智慧與現代 AI 技術的智能算命網站。透過六爻占卜排盤，搭配 AI 大師進行專業解讀。

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Python](https://img.shields.io/badge/python-3.10+-blue.svg)
![Node.js](https://img.shields.io/badge/node.js-18+-green.svg)

## ✨ 功能特色

### 占卜系統
- 🔮 **六爻占卜**：傳統易經六爻排盤 + AI 智慧解讀
  - 逼真的擲幣動畫與視覺效果
  - 完整的卦象排盤與變卦分析
- 🃏 **塔羅占卜**：含 78 張塔羅牌的完整牌組 + AI 專業解讀
  - **單張牌陣**：快速洞察當前狀況
  - **三張牌陣**：探索過去、現在、未來
  - **凱爾特十字牌陣**：深度分析複雜問題（10張牌）
  - 精美的牌卡圖像與翻牌動畫
  - 支援正逆位解讀

### AI 與系統功能
- 🤖 **多 AI 支援**：支援 Google Gemini 和本地 AI（LM Studio、Ollama 等 OpenAI 兼容 API）
- 📜 **歷史紀錄**：完整保存占卜紀錄，支援 Markdown 渲染
- 🧠 **思考過程**：展示 AI 思考過程（可摺疊），了解解盤邏輯
- 👥 **用戶系統**：多用戶支援，管理員可管理所有用戶
- ⚙️ **AI 設定**：可新增、編輯、切換多個 AI 配置
- 📱 **響應式設計**：支援手機、平板、電腦
- ⏱️ **超時處理**：5 分鐘 AI 超時保護，可隨時取消

### 🔒 安全特性（v6.0 新增）
- 🛡️ **API 請求簽名**：HMAC-SHA256 防止 CSRF 和請求偽造
- 🔐 **來源白名單**：只允許授權域名訪問
- 🚫 **防重定向攻擊**：自動檢測並阻止惡意重定向
- ⏰ **防重放攻擊**：時間戳和 nonce 機制
- 🔌 **SSE 安全通訊**：長連接使用 Server-Sent Events
- 📊 **安全響應頭**：完整的安全 HTTP 頭部設置

詳細安全文檔請參考：[API_SECURITY.md](docs/API_SECURITY.md)

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

### 首次安裝配置

```bash
# 克隆代碼
git clone https://github.com/0524041/AI-Divination.git
cd AI-Divination

# 一鍵啟動（自動配置安全機制）
./start.sh

# 查看狀態
./start.sh --status

# 查看日誌
./start.sh --logs
```

> **📝 v6.1 更新**：安全機制現已整合到 `start.sh`，無需單獨執行 `configure_security.sh`

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
4. 回到首頁，選擇你想要的占卜方式：
   - **六爻占卜**：傳統易經占卜，適合重大決策
   - **塔羅占卜**：靈性指引，適合自我探索與問題洞察

## �� 目錄結構

```
AI-Divination/
├── backend/                    # 後端 (FastAPI)
│   ├── app/
│   │   ├── api/               # API 路由
│   │   │   ├── auth.py        # 認證 API
│   │   │   ├── divination.py  # 六爻占卜 API
│   │   │   ├── tarot.py       # 塔羅占卜 API
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
│   │   ├── system_prompt.md   # 六爻占卜 Prompt
│   │   ├── tarot_system_prompt_single.md       # 單張牌 Prompt
│   │   ├── tarot_system_prompt_three_card.md   # 三張牌 Prompt
│   │   └── tarot_system_prompt_celtic_cross.md # 凱爾特十字 Prompt
│   └── requirements.txt       # Python 依賴
├── frontend/                   # 前端 (Next.js)
│   ├── public/
│   │   └── tarot-cards/       # 78 張塔羅牌圖片
│   └── src/
│       ├── app/               # 頁面
│       │   ├── page.tsx       # 首頁
│       │   ├── login/         # 登入頁
│       │   ├── liuyao/        # 六爻占卜頁
│       │   ├── tarot/         # 塔羅占卜頁
│       │   ├── history/       # 歷史紀錄頁
│       │   └── settings/      # 設定頁
│       ├── components/
│       │   └── CoinTossing.tsx # 六爻擲幣動畫
│       └── lib/
│           ├── markdown.ts    # Markdown 解析
│           └── tarot-data.ts  # 塔羅牌資料
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
## 📚 版本歷史

### v6.0 (2026-01-08) 🔒
- 🛡️ **重大安全更新**：實施全面 API 安全機制
  - ✅ HMAC-SHA256 請求簽名驗證
  - ✅ 來源白名單驗證
  - ✅ 防止重定向攻擊
  - ✅ 防止重放攻擊（時間戳 + nonce）
  - ✅ SSE 安全通訊機制
  - ✅ 完整的安全響應頭
- 📖 新增完整安全文檔（90+ 頁）
- 🔧 新增自動配置腳本 `configure_security.sh`
- 🧪 新增安全測試工具
- 📝 詳見：[API_SECURITY.md](docs/API_SECURITY.md)

### v5.1 (2026-01-05)
- ✨ **塔羅占卜功能上線**：完整的 78 張塔羅牌系統
  - 單張牌陣：適合每日指引
  - 三張牌陣：過去-現在-未來分析
  - 凱爾特十字牌陣：10 張牌深度解讀
  - 精美的翻牌動畫與視覺效果
  - 支援正逆位解讀
- ✨ 針對不同牌陣優化的專屬 AI Prompt
- ✨ 塔羅占卜歷史紀錄整合
- 🐛 優化 AI 解盤時序，提前提交後端處理
- 🐛 修復塔羅頁面 AI 切換器點擊問題

### v5.0 (2025-12-29)
- 🔄 完全重構前後端架構
- ✨ 新增 AI 配置編輯功能
- ✨ 新增占卜頁面 AI 切換器
- ✨ 新增 AI 思考過程摺疊顯示
- ✨ 新增 5 分鐘超時保護
- ✨ 新增取消占卜功能
- ✨ 新增六爻擲幣 3D 動畫效果

## ✅ 已完成功能
- [x] 六爻占卜核心功能
- [x] 塔羅占卜系統（78 張完整牌組）
  - [x] 單張牌陣
  - [x] 三張牌陣
  - [x] 凱爾特十字牌陣（10張）
- [x] 用戶認證系統
- [x] AI 服務整合（Gemini + Local）
- [x] 歷史紀錄 + Markdown 渲染
- [x] AI 思考過程顯示
- [x] 3D 擲幣動畫
- [x] **API 安全機制**（v6.0）
  - [x] 請求簽名驗證
  - [x] 防重定向攻擊
  - [x] 防 CSRF/重放攻擊
  - [x] SSE 安全通訊

## 🚀 規劃中功能
- [ ] 更多塔羅牌陣類型
  - [ ] 時間之流（時間線分析）
  - [ ] 關係牌陣（雙人關係）
  - [ ] 決策牌陣（選擇指引）
- [ ] 紫微斗數 (Coming Soon)
- [ ] 八字命盤 (Coming Soon)
- [ ] 流年運勢 (Coming Soon)
- [ ] Docker 部署支援
- [ ] 占卜結果分享功能

## 🔗 相關文檔

- 📖 [API 安全機制詳細文檔](docs/API_SECURITY.md)
- 🚀 [安全配置快速指南](docs/SECURITY_QUICKSTART.md)
- 📝 [安全修復總結](docs/SECURITY_FIX_SUMMARY.md)
- ✅ [配置檢查清單](SECURITY_CHECKLIST.md)
- 📊 [性能分析](docs/PERFORMANCE_ANALYSIS.md)
- 🔐 [輸入安全分析](docs/INPUT_SECURITY_ANALYSIS.md)

## 🤝 貢獻

歡迎提交 Issue 和 Pull Request！

## 📄 授權

MIT License

## 🙏 致謝

- [六爻排盤算法](https://github.com/ichingtao/ichingshifa) - 六爻排盤核心
- [Google Gemini](https://ai.google.dev/) - AI 服務
- [Next.js](https://nextjs.org/) - React 框架
- [FastAPI](https://fastapi.tiangolo.com/) - Python API 框架
