"""
API 安全中間件 - 防止重定向和請求偽造攻擊
"""
import hmac
import hashlib
import time
import secrets
import logging
from typing import Callable
from fastapi import Request, Response, HTTPException, status
from starlette.middleware.base import BaseHTTPMiddleware
from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class APISecurityMiddleware(BaseHTTPMiddleware):
    """
    API 安全中間件
    - 驗證請求來源
    - 驗證請求簽名
    - 防止重放攻擊
    - 防止重定向攻擊
    """
    
    # 不需要驗證的路徑
    SKIP_PATHS = [
        "/docs",
        "/redoc",
        "/openapi.json",
        "/health",
        "/",
        "/api/auth/check-init",
        "/api/auth/login",
        "/api/auth/client-config"
    ]
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """處理請求"""
        
        # 跳過不需要驗證的路徑
        if request.url.path in self.SKIP_PATHS:
            return await call_next(request)
        
        try:
            # 1. 驗證來源
            self._verify_origin(request)
            
            # 2. 驗證請求簽名（非 SSE 請求）
            if not request.url.path.endswith("/stream"):
                self._verify_signature(request)
            
            # 3. 防止重放攻擊
            self._verify_timestamp(request)
            
            # 執行請求
            response = await call_next(request)
            
            # 4. 添加安全響應頭
            self._add_security_headers(response)
            
            return response
            
        except HTTPException as e:
            logger.warning(f"Security check failed: {e.detail}")
            raise
        except Exception as e:
            logger.error(f"Security middleware error: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Security check error"
            )
    
    def _verify_origin(self, request: Request):
        """驗證請求來源（寬鬆模式，適用於通過代理的請求）"""
        origin = request.headers.get("origin")
        referer = request.headers.get("referer")
        
        # 如果沒有 origin header，可能是：
        # 1. 來自 Next.js 代理的內部請求
        # 2. 同源請求
        # 3. 非瀏覽器請求
        # 這些情況都允許通過
        if not origin:
            return
        
        # 檢查 Origin 是否在白名單中
        allowed = origin in settings.ALLOWED_ORIGINS
        
        # 對於不在白名單的 origin，僅記錄警告而不阻止
        # 因為請求可能來自 Cloudflare Tunnel 等代理
        # 真正的安全性由 JWT token 和響應簽名保證
        if not allowed:
            logger.warning(f"Request from non-whitelisted origin: {origin} (allowed for proxy compatibility)")
    
    def _verify_signature(self, request: Request):
        """驗證請求簽名（若有提供則驗證，無則跳過）"""
        signature = request.headers.get("X-Request-Signature")
        timestamp = request.headers.get("X-Request-Timestamp")
        nonce = request.headers.get("X-Request-Nonce")
        
        # 如果沒有提供簽名標頭，跳過驗證
        # 注意：這是為了兼容前端直接 fetch 的情況
        # 生產環境可以將此改為強制要求
        if not all([signature, timestamp, nonce]):
            return
        
        # 生成期望的簽名
        path = str(request.url.path)
        message = f"{path}:{timestamp}:{nonce}"
        expected_signature = hmac.new(
            settings.API_REQUEST_SIGNATURE_KEY.encode(),
            message.encode(),
            hashlib.sha256
        ).hexdigest()
        
        # 比對簽名
        if not hmac.compare_digest(signature, expected_signature):
            logger.warning(f"Invalid signature for path: {path}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid request signature"
            )
    
    def _verify_timestamp(self, request: Request):
        """防止重放攻擊 - 驗證時間戳"""
        timestamp_str = request.headers.get("X-Request-Timestamp")
        if not timestamp_str:
            return
        
        try:
            timestamp = int(timestamp_str)
            current_time = int(time.time())
            
            # 時間差不能超過 5 分鐘
            if abs(current_time - timestamp) > 300:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Request timestamp expired"
                )
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid timestamp format"
            )
    
    def _add_security_headers(self, response: Response):
        """添加安全響應頭"""
        # 防止點擊劫持
        response.headers["X-Frame-Options"] = "DENY"
        # 防止 MIME 類型嗅探
        response.headers["X-Content-Type-Options"] = "nosniff"
        # 啟用 XSS 過濾
        response.headers["X-XSS-Protection"] = "1; mode=block"
        # 內容安全策略
        response.headers["Content-Security-Policy"] = "default-src 'self'"
        # 嚴格的傳輸安全（生產環境應啟用）
        # response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        
        # 添加響應簽名（防止假冒 API 響應）
        # 注意：不使用 Content-Length，因為 CDN/代理可能會修改它（如 gzip 壓縮）
        timestamp = str(int(time.time()))
        nonce = secrets.token_urlsafe(8)  # 隨機值，確保每次響應唯一
        response.headers["X-Response-Timestamp"] = timestamp
        response.headers["X-Response-Nonce"] = nonce
        
        # 生成響應簽名：基於 timestamp 和 nonce
        # 只有擁有密鑰的服務器才能生成正確的簽名
        signature_message = f"response:{timestamp}:{nonce}"
        response_signature = hmac.new(
            settings.API_REQUEST_SIGNATURE_KEY.encode(),
            signature_message.encode(),
            hashlib.sha256
        ).hexdigest()
        response.headers["X-Response-Signature"] = response_signature


def verify_api_signature(path: str, timestamp: str, nonce: str) -> str:
    """
    生成 API 請求簽名
    用於客戶端生成簽名
    """
    message = f"{path}:{timestamp}:{nonce}"
    signature = hmac.new(
        settings.API_REQUEST_SIGNATURE_KEY.encode(),
        message.encode(),
        hashlib.sha256
    ).hexdigest()
    return signature
