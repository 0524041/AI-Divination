#!/bin/bash

# ============================================
# AI-Divination V2 啟動腳本
# 同時啟動 Flask 後端 (8080) + Next.js 前端 (3000)
# ============================================

set -e

# 顏色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 獲取腳本所在目錄的絕對路徑
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# PID 文件
BACKEND_PID_FILE="$SCRIPT_DIR/.backend.pid"
FRONTEND_PID_FILE="$SCRIPT_DIR/.frontend.pid"

# 清理函數：正確釋放資源
cleanup() {
    echo ""
    echo -e "${YELLOW}🛑 正在關閉服務...${NC}"
    
    # 關閉後端
    if [ -f "$BACKEND_PID_FILE" ]; then
        BACKEND_PID=$(cat "$BACKEND_PID_FILE")
        if kill -0 "$BACKEND_PID" 2>/dev/null; then
            echo -e "${BLUE}  → 關閉後端 (PID: $BACKEND_PID)${NC}"
            kill "$BACKEND_PID" 2>/dev/null || true
            # 等待進程結束
            wait "$BACKEND_PID" 2>/dev/null || true
        fi
        rm -f "$BACKEND_PID_FILE"
    fi
    
    # 關閉前端
    if [ -f "$FRONTEND_PID_FILE" ]; then
        FRONTEND_PID=$(cat "$FRONTEND_PID_FILE")
        if kill -0 "$FRONTEND_PID" 2>/dev/null; then
            echo -e "${BLUE}  → 關閉前端 (PID: $FRONTEND_PID)${NC}"
            kill "$FRONTEND_PID" 2>/dev/null || true
            # 等待進程結束
            wait "$FRONTEND_PID" 2>/dev/null || true
        fi
        rm -f "$FRONTEND_PID_FILE"
    fi
    
    # 確保殺死所有相關進程
    pkill -f "uv run server.py" 2>/dev/null || true
    pkill -f "next dev" 2>/dev/null || true
    
    echo -e "${GREEN}✅ 所有服務已關閉${NC}"
    exit 0
}

# 捕獲信號
trap cleanup SIGINT SIGTERM EXIT

# 打印 Banner
echo -e "${YELLOW}"
echo "╔═══════════════════════════════════════════╗"
echo "║     🔮 靈機一動 - AI Divination V2 🔮     ║"
echo "║         易經占卜 · 洞察天機               ║"
echo "╚═══════════════════════════════════════════╝"
echo -e "${NC}"

# 檢查必要目錄
if [ ! -d "frontend" ]; then
    echo -e "${RED}❌ 錯誤：找不到 frontend 目錄${NC}"
    echo "   請確保 Next.js 前端已正確設置"
    exit 1
fi

# 檢查環境
echo -e "${BLUE}📦 檢查環境...${NC}"

# 檢查 uv
if ! command -v uv &> /dev/null; then
    echo -e "${RED}❌ 未找到 uv，請先安裝: curl -LsSf https://astral.sh/uv/install.sh | sh${NC}"
    exit 1
fi
echo -e "${GREEN}   ✓ uv 已安裝${NC}"

# 檢查 Node.js
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ 未找到 npm，請先安裝 Node.js${NC}"
    exit 1
fi
echo -e "${GREEN}   ✓ npm 已安裝${NC}"

echo ""

# ====== Python 環境設置 ======
echo -e "${BLUE}🐍 設置 Python 環境...${NC}"

# 使用 uv sync 確保虛擬環境和依賴正確
if [ -f "pyproject.toml" ]; then
    echo -e "   → 同步 Python 依賴..."
    uv sync --quiet
    echo -e "${GREEN}   ✓ Python 依賴已同步${NC}"
fi

# ====== 資料庫初始化 ======
echo -e "${BLUE}🗄️  檢查資料庫...${NC}"

# 執行資料庫遷移（如果 users 表不存在）
if [ -f "divination.db" ]; then
    # 檢查 users 表是否存在
    USER_TABLE_EXISTS=$(sqlite3 divination.db "SELECT name FROM sqlite_master WHERE type='table' AND name='users';" 2>/dev/null || echo "")
    if [ -z "$USER_TABLE_EXISTS" ]; then
        echo -e "   → 執行資料庫遷移..."
        if [ -f "migrations/001_add_users.sql" ]; then
            sqlite3 divination.db < migrations/001_add_users.sql
            echo -e "${GREEN}   ✓ 資料庫遷移完成${NC}"
        fi
    else
        echo -e "${GREEN}   ✓ 資料庫結構正常${NC}"
    fi
else
    echo -e "   → 資料庫將在首次啟動時創建"
fi

# ====== 前端依賴 ======
echo -e "${BLUE}📦 檢查前端依賴...${NC}"

if [ ! -d "frontend/node_modules" ]; then
    echo -e "   → 安裝前端依賴 (首次可能需要較長時間)..."
    cd frontend && npm install --silent && cd ..
    echo -e "${GREEN}   ✓ 前端依賴安裝完成${NC}"
else
    echo -e "${GREEN}   ✓ 前端依賴已存在${NC}"
fi

echo ""
echo -e "${GREEN}✅ 環境檢查全部通過${NC}"
echo ""

# 啟動後端
echo -e "${BLUE}🚀 啟動後端服務 (Port 8080)...${NC}"
uv run server.py &
BACKEND_PID=$!
echo "$BACKEND_PID" > "$BACKEND_PID_FILE"
echo -e "${GREEN}   ✓ 後端已啟動 (PID: $BACKEND_PID)${NC}"

# 等待後端啟動
sleep 2

# 檢查後端是否成功啟動
if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
    echo -e "${RED}❌ 後端啟動失敗${NC}"
    cleanup
    exit 1
fi

# 啟動前端
echo -e "${BLUE}🚀 啟動前端服務 (Port 3000)...${NC}"
cd frontend && npm run dev &
FRONTEND_PID=$!
echo "$FRONTEND_PID" > "$FRONTEND_PID_FILE"
cd ..
echo -e "${GREEN}   ✓ 前端已啟動 (PID: $FRONTEND_PID)${NC}"

# 等待前端啟動
sleep 3

echo ""
echo -e "${GREEN}═══════════════════════════════════════════${NC}"
echo -e "${GREEN}🎉 服務已全部啟動！${NC}"
echo ""
echo -e "   ${YELLOW}前端地址:${NC} http://localhost:3000"
echo -e "   ${YELLOW}後端地址:${NC} http://localhost:8080"
echo ""
echo -e "${BLUE}   按 Ctrl+C 關閉所有服務${NC}"
echo -e "${GREEN}═══════════════════════════════════════════${NC}"
echo ""

# 等待進程
wait
