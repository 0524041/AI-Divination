#!/bin/bash

# ============================================
# AI-Divination 啟動腳本
# 使用 uv 進行 Python 版本管理和虛擬環境
# ============================================

# 顏色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 專案路徑
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"
VENV_DIR="$BACKEND_DIR/.venv"
DB_FILE="$BACKEND_DIR/divination.db"

# Python 版本要求 (使用 uv 管理)
PYTHON_VERSION="3.10"

# ============================================
# 顯示幫助信息
# ============================================
show_help() {
    echo -e "${BLUE}============================================${NC}"
    echo -e "${BLUE}       AI-Divination 啟動程序${NC}"
    echo -e "${BLUE}============================================${NC}"
    echo ""
    echo -e "${YELLOW}用法:${NC} ./start.sh [選項]"
    echo ""
    echo -e "${YELLOW}選項:${NC}"
    echo -e "  ${GREEN}(無參數)${NC}        正常啟動服務"
    echo -e "  ${GREEN}--reset${NC}         重置資料庫 (清空所有資料回到初始狀態)"
    echo -e "  ${GREEN}--clean-cache${NC}   清理所有快取 (包含 __pycache__, .next, node_modules/.cache)"
    echo -e "  ${GREEN}--stop${NC}          停止所有服務"
    echo -e "  ${GREEN}--restart${NC}       重啟所有服務"
    echo -e "  ${GREEN}--status${NC}        查看服務狀態"
    echo -e "  ${GREEN}--logs [-f]${NC}     查看服務日誌 (-f 可動態追蹤)"
    echo -e "  ${GREEN}--install${NC}       只安裝依賴，不啟動服務"
    echo -e "  ${GREEN}--build${NC}         強制重新構建前端後啟動"
    echo -e "  ${GREEN}--build only${NC}    只構建前端，不啟動服務"
    echo -e "  ${GREEN}--optimize-db${NC}   優化資料庫 (創建索引、ANALYZE、VACUUM)"
    echo -e "  ${GREEN}--dev${NC}           開發模式 (前端 npm run dev + 後端 uvicorn --reload)"
    echo -e "  ${GREEN}--help, -h${NC}      顯示此幫助信息"
    echo ""
    echo -e "${YELLOW}範例:${NC}"
    echo -e "  ./start.sh              # 啟動服務 (自動檢測是否需要構建)"
    echo -e "  ./start.sh --build      # 強制重新構建前端後啟動"
    echo -e "  ./start.sh --build only # 只構建前端 (不啟動)"
    echo -e "  ./start.sh --dev        # 開發模式 (有熱重載)"
    echo -e "  ./start.sh --reset      # 重置資料庫後啟動"
    echo -e "  ./start.sh --clean-cache # 清理快取後啟動"
    echo -e "  ./start.sh --optimize-db # 優化資料庫"
    echo -e "  ./start.sh --stop       # 停止服務"
    echo ""
}

# ============================================
# 重置資料庫
# ============================================
reset_database() {
    echo -e "\n${YELLOW}[重置] 清空資料庫...${NC}"
    
    if [ -f "$DB_FILE" ]; then
        rm -f "$DB_FILE"
        echo -e "${GREEN}✓ 已刪除資料庫檔案${NC}"
    else
        echo -e "${CYAN}ℹ 資料庫檔案不存在${NC}"
    fi
    
    # 刪除加密金鑰 (重置後需要重新初始化)
    rm -f "$BACKEND_DIR/.secret_key" 2>/dev/null
    rm -f "$BACKEND_DIR/.encryption_key" 2>/dev/null
    echo -e "${GREEN}✓ 已清除金鑰檔案${NC}"
    
    echo -e "${GREEN}✓ 資料庫重置完成，下次啟動時將重新初始化${NC}"
}

