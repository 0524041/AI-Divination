"""
Flask Routes - 所有 API 路由
"""
from flask import request, jsonify, render_template, session
from .utils.auth import login_required, admin_required
from .core.database import (
    get_db_connection, 
    get_setting, 
    set_setting,
    add_history,
    get_history,
    delete_history,
    toggle_favorite
)
from .services.divination import perform_divination, get_current_time
from .services.ai import call_ai, format_divination_result, get_system_prompt
from .models.user import (
    authenticate_user,
    create_user,
    get_all_users,
    delete_user,
    update_user_role,
    update_user_password,
    get_user_api_keys,
    add_api_key,
    delete_api_key,
    get_user_api_key,
    get_user_api_key_info
)
import json


def register_routes(app):
    """註冊所有路由"""
    
    # ============= Authentication Routes =============
    @app.route('/api/login', methods=['POST'])
    def login():
        data = request.json
        username = data.get('username')
        password = data.get('password')
        
        user = authenticate_user(username, password)
        if user:
            session['user_id'] = user['id']
            session['username'] = user['username']
            session['role'] = user['role']
            session.permanent = True
            return jsonify({
                "success": True,
                "user": {
                    "id": user['id'],
                    "username": user['username'],
                    "role": user['role']
                }
            })
        
        return jsonify({"error": "Invalid credentials"}), 401

    @app.route('/api/logout', methods=['POST'])
    def logout():
        session.clear()
        return jsonify({"success": True})

    @app.route('/api/current-user', methods=['GET'])
    def get_current_user():
        if 'user_id' in session:
            return jsonify({
                "id": session['user_id'],
                "username": session['username'],
                "role": session['role']
            })
        return jsonify({"error": "Not logged in"}), 401

    # ============= Public Registration =============
    @app.route('/api/register', methods=['POST'])
    def register():
        data = request.json
        username = data.get('username')
        password = data.get('password')
        
        if not username or not password:
            return jsonify({"error": "Username and password required"}), 400
        if len(password) < 6:
            return jsonify({"error": "Password must be at least 6 characters"}), 400
        if len(username) < 2:
            return jsonify({"error": "Username must be at least 2 characters"}), 400
        
        try:
            user_id = create_user(username, password, 'user')
            session['user_id'] = user_id
            session['username'] = username
            session['role'] = 'user'
            session.permanent = True
            return jsonify({
                "success": True,
                "user": {"id": user_id, "username": username, "role": "user"}
            })
        except Exception as e:
            if "UNIQUE constraint" in str(e):
                return jsonify({"error": "用戶名已存在"}), 400
            return jsonify({"error": str(e)}), 400

    # ============= User Management (Admin) =============
    @app.route('/api/admin/users', methods=['GET'])
    @admin_required
    def list_users():
        users = get_all_users()
        return jsonify(users)

    @app.route('/api/admin/users', methods=['POST'])
    @admin_required
    def create_user_route():
        data = request.json
        username = data.get('username')
        password = data.get('password')
        role = data.get('role', 'user')
        
        try:
            user_id = create_user(username, password, role)
            return jsonify({"success": True, "user_id": user_id})
        except Exception as e:
            return jsonify({"error": str(e)}), 400

    @app.route('/api/admin/users/<int:user_id>', methods=['DELETE'])
    @admin_required
    def delete_user_route(user_id):
        if user_id == 1:
            return jsonify({"error": "Cannot delete admin user"}), 403
        delete_user(user_id)
        return jsonify({"success": True})

    @app.route('/api/admin/users/<int:user_id>', methods=['PUT'])
    @admin_required
    def update_user_route(user_id):
        data = request.json
        role = data.get('role')
        password = data.get('password')
        
        if role:
            update_user_role(user_id, role)
        
        if password and len(password) >= 6:
            update_user_password(user_id, password)
        
        return jsonify({"success": True})

    # ============= User Profile =============
    @app.route('/api/user/password', methods=['PUT'])
    @login_required
    def update_password():
        data = request.json
        new_password = data.get('new_password')
        
        if not new_password or len(new_password) < 6:
            return jsonify({"error": "Password must be at least 6 characters"}), 400
        
        update_user_password(session['user_id'], new_password)
        return jsonify({"success": True})

    @app.route('/api/user/api-keys', methods=['GET'])
    @login_required
    def get_user_keys():
        keys = get_user_api_keys(session['user_id'])
        return jsonify(keys)

    @app.route('/api/user/api-keys', methods=['POST'])
    @login_required
    def add_user_key():
        data = request.json
        provider = data.get('provider')
        api_key = data.get('api_key')
        config_dict = data.get('config')
        
        if provider not in ['gemini', 'local']:
            return jsonify({"error": "Invalid provider"}), 400
        
        config_json = json.dumps(config_dict) if config_dict else None
        add_api_key(session['user_id'], provider, api_key, config_json)
        return jsonify({"success": True})

    @app.route('/api/user/api-keys/<provider>', methods=['DELETE'])
    @login_required
    def delete_user_key(provider):
        delete_api_key(session['user_id'], provider)
        return jsonify({"success": True})
    
    @app.route('/api/check-ai-availability', methods=['POST'])
    @login_required
    def check_ai_availability():
        """檢查 AI 可用性（不浪費請求次數）"""
        data = request.json
        provider = data.get('provider')
        user_id = session['user_id']
        
        if not provider or provider not in ['local', 'gemini']:
            return jsonify({"error": "請選擇 AI 提供者 (local 或 gemini)"}), 400
        
        key_info = get_user_api_key_info(user_id, provider)
        
        if provider == 'gemini':
            # 檢查是否有 Gemini API Key
            if not key_info or not key_info.get('api_key'):
                return jsonify({
                    "available": False,
                    "error": "請先在設定中配置 Gemini API Key",
                    "error_type": "missing_api_key"
                })
            
            return jsonify({
                "available": True,
                "message": "Gemini API Key 已配置"
            })
            
        elif provider == 'local':
            # 檢查是否有 Local AI 配置
            if not key_info or not key_info.get('config'):
                return jsonify({
                    "available": False,
                    "error": "請先在設定中配置 Local AI (API URL 和模型)",
                    "error_type": "missing_config"
                })
            
            config = key_info.get('config')
            api_url = config.get('api_url')
            model_name = config.get('model_name')
            
            if not api_url or not model_name:
                return jsonify({
                    "available": False,
                    "error": "Local AI 配置不完整，請在設定中重新配置",
                    "error_type": "invalid_config"
                })
            
            # 測試連線 (可選，如果用戶要求不測試則跳過)
            test_connection = data.get('test_connection', False)
            if test_connection:
                import urllib.request
                import urllib.error
                
                models_url = f"{api_url.rstrip('/')}/models"
                try:
                    req = urllib.request.Request(models_url, headers={"Content-Type": "application/json"})
                    with urllib.request.urlopen(req, timeout=5) as response:
                        result = json.loads(response.read().decode('utf-8'))
                        return jsonify({
                            "available": True,
                            "message": f"Local AI 連線成功",
                            "config": {"api_url": api_url, "model_name": model_name}
                        })
                except Exception as e:
                    return jsonify({
                        "available": False,
                        "error": f"無法連線到 Local AI: {str(e)}",
                        "error_type": "connection_failed",
                        "config": {"api_url": api_url, "model_name": model_name}
                    })
            else:
                # 不測試連線，只檢查配置是否存在
                return jsonify({
                    "available": True,
                    "message": "Local AI 已配置",
                    "config": {"api_url": api_url, "model_name": model_name}
                })

    # ============= Main App Routes =============
    @app.route('/')
    def index():
        return jsonify({
            "name": "AI Divination API",
            "version": "2.0.0",
            "status": "online"
        })

    @app.route('/api/divinate', methods=['POST'])
    @login_required
    def divinate():
        data = request.json
        question = data.get('question')
        coins = data.get('coins')
        gender = data.get('gender')  # 求測者性別: 男/女
        target = data.get('target')  # 占卜對象: 自己/父母/朋友/他人
        
        user_id = session['user_id']
        
        print(f"=== 收到前端六爻數據 ===" )
        print(f"用戶: {session['username']} (ID: {user_id})")
        print(f"問題: {question}")
        print(f"性別: {gender}, 對象: {target}")
        print(f"六個硬幣結果 (背面數): {coins}")
        if coins:
            coin_labels = {0: '老陰(3正)', 1: '陽(2正1負)', 2: '陰(1正2負)', 3: '老陽(3負)'}
            print(f"解讀: {[coin_labels.get(c, '?') for c in coins]}")
        print("=" * 30)
        
        if not question:
            return jsonify({"error": "Question is required"}), 400
        
        # Pre-execute Tools
        tool_status = {
            "get_divination_tool": "unused", 
            "get_current_time": "unused"
        }
        
        # Get current time
        try:
            current_time_str = get_current_time()
            tool_status["get_current_time"] = "success"
        except Exception as e:
            current_time_str = f"Error getting time: {e}"
            tool_status["get_current_time"] = "error"

        # Perform divination
        try:
            divination_result = perform_divination(question, coins)
            
            if isinstance(divination_result, dict) and "error" in divination_result:
                tool_status["get_divination_tool"] = "error"
            else:
                tool_status["get_divination_tool"] = "success"
                
            divination_result_str = json.dumps(divination_result, ensure_ascii=False, indent=2)
            raw_result_for_ai = format_divination_result(divination_result, gender=gender, target=target)

        except Exception as e:
            raw_result_for_ai = f"Error performing divination: {e}"
            divination_result_str = json.dumps({"error": str(e)})
            tool_status["get_divination_tool"] = "error"

        # Construct Prompt
        prompt_template = get_system_prompt()
        full_payload = prompt_template.replace('{question}', str(question)).replace('{divination_result}', str(raw_result_for_ai))

        # Get AI provider from request (frontend must specify)
        ai_provider = data.get('provider')
        if not ai_provider or ai_provider not in ['local', 'gemini']:
            return jsonify({"error": "請選擇 AI 提供者 (local 或 gemini)"}), 400
        
        # Get user's AI configuration
        key_info = get_user_api_key_info(user_id, ai_provider)
        
        # Check AI availability
        if ai_provider == 'gemini':
            # Check if user has Gemini API Key
            if not key_info or not key_info.get('api_key'):
                return jsonify({
                    "error": "請先在設定中配置 Gemini API Key",
                    "error_type": "missing_api_key"
                }), 400
            user_gemini_key = key_info.get('api_key')
            user_local_config = None
            print(f"[Routes] Using Gemini with user {user_id}'s API Key")
            
        elif ai_provider == 'local':
            # Check if user has Local AI configuration
            if not key_info or not key_info.get('config'):
                return jsonify({
                    "error": "請先在設定中配置 Local AI (API URL 和模型)",
                    "error_type": "missing_config"
                }), 400
            
            user_local_config = key_info.get('config')
            user_gemini_key = None
            
            # Validate required fields
            api_url = user_local_config.get('api_url')
            model_name = user_local_config.get('model_name')
            
            if not api_url or not model_name:
                return jsonify({
                    "error": "Local AI 配置不完整，請在設定中重新配置",
                    "error_type": "invalid_config"
                }), 400
            
            print(f"[Routes] Using Local AI for user {user_id}: {api_url} / {model_name}")
        
        print(f"[Routes] About to call AI, provider='{ai_provider}'")
        
        # 1. 立即保存初步歷史紀錄（無解卦結果）
        history_id = add_history(
            question=question, 
            result_json={"raw": divination_result_str}, 
            interpretation="",  # 初始為空，表示處理中
            user_id=user_id, 
            ai_model="processing...", 
            gender=gender, 
            target=target
        )

        # 2. 定義背景任務函數
        def run_ai_background(h_id, payload, provider, gemini_key, local_config):
            try:
                print(f"[Background] AI Thread starting for History ID: {h_id}")
                content, used_model = call_ai(
                    prompt=payload,
                    provider=provider,
                    user_gemini_key=gemini_key,
                    user_local_config=local_config
                )
                
                # 更新資料庫
                from .core.database import update_history_interpretation
                update_history_interpretation(h_id, content, used_model)
                print(f"[Background] AI Thread completed for History ID: {h_id}")
            except Exception as e:
                print(f"[Background] AI Thread error: {e}")
                from .core.database import update_history_interpretation
                update_history_interpretation(h_id, f"解卦出錯: {str(e)}", "error")

        # 3. 啟動背景執行緒 (並傳入必要參數)
        import threading
        thread = threading.Thread(
            target=run_ai_background, 
            args=(history_id, full_payload, ai_provider, user_gemini_key, user_local_config)
        )
        thread.daemon = True # 設為守護執行緒
        thread.start()

        # 4. 立即回傳
        return jsonify({
            "id": history_id,
            "result": None, # 代表正在處理中
            "tool_status": tool_status,
            "ai_model": "processing...",
            "status": "processing"
        })

    @app.route('/api/history', methods=['GET'])
    @login_required
    def history():
        user_id = session['user_id']
        role = session['role']
        
        target_user_id = request.args.get('user_id')
        
        if role == 'admin':
            if target_user_id == 'all' or not target_user_id:
                return jsonify(get_history())
            else:
                try:
                    return jsonify(get_history(int(target_user_id)))
                except ValueError:
                    return jsonify(get_history())
        else:
            return jsonify(get_history(user_id))

    @app.route('/api/history/<int:id>', methods=['GET', 'DELETE'])
    @login_required
    def handle_history_item(id):
        user_id = session['user_id']
        role = session.get('role')
        
        # 先獲取記錄來檢查權限
        conn = get_db_connection()
        record = conn.execute('SELECT * FROM history WHERE id = ?', (id,)).fetchone()
        conn.close()
        
        if not record:
            return jsonify({"error": "Record not found"}), 404
            
        # 權限檢查：只有本人或管理員可以訪問/刪除
        if role != 'admin' and record['user_id'] != user_id:
            return jsonify({"error": "Permission denied"}), 403

        if request.method == 'GET':
            return jsonify(dict(record))
            
        elif request.method == 'DELETE':
            if id == 1 and role != 'admin': # 雖然這行邏輯怪怪的，但這是原始邏輯的延續
                pass 
            delete_history(id)
            return jsonify({"success": True})

    @app.route('/api/history/<int:id>/favorite', methods=['PUT'])
    @login_required
    def favorite(id):
        data = request.json
        toggle_favorite(id, data.get('is_favorite'))
        return jsonify({"success": True})

    @app.route('/api/settings', methods=['GET', 'POST'])
    def handle_settings():
        default_prompt = get_system_prompt()
        
        if request.method == 'GET':
            # GET 不需要登入，公開訪問（首頁需要顯示當前 AI 模型）
            return jsonify({
                "system_prompt": get_setting('system_prompt', default_prompt),
                "default_prompt": default_prompt,
                "ai_provider": get_setting('ai_provider', 'local'),
                "local_api_url": get_setting('local_api_url', 'http://localhost:1234/v1'),
                "local_model_name": get_setting('local_model_name', 'qwen/qwen3-8b')
            })
        else:
            # POST 需要登入且為管理員
            if 'user_id' not in session:
                return jsonify({"error": "Authentication required"}), 401
            
            if session.get('role') != 'admin':
                return jsonify({"error": "Admin access required"}), 403
            
            data = request.json
            if 'system_prompt' in data:
                set_setting('system_prompt', data['system_prompt'])
            if 'ai_provider' in data:
                set_setting('ai_provider', data['ai_provider'])
            if 'local_api_url' in data:
                set_setting('local_api_url', data['local_api_url'])
            if 'local_model_name' in data:
                set_setting('local_model_name', data['local_model_name'])
            return jsonify({"success": True})

    @app.route('/api/test-local-ai', methods=['POST'])
    @login_required
    def test_local_ai():
        """測試 Local AI 連線並取得模型列表"""
        import urllib.request
        import urllib.error
        
        data = request.json
        api_url = data.get('api_url', '').rstrip('/')
        
        if not api_url:
            return jsonify({"error": "請提供 API URL"}), 400
        
        # 嘗試取得模型列表
        models_url = f"{api_url}/models"
        
        try:
            req = urllib.request.Request(models_url, headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=10) as response:
                result = json.loads(response.read().decode('utf-8'))
                
                # OpenAI 格式的模型列表
                models = []
                if 'data' in result and isinstance(result['data'], list):
                    for model in result['data']:
                        model_id = model.get('id', '')
                        if model_id:
                            models.append(model_id)
                
                return jsonify({
                    "success": True,
                    "models": models,
                    "message": f"連線成功！找到 {len(models)} 個模型"
                })
                
        except urllib.error.URLError as e:
            return jsonify({"error": f"無法連線到 {api_url}：{str(e.reason)}"}), 400
        except Exception as e:
            return jsonify({"error": f"測試失敗：{str(e)}"}), 400
