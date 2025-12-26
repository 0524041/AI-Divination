# 🔮 靈機一動 - AI 易經占卜系統 

**AI Divination App** - 結合現代 AI 技術與傳統六爻占卜的智慧算卦系統

![Home Page Screenshot](img/homepage_screenshot.png)

## ✨ V2.0 重大更新

### 🎨 全新前端架構
- **Next.js 16 + React** - 現代化單頁應用
- **shadcn/ui** - 精美 UI 元件庫
- **Tailwind CSS v4** - 原子化 CSS
- **響應式側邊欄** - 簡潔導航設計
- **玻璃擬態設計** - 深色主題 + 金色點綴

### 🧠 AI 功能
- **Google Gemini** - 雲端 AI 解卦 (gemini-3-flash-preview + high thinking)
- **本地 LLM** - 支援 OpenAI 兼容 API (預設)
- **思維過程可視化** - 展開/收合 AI 思考過程
- **模型追蹤** - 顯示占卜使用的 AI 模型、歷史記錄保存模型名稱

### 👥 多用戶系統
- 用戶註冊/登入（密碼確認功能）
- 管理員後台（新增用戶密碼確認）
- 獨立歷史記錄
- API Key 管理

---

## 📁 專案結構

```
AI-Divination/
├── backend/                    # 後端模組 (Python 標準結構)
│   ├── app/
│   │   ├── api/               # API 藍圖
│   │   ├── core/              # 核心配置
│   │   │   ├── config.py      # 應用配置
│   │   │   └── database.py    # 資料庫操作
│   │   ├── models/            # 資料模型
│   │   │   ├── user.py        # 用戶模型
│   │   │   ├── history.py     # 歷史記錄
│   │   │   └── settings.py    # 系統設定
│   │   ├── services/          # 業務邏輯
│   │   │   ├── ai.py          # AI 服務 (Gemini/Local)
│   │   │   ├── divination.py  # 占卜計算
│   │   │   └── divination_core.py  # 六爻排盤核心
│   │   ├── utils/             # 工具函數
│   │   │   └── auth.py        # 認證裝飾器
│   │   └── routes.py          # API 路由
│   ├── prompts/               # AI Prompt 模板
│   │   └── system_prompt.md
│   └── run.py                 # 後端啟動入口
│
├── frontend/                   # 前端應用 (Next.js)
│   ├── src/
│   │   ├── app/               # 頁面路由
│   │   │   ├── page.tsx       # 首頁 (六爻占卜)
│   │   │   ├── history/       # 歷史記錄
│   │   │   ├── settings/      # 設定頁面
│   │   │   └── admin/         # 管理員頁面
│   │   ├── components/        # React 元件
│   │   │   ├── AppLayout.tsx  # 主佈局
│   │   │   ├── AppSidebar.tsx # 側邊欄
│   │   │   ├── LiuYaoPage.tsx # 六爻主頁面
│   │   │   ├── DivinationResult.tsx  # 占卜結果
│   │   │   ├── AuthForm.tsx   # 登入/註冊表單
│   │   │   └── ui/            # shadcn/ui 元件
│   │   ├── contexts/          # React Context
│   │   ├── lib/               # 工具函數
│   │   └── types/             # TypeScript 類型定義
│   └── package.json
│
├── _legacy_backup/            # 舊版檔案備份
├── docs/                       # 專案文件
├── start.sh                    # 一鍵啟動腳本
└── README.md
```

---

## 🚀 快速開始

### 系統需求
- Python 3.10+
- Node.js 18+
- npm 或 pnpm

### 1. 安裝與啟動

```bash
# 克隆專案
git clone <repo-url>
cd AI-Divination

# 一鍵啟動 (自動安裝依賴)
chmod +x start.sh
./start.sh
```

### 2. 訪問應用

- **前端**: http://localhost:3000
- **後端 API**: http://localhost:8080

### 3. 預設帳號

```
用戶名: admin
密碼: admin123
```

---

## 🔧 設定說明

### AI 模型設定

進入「設定」頁面可以選擇：

| 設定項 | 說明 |
|--------|------|
| **AI 提供者** | `local` (預設) 或 `gemini` |
| **Local API URL** | 本地 LLM 服務地址 (預設: `http://localhost:1234/v1`) |
| **Local Model** | 模型名稱 (預設: `qwen/qwen3-8b`) |
| **Gemini API Key** | 使用 Gemini 時需要填入 |

> **目前 AI 模型**
> - Gemini: `gemini-3-flash-preview` (high thinking mode)
> - Local: 可自定義 (預設 `qwen/qwen3-8b`)