# ============================================
# 清理快取
# ============================================
clean_cache() {
    echo -e "\n${YELLOW}[清理] 清除所有快取...${NC}"
    
    # 清理 Python 快取
    find "$BACKEND_DIR" -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
    find "$BACKEND_DIR" -type f -name "*.pyc" -delete 2>/dev/null || true
    find "$BACKEND_DIR" -type f -name "*.pyo" -delete 2>/dev/null || true
    echo -e "${GREEN}✓ Python 快取已清除${NC}"
    
    # 清理 Next.js 快取
    if [ -d "$FRONTEND_DIR/.next" ]; then
        rm -rf "$FRONTEND_DIR/.next"
        echo -e "${GREEN}✓ Next.js 快取已清除${NC}"
    fi
    
    # 清理 node_modules 快取
    if [ -d "$FRONTEND_DIR/node_modules/.cache" ]; then
        rm -rf "$FRONTEND_DIR/node_modules/.cache"
        echo -e "${GREEN}✓ Node.js 快取已清除${NC}"
    fi
    
    # 清理日誌檔案
    rm -f "$PROJECT_DIR/backend.log" 2>/dev/null
    rm -f "$PROJECT_DIR/frontend.log" 2>/dev/null
    echo -e "${GREEN}✓ 日誌檔案已清除${NC}"
    
    echo -e "${GREEN}✓ 所有快取清理完成${NC}"
}

# ============================================
# 停止服務（優化版：分層停止 + 端口確認）
# ============================================
stop_services() {
    echo -e "\n${YELLOW}[停止] 正在停止所有服務...${NC}"
    
    local BACKEND_STOPPED=false
    local FRONTEND_STOPPED=false
    
    # Step 1: 優雅停止 (SIGTERM)
    if pgrep -f "uvicorn app.main:app" > /dev/null 2>&1; then
        pkill -TERM -f "uvicorn app.main:app" 2>/dev/null
    else
        BACKEND_STOPPED=true
        echo -e "${CYAN}ℹ 後端服務未運行${NC}"
    fi
    
    if pgrep -f "next-server|next dev|next start" > /dev/null 2>&1; then
        pkill -TERM -f "next-server" 2>/dev/null
        pkill -TERM -f "next dev" 2>/dev/null
        pkill -TERM -f "next start" 2>/dev/null
    else
        FRONTEND_STOPPED=true
        echo -e "${CYAN}ℹ 前端服務未運行${NC}"
    fi
    
    # Step 2: 等待優雅退出
    if [ "$BACKEND_STOPPED" = false ] || [ "$FRONTEND_STOPPED" = false ]; then
        echo -e "${CYAN}等待進程優雅退出...${NC}"
        sleep 2
    fi
    
    # Step 3: 確認後端停止
    if [ "$BACKEND_STOPPED" = false ]; then
        if pgrep -f "uvicorn app.main:app" > /dev/null 2>&1; then
            echo -e "${YELLOW}⚠ 後端進程未完全停止，強制終止...${NC}"
            pkill -9 -f "uvicorn app.main:app" 2>/dev/null
            sleep 1
        fi
        
        if ! pgrep -f "uvicorn app.main:app" > /dev/null 2>&1; then
            echo -e "${GREEN}✓ 後端服務已停止${NC}"
        else
            echo -e "${RED}✗ 後端服務停止失敗${NC}"
        fi
    fi
    
    # Step 4: 確認前端停止
    if [ "$FRONTEND_STOPPED" = false ]; then
        if pgrep -f "next-server|next dev|next start" > /dev/null 2>&1; then
            echo -e "${YELLOW}⚠ 前端進程未完全停止，強制終止...${NC}"
            pkill -9 -f "next-server" 2>/dev/null
            pkill -9 -f "next dev" 2>/dev/null
            pkill -9 -f "next start" 2>/dev/null
            sleep 1
        fi
        
        if ! pgrep -f "next-server|next dev|next start" > /dev/null 2>&1; then
            echo -e "${GREEN}✓ 前端服務已停止${NC}"
        else
            echo -e "${RED}✗ 前端服務停止失敗${NC}"
        fi
    fi
    
    # Step 5: 確保端口已釋放
    local PORT_ISSUES=false
    for port in 3000 8000; do
        if lsof -ti:$port > /dev/null 2>&1; then
            echo -e "${YELLOW}端口 $port 仍被占用，強制釋放...${NC}"
            lsof -ti:$port | xargs kill -9 2>/dev/null || true
            PORT_ISSUES=true
        fi
    done
    
    if [ "$PORT_ISSUES" = true ]; then
        sleep 1
    fi
    
    # 最終確認
    local FINAL_OK=true
    for port in 3000 8000; do
        if lsof -ti:$port > /dev/null 2>&1; then
            echo -e "${RED}✗ 端口 $port 仍被占用${NC}"
            FINAL_OK=false
        fi
    done
    
    if [ "$FINAL_OK" = true ]; then
        echo -e "${GREEN}✓ 服務停止完成，端口已釋放${NC}"
    else
        echo -e "${YELLOW}⚠ 請手動執行: killall -9 node; killall -9 python${NC}"
    fi
}

