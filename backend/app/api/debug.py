"""
除錯與性能分析 API
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel
from typing import List, Dict, Any
from datetime import datetime
import time

from app.core.database import get_db
from app.models.user import User
from app.utils.auth import get_admin_user
from app.utils.performance import request_logger

router = APIRouter(prefix="/api/debug", tags=["除錯"])


class PerformanceStats(BaseModel):
    """性能統計"""
    total_requests: int
    average_response_time: float
    slow_requests_count: int
    slow_requests: List[Dict[str, Any]]


class DatabaseStats(BaseModel):
    """資料庫統計"""
    db_file_size: str
    total_users: int
    total_history: int
    total_ai_configs: int
    db_query_test_time: float


@router.get("/performance", response_model=PerformanceStats)
def get_performance_stats(
    threshold: float = 1.0,
    _: User = Depends(get_admin_user)
):
    """取得性能統計（僅管理員）"""
    requests = request_logger.requests
    slow_requests = request_logger.get_slow_requests(threshold)
    avg_time = request_logger.get_average_duration()
    
    return PerformanceStats(
        total_requests=len(requests),
        average_response_time=avg_time,
        slow_requests_count=len(slow_requests),
        slow_requests=[
            {
                "path": r["path"],
                "method": r["method"],
                "duration": round(r["duration"], 3),
                "status_code": r["status_code"],
                "timestamp": r["timestamp"].isoformat()
            }
            for r in slow_requests[-20:]  # 最近 20 筆慢請求
        ]
    )


@router.get("/database", response_model=DatabaseStats)
def get_database_stats(
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user)
):
    """取得資料庫統計（僅管理員）"""
    import os
    from app.models.user import User
    from app.models.history import History
    from app.models.settings import AIConfig
    
    # 取得資料庫檔案大小
    db_path = "divination.db"
    db_size = "未知"
    if os.path.exists(db_path):
        size_bytes = os.path.getsize(db_path)
        db_size = f"{size_bytes / 1024:.2f} KB" if size_bytes < 1024*1024 else f"{size_bytes / (1024*1024):.2f} MB"
    
    # 測試查詢速度
    start = time.perf_counter()
    total_users = db.query(User).count()
    total_history = db.query(History).count()
    total_ai_configs = db.query(AIConfig).count()
    query_time = time.perf_counter() - start
    
    return DatabaseStats(
        db_file_size=db_size,
        total_users=total_users,
        total_history=total_history,
        total_ai_configs=total_ai_configs,
        db_query_test_time=round(query_time, 4)
    )


@router.get("/database/vacuum")
def vacuum_database(
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user)
):
    """
    執行 VACUUM 優化資料庫（僅管理員）
    
    VACUUM 會：
    - 重建資料庫文件，消除碎片
    - 釋放未使用的空間
    - 優化查詢性能
    
    注意：大型資料庫可能需要一些時間
    """
    start = time.perf_counter()
    
    try:
        db.execute(text("VACUUM"))
        db.commit()
        elapsed = time.perf_counter() - start
        
        return {
            "success": True,
            "message": "資料庫優化完成",
            "elapsed_time": round(elapsed, 3)
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"優化失敗: {str(e)}"
        }


@router.get("/database/analyze")
def analyze_database(
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user)
):
    """
    執行 ANALYZE 優化查詢計劃（僅管理員）
    
    ANALYZE 會更新統計資訊，幫助 SQLite 選擇更好的查詢計劃
    """
    start = time.perf_counter()
    
    try:
        db.execute(text("ANALYZE"))
        db.commit()
        elapsed = time.perf_counter() - start
        
        return {
            "success": True,
            "message": "查詢計劃優化完成",
            "elapsed_time": round(elapsed, 3)
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"優化失敗: {str(e)}"
        }


@router.get("/slow-queries")
def get_slow_queries(
    path: str = None,
    _: User = Depends(get_admin_user)
):
    """取得慢查詢分析（僅管理員）"""
    requests = request_logger.requests
    
    if path:
        requests = [r for r in requests if r["path"] == path]
    
    # 按路徑分組統計
    path_stats = {}
    for r in requests:
        p = r["path"]
        if p not in path_stats:
            path_stats[p] = {
                "path": p,
                "count": 0,
                "total_time": 0,
                "min_time": float('inf'),
                "max_time": 0,
                "avg_time": 0
            }
        
        path_stats[p]["count"] += 1
        path_stats[p]["total_time"] += r["duration"]
        path_stats[p]["min_time"] = min(path_stats[p]["min_time"], r["duration"])
        path_stats[p]["max_time"] = max(path_stats[p]["max_time"], r["duration"])
    
    # 計算平均值
    for p in path_stats.values():
        p["avg_time"] = p["total_time"] / p["count"] if p["count"] > 0 else 0
        p["avg_time"] = round(p["avg_time"], 4)
        p["min_time"] = round(p["min_time"], 4)
        p["max_time"] = round(p["max_time"], 4)
        p["total_time"] = round(p["total_time"], 4)
    
    # 按平均時間排序
    sorted_stats = sorted(path_stats.values(), key=lambda x: x["avg_time"], reverse=True)
    
    return {
        "total_requests": len(requests),
        "unique_paths": len(path_stats),
        "stats": sorted_stats[:20]  # 前 20 個最慢的路徑
    }
