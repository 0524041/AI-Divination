"""
性能監控 Middleware
"""
import time
import logging
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from app.utils.performance import request_logger

logger = logging.getLogger(__name__)


class PerformanceMiddleware(BaseHTTPMiddleware):
    """性能監控中間件 - 記錄每個請求的響應時間"""
    
    async def dispatch(self, request: Request, call_next):
        # 記錄開始時間
        start_time = time.perf_counter()
        
        # 處理請求
        response = await call_next(request)
        
        # 計算耗時
        duration = time.perf_counter() - start_time
        
        # 記錄
        path = request.url.path
        method = request.method
        status_code = response.status_code
        
        # 記錄到全局記錄器
        request_logger.log_request(path, method, duration, status_code)
        
        # 輸出日誌
        if duration >= 1.0:
            logger.warning(
                f"⏱️  SLOW REQUEST: {method} {path} - {duration:.3f}s - Status: {status_code}"
            )
        elif duration >= 0.5:
            logger.info(
                f"⚠️  {method} {path} - {duration:.3f}s - Status: {status_code}"
            )
        else:
            logger.debug(
                f"✓ {method} {path} - {duration:.3f}s - Status: {status_code}"
            )
        
        # 在響應頭中加入性能資訊
        response.headers["X-Response-Time"] = f"{duration:.3f}s"
        
        return response