# ============================================
# 清理進程並釋放端口
# ============================================
cleanup_processes_and_ports() {
    echo "清理殘留進程..."
    pkill -f "uvicorn app.main:app" 2>/dev/null || true
    pkill -f "next-server" 2>/dev/null || true
    pkill -f "next dev" 2>/dev/null || true
    pkill -f "next start" 2>/dev/null || true
    
    sleep 2
    
    # 檢查端口並強制釋放
    for port in 3000 8000; do
        if lsof -ti:$port > /dev/null 2>&1; then
            echo -e "${YELLOW}端口 $port 仍被占用，強制釋放...${NC}"
            lsof -ti:$port | xargs kill -9 2>/dev/null || true
            sleep 1
        fi
    done
}

# ============================================
# 重啟服務（自動檢測前端變更並重新構建）
# ============================================
restart_services() {
    echo -e "\n${YELLOW}[重啟] 正在重啟所有服務...${NC}"
    
    # 停止服務
    stop_services
    sleep 2
    
    # 檢查前端是否需要重新構建
    cd "$FRONTEND_DIR"
    FRONTEND_CHANGED=false
    
    if [ ! -d ".next" ] || [ ! -f ".next/BUILD_ID" ]; then
        echo -e "${YELLOW}未找到構建目錄，需要重新構建${NC}"
        FRONTEND_CHANGED=true
    else
        # 比較 src 目錄最新修改時間與 .next/BUILD_ID 時間
        BUILD_TIME=$(stat -f "%m" .next/BUILD_ID 2>/dev/null || echo "0")
        
        # 找出所有原始碼檔案中最新的修改時間
        NEWEST_SRC=0
        while IFS= read -r file; do
            FILE_TIME=$(stat -f "%m" "$file" 2>/dev/null || echo "0")
            if [ "$FILE_TIME" -gt "$NEWEST_SRC" ]; then
                NEWEST_SRC=$FILE_TIME
            fi
        done < <(find src -type f \( -name "*.tsx" -o -name "*.ts" -o -name "*.css" -o -name "*.json" \) 2>/dev/null)
        
        if [ "$NEWEST_SRC" -gt "$BUILD_TIME" ]; then
            echo -e "${YELLOW}檢測到前端原始碼比構建更新 (最新: $(date -r $NEWEST_SRC '+%Y-%m-%d %H:%M:%S'), 構建: $(date -r $BUILD_TIME '+%Y-%m-%d %H:%M:%S'))${NC}"
            FRONTEND_CHANGED=true
        fi
    fi
    
    if [ "$FRONTEND_CHANGED" = true ]; then
        echo -e "${CYAN}正在重新構建前端...${NC}"
        npm run build
        if [ $? -ne 0 ]; then
            echo -e "${RED}✗ 前端構建失敗${NC}"
            exit 1
        fi
        echo -e "${GREEN}✓ 前端重新構建完成${NC}"
    else
        echo -e "${GREEN}✓ 前端無變更，使用現有構建${NC}"
    fi
    
    # 啟動服務
    cd "$PROJECT_DIR"
    start_services
}

# ============================================
# 查看服務狀態
# ============================================
show_status() {
    echo -e "\n${BLUE}============================================${NC}"
    echo -e "${BLUE}       服務狀態${NC}"
    echo -e "${BLUE}============================================${NC}"
    
    # 檢查後端
    if pgrep -f "uvicorn app.main:app" > /dev/null; then
        BACKEND_PID=$(pgrep -f "uvicorn app.main:app")
        echo -e "後端服務: ${GREEN}運行中${NC} (PID: $BACKEND_PID)"
    else
        echo -e "後端服務: ${RED}未運行${NC}"
    fi
    
    # 檢查前端
    if pgrep -f "next-server|next dev|next start" > /dev/null; then
        FRONTEND_PID=$(pgrep -f "next-server|next dev|next start")
        echo -e "前端服務: ${GREEN}運行中${NC} (PID: $FRONTEND_PID)"
    else
        echo -e "前端服務: ${RED}未運行${NC}"
    fi
    
    echo -e "${BLUE}============================================${NC}"
}

