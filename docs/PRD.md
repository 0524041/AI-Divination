# AI 算命網頁 - 產品需求文件 (PRD)

## 1. 專案概述

### 1.1 專案名稱
AI-Divination (AI 算命網頁)

### 1.2 專案目標
建立一個結合 AI 進行解盤的算命網頁，初期支援六爻占卜功能，未來可擴展其他算命類型（紫微斗數、流年等）。

### 1.3 核心理念
- **MVP 最小可行產品**：先驗證核心功能，再逐步擴展
- **模組化設計**：預留擴展框架，便於新增算命類型
- **輕量化 & 安全**：注重資安風險，API Key 加密存儲

---

## 2. 系統架構

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (React/Next.js)              │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌────────┐ │
│  │  首頁   │ │ 六爻頁  │ │歷史紀錄 │ │  設定   │ │  登入  │ │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │ API
┌─────────────────────────────────────────────────────────────┐
│                     Backend (FastAPI/Python)                 │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────┐ │
│  │   Auth API   │ │ Divination   │ │      AI Service      │ │
│  │  (JWT/用戶)  │ │   Service    │ │ (Gemini/Local AI)    │ │
│  └──────────────┘ └──────────────┘ └──────────────────────┘ │
│  ┌──────────────┐ ┌──────────────┐                          │
│  │  History API │ │ Settings API │                          │
│  └──────────────┘ └──────────────┘                          │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                      SQLite Database                         │
│  ┌────────┐ ┌──────────┐ ┌────────────┐ ┌────────────────┐  │
│  │ users  │ │ settings │ │  history   │ │ ai_configs     │  │
│  └────────┘ └──────────┘ └────────────┘ └────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. 功能規格

### 3.1 頁面結構

#### 3.1.1 登入頁面 `/login`
- **首次登入流程**：
  - 檢測是否有 admin 帳戶
  - 若無，引導創建 admin 帳戶（帳號固定 `admin`，密碼自訂）
- **一般登入**：帳號密碼登入
- **註冊帳號**：一般用戶註冊

#### 3.1.2 算命首頁 `/`
- 卡片式選擇算命類型
- 目前可用：**六爻占卜**
- Coming Soon：紫微斗數、八字命盤、流年運勢等

#### 3.1.3 六爻占卜頁面 `/liuyao`
- **子頁面**：
  - 主頁（算卦流程）
  - 說明（六爻介紹）
  - 教學（操作指南）
- **算卦流程**：
  1. 選擇 AI 智能體（需先在設定頁配置）
  2. 選擇性別（男/女）
  3. 選擇算命對象（自己/父母/朋友/對方）
  4. 填寫具體問題
  5. 送出 → 後端擲硬幣 → 排盤 → AI 解盤
  6. 前端動畫展示 + 等待結果

#### 3.1.4 歷史紀錄頁面 `/history`
- 顯示欄位：時間、算命類型、盤面內容、AI 解盤、使用的 AI
- 功能：複製內容、刪除紀錄
- **Admin 專屬**：查看所有用戶紀錄，可依用戶篩選
- Markdown 解析呈現

#### 3.1.5 設定頁面 `/settings`
- **AI 設定**：
  - Gemini API Key（加密存儲）
  - Local AI URL + 模型選擇 + 測試連線
- **用戶設定**：
  - 修改密碼（兩次確認）
- **管理用戶**（Admin 限定）：
  - 新增/刪除用戶
  - 調整用戶權限
- **登出**

---

### 3.2 API 規格

#### Auth API
| Method | Endpoint | 說明 |
|--------|----------|------|
| POST | `/api/auth/init` | 初始化 admin 帳戶 |
| POST | `/api/auth/register` | 註冊一般用戶 |
| POST | `/api/auth/login` | 登入取得 JWT |
| POST | `/api/auth/logout` | 登出 |
| PUT | `/api/auth/password` | 修改密碼 |
| GET | `/api/auth/check-init` | 檢查是否已初始化 |

#### User Management API (Admin)
| Method | Endpoint | 說明 |
|--------|----------|------|
| GET | `/api/admin/users` | 取得所有用戶 |
| POST | `/api/admin/users` | 新增用戶 |
| DELETE | `/api/admin/users/{id}` | 刪除用戶 |
| PUT | `/api/admin/users/{id}/role` | 修改用戶權限 |

