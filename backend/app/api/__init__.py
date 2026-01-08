"""
API 路由模組
"""
from .auth import router as auth_router
from .settings import router as settings_router
from .liuyao import router as liuyao_router
from .history import router as history_router
from .admin import router as admin_router
from .tarot import router as tarot_router

__all__ = [
    'auth_router',
    'settings_router',
    'liuyao_router',
    'history_router',
    'admin_router',
    'tarot_router'
]