# 查看日誌
# ============================================
show_logs() {
    local FOLLOW=""
    if [ "$1" == "-f" ]; then
        FOLLOW="-f"
        echo -e "\n${YELLOW}[日誌] 正在動態追蹤日誌 (按 Ctrl+C 退出)...${NC}"
    else
        echo -e "\n${BLUE}============================================${NC}"
        echo -e "${BLUE}       最近服務日誌 (最後 50 行)${NC}"
        echo -e "${BLUE}============================================${NC}"
        echo -e "${CYAN}完整日誌檔案位於: $PROJECT_DIR/backend.log, frontend.log${NC}"
        echo -e "${CYAN}提示: 使用 ./start.sh --logs -f 可進行動態追蹤${NC}"
    fi
    
    if [ "$FOLLOW" == "-f" ]; then
        # 如果是跟隨模式，合併輸出
        tail -f "$PROJECT_DIR/backend.log" "$PROJECT_DIR/frontend.log"
    else
        if [ -f "$PROJECT_DIR/backend.log" ]; then
            echo -e "\n${YELLOW}=== 後端日誌 (backend.log) ===${NC}"
            tail -50 "$PROJECT_DIR/backend.log"
        fi
        
        if [ -f "$PROJECT_DIR/frontend.log" ]; then
            echo -e "\n${YELLOW}=== 前端日誌 (frontend.log) ===${NC}"
            tail -50 "$PROJECT_DIR/frontend.log"
        fi
    fi
}

# ============================================
# 檢查並安裝 uv
# ============================================
check_uv() {
    if ! command -v uv &> /dev/null; then
        echo -e "${YELLOW}uv 未安裝，正在安裝...${NC}"
        curl -LsSf https://astral.sh/uv/install.sh | sh
        export PATH="$HOME/.local/bin:$PATH"
        
        if ! command -v uv &> /dev/null; then
            echo -e "${RED}✗ uv 安裝失敗${NC}"
            exit 1
        fi
    fi
    echo -e "${GREEN}✓ uv $(uv --version | head -1)${NC}"
}

# ============================================
# 設置 Python 環境 (使用 uv)
# ============================================
setup_python_env() {
    echo -e "\n${YELLOW}[2/7] 設置 Python 環境 (使用 uv)...${NC}"
    
    cd "$BACKEND_DIR"
    
    # 檢查虛擬環境是否存在且 Python 版本正確
    NEED_CREATE_VENV=false
    
    if [ ! -d "$VENV_DIR" ]; then
        NEED_CREATE_VENV=true
    else
        # 檢查現有虛擬環境的 Python 版本
        ACTUAL_VERSION=$("$VENV_DIR/bin/python" --version 2>&1 | grep -oE '[0-9]+\.[0-9]+')
        if [ "$ACTUAL_VERSION" != "$PYTHON_VERSION" ]; then
            echo -e "${YELLOW}⚠ 虛擬環境 Python 版本不符 (目前: $ACTUAL_VERSION, 需要: $PYTHON_VERSION)${NC}"
            echo "移除舊的虛擬環境..."
            rm -rf "$VENV_DIR"
            NEED_CREATE_VENV=true
        fi
    fi
    
    if [ "$NEED_CREATE_VENV" = true ]; then
        echo "建立虛擬環境 (Python $PYTHON_VERSION)..."
        uv venv --python $PYTHON_VERSION "$VENV_DIR"
        echo -e "${GREEN}✓ 虛擬環境已建立${NC}"
        
        # 新建環境後需要重新安裝依賴
        if [ -f "requirements.txt" ]; then
            echo "安裝 Python 依賴..."
            uv pip install -r requirements.txt --quiet
        fi
    else
        echo -e "${GREEN}✓ 虛擬環境已存在 (Python $PYTHON_VERSION)${NC}"
    fi
    
    # 顯示 Python 版本
    ACTUAL_VERSION=$("$VENV_DIR/bin/python" --version 2>&1)
    echo -e "${GREEN}✓ $ACTUAL_VERSION${NC}"
}

# ============================================
# 安裝 Python 依賴 (使用 uv)
# ============================================
install_python_deps() {
    echo -e "\n${YELLOW}[3/7] 安裝 Python 依賴 (使用 uv)...${NC}"
    
    cd "$BACKEND_DIR"
    
    if [ -f "requirements.txt" ]; then
        uv pip install -r requirements.txt --quiet
        echo -e "${GREEN}✓ Python 依賴已安裝${NC}"
    else
        echo -e "${RED}✗ requirements.txt 不存在${NC}"
        exit 1
    fi
}

