"""
資料庫索引優化腳本

這個腳本會為常用的查詢欄位添加索引，提升查詢性能
"""
from sqlalchemy import create_engine, text, Index
from app.core.config import get_settings

settings = get_settings()


def create_indexes():
    """創建資料庫索引"""
    engine = create_engine(
        settings.DATABASE_URL,
        connect_args={"check_same_thread": False}
    )
    
    with engine.connect() as conn:
        print("開始創建索引...")
        
        # History 表索引
        indexes = [
            # 用戶 ID 索引（常用於篩選用戶歷史）
            "CREATE INDEX IF NOT EXISTS idx_history_user_id ON history(user_id)",
            
            # 創建時間索引（常用於排序）
            "CREATE INDEX IF NOT EXISTS idx_history_created_at ON history(created_at DESC)",
            
            # 占卜類型索引（常用於篩選）
            "CREATE INDEX IF NOT EXISTS idx_history_divination_type ON history(divination_type)",
            
            # 狀態索引
            "CREATE INDEX IF NOT EXISTS idx_history_status ON history(status)",
            
            # 複合索引：用戶 + 創建時間（常用於用戶歷史列表查詢）
            "CREATE INDEX IF NOT EXISTS idx_history_user_created ON history(user_id, created_at DESC)",
            
            # 複合索引：用戶 + 占卜類型
            "CREATE INDEX IF NOT EXISTS idx_history_user_type ON history(user_id, divination_type)",
            
            # AIConfig 表索引
            # 用戶 ID + 活動狀態索引（常用於查詢用戶的活動 AI 配置）
            "CREATE INDEX IF NOT EXISTS idx_ai_config_user_active ON ai_configs(user_id, is_active)",
            
            # User 表索引
            # 用戶名索引（登入時查詢）
            "CREATE INDEX IF NOT EXISTS idx_user_username ON users(username)",
            
            # 角色索引
            "CREATE INDEX IF NOT EXISTS idx_user_role ON users(role)",
        ]
        
        for idx_sql in indexes:
            try:
                conn.execute(text(idx_sql))
                idx_name = idx_sql.split("idx_")[1].split(" ")[0]
                print(f"✓ 創建索引: idx_{idx_name}")
            except Exception as e:
                print(f"✗ 索引創建失敗: {e}")
        
        conn.commit()
        print("\n索引創建完成！")


def analyze_database():
    """分析資料庫，更新統計資訊"""
    engine = create_engine(
        settings.DATABASE_URL,
        connect_args={"check_same_thread": False}
    )
    
    with engine.connect() as conn:
        print("\n開始分析資料庫...")
        conn.execute(text("ANALYZE"))
        conn.commit()
        print("✓ ANALYZE 完成")


def vacuum_database():
    """清理資料庫碎片"""
    engine = create_engine(
        settings.DATABASE_URL,
        connect_args={"check_same_thread": False}
    )
    
    with engine.connect() as conn:
        print("\n開始優化資料庫（VACUUM）...")
        conn.execute(text("VACUUM"))
        conn.commit()
        print("✓ VACUUM 完成")


def show_indexes():
    """顯示現有索引"""
    engine = create_engine(
        settings.DATABASE_URL,
        connect_args={"check_same_thread": False}
    )
    
    with engine.connect() as conn:
        print("\n現有索引：")
        print("-" * 60)
        
        # 查詢所有索引
        result = conn.execute(text("""
            SELECT 
                m.name as table_name,
                il.name as index_name,
                ii.name as column_name
            FROM sqlite_master AS m,
                 pragma_index_list(m.name) AS il,
                 pragma_index_info(il.name) AS ii
            WHERE m.type = 'table'
            ORDER BY m.name, il.name
        """))
        
        current_table = None
        for row in result:
            if row.table_name != current_table:
                print(f"\n表: {row.table_name}")
                current_table = row.table_name
            print(f"  - {row.index_name}: {row.column_name}")


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1:
        command = sys.argv[1]
        
        if command == "create":
            create_indexes()
        elif command == "analyze":
            analyze_database()
        elif command == "vacuum":
            vacuum_database()
        elif command == "show":
            show_indexes()
        elif command == "all":
            create_indexes()
            analyze_database()
            print("\n建議：如果資料庫較大，可以執行 VACUUM 來清理碎片")
            print("執行：python optimize_db.py vacuum")
        else:
            print("未知命令")
            print("使用方法：")
            print("  python optimize_db.py create   # 創建索引")
            print("  python optimize_db.py analyze  # 分析資料庫")
            print("  python optimize_db.py vacuum   # 優化資料庫")
            print("  python optimize_db.py show     # 顯示索引")
            print("  python optimize_db.py all      # 創建索引 + 分析")
    else:
        print("資料庫優化工具")
        print("=" * 60)
        print("\n使用方法：")
        print("  python optimize_db.py create   # 創建索引")
        print("  python optimize_db.py analyze  # 分析資料庫（更新統計資訊）")
        print("  python optimize_db.py vacuum   # 優化資料庫（清理碎片）")
        print("  python optimize_db.py show     # 顯示現有索引")
        print("  python optimize_db.py all      # 一次執行創建索引 + 分析")
        print("\n建議順序：")
        print("  1. 先執行 'all' 創建索引並分析")
        print("  2. 如果資料庫使用一段時間後變慢，執行 'vacuum'")
