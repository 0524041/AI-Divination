"""
FastAPI 主應用程式
"""
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
from app.core.config import get_settings

settings = get_settings()

# 建立應用程式
app = FastAPI(
    title=settings.APP_NAME,
    description="AI 算命網頁 API",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS 設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
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
