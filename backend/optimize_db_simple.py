#!/usr/bin/env python3
"""
簡單的資料庫優化工具 - 不需要額外依賴
"""
import sqlite3
import sys
import time
import os

DB_PATH = "divination.db"

def create_indexes():
    """創建索引"""
    print("開始創建索引...")
    print("=" * 60)
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    indexes = [
        ("idx_history_user_id", "CREATE INDEX IF NOT EXISTS idx_history_user_id ON history(user_id)"),
        ("idx_history_created_at", "CREATE INDEX IF NOT EXISTS idx_history_created_at ON history(created_at DESC)"),
        ("idx_history_divination_type", "CREATE INDEX IF NOT EXISTS idx_history_divination_type ON history(divination_type)"),
        ("idx_history_status", "CREATE INDEX IF NOT EXISTS idx_history_status ON history(status)"),
        ("idx_history_user_created", "CREATE INDEX IF NOT EXISTS idx_history_user_created ON history(user_id, created_at DESC)"),
        ("idx_history_user_type", "CREATE INDEX IF NOT EXISTS idx_history_user_type ON history(user_id, divination_type)"),
        ("idx_ai_config_user_active", "CREATE INDEX IF NOT EXISTS idx_ai_config_user_active ON ai_configs(user_id, is_active)"),
        ("idx_user_username", "CREATE INDEX IF NOT EXISTS idx_user_username ON users(username)"),
        ("idx_user_role", "CREATE INDEX IF NOT EXISTS idx_user_role ON users(role)"),
    ]
    
    for name, sql in indexes:
        try:
            cursor.execute(sql)
            print(f"✓ 創建索引: {name}")
        except Exception as e:
            print(f"✗ 創建索引失敗 {name}: {e}")
    
    conn.commit()
    conn.close()
    print("\n索引創建完成！")

def analyze_db():
    """分析資料庫"""
    print("\n開始分析資料庫...")
    print("=" * 60)
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    start = time.time()
    cursor.execute("ANALYZE")
    conn.commit()
    elapsed = time.time() - start
    
    conn.close()
    print(f"✓ ANALYZE 完成 (耗時: {elapsed:.3f}s)")

def vacuum_db():
    """清理資料庫碎片"""
    print("\n開始優化資料庫（VACUUM）...")
    print("=" * 60)
    print("注意：這可能需要一些時間...")
    
    # 獲取優化前的大小
    size_before = os.path.getsize(DB_PATH)
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    start = time.time()
    cursor.execute("VACUUM")
    conn.commit()
    elapsed = time.time() - start
    
    conn.close()
    
    # 獲取優化後的大小
    size_after = os.path.getsize(DB_PATH)
    saved = size_before - size_after
    
    print(f"✓ VACUUM 完成 (耗時: {elapsed:.3f}s)")
    print(f"  優化前: {size_before/1024:.2f} KB")
    print(f"  優化後: {size_after/1024:.2f} KB")
    if saved > 0:
        print(f"  節省空間: {saved/1024:.2f} KB ({saved/size_before*100:.1f}%)")

def show_stats():
    """顯示資料庫統計"""
    print("\n資料庫統計")
    print("=" * 60)
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # 檔案大小
    size = os.path.getsize(DB_PATH)
    print(f"檔案大小: {size/1024:.2f} KB")
    
    # 記錄數
    cursor.execute("SELECT COUNT(*) FROM users")
    users = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM history")
    history = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM ai_configs")
    configs = cursor.fetchone()[0]
    
    print(f"用戶數: {users}")
    print(f"歷史記錄: {history}")
    print(f"AI 配置: {configs}")
    
    # 索引
    cursor.execute("""
        SELECT name FROM sqlite_master 
        WHERE type='index' AND name LIKE 'idx_%'
        ORDER BY name
    """)
    indexes = cursor.fetchall()
    print(f"\n自定義索引數: {len(indexes)}")
    if indexes:
        print("索引列表:")
        for idx in indexes:
            print(f"  - {idx[0]}")
    else:
        print("⚠️  沒有自定義索引")
    
    conn.close()

def test_performance():
    """測試查詢性能"""
    print("\n查詢性能測試")
    print("=" * 60)
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    tests = [
        ("簡單查詢", "SELECT * FROM users LIMIT 10"),
        ("排序查詢", "SELECT * FROM history ORDER BY created_at DESC LIMIT 20"),
        ("聯結查詢", "SELECT h.*, u.username FROM history h JOIN users u ON h.user_id = u.id LIMIT 20"),
    ]
    
    max_time = 0
    for name, sql in tests:
        start = time.time()
        cursor.execute(sql)
        cursor.fetchall()
        elapsed = (time.time() - start) * 1000
        max_time = max(max_time, elapsed)
        print(f"  {name}: {elapsed:.2f}ms")
    
    print()
    if max_time > 100:
        print("⚠️  性能警告: 查詢時間超過 100ms，建議優化")
    elif max_time > 50:
        print("ℹ️  性能一般: 查詢時間在 50-100ms")
    else:
        print("✓ 性能良好: 查詢時間小於 50ms")
    
    conn.close()

def main():
    if not os.path.exists(DB_PATH):
        print(f"✗ 找不到資料庫檔案: {DB_PATH}")
        print("  請確保在 backend/ 目錄下執行此腳本")
        return
    
    if len(sys.argv) < 2:
        print("資料庫優化工具")
        print("=" * 60)
        print("\n使用方法：")
        print("  python optimize_db_simple.py create   # 創建索引")
        print("  python optimize_db_simple.py analyze  # 分析資料庫")
        print("  python optimize_db_simple.py vacuum   # 優化資料庫")
        print("  python optimize_db_simple.py stats    # 顯示統計")
        print("  python optimize_db_simple.py test     # 測試性能")
        print("  python optimize_db_simple.py all      # 執行所有優化")
        return
    
    command = sys.argv[1]
    
    if command == "create":
        create_indexes()
    elif command == "analyze":
        analyze_db()
    elif command == "vacuum":
        vacuum_db()
    elif command == "stats":
        show_stats()
    elif command == "test":
        test_performance()
    elif command == "all":
        show_stats()
        test_performance()
        create_indexes()
        analyze_db()
        print("\n" + "=" * 60)
        print("✓ 所有優化完成！")
        print("\n建議：")
        print("  1. 重啟後端服務以應用優化")
        print("  2. 如果資料庫較大，可執行: python optimize_db_simple.py vacuum")
        test_performance()
    else:
        print(f"✗ 未知命令: {command}")
        print("使用 'python optimize_db_simple.py' 查看幫助")

if __name__ == "__main__":
    main()
