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
    toggle_favorite,
    get_daily_usage_count
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
    delete_api_key
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
        
        if provider not in ['gemini', 'local']:
            return jsonify({"error": "Invalid provider"}), 400
        
        add_api_key(session['user_id'], provider, api_key)
        return jsonify({"success": True})

    @app.route('/api/user/api-keys/<provider>', methods=['DELETE'])
    @login_required
    def delete_user_key(provider):
        delete_api_key(session['user_id'], provider)
        return jsonify({"success": True})

    # ============= Main App Routes =============
    @app.route('/')
    def index():
        return render_template('index.html')

    @app.route('/api/divinate', methods=['POST'])
    @login_required
    def divinate():
        data = request.json
        question = data.get('question')
        coins = data.get('coins')
        
        user_id = session['user_id']
        
        print(f"=== 收到前端六爻數據 ===")
        print(f"用戶: {session['username']} (ID: {user_id})")
        print(f"問題: {question}")
        print(f"六個硬幣結果 (背面數): {coins}")
        if coins:
            coin_labels = {0: '老陰(3正)', 1: '陽(2正1負)', 2: '陰(1正2負)', 3: '老陽(3負)'}
            print(f"解讀: {[coin_labels.get(c, '?') for c in coins]}")
        print("=" * 30)
        
        if not question:
            return jsonify({"error": "Question is required"}), 400
            
        # Check Limits
        limit_str = get_setting('daily_limit', '5')
        if limit_str != 'unlimited':
            try:
                limit = int(limit_str)
                count = get_daily_usage_count(user_id)
                if count >= limit:
                    return jsonify({"error": f"Daily limit of {limit} divinations reached."}), 403
            except ValueError:
                pass 
        
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
            raw_result_for_ai = format_divination_result(divination_result)

        except Exception as e:
            raw_result_for_ai = f"Error performing divination: {e}"
            divination_result_str = json.dumps({"error": str(e)})
            tool_status["get_divination_tool"] = "error"

        # Construct Prompt
        prompt_template = get_system_prompt()
        full_payload = prompt_template.replace('{question}', str(question)).replace('{divination_result}', str(raw_result_for_ai))

        # Call AI
        ai_provider = get_setting('ai_provider', 'local')
        user_gemini_key = request.headers.get('X-Gemini-Api-Key')
        
        try:
            interpretation, ai_model = call_ai(
                prompt=full_payload,
                provider=ai_provider,
                user_gemini_key=user_gemini_key
            )
            
            # Save History with AI model
            history_id = add_history(question, {"raw": divination_result_str}, interpretation, user_id, ai_model)
            
            return jsonify({
                "id": history_id,
                "result": interpretation,
                "tool_status": tool_status,
                "ai_model": ai_model
            })

        except Exception as e:
            print(f"AI Error: {e}")
            return jsonify({"error": str(e)}), 500

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

    @app.route('/api/history/<int:id>/favorite', methods=['PUT'])
    @login_required
    def favorite(id):
        data = request.json
        toggle_favorite(id, data.get('is_favorite'))
        return jsonify({"success": True})

    @app.route('/api/history/<int:id>', methods=['DELETE'])
    @login_required
    def delete_history_item(id):
        delete_history(id)
        return jsonify({"success": True})

    @app.route('/api/settings', methods=['GET', 'POST'])
    def handle_settings():
        default_prompt = get_system_prompt()
        
        if request.method == 'GET':
            return jsonify({
                "daily_limit": get_setting('daily_limit', '5'),
                "system_prompt": get_setting('system_prompt', default_prompt),
                "default_prompt": default_prompt,
                "ai_provider": get_setting('ai_provider', 'local'),
                "local_api_url": get_setting('local_api_url', 'http://localhost:1234/v1'),
                "local_model_name": get_setting('local_model_name', 'qwen/qwen3-8b')
            })
        else:
            data = request.json
            if 'daily_limit' in data:
                set_setting('daily_limit', data['daily_limit'])
            if 'system_prompt' in data:
                set_setting('system_prompt', data['system_prompt'])
            if 'ai_provider' in data:
                set_setting('ai_provider', data['ai_provider'])
            if 'local_api_url' in data:
                set_setting('local_api_url', data['local_api_url'])
            if 'local_model_name' in data:
                set_setting('local_model_name', data['local_model_name'])
            return jsonify({"success": True})
