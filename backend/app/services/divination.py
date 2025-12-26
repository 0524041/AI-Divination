"""
Divination service - 占卜服務
"""
from datetime import datetime
from typing import List, Dict, Any, Optional
import random

# 複用現有的占卜邏輯
from .divination_core import LiuYaoChart, get_current_time as _get_current_time

__all__ = ['perform_divination', 'get_current_time', 'LiuYaoChart']


def get_current_time() -> str:
    """取得當前時間資訊"""
    return _get_current_time()


def perform_divination(question: str, coins: List[int] = None) -> Dict[str, Any]:
    """
    執行六爻占卜
    
    Args:
        question: 問題
        coins: 六個硬幣結果 (0-3)，如果不提供則隨機生成
    
    Returns:
        占卜結果字典
    """
    if coins is None:
        coins = [random.randint(0, 3) for _ in range(6)]
    
    dt = datetime.now()
    chart = LiuYaoChart(dt, coins)
    result = chart.to_dict()
    result['question'] = question
    
    return result
