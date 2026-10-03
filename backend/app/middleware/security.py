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
        """添加安全響應頭

        API 回應多為 JSON／SSE，CSP 只在文件層有意義；前端 HTML 的 CSP 由
        Next.js（Vercel）以 next.config headers 提供。此處保留最嚴格的空政策，
        避免 API 回應被當成文件渲染，並移除已淘汰的 X-XSS-Protection。
        """
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["Content-Security-Policy"] = (
            "default-src 'none'; frame-ancestors 'none'; base-uri 'none'"
        )
