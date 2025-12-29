#!/usr/bin/env python3
"""
修正資料庫中 Local AI 配置的 key 名稱

從舊的格式: {"url": "...", "model": "..."}
轉換為新格式: {"api_url": "...", "model_name": "..."}
"""
import sys
import json
sys.path.insert(0, 'backend')
from app.core.database import get_db_connection

def migrate_local_ai_config():
    conn = get_db_connection()
    
    # 找出所有 Local AI 配置
    keys = conn.execute(
        'SELECT id, user_id, config_json FROM api_keys WHERE provider = ? AND config_json IS NOT NULL',
        ('local',)
    ).fetchall()
    
    updated_count = 0
    
    for key in keys:
        try:
            config = json.loads(key['config_json'])
            
            # 檢查是否使用舊格式
            if 'url' in config or 'model' in config:
                # 轉換為新格式
                new_config = {}
                
                if 'url' in config:
                    new_config['api_url'] = config['url']
                if 'model' in config:
                    new_config['model_name'] = config['model']
                
                # 保留其他可能的 key
                for k, v in config.items():
                    if k not in ['url', 'model']:
                        new_config[k] = v
                
                # 更新資料庫
                conn.execute(
                    'UPDATE api_keys SET config_json = ? WHERE id = ?',
                    (json.dumps(new_config), key['id'])
                )
                
                updated_count += 1
                print(f"✅ 更新用戶 {key['user_id']} 的配置:")
                print(f"   舊: {config}")
                print(f"   新: {new_config}")
        
        except json.JSONDecodeError:
            print(f"❌ 無法解析用戶 {key['user_id']} 的配置 JSON")
        except Exception as e:
            print(f"❌ 處理用戶 {key['user_id']} 時出錯: {e}")
    
    conn.commit()
    conn.close()
    
    print(f"\n✅ 完成！共更新了 {updated_count} 個配置")

if __name__ == '__main__':
    print("開始遷移 Local AI 配置...")
    migrate_local_ai_config()
