#!/usr/bin/env python3
"""
簡化版六爻算法比較工具
只比較我們能夠比較的部分
"""

import sys
sys.path.insert(0, '/home/liewei/workspace/AI-Divination/backend')
from app.services.divination_core import get_divination

try:
    from ichingshifa.ichingshifa import Iching
    ICHINGSHIFA_AVAILABLE = True
except ImportError:
    ICHINGSHIFA_AVAILABLE = False

def yaogua_6to9_to_bengua(yaogua_str):
    """
    將 6-9 格式的搖卦轉換為本卦名稱
    6=老陰(變), 7=少陽, 8=少陰, 9=老陽(變)
    """
    # 簡單映射：根據上下卦確定卦名
    trigram_map = {
        '777': '乾',
        '888': '坤',
        '788': '震',
        '878': '巽',
        '787': '坎',
        '977': '離',
        '877': '艮',
        '778': '兌'
    }
    
    # 取上三爻和下三爻
    # 將6和9都視為陽爻7，8視為陰爻8來確定卦名
    normalized = yaogua_str.replace('6', '8').replace('9', '7')
    upper = normalized[3:6]
    lower = normalized[0:3]
    
    upper_gua = trigram_map.get(upper, '?')
    lower_gua = trigram_map.get(lower, '?')
    
    # 組合成卦名
    if upper_gua == lower_gua:
        gua_name = f"{upper_gua}為{guaname_map.get(upper_gua, upper_gua)}"
    else:
        # 查詢六十四卦表...這裡簡化處理
        gua_name = f"{upper_gua}{lower_gua}"
    
    return gua_name, upper_gua, lower_gua

guaname_map = {
    '乾': '天',
    '坤': '地',
    '震': '雷',
    '巽': '風',
    '坎': '水',
    '離': '火',
    '艮': '山',
    '兌': '澤'
}

def test_basic_conversion():
    """測試基本的格式轉換"""
    print("=" * 80)
    print("測試搖卦格式轉換")
    print("=" * 80)
    
    test_cases = [
        ("777777", "乾為天"),  # 111111
        ("888888", "坤為地"),  # 000000
        ("788788", "震為雷"),  # 100100
        ("877877", "巽為風"),  # 011011
        ("878878", "坎為水"),  # 010010
        ("787787", "離為火"),  # 101101
        ("887887", "艮為山"),  # 001001
        ("778778", "兌為澤"),  # 110110
    ]
    
    for yaogua, expected in test_cases:
        # 轉換為 0-3 格式
        mapping = {'6': 3, '7': 1, '8': 2, '9': 0}
        my_yaogua = [mapping[c] for c in yaogua]
        
        # 使用我的演算法
        my_result = get_divination(2025, 12, 29, 14, 30, my_yaogua)
        
        status = "✅" if expected in my_result['benguaming'] else "❌"
        print(f"{status} {yaogua} → {my_result['benguaming']} (期望: {expected})")
        
        # 顯示詳細信息
        if "✅" in status:
            print(f"   納甲: {[my_result[f'yao_{i+1}']['origin']['zhi'] for i in range(6)]}")
            print(f"   六親: {[my_result[f'yao_{i+1}']['origin']['relative'] for i in range(6)]}")

def main():
    if not ICHINGSHIFA_AVAILABLE:
        print("⚠️  ichingshifa 套件未安裝，僅測試自己的演算法")
        print()
    
    test_basic_conversion()

if __name__ == '__main__':
    main()
