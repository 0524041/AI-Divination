"""
Core module - 核心配置與設定
"""
from .config import Config, get_config
from .database import get_db_connection, init_db

__all__ = ['Config', 'get_config', 'get_db_connection', 'init_db']
