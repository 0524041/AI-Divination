#!/bin/bash

# 資料庫性能分析腳本
# 這個腳本會幫你診斷資料庫和後端的性能問題

echo "=========================================="
echo "  AI 算命 - 性能分析工具"
echo "=========================================="
echo ""

# 檢查資料庫文件
echo "1. 檢查資料庫檔案..."
echo "----------------------------------------"
if [ -f "backend/divination.db" ]; then
    DB_SIZE=$(ls -lh backend/divination.db | awk '{print $5}')
    echo "✓ 資料庫檔案: backend/divination.db"
    echo "  大小: $DB_SIZE"
    
    # 檢查檔案碎片（透過檔案大小和實際使用率）
    ACTUAL_SIZE=$(du -h backend/divination.db | cut -f1)
    echo "  實際佔用: $ACTUAL_SIZE"
else
    echo "✗ 找不到資料庫檔案（backend/divination.db）"
    echo "  如果還沒啟動過後端，請先執行 ./start.sh"
    exit 1
fi
echo ""

# 檢查資料庫統計
echo "2. 資料庫統計..."
echo "----------------------------------------"
cd backend
uv run python -c "
from sqlalchemy import create_engine, text
import time

engine = create_engine('sqlite:///divination.db', connect_args={'check_same_thread': False})
with engine.connect() as conn:
    # 查詢記錄數
    start = time.perf_counter()
    users = conn.execute(text('SELECT COUNT(*) FROM users')).scalar()
    history = conn.execute(text('SELECT COUNT(*) FROM history')).scalar()
    ai_configs = conn.execute(text('SELECT COUNT(*) FROM ai_configs')).scalar()
    query_time = time.perf_counter() - start
    
    print(f'  用戶數: {users}')
    print(f'  歷史記錄: {history}')
    print(f'  AI 配置: {ai_configs}')
    print(f'  查詢耗時: {query_time*1000:.1f}ms')
    
    # 檢查是否有索引
    indexes = conn.execute(text(\"SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%'\")).fetchall()
    print(f'  自定義索引數: {len(indexes)}')
    if len(indexes) == 0:
        print('  ⚠️  警告: 沒有自定義索引，建議執行優化')
"
cd ..
echo ""

# 測試查詢性能
echo "3. 查詢性能測試..."
echo "----------------------------------------"
cd backend
uv run python -c "
from sqlalchemy import create_engine, text
import time

engine = create_engine('sqlite:///divination.db', connect_args={'check_same_thread': False})
with engine.connect() as conn:
    # 測試1: 簡單查詢
    start = time.perf_counter()
    conn.execute(text('SELECT * FROM users LIMIT 10')).fetchall()
    t1 = (time.perf_counter() - start) * 1000
    print(f'  簡單查詢 (users): {t1:.2f}ms')
    
    # 測試2: 排序查詢
    start = time.perf_counter()
    conn.execute(text('SELECT * FROM history ORDER BY created_at DESC LIMIT 20')).fetchall()
    t2 = (time.perf_counter() - start) * 1000
    print(f'  排序查詢 (history): {t2:.2f}ms')
    
    # 測試3: 聯結查詢
    start = time.perf_counter()
    conn.execute(text('SELECT h.*, u.username FROM history h JOIN users u ON h.user_id = u.id LIMIT 20')).fetchall()
    t3 = (time.perf_counter() - start) * 1000
    print(f'  聯結查詢 (history+users): {t3:.2f}ms')
    
    # 評估
    print()
    if max(t1, t2, t3) > 100:
        print('  ⚠️  性能警告: 查詢時間超過 100ms，建議優化')
    elif max(t1, t2, t3) > 50:
        print('  ℹ️  性能一般: 查詢時間在 50-100ms')
    else:
        print('  ✓ 性能良好: 查詢時間小於 50ms')
"
echo ""

# 檢查索引
echo "4. 檢查資料庫索引..."
echo "----------------------------------------"
cd backend
uv run python optimize_db.py show 2>/dev/null | head -30
cd ..
echo ""

# 提供建議
echo "=========================================="
echo "  優化建議"
echo "=========================================="
echo ""
echo "如果發現性能問題，可以執行以下優化："
echo ""uv run python optimize_db.py all"
echo ""
echo "2. 清理資料庫碎片："
echo "   cd backend && uv run python
echo "2. 清理資料庫碎片："
echo "   cd backend && python3 optimize_db.py vacuum"
echo ""
echo "3. 即時性能監控："
echo "   啟動後端後，訪問 http://localhost:8000/api/debug/performance"
echo "   (需要管理員權限)"
echo ""
echo "4. 查看慢查詢："
echo "   http://localhost:8000/api/debug/slow-queries"
echo ""
