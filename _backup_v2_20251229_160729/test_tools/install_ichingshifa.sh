#!/bin/bash
# 安裝 ichingshifa 套件和相關依賴

echo "=========================================="
echo "安裝 ichingshifa 套件"
echo "=========================================="

# 檢查是否在虛擬環境中
if [ -z "$VIRTUAL_ENV" ]; then
    echo "⚠️  警告: 當前不在虛擬環境中"
    echo "建議先激活 backend 虛擬環境:"
    echo "  source backend/.venv/bin/activate"
    echo ""
    read -p "是否繼續安裝到全局環境？(y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "安裝已取消"
        exit 1
    fi
fi

echo ""
echo "正在安裝 sxtwl (農曆計算庫)..."
pip install sxtwl

echo ""
echo "正在安裝 ichingshifa (六爻筮法)..."
pip install --upgrade ichingshifa

echo ""
echo "=========================================="
echo "✅ 安裝完成"
echo "=========================================="
echo ""
echo "使用方法:"
echo "  1. 測試單個案例:"
echo "     python test_tools/compare_with_ichingshifa.py --yaogua 777777"
echo ""
echo "  2. 批量測試:"
echo "     python test_tools/compare_with_ichingshifa.py --batch"
echo ""
echo "  3. 互動式測試:"
echo "     python test_tools/compare_with_ichingshifa.py --interactive"
echo ""
echo "詳細說明請查看: test_tools/README_ichingshifa.md"
echo ""