# ============================================
# 檢查關鍵依賴
# ============================================
check_dependencies() {
    echo -e "\n${YELLOW}[依賴檢查] 驗證核心套件...${NC}"
    
    local packages=("fastapi" "httpx"
    "google.genai"
    "openai"
)
    local missing=0
    
    for pkg in "${packages[@]}"; do
        if ! "$VENV_DIR/bin/python" -c "import $pkg" &>/dev/null; then
            echo -e "${RED}✗ 缺失關鍵套件: $pkg${NC}"
            missing=$((missing + 1))
        else
            echo -e "${GREEN}✓ 已安裝: $pkg${NC}"
        fi
    done
    
    if [ $missing -gt 0 ]; then
        echo -e "${YELLOW}正在嘗試自動修復缺失套件...${NC}"
        install_python_deps
    fi
}

# ============================================
# 初始化資料庫
# ============================================
init_database() {
    echo -e "\n${YELLOW}[4/8] 初始化資料庫...${NC}"
    
    cd "$BACKEND_DIR"
    "$VENV_DIR/bin/python" -c "from app.core.database import init_db; init_db()"
    echo -e "${GREEN}✓ 資料庫初始化完成${NC}"
}

# ============================================
# 配置安全機制（簡化版 - 不再使用簽名密鑰）
# ============================================
configure_security() {
    echo -e "\n${YELLOW}[5/8] 配置安全機制...${NC}"
    
    # 後端會在 Settings 初始化時自動生成 SECRET_KEY 和 ENCRYPTION_KEY
    cd "$BACKEND_DIR"
    "$VENV_DIR/bin/python" -c "from app.core.config import get_settings; get_settings()"
    
    echo -e "${GREEN}✓ 安全機制配置完成${NC}"
}

# ============================================
# 優化資料庫
# ============================================
optimize_database() {
    echo -e "\n${BLUE}============================================${NC}"
    echo -e "${BLUE}       資料庫優化${NC}"
    echo -e "${BLUE}============================================${NC}"
    
    cd "$BACKEND_DIR"
    
    if [ ! -f "divination.db" ]; then
        echo -e "${RED}✗ 找不到資料庫檔案${NC}"
        echo -e "${YELLOW}請先啟動服務一次以創建資料庫${NC}"
        exit 1
    fi
    
    echo -e "${YELLOW}正在執行資料庫優化...${NC}\n"
    
    python3 optimize_db_simple.py all
    
    echo -e "\n${BLUE}============================================${NC}"
    echo -e "${GREEN}✓ 資料庫優化完成！${NC}"
    echo -e "${BLUE}============================================${NC}"
    echo -e "${CYAN}建議: 如果資料庫較大，可額外執行 VACUUM:${NC}"
    echo -e "  cd backend && python3 optimize_db_simple.py vacuum"
    echo ""
}

# ============================================
# 檢查 Node.js
# ============================================
check_nodejs() {
    echo -e "\n${YELLOW}[6/8] 檢查 Node.js 版本...${NC}"
    
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
        if [ "$NODE_VERSION" -ge 18 ]; then
            echo -e "${GREEN}✓ Node.js $(node -v)${NC}"
        else
            echo -e "${RED}✗ Node.js 版本需要 18+，當前版本: $(node -v)${NC}"
            exit 1
        fi
    else
        echo -e "${RED}✗ 未找到 Node.js${NC}"
        exit 1
    fi
}

# ============================================
# 安裝前端依賴
# ============================================
install_frontend_deps() {
    echo -e "\n${YELLOW}[7/8] 安裝前端依賴...${NC}"
    
    cd "$FRONTEND_DIR"
    
    if [ -f "package.json" ]; then
        if [ ! -d "node_modules" ]; then
            npm install --silent
        fi
        echo -e "${GREEN}✓ 前端依賴已安裝${NC}"
    else
        echo -e "${RED}✗ package.json 不存在${NC}"
        exit 1
    fi
}

