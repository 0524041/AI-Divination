"""
FastAPI 主應用程式
"""

import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import (
    auth_router,
    settings_router,
    liuyao_router,
    history_router,
    admin_router,
    tarot_router,
    share_router,
)
from app.api.ziwei import router as ziwei_router
from app.api.websocket import router as websocket_router
from app.api.birth_data import router as birth_data_router
from app.api.debug import router as debug_router
from app.middleware.performance import PerformanceMiddleware
from app.middleware.security import APISecurityMiddleware
from app.core.config import get_settings
from app.core.database import run_migrations

# 設定日誌
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)

settings = get_settings()

run_migrations()

# 建立應用程式
# 生產環境隱藏 API 文件
app = FastAPI(
    title=settings.APP_NAME,
    description="AI 算命網頁 API",
    version="2.0.0",
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
    openapi_url="/openapi.json" if settings.DEBUG else None,
)

# 全局異常處理
from fastapi import Request
from fastapi.responses import JSONResponse
import traceback


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    error_msg = f"Global Error: {str(exc)}\n{traceback.format_exc()}"
    print(error_msg)  # 確保印在後端終端機

    # 生產環境隱藏詳細錯誤
    if settings.DEBUG:
        return JSONResponse(
            status_code=500,
            content={"detail": str(exc), "traceback": traceback.format_exc()},
        )
    else:
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal server error"},
        )


# API 安全中間件（最優先）
app.add_middleware(APISecurityMiddleware)

# 性能監控 Middleware（必須在 CORS 之後）
app.add_middleware(PerformanceMiddleware)

# CORS 設定 - 使用配置中的允許來源
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 註冊路由
app.include_router(auth_router)
app.include_router(settings_router)
app.include_router(liuyao_router)
app.include_router(ziwei_router)
app.include_router(websocket_router)
app.include_router(birth_data_router)
app.include_router(history_router)
app.include_router(admin_router)
app.include_router(tarot_router)
app.include_router(share_router)  # 公開分享 API
app.include_router(debug_router)  # 除錯 API


@app.get("/")
def root():
    """根路由"""
    return {"name": settings.APP_NAME, "version": "2.0.0", "status": "running"}


@app.get("/health")
def health():
    """健康檢查"""
    return {"status": "ok"}


@app.post("/api/cancel-stream/{connection_id}")
async def cancel_stream(connection_id: str):
    """取消 SSE 連接"""
    from app.utils.sse import cancel_sse_connection

    await cancel_sse_connection(connection_id)
    return {"message": "連接已取消", "connection_id": connection_id}
