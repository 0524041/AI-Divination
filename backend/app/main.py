"""
FastAPI 主應用程式
"""
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import (
    auth_router,
    settings_router,
    divination_router,
    history_router,
    admin_router,
    tarot_router
)
from app.api.debug import router as debug_router
from app.middleware.performance import PerformanceMiddleware
from app.middleware.security import APISecurityMiddleware
from app.core.config import get_settings

# 設定日誌
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

settings = get_settings()

# 建立應用程式
app = FastAPI(
    title=settings.APP_NAME,
    description="AI 算命網頁 API",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
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
app.include_router(divination_router)
app.include_router(history_router)
app.include_router(admin_router)
app.include_router(tarot_router)
app.include_router(debug_router)  # 除錯 API


@app.get("/")
def root():
    """根路由"""
    return {
        "name": settings.APP_NAME,
        "version": "2.0.0",
        "status": "running"
    }


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