# ============================================
# 啟動服務
# ============================================
start_services() {
    echo -e "\n${YELLOW}[8/8] 啟動服務...${NC}"
    
    # 確保沒有殘留的進程
    echo "清理殘留進程..."
    pkill -9 -f "uvicorn app.main:app" 2>/dev/null || true
    pkill -9 -f "next-server" 2>/dev/null || true
    pkill -9 -f "next dev" 2>/dev/null || true
    pkill -9 -f "next start" 2>/dev/null || true
    
    # 等待端口釋放
    sleep 2
    
    # 檢查端口是否已釋放
    if lsof -ti:3000 > /dev/null 2>&1; then
        echo -e "${RED}✗ 端口 3000 仍被占用，嘗試強制釋放...${NC}"
        kill -9 $(lsof -ti:3000) 2>/dev/null || true
        sleep 1
    fi
    
    if lsof -ti:8000 > /dev/null 2>&1; then
        echo -e "${RED}✗ 端口 8000 仍被占用，嘗試強制釋放...${NC}"
        kill -9 $(lsof -ti:8000) 2>/dev/null || true
        sleep 1
    fi
    
    # 啟動後端 (只監聽 localhost，透過 Next.js rewrites 代理訪問)
    echo "啟動後端服務 (Port 8000, localhost only)..."
    cd "$BACKEND_DIR"
    nohup "$VENV_DIR/bin/uvicorn" app.main:app --host 127.0.0.1 --port 8000 --reload > "$PROJECT_DIR/backend.log" 2>&1 &
    BACKEND_PID=$!
    
    # 啟動前端 (生產模式)
    echo "啟動前端服務 (Port 3000, 0.0.0.0)..."
    cd "$FRONTEND_DIR"
    
    # 檢查是否需要構建
    NEED_BUILD=false
    if [ ! -d ".next" ]; then
        echo "未找到構建檔案 (.next 目錄不存在)"
        NEED_BUILD=true
    elif [ ! -f ".next/BUILD_ID" ]; then
        echo "構建檔案不完整 (缺少 BUILD_ID)"
        NEED_BUILD=true
    elif [ "$FORCE_BUILD" = true ]; then
        echo "強制重新構建"
        NEED_BUILD=true
    fi
    
    if [ "$NEED_BUILD" = true ]; then
        echo "正在構建前端 (生產模式)..."
        npm run build
        if [ $? -ne 0 ]; then
            echo -e "${RED}✗ 前端構建失敗${NC}"
            exit 1
        fi
        echo -e "${GREEN}✓ 前端構建完成${NC}"
    else
        echo "使用現有構建檔案"
    fi
    
    # 啟動生產伺服器
    nohup npm start -- -H 0.0.0.0 > "$PROJECT_DIR/frontend.log" 2>&1 &
    FRONTEND_PID=$!
    
    sleep 3
    
    # 檢查服務狀態
    echo -e "\n${BLUE}============================================${NC}"
    echo -e "${GREEN}       服務已啟動！${NC}"
    echo -e "${BLUE}============================================${NC}"
    echo -e "前端:    ${GREEN}http://localhost:3000${NC}"
    echo -e "後端:    ${GREEN}http://localhost:8000${NC}"
    echo -e "API 文檔: ${GREEN}http://localhost:8000/docs${NC}"
    echo -e "${BLUE}============================================${NC}"
    echo -e "後端 PID: $BACKEND_PID"
    echo -e "前端 PID: $FRONTEND_PID"
    echo -e "日誌檔案: backend.log, frontend.log"
    echo -e "${BLUE}============================================${NC}"
    echo -e "\n${CYAN}提示: 使用 ${GREEN}./start.sh --stop${CYAN} 停止服務${NC}"
    echo -e "${CYAN}      使用 ${GREEN}./start.sh --status${CYAN} 查看狀態${NC}"
    echo -e "${CYAN}      使用 ${GREEN}./start.sh --logs${CYAN} 查看日誌${NC}"
}

