# ☯ 玄覺空間 (Mystic Mind Space) v1.2.0

🌐 **網站上線啦！歡迎大家測試：[https://akspace99.dpdns.org](https://akspace99.dpdns.org)**

**v1.2.0 更新：前端架構優化 & Admin 功能強化！**

結合傳統易經智慧與現代 AI 技術的智能算命網站。透過六爻占卜排盤，搭配 AI 大師進行專業解讀。

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Python](https://img.shields.io/badge/python-3.10+-blue.svg)
![Node.js](https://img.shields.io/badge/node.js-18+-green.svg)

## ✨ 功能特色

### 占卜系統
- 🔮 **六爻占卜**：傳統易經六爻排盤 + AI 智慧解讀
  - **[NEW] 深度邏輯解盤**：引入現實錨定 (Reality Check) 與 5 步深度分析 SOP
  - **[NEW] 完整盤面參數**：包含伏神、完整神煞（日祿、貴人）、變卦宮位
  - 逼真的擲幣動畫與視覺效果
- 🃏 **塔羅占卜**：含 78 張塔羅牌的完整牌組 + AI 專業解讀
  - **單張牌陣**：快速洞察當前狀況
  - **三張牌陣**：探索過去、現在、未來
  - **凱爾特十字牌陣**：深度分析複雜問題（10張牌）
  - 精美的牌卡圖像與翻牌動畫
  - 支援正逆位解讀
- 🌌 **紫微斗數**：專業級紫微斗數排盤與 AI 解讀
  - **完整流運推算**：支援本命、大限、小限、流年、流月、流日全盤推算
  - **AI 命理師**：基於「疊宮」與「四化」理論的深度運勢分析
  - **視覺化命盤**：清晰標示廟旺利陷、四化飛星與流運宮位重疊
  - **生辰管理**：可儲存多組生辰八字，支援真太陽時校正

### AI 與系統功能
- 🤖 **多 AI 支援**：支援 Google Gemini 和本地 AI（LM Studio、Ollama 等 OpenAI 兼容 API）
- 📜 **歷史紀錄**：完整保存占卜紀錄，支援 Markdown 渲染
- 🧠 **思考過程**：展示 AI 思考過程（可摺疊），了解解盤邏輯
- 👥 **用戶系統**：多用戶支援，管理員可管理所有用戶
- ⚙️ **AI 設定**：可新增、編輯、切換多個 AI 配置
- 📱 **響應式設計**：支援手機、平板、電腦
- ⏱️ **超時處理**：5 分鐘 AI 超時保護，可隨時取消

### 🔒 安全與建置
- 🛡️ **簡化安全機制**：移除複雜的請求簽名驗證，優化 Safari 兼容性
- 🔐 **完整安全頭部**：X-Frame-Options、CSP、XSS 保護
- ⚡ **智能重啟**：`start.sh --restart` 自動偵測前端變更並重新編譯
- 🏗️ **生產環境優化**：字型改用客戶端載入，避免建置時網路依賴

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

## 📂 目錄結構

```
AI-Divination/
├── backend/                    # 後端 (FastAPI)
│   ├── app/
│   │   ├── api/               # API 路由
│   │   │   ├── auth.py        # 認證 API
│   │   │   ├── liuyao.py      # 六爻占卜 API (前身為 divination.py)
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
│   │   ├── liuyao_system.md   # 六爻占卜核心 Prompt
│   │   ├── system_prompt_v2.md # 備用通用 Prompt
│   │   ├── tarot_system_prompt_single.md       # 單張牌 Prompt
│   │   ├── tarot_system_prompt_three_card.md   # 三張牌 Prompt
│   │   └── tarot_system_prompt_celtic_cross.md # 凱爾特十字 Prompt
│   └── requirements.txt       # Python 依賴
├── frontend/                   # 前端 (Next.js)
│   ├── public/
│   │   ├── icon.svg           # 網站圖標
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

## 📚 版本歷史

### v1.3.0 (2026-01-15) 🌌
- **紫微斗數 (Zi Wei Dou Shu) 正式上線**：
  - 新增完整 **Service Layer** 架構，支援本命、大限、小限、流年/月/日運勢推算。
  - **AI 深度解盤**：引入 `ziwei_system.md` 專家級 Prompt，支援疊宮分析、四化引動與時空錨定。
  - **互動式命盤**：前端新增可折疊、可互動的 SVG/CSS 命盤，支援亮顯流運宮位與四化。
  - **歷史紀錄優化**：歷史紀錄現在能完整還原當時的命盤狀態（包含流運時間與類型），並顯示測算者姓名。
  - **日期修正**：修復了跨時區導致的流運日期偏差問題 (Local Noon Fix)。

### v1.2.0 (2026-01-10) 🎨
- 🎨 **前端架構重構**：
  - 統一 Navbar 組件，5 個頁面共用，減少 ~300 行重複代碼
  - 新增 UI 組件庫（Button、Card、Modal、CopyButton、ShareButton）
  - 新增 AuthContext 全局認證狀態管理
- 🔍 **歷史紀錄搜尋**：支援關鍵字搜尋問題內容
- 👥 **Admin 功能強化**：
  - 用戶管理分頁（每頁 20 人）
  - 用戶篩選器可搜尋
- 🧪 **單元測試**：新增 Vitest + React Testing Library（14 項測試）
- 🔧 **修復項目**：
  - Safari 剪貼簿相容性問題（ClipboardItem + Promise 模式）
  - 過度滾動白色背景問題
  - `start.sh --restart` 自動偵測前端變更
  - `start.sh --clean-cache` 行為修正
  - 生產建置字型網路依賴問題

### v1.1.0 (2026-01-08) ☯️
- 🎨 **品牌升級**：正式更名為「玄覺空間」，啟用全新太極八卦圖標。
- 🛡️ **安全核心重構**：
  - 修復 API 簽名驗證與 CORS 問題。
  - 實施 HMAC-SHA256 請求驗證與來源白名單。
- 🔮 **六爻系統增強**：
  - **SOP 導入**：新增「現實錨定」與 5 步深度解盤流程。
  - **數據深化**：支援伏神、變卦宮位、完整神煞（日祿/貴人）計算。
  - **醫療警示**：優化健康類問題的吉凶判斷邏輯。

### v1.0.1 (2026-01-05) ✨
*原 v5.1*
- ✨ **塔羅占卜上線**：78 張牌完整系統、3 種牌陣（單張/三張/凱爾特十字）。
- ✨ **AI Prompt 優化**：針對不同牌陣提供專屬 AI 指引。

### v1.0.0 (2025-12-29) 🚀
*原 v5.0*
- 🔄 **全新架構**：Next.js + FastAPI 前後端分離重構。
- ✨ **核心功能**：六爻擲幣動畫、多 AI 切換、思考過程摺疊、歷史紀錄。

## ✅ 已完成功能
- [x] 六爻占卜核心功能 (含深度邏輯解盤)
- [x] 塔羅占卜系統（78 張完整牌組）
- [x] 紫微斗數系統 (完整流運推算)
- [x] 用戶認證系統
- [x] AI 服務整合（Gemini + Local）
- [x] 歷史紀錄 + Markdown 渲染
- [x] AI 思考過程顯示
- [x] 3D 擲幣動畫
- [x] API 安全機制 (HMAC/CORS)

## 🚀 規劃中功能
- [ ] 更多塔羅牌陣類型
- [ ] 八字命盤 (Coming Soon)
- [ ] 流年運勢整合報表
- [ ] Docker 部署支援

## 🔗 相關文檔

- 📖 [API 安全機制詳細文檔](docs/API_SECURITY.md)
- 🚀 [安全配置快速指南](docs/SECURITY_QUICKSTART.md)

## 🤝 貢獻

歡迎提交 Issue 和 Pull Request！

## 📄 授權

MIT License

## 🙏 致謝

- [六爻排盤算法](https://github.com/ichingtao/ichingshifa) - 六爻排盤核心
- [Google Gemini](https://ai.google.dev/) - AI 服務
- [Next.js](https://nextjs.org/) - React 框架
- [FastAPI](https://fastapi.tiangolo.com/) - Python API 框架