占卜頁面會顯示當前使用的 AI 模型，歷史記錄也會保存使用的模型名稱。

### 本地 AI 設定

推薦使用 [LM Studio](https://lmstudio.ai/) 或 [Ollama](https://ollama.ai/) 運行本地模型：

```bash
# LM Studio - 啟動後選擇模型，開啟 Local Server (port 1234)

# Ollama
ollama run qwen2.5:7b
```

---

## 🛡️ 功能特色

### 六爻占卜
- 🎲 互動式搖卦動畫
- 📊 專業六爻排盤
- 🧠 AI 智能解卦
- 📝 思維過程可視化

### 歷史記錄
- 📂 查看過往占卜
- ⭐ 收藏重要記錄
- 📋 複製為 Markdown
- 🗑️ 刪除記錄

### 管理功能 (Admin)
- 👥 用戶管理
- 📊 查看所有用戶歷史
- ⚙️ 系統設定

---

## 📡 API 端點

| 方法 | 路徑 | 說明 |
|------|------|------|
| POST | `/api/login` | 用戶登入 |
| POST | `/api/logout` | 用戶登出 |
| POST | `/api/register` | 用戶註冊 |
| GET | `/api/current-user` | 獲取當前用戶 |
| POST | `/api/divinate` | 執行占卜 |
| GET | `/api/history` | 獲取歷史記錄 |
| PUT | `/api/history/:id/favorite` | 切換收藏 |
| DELETE | `/api/history/:id` | 刪除記錄 |
| GET/POST | `/api/settings` | 系統設定 |
| GET | `/api/admin/users` | 用戶列表 (Admin) |

---

## 🔄 更新日誌

### v2.2.0 (2025-12-26)
**🔒 安全性增強**
- ✨ SECRET_KEY 和 ENCRYPTION_KEY 持久化存儲（避免重啟後 session 失效）
- ✨ Session Cookie 加入 SameSite=Lax 防護 CSRF 攻擊
- ✨ 生產環境自動啟用 Secure Cookie
- ✨ `/api/settings` POST 操作需要管理員權限
- ✨ 歷史記錄刪除增加權限檢查（只能刪除自己的記錄）
- 🔧 API Key 加密金鑰使用一致的來源

**🛠️ 性能修復**
- ✨ Local AI 連線測試功能（可獲取模型列表）
- ✨ 設定頁面新增模型下拉選單
- ✨ 占卜過程可取消
- 🐛 修復 CoinTossing useEffect cleanup 導致 AI 請求無法發出的問題
- 🐛 修復中文輸入法 Enter 鍵誤觸發送出的問題
- 🐛 修復 macOS 上的 semaphore 洩漏警告

**📖 使用說明**
- ✨ Gemini 使用小技巧：API 配額限制說明

### v2.1.0 (2025-06-XX)
**🛠️ 功能增強**
- ✨ 占卜頁面顯示當前 AI 模型
- ✨ 歷史記錄保存並顯示使用的 AI 模型
- ✨ 註冊/管理員新增用戶需輸入兩次密碼確認
- 🔧 Gemini 模型更新為 `gemini-3-flash-preview` (high thinking)
- 🔧 後端重構為標準 Python 專案結構
- 🔧 側邊欄導航簡化

### v2.0.0 (2025-12-26)
**🎨 前端大改版**
- ✨ 全新 Next.js + React 前端
- ✨ shadcn/ui 側邊欄
- ✨ 歷史記錄 Markdown 渲染
- ✨ AI 思考過程折疊顯示
- 🔧 修復 is_favorite 顯示問題

### v0.4.0 (2024-12-24)
- ✨ 多用戶系統
- ✨ Admin 管理面板
- ✨ 雙 AI 模型支援

### v0.3.0
- 空靈玄學 UI 主題
- 歷史記錄管理

### v0.2.0
- 基礎占卜功能
- Gemini AI 整合

---

## 🛠️ 技術棧

| 類型 | 技術 |
|------|------|
| **前端** | Next.js 16, React 19, TypeScript, Tailwind CSS v4 |
| **UI 庫** | shadcn/ui, Lucide Icons |
| **後端** | Flask, SQLite |
| **AI** | Google Gemini, OpenAI Compatible API |
| **占卜** | lunar-python (農曆計算) |

---

## 📜 License

MIT License

---

## 🙏 鳴謝

- [shadcn/ui](https://ui.shadcn.com/) - 精美 React 元件
- [lunar-python](https://github.com/6tail/lunar-python) - 農曆計算庫
- [Google Gemini](https://ai.google.dev/) - AI 解卦服務
