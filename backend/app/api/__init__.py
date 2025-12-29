"""
API 路由模組
"""
from .auth import router as auth_router
from .settings import router as settings_router
from .divination import router as divination_router
from .history import router as history_router
from .admin import router as admin_router

__all__ = [
    'auth_router',
    'settings_router',
    'divination_router',
    'history_router',
    'admin_router'
]
