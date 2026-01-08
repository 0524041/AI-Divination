#!/bin/bash

# API 安全配置腳本

echo "========================================"
echo "  API 安全機制配置工具"
echo "========================================"
echo ""

# 檢查後端密鑰文件
BACKEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/backend"
SIGNATURE_KEY_FILE="$BACKEND_DIR/.api_signature_key"

if [ -f "$SIGNATURE_KEY_FILE" ]; then
    echo "✓ 後端已有 API 簽名密鑰"
    SIGNATURE_KEY=$(cat "$SIGNATURE_KEY_FILE")
else
    echo "⚠ 後端尚未生成 API 簽名密鑰"
    echo "  請先啟動後端服務以生成密鑰："
    echo "  cd backend && python -m uvicorn app.main:app"
    echo ""
    read -p "是否現在啟動後端？(y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        cd "$BACKEND_DIR"
        echo "正在啟動後端..."
        python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 &
        BACKEND_PID=$!
        echo "後端 PID: $BACKEND_PID"
        sleep 3
        
        if [ -f "$SIGNATURE_KEY_FILE" ]; then
            SIGNATURE_KEY=$(cat "$SIGNATURE_KEY_FILE")
            echo "✓ 密鑰已生成"
            kill $BACKEND_PID 2>/dev/null
        else
            echo "✗ 密鑰生成失敗"
            exit 1
        fi
    else
        exit 1
    fi
fi

# 配置前端
FRONTEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/frontend"
ENV_FILE="$FRONTEND_DIR/.env.local"

echo ""
echo "配置前端環境變量..."

if [ -f "$ENV_FILE" ]; then
    echo "⚠ .env.local 已存在"
    read -p "是否覆蓋？(y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "保持現有配置"
        exit 0
    fi
fi

# 創建 .env.local
cat > "$ENV_FILE" << EOF
# API 配置
NEXT_PUBLIC_API_URL=http://localhost:8000

# API 簽名密鑰（開發環境）
# 生產環境中應通過服務器動態獲取
NEXT_PUBLIC_API_SIGNATURE_KEY=$SIGNATURE_KEY
EOF

echo "✓ 前端環境變量已配置"
echo ""
echo "配置完成！"
echo ""
echo "下一步："
echo "1. 啟動服務："
echo "   ./start.sh"
echo ""
echo "2. 訪問應用："
echo "   http://localhost:3000"
echo ""
echo "3. 測試安全機制："
echo "   python test_tools/test_api_security.py"
echo ""
echo "詳細文檔：docs/API_SECURITY.md"
