"""
安全性增強模組

這個模組提供了額外的安全功能，包括：
1. Rate Limiting（速率限制）
2. 輸入清理
3. 安全 Headers
4. 密碼強度驗證
"""
import html
import re
from typing import Optional
from fastapi import Request, HTTPException, status
from fastapi.responses import JSONResponse
from collections import defaultdict
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

# ===== Rate Limiting =====

class RateLimiter:
    """簡單的內存速率限制器"""
    
    def __init__(self):
        # 儲存格式: {ip: [(timestamp, count)]}
        self.requests = defaultdict(list)
        self.cleanup_interval = 3600  # 每小時清理一次
        self.last_cleanup = datetime.now()
    
    def is_allowed(
        self, 
        identifier: str, 
        max_requests: int, 
        window_seconds: int
    ) -> tuple[bool, Optional[int]]:
        """
        檢查是否允許請求
        
        Args:
            identifier: 識別符（通常是 IP）
            max_requests: 時間窗口內最大請求數
            window_seconds: 時間窗口（秒）
            
        Returns:
            (是否允許, 剩餘秒數)
        """
        now = datetime.now()
        cutoff = now - timedelta(seconds=window_seconds)
        
        # 清理舊記錄
        self.requests[identifier] = [
            req_time for req_time in self.requests[identifier]
            if req_time > cutoff
        ]
        
        # 檢查是否超過限制
        if len(self.requests[identifier]) >= max_requests:
            oldest_request = min(self.requests[identifier])
            retry_after = int((oldest_request + timedelta(seconds=window_seconds) - now).total_seconds())
            return False, max(retry_after, 1)
        
        # 記錄這次請求
        self.requests[identifier].append(now)
        
        # 定期清理
        if (now - self.last_cleanup).seconds > self.cleanup_interval:
            self._cleanup()
            self.last_cleanup = now
        
        return True, None
    
    def _cleanup(self):
        """清理過期的記錄"""
        now = datetime.now()
        cutoff = now - timedelta(seconds=3600)  # 保留最近 1 小時
        
        for identifier in list(self.requests.keys()):
            self.requests[identifier] = [
                req_time for req_time in self.requests[identifier]
                if req_time > cutoff
            ]
            if not self.requests[identifier]:
                del self.requests[identifier]


# 全局速率限制器
rate_limiter = RateLimiter()


def check_rate_limit(
    request: Request,
    max_requests: int = 10,
    window_seconds: int = 60
):
    """
    檢查速率限制的依賴注入函數
    
    使用方式：
    @router.post("/login")
    async def login(
        request: Request,
        _: None = Depends(lambda r: check_rate_limit(r, max_requests=5, window_seconds=60))
    ):
        ...
    """
    client_ip = request.client.host
    allowed, retry_after = rate_limiter.is_allowed(
        client_ip, max_requests, window_seconds
    )
    
    if not allowed:
        logger.warning(f"Rate limit exceeded for IP: {client_ip}")
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"請求過於頻繁，請在 {retry_after} 秒後重試",
            headers={"Retry-After": str(retry_after)}
        )


class RateLimitDep:
    """
    Rate Limit 依賴注入工廠
    
    使用方式:
    @router.post("/login")
    async def login(
        request: Request,
        _: None = Depends(RateLimitDep(max_requests=5, window_seconds=60))
    ):
        ...
    """
    def __init__(self, max_requests: int = 10, window_seconds: int = 60):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
    
    def __call__(self, request: Request):
        check_rate_limit(request, self.max_requests, self.window_seconds)


# ===== 輸入清理 =====

def sanitize_text_input(text: str, max_length: int = 1000) -> str:
    """
    清理文字輸入
    
    Args:
        text: 原始文字
        max_length: 最大長度
        
    Returns:
        清理後的文字
    """
    if not text:
        return ""
    
    # HTML 轉義
    text = html.escape(text)
    
    # 移除控制字元（但保留換行、Tab）
    text = ''.join(
        c for c in text 
        if c.isprintable() or c in ['\n', '\r', '\t']
    )
    
    # 限制長度
    text = text[:max_length]
    
    return text.strip()


import socket
import ipaddress
from urllib.parse import urlparse

