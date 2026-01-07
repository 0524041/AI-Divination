"""
性能分析工具 - 用於診斷 DB 和後端計算延遲
"""
import time
import functools
from typing import Callable, Any
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


class PerformanceTimer:
    """性能計時器"""
    
    def __init__(self, name: str, log_threshold: float = 0.1):
        """
        Args:
            name: 計時器名稱
            log_threshold: 超過此秒數才記錄（避免過多日誌）
        """
        self.name = name
        self.log_threshold = log_threshold
        self.start_time = None
        self.end_time = None
        
    def __enter__(self):
        self.start_time = time.perf_counter()
        return self
        
    def __exit__(self, exc_type, exc_val, exc_tb):
        self.end_time = time.perf_counter()
        elapsed = self.end_time - self.start_time
        
        if elapsed >= self.log_threshold:
            logger.warning(
                f"⏱️  [{self.name}] 耗時: {elapsed:.3f}s ({elapsed*1000:.1f}ms)"
            )
        else:
            logger.info(
                f"✓ [{self.name}] 耗時: {elapsed:.3f}s ({elapsed*1000:.1f}ms)"
            )
    
    @property
    def elapsed(self) -> float:
        """取得經過時間（秒）"""
        if self.end_time and self.start_time:
            return self.end_time - self.start_time
        return 0


def measure_time(threshold: float = 0.1):
    """
    裝飾器：測量函數執行時間
    
    Args:
        threshold: 超過此秒數才記錄警告
    """
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        def sync_wrapper(*args, **kwargs) -> Any:
            start = time.perf_counter()
            result = func(*args, **kwargs)
            elapsed = time.perf_counter() - start
            
            if elapsed >= threshold:
                logger.warning(
                    f"⏱️  {func.__name__}() 耗時: {elapsed:.3f}s ({elapsed*1000:.1f}ms)"
                )
            else:
                logger.info(
                    f"✓ {func.__name__}() 耗時: {elapsed:.3f}s ({elapsed*1000:.1f}ms)"
                )
            
            return result
        
        @functools.wraps(func)
        async def async_wrapper(*args, **kwargs) -> Any:
            start = time.perf_counter()
            result = await func(*args, **kwargs)
            elapsed = time.perf_counter() - start
            
            if elapsed >= threshold:
                logger.warning(
                    f"⏱️  {func.__name__}() 耗時: {elapsed:.3f}s ({elapsed*1000:.1f}ms)"
                )
            else:
                logger.info(
                    f"✓ {func.__name__}() 耗時: {elapsed:.3f}s ({elapsed*1000:.1f}ms)"
                )
            
            return result
        
        # 根據函數類型返回對應的包裝器
        import asyncio
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        return sync_wrapper
    
    return decorator


def log_db_query(query_name: str):
    """
    裝飾器：記錄資料庫查詢時間
    
    用法:
        @log_db_query("get_user_history")
        def get_history(...):
            ...
    """
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        def wrapper(*args, **kwargs) -> Any:
            start = time.perf_counter()
            result = func(*args, **kwargs)
            elapsed = time.perf_counter() - start
            
            logger.info(
                f"🗄️  DB Query [{query_name}]: {elapsed:.3f}s ({elapsed*1000:.1f}ms)"
            )
            
            return result
        return wrapper
    return decorator


class RequestLogger:
    """請求性能記錄器 - 用於 FastAPI middleware"""
    
    def __init__(self):
        self.requests = []
        
    def log_request(self, path: str, method: str, duration: float, status_code: int):
        """記錄請求"""
        self.requests.append({
            "path": path,
            "method": method,
            "duration": duration,
            "status_code": status_code,
            "timestamp": datetime.now()
        })
        
        # 只保留最近 100 筆
        if len(self.requests) > 100:
            self.requests = self.requests[-100:]
    
    def get_slow_requests(self, threshold: float = 1.0):
        """取得慢請求"""
        return [
            r for r in self.requests 
            if r["duration"] >= threshold
        ]
    
    def get_average_duration(self, path: str = None):
        """取得平均響應時間"""
        filtered = self.requests
        if path:
            filtered = [r for r in self.requests if r["path"] == path]
        
        if not filtered:
            return 0
        
        return sum(r["duration"] for r in filtered) / len(filtered)


# 全局請求記錄器
request_logger = RequestLogger()