# ============================================
# 啟動開發模式服務
# ============================================
start_dev_services() {
    echo -e "\n${YELLOW}[開發模式] 啟動服務...${NC}"
    
    cleanup_processes_and_ports
    
    echo "啟動後端服務 (開發模式 Port 8000)..."
    cd "$BACKEND_DIR"
    nohup "$VENV_DIR/bin/uvicorn" app.main:app --host 127.0.0.1 --port 8000 --reload > "$PROJECT_DIR/backend.log" 2>&1 &
    BACKEND_PID=$!
    
    echo "啟動前端服務 (開發模式 Port 3000, 0.0.0.0)..."
    cd "$FRONTEND_DIR"
    nohup npm run dev -- -H 0.0.0.0 > "$PROJECT_DIR/frontend.log" 2>&1 &
    FRONTEND_PID=$!
    
    sleep 3
    
    echo -e "\n${BLUE}============================================${NC}"
    echo -e "${GREEN}       開發模式服務已啟動！${NC}"
    echo -e "${BLUE}============================================${NC}"
    echo -e "前端:    ${GREEN}http://localhost:3000${NC} (Hot Reload)"
    echo -e "後端:    ${GREEN}http://localhost:8000${NC} (Auto Reload)"
    echo -e "API 文檔: ${GREEN}http://localhost:8000/docs${NC}"
    echo -e "${BLUE}============================================${NC}"
    echo -e "後端 PID: $BACKEND_PID"
    echo -e "前端 PID: $FRONTEND_PID"
    echo -e "日誌檔案: backend.log, frontend.log"
    echo -e "${BLUE}============================================${NC}"
    echo -e "\n${CYAN}提示: 使用 ${GREEN}./start.sh --stop${CYAN} 停止服務${NC}"
    echo -e "${CYAN}      使用 ${GREEN}./start.sh --logs -f${CYAN} 動態查看日誌${NC}"
}

# ============================================
# 主程序
# ============================================
main() {
    echo -e "${BLUE}============================================${NC}"
    echo -e "${BLUE}       AI-Divination 啟動程序${NC}"
    echo -e "${BLUE}============================================${NC}"
    
    # 解析命令行參數
    RESET_DB=false
    CLEAN_CACHE=false
    INSTALL_ONLY=false
    FORCE_BUILD=false
    DEV_MODE=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --help|-h)
                show_help
                exit 0
                ;;
            --reset)
                RESET_DB=true
                shift
                ;;
            --build|--rebuild)
                if [ "$2" == "only" ]; then
                    # 只構建，不啟動服務
                    echo -e "\n${YELLOW}[構建] 正在構建前端...${NC}"
                    cd "$FRONTEND_DIR"
                    npm run build
                    if [ $? -eq 0 ]; then
                        echo -e "${GREEN}✓ 前端構建完成${NC}"
                    else
                        echo -e "${RED}✗ 前端構建失敗${NC}"
                        exit 1
                    fi
                    exit 0
                else
                    FORCE_BUILD=true
                fi
                shift
                ;;
            --optimize-db)
                optimize_database
                exit 0
                ;;
            --clean-cache)
                echo -e "\n${YELLOW}[清理快取] 停止服務並清除快取...${NC}"
                stop_services
                clean_cache
                echo -e "${GREEN}✓ 快取清理完成${NC}"
                exit 0
                ;;
            --stop)
                stop_services
                exit 0
                ;;
            --restart)
                restart_services
                exit 0
                ;;
            --status)
                show_status
                exit 0
                ;;
            --logs)
                shift
                show_logs "$1"
                exit 0
                ;;
            --install)
                INSTALL_ONLY=true
                shift
                ;;
            --dev)
                DEV_MODE=true
                shift
                ;;
            *)
                echo -e "${RED}未知選項: $1${NC}"
                echo -e "使用 ${GREEN}--help${NC} 查看可用選項"
                exit 1
                ;;
        esac
    done
    
    # 執行重置資料庫
    if [ "$RESET_DB" = true ]; then
        reset_database
    fi
    
    # 執行清理快取
    if [ "$CLEAN_CACHE" = true ]; then
        clean_cache
    fi
    
    # 1. 檢查 uv
    echo -e "\n${YELLOW}[1/7] 檢查 uv 套件管理器...${NC}"
    check_uv
    
    # 2. 設置 Python 環境
    setup_python_env
    
    # 3. 安裝 Python 依賴
    install_python_deps
    
    # 檢查依賴
    check_dependencies
    
    # 4. 初始化資料庫
    init_database
    
    # 5. 配置安全機制
    configure_security
    
    # 6. 檢查 Node.js
    check_nodejs
    
    # 7. 安裝前端依賴
    install_frontend_deps
    
    # 8. 啟動服務 (除非只安裝)
    if [ "$INSTALL_ONLY" = true ]; then
        echo -e "\n${GREEN}✓ 安裝完成！${NC}"
        echo -e "${CYAN}使用 ${GREEN}./start.sh${CYAN} 啟動服務${NC}"
    elif [ "$DEV_MODE" = true ]; then
        start_dev_services
    else
        start_services
    fi
}

# 執行主程序
main "$@"