#### Settings API
| Method | Endpoint | 說明 |
|--------|----------|------|
| GET | `/api/settings` | 取得用戶設定 |
| PUT | `/api/settings/ai` | 更新 AI 設定 |
| POST | `/api/settings/ai/test` | 測試 AI 連線 |

#### Divination API
| Method | Endpoint | 說明 |
|--------|----------|------|
| POST | `/api/divination/liuyao` | 六爻占卜 |
| POST | `/api/divination/cancel` | 取消占卜 |

#### History API
| Method | Endpoint | 說明 |
|--------|----------|------|
| GET | `/api/history` | 取得歷史紀錄 |
| GET | `/api/history/{id}` | 取得單筆紀錄 |
| DELETE | `/api/history/{id}` | 刪除紀錄 |
| GET | `/api/admin/history` | Admin 取得所有紀錄 |

---

### 3.3 資料庫結構

```sql
-- 用戶表
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'user',  -- 'admin' | 'user'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- AI 設定表
CREATE TABLE ai_configs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    provider TEXT NOT NULL,  -- 'gemini' | 'local'
    api_key_encrypted TEXT,  -- Gemini API Key (加密)
    local_url TEXT,          -- Local AI URL
    local_model TEXT,        -- Local AI Model
    is_active BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 歷史紀錄表
CREATE TABLE history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    divination_type TEXT NOT NULL,  -- 'liuyao' | 'ziwei' | ...
    question TEXT NOT NULL,
    gender TEXT,
    target TEXT,
    chart_data TEXT NOT NULL,       -- JSON: 盤面數據
    interpretation TEXT,            -- AI 解盤結果
    ai_provider TEXT,
    ai_model TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

---

## 4. 技術棧

### 4.1 Frontend
- **框架**: Next.js 14+ (React)
- **UI 庫**: Tailwind CSS + shadcn/ui
- **狀態管理**: React Context
- **HTTP**: Fetch API
- **Markdown**: marked + DOMPurify

### 4.2 Backend
- **框架**: FastAPI (Python 3.11+)
- **資料庫**: SQLite + SQLAlchemy
- **認證**: JWT (python-jose)
- **加密**: cryptography (Fernet)
- **農曆計算**: lunar-python

### 4.3 AI 服務
- **Gemini**: Google AI API
- **Local AI**: OpenAI 兼容端點

---

## 5. 開發計劃

### Phase 1: 基礎架構 (MVP)
1. [ ] 專案結構初始化
2. [ ] 資料庫初始化腳本
3. [ ] 用戶認證系統 (登入/註冊/JWT)
4. [ ] 基礎 API 路由

### Phase 2: 六爻功能
5. [ ] 六爻排盤核心演算法
6. [ ] 擲硬幣演算法
7. [ ] AI 服務整合
8. [ ] System Prompt 模板

### Phase 3: 前端頁面
9. [ ] 登入/註冊頁面
10. [ ] 首頁（算命類型選擇）
11. [ ] 六爻占卜頁面
12. [ ] 歷史紀錄頁面
13. [ ] 設定頁面

### Phase 4: 進階功能
14. [ ] Admin 用戶管理
15. [ ] 取消占卜功能
16. [ ] 動畫效果優化

---

## 6. 參考資源

### 6.1 可複用的舊程式碼
備份位置: `_backup_v2_20251229_160729/`

1. **六爻排盤演算法**: `backend/app/services/divination_core.py`
2. **格式化輸出**: `backend/app/services/divination_core.py` 中的 `to_dict()` 和 format 相關
3. **System Prompt**: `backend/prompts/system_prompt.md`
4. **MD 解析**: `frontend/src/components/DivinationResult.tsx`
5. **擲硬幣**: `backend/app/services/divination_core.py` 中的 `coins_to_yao()`

---

## 7. 啟動腳本規格

`start.sh` 需要：
1. 檢查 Python 版本
2. 創建/啟用虛擬環境
3. 安裝 Python 依賴
4. 初始化資料庫
5. 檢查 Node.js 版本
6. 安裝前端依賴
7. 啟動後端服務
8. 啟動前端服務