def is_safe_url(url: str) -> bool:
    """
    檢查 URL 是否安全 (防止 SSRF)
    
    1. 禁止私有 IP (127.0.0.1, 192.168.x.x, 10.x.x.x 等)
    2. 禁止 Loopback
    3. 必須是 http 或 https
    """
    try:
        parsed = urlparse(url)
        hostname = parsed.hostname
        
        if not hostname:
            return False
            
        # 取得 IP
        try:
            ip_list = socket.getaddrinfo(hostname, None)
            # 檢查所有解析出來的 IP
            for item in ip_list:
                ip_str = item[4][0]
                ip_obj = ipaddress.ip_address(ip_str)
                
                if ip_obj.is_private or ip_obj.is_loopback or ip_obj.is_link_local:
                    logger.warning(f"Blocked unsafe IP access: {url} -> {ip_str}")
                    return False
                    
        except socket.gaierror:
            # 無法解析 DNS，視為不安全或無效
            return False
            
        return True
        
    except Exception as e:
        logger.error(f"Error checking URL safety: {e}")
        return False

def sanitize_url(url: str) -> str:
    """
    清理 URL 輸入
    
    只允許 http:// 和 https:// 開頭的 URL，且禁止存取私有 IP
    """
    if not url:
        return ""
    
    url = url.strip()
    
    # 只允許 http/https
    if not url.startswith(('http://', 'https://')):
        raise ValueError("URL 必須以 http:// 或 https:// 開頭")
    
    # 基本 URL 格式驗證
    url_pattern = re.compile(
        r'^https?://'  # http:// or https://
        r'(?:(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+[A-Z]{2,6}\.?|'  # domain...
        r'localhost|'  # localhost...
        r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})'  # ...or ip
        r'(?::\d+)?'  # optional port
        r'(?:/?|[/?]\S+)$', re.IGNORECASE
    )
    
    if not url_pattern.match(url):
        raise ValueError("無效的 URL 格式")
        
    # SSRF 檢查
    if not is_safe_url(url):
        raise ValueError("禁止連線到私有網路或無效的主機")
    
    return url


# ===== 密碼強度驗證 =====

def validate_password_strength(password: str) -> tuple[bool, str]:
    """
    驗證密碼強度
    
    要求：
    - 至少 8 個字元
    - 至少 1 個大寫字母
    - 至少 1 個小寫字母
    - 至少 1 個數字
    
    Returns:
        (是否有效, 錯誤訊息)
    """
    if len(password) < 8:
        return False, "密碼至少需要 8 個字元"
    
    if not re.search(r'[A-Z]', password):
        return False, "密碼需包含至少一個大寫字母"
    
    if not re.search(r'[a-z]', password):
        return False, "密碼需包含至少一個小寫字母"
    
    if not re.search(r'[0-9]', password):
        return False, "密碼需包含至少一個數字"
    
    # 可選：檢查特殊字元
    # if not re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
    #     return False, "密碼需包含至少一個特殊字元"
    
    return True, ""


# ===== 安全 Headers Middleware =====

class SecurityHeadersMiddleware:
    """添加安全相關的 HTTP Headers"""
    
    def __init__(self, app):
        self.app = app
    
    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        
        async def send_wrapper(message):
            if message["type"] == "http.response.start":
                headers = dict(message.get("headers", []))
                
                # 添加安全 Headers
                security_headers = {
                    b"x-content-type-options": b"nosniff",
                    b"x-frame-options": b"DENY",
                    b"x-xss-protection": b"1; mode=block",
                    b"referrer-policy": b"strict-origin-when-cross-origin",
                }
                
                for key, value in security_headers.items():
                    if key not in headers:
                        headers[key] = value
                
                message["headers"] = list(headers.items())
            
            await send(message)
        
        await self.app(scope, receive, send_wrapper)


# ===== 使用範例 =====

"""
在 FastAPI 應用中使用：

1. 添加 Middleware：
   from app.utils.security import SecurityHeadersMiddleware
   app.add_middleware(SecurityHeadersMiddleware)

2. 在登入 API 加上 Rate Limiting：
   from app.utils.security import check_rate_limit
   from fastapi import Depends
   
   @router.post("/login")
   async def login(
       request: Request,
       data: LoginRequest,
       _: None = Depends(lambda r: check_rate_limit(r, max_requests=5, window_seconds=60))
   ):
       # 每分鐘最多 5 次登入嘗試
       ...

3. 清理用戶輸入：
   from app.utils.security import sanitize_text_input
   
   question = sanitize_text_input(request.question, max_length=500)

4. 驗證密碼強度：
   from app.utils.security import validate_password_strength
   
   valid, error_msg = validate_password_strength(password)
   if not valid:
       raise HTTPException(400, detail=error_msg)
"""
