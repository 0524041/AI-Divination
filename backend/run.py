"""
Flask Application Entry Point
啟動 Flask 伺服器
"""
import os
import sys

# 添加後端目錄到 Python 路徑
backend_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, backend_dir)
sys.path.insert(0, os.path.dirname(backend_dir))

from flask import Flask
from flask_cors import CORS

from app.core.config import get_config
from app.core.database import init_db


def create_app():
    """Application factory"""
    config = get_config()
    
    app = Flask(__name__, 
                static_folder='../static', 
                template_folder='../templates')
    
    # Configuration
    app.secret_key = config.SECRET_KEY
    app.config['SESSION_COOKIE_HTTPONLY'] = config.SESSION_COOKIE_HTTPONLY
    app.config['PERMANENT_SESSION_LIFETIME'] = config.PERMANENT_SESSION_LIFETIME
    
    # Enable CORS
    CORS(app, supports_credentials=True, origins=config.CORS_ORIGINS)
    
    # Initialize database
    init_db()
    
    # Import and register routes (delayed import to avoid circular imports)
    from app.routes import register_routes
    register_routes(app)
    
    return app


def main():
    """Main entry point"""
    # Startup Check
    print("Checking tools...")
    try:
        from app.services.divination import get_current_time
        t = get_current_time()
        print(f"Time Check: OK")
        print("Divination Tool: Integration Logic Loaded.")
    except Exception as e:
        print(f"Startup Warning: Tools might be broken: {e}")
    
    app = create_app()
    print(f"\n🔮 AI Divination Backend V2 running on http://0.0.0.0:8080\n")
    app.run(host='0.0.0.0', port=8080, debug=True)


if __name__ == '__main__':
    main()
