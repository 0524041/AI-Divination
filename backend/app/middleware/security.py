"""
API 安全中間件 - 簡化版
移除複雜的簽名驗證，保留基本安全 headers
"""
import logging
from typing import Callable
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)


class APISecurityMiddleware(BaseHTTPMiddleware):
    """
    簡化版 API 安全中間件
    
    設計理念：
    - JWT token 已提供認證保護
    - Cloudflare Tunnel 提供 DDoS 和 SSL 防護
    - 前後端在同一機器上，無需複雜的簽名驗證
    
    保留功能：
    - 基本安全響應頭（防止 XSS、clickjacking）
    - 來源日誌記錄（便於調試）
    """
    
    # 不需要記錄日誌的路徑
    QUIET_PATHS = [
        "/docs",
        "/redoc",
        "/openapi.json",
        "/health",
        "/",
    ]
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """處理請求"""
        
        # 記錄非白名單來源（僅用於調試，不阻擋）
        self._log_origin_if_unusual(request)
        
        # 執行請求
        response = await call_next(request)
        
        # 添加安全響應頭
        self._add_security_headers(response)
        
        return response
    
    def _log_origin_if_unusual(self, request: Request):
        """記錄非預期來源（不阻擋，僅記錄）"""
        # 跳過靜態路徑的日誌
        if request.url.path in self.QUIET_PATHS:
            return
            
        origin = request.headers.get("origin")
        if origin and "localhost" not in origin and "127.0.0.1" not in origin:
            # 只記錄警告，不阻擋（因為可能來自 Cloudflare Tunnel）
            logger.debug(f"Request from external origin: {origin}")
    
    def _add_security_headers(self, response: Response):
        """添加安全響應頭"""
        # 防止點擊劫持
        response.headers["X-Frame-Options"] = "DENY"
        
        # 防止 MIME 類型嗅探
        response.headers["X-Content-Type-Options"] = "nosniff"
        
        # 啟用 XSS 過濾
        response.headers["X-XSS-Protection"] = "1; mode=block"
        
        # 內容安全策略 - 放寬限制以支援 Safari 和各種功能
        # 'unsafe-inline' 和 'unsafe-eval' 用於支援 Next.js 開發模式
        # img-src * data: 允許各種圖片來源
        # font-src * data: 允許字體載入
        # connect-src * 允許 API 連接
        response.headers["Content-Security-Policy"] = (
            "default-src 'self' 'unsafe-inline' 'unsafe-eval'; "
            "img-src * data: blob:; "
            "font-src * data:; "
            "connect-src *; "
            "style-src 'self' 'unsafe-inline';"
        )
        
        # 嚴格的傳輸安全（Cloudflare 已處理 HTTPS，此 header 由 Cloudflare 添加）
        # 在 localhost 開發環境不啟用
        # response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
