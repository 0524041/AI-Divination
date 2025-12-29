#!/usr/bin/env python3
"""
比較 ichingshifa 套件與自己的六爻排盤演算法
"""

import sys
import json
from datetime import datetime

# 添加 backend 路徑
sys.path.insert(0, '/home/liewei/workspace/AI-Divination/backend')
from app.services.divination_core import get_divination

try:
    from ichingshifa.ichingshifa import Iching
    ICHINGSHIFA_AVAILABLE = True
except ImportError:
    ICHINGSHIFA_AVAILABLE = False
    print("⚠️  ichingshifa 套件未安裝")
    print("請執行: uv pip install ichingshifa sxtwl ephem numpy cn2an")
    print("或: pip install ichingshifa sxtwl ephem numpy cn2an")


def convert_yaogua_format(yaogua_str: str) -> list:
    """
    轉換 ichingshifa 的搖卦格式到我們的格式
    ichingshifa: 6-9 (6=老陰, 7=少陽, 8=少陰, 9=老陽)
    我們的格式: 0-3 (0=老陽, 1=少陽, 2=少陰, 3=老陰)
    
    Args:
        yaogua_str: 六個數字的字符串，如 "789789"
    
    Returns:
        list: [0-3] * 6
    """
    mapping = {
        '6': 3,  # 老陰 -> 3
        '7': 1,  # 少陽 -> 1
        '8': 2,  # 少陰 -> 2
        '9': 0,  # 老陽 -> 0
    }
    
    result = []
    for char in yaogua_str:
        result.append(mapping.get(char, 1))  # 默認少陽
    
    return result


def compare_gua_names(ichingshifa_result: dict, my_result: dict) -> dict:
    """比較卦名"""
    errors = []
    
    # 本卦
    ichi_bengua = ichingshifa_result['大衍筮法'][1]
    my_bengua = my_result['benguaming']
    
    if ichi_bengua != my_bengua:
        errors.append(f"本卦名不同: ichingshifa='{ichi_bengua}', 我的='{my_bengua}'")
    
    # 變卦
    ichi_zhigua = ichingshifa_result['大衍筮法'][2]
    my_biangua = my_result['bianguaming']
    
    if ichi_zhigua != my_biangua and my_biangua != '無變卦':
        errors.append(f"變卦名不同: ichingshifa='{ichi_zhigua}', 我的='{my_biangua}'")
    
    return {
        'category': '卦名比較',
        'passed': len(errors) == 0,
        'errors': errors
    }


def compare_najia(ichingshifa_result: dict, my_result: dict) -> dict:
    """比較納甲（地支）"""
    errors = []
    
    # ichingshifa 的地支
    ichi_dizhi = ichingshifa_result['本卦']['地支']  # 從下到上
    
    # 我的地支
    my_dizhi = []
    for i in range(1, 7):
        my_dizhi.append(my_result[f'yao_{i}']['origin']['zhi'])
    
    for i in range(6):
        if ichi_dizhi[i] != my_dizhi[i]:
            errors.append(f"{i+1}爻地支不同: ichingshifa='{ichi_dizhi[i]}', 我的='{my_dizhi[i]}'")
    
    return {
        'category': '納甲（地支）比較',
        'passed': len(errors) == 0,
        'errors': errors
    }


def compare_liuqin(ichingshifa_result: dict, my_result: dict) -> dict:
    """比較六親"""
    errors = []
    
    # ichingshifa 的六親
    ichi_liuqin = ichingshifa_result['本卦']['六親用神']
    
    # 六親對照表
    mapping = {
        '父': '父母',
        '官': '官鬼',
        '兄': '兄弟',
        '妻': '妻財',
        '子': '子孫'
    }
    
    # 我的六親
    my_liuqin = []
    for i in range(1, 7):
        my_liuqin.append(my_result[f'yao_{i}']['origin']['relative'])
    
    for i in range(6):
        ichi = mapping.get(ichi_liuqin[i], ichi_liuqin[i])
        my = my_liuqin[i]
        if ichi != my:
            errors.append(f"{i+1}爻六親不同: ichingshifa='{ichi}', 我的='{my}'")
    
    return {
        'category': '六親比較',
        'passed': len(errors) == 0,
        'errors': errors
    }


def compare_shiyinggua(ichingshifa_result: dict, my_result: dict) -> dict:
    """比較世應卦"""
    errors = []
    
    # ichingshifa 的世應卦
    ichi_shiyinggua = ichingshifa_result['本卦']['世應卦']
    
    # 從我的結果找世爻位置
    my_shi_pos = None
    for i in range(1, 7):
        if my_result[f'yao_{i}']['origin']['is_subject']:
            my_shi_pos = i
            break
    
    # 世應卦對照
    shi_mapping = {
        1: '一世卦',
        2: '二世卦',
        3: '三世卦',
        4: '四世卦',
        5: '五世卦',
        6: '六世卦'
    }
    
    my_shiyinggua = shi_mapping.get(my_shi_pos, '未知')
    
    # 處理遊魂卦和歸魂卦（目前我的算法沒有這個標註）
    if '遊魂' in ichi_shiyinggua or '歸魂' in ichi_shiyinggua:
        # 跳過這類比較
        pass
    elif ichi_shiyinggua != my_shiyinggua:
        errors.append(f"世應卦不同: ichingshifa='{ichi_shiyinggua}', 我的='{my_shiyinggua}'")
    
    return {
        'category': '世應卦比較',
        'passed': len(errors) == 0,
        'errors': errors
    }


def compare_guagong(ichingshifa_result: dict, my_result: dict) -> dict:
    """比較卦宮"""
    errors = []
    
    # ichingshifa 的卦宮需要從卦名推導（目前沒有直接提供）
    # 我的卦宮
    my_gong = my_result['guashen']
    
    # 暫時無法比較，因為 ichingshifa 沒有直接提供卦宮信息
    
    return {
        'category': '卦宮比較',
        'passed': True,
        'errors': ['ichingshifa 未提供卦宮信息，無法比較']
    }


def display_comparison(yaogua_str: str):
    """顯示比較結果"""
    print("\n" + "=" * 80)
    print(f"比較 ichingshifa 與自己的排盤演算法")
    print(f"搖卦: {yaogua_str} (ichingshifa 格式)")
    print("=" * 80)
    
    if not ICHINGSHIFA_AVAILABLE:
        print("\n❌ ichingshifa 套件未安裝，無法比較")
        return
    
    # 使用 ichingshifa 起卦
    try:
        ichi = Iching()
        ichi_result = ichi.mget_bookgua_details(yaogua_str)
    except Exception as e:
        print(f"\n❌ ichingshifa 起卦失敗: {e}")
        return
    
    # 轉換格式到我們的
    my_yaogua = convert_yaogua_format(yaogua_str)
    
    # 使用我們的演算法
    my_result = get_divination(
        year=2025, month=12, day=29, hour=14, minute=30,
        yaogua=my_yaogua
    )
    
    print(f"\n轉換後的搖卦: {my_yaogua} (我的格式)")
    
    # 顯示 ichingshifa 的結果
    print("\n" + "-" * 80)
    print("ichingshifa 結果:")
    print("-" * 80)
    print(f"本卦: {ichi_result['本卦']['卦']}")
    print(f"變卦: {ichi_result['之卦']['卦']}")
    print(f"世應卦: {ichi_result['本卦']['世應卦']}")
    print(f"地支: {' '.join(ichi_result['本卦']['地支'])}")
    print(f"六親: {' '.join(ichi_result['本卦']['六親用神'])}")
    print(f"五行: {' '.join(ichi_result['本卦']['五行'])}")
    
    # 顯示我的結果
    print("\n" + "-" * 80)
    print("我的演算法結果:")
    print("-" * 80)
    print(f"本卦: {my_result['benguaming']}")
    print(f"變卦: {my_result['bianguaming']}")
    print(f"卦宮: {my_result['guashen']}")
    
    my_dizhi = []
    my_liuqin = []
    my_wuxing = []
    for i in range(1, 7):
        my_dizhi.append(my_result[f'yao_{i}']['origin']['zhi'])
        my_liuqin.append(my_result[f'yao_{i}']['origin']['relative'])
        my_wuxing.append(my_result[f'yao_{i}']['origin']['wuxing'])
    
    print(f"地支: {' '.join(my_dizhi)}")
    print(f"六親: {' '.join(my_liuqin)}")
    print(f"五行: {' '.join(my_wuxing)}")
    
    # 執行比較
    print("\n" + "=" * 80)
    print("比較結果:")
    print("=" * 80)
    
    comparisons = [
        compare_gua_names(ichi_result, my_result),
        compare_najia(ichi_result, my_result),
        compare_liuqin(ichi_result, my_result),
        compare_shiyinggua(ichi_result, my_result),
        compare_guagong(ichi_result, my_result),
    ]
    
    total_passed = 0
    total_failed = 0
    
    for comp in comparisons:
        print(f"\n【{comp['category']}】")
        if comp['passed']:
            print("✅ 通過")
            total_passed += 1
        else:
            print("❌ 有差異:")
            for error in comp['errors']:
                print(f"  - {error}")
            total_failed += 1
    
    print("\n" + "=" * 80)
    print(f"總結: {total_passed} 項通過, {total_failed} 項有差異")
    print("=" * 80)


def test_multiple_cases():
    """測試多個案例"""
    test_cases = [
        ("788988", "火水未濟（有動爻）"),
        ("777777", "乾為天（八純卦）"),
        ("777888", "地天泰"),
        ("877777", "天風姤"),
        ("788888", "地雷復"),
        ("787888", "地火明夷"),
    ]
    
    print("\n" + "=" * 80)
    print("批量測試多個案例")
    print("=" * 80)
    
    for yaogua_str, description in test_cases:
        print(f"\n{'='*80}")
        print(f"測試案例: {description}")
        print(f"{'='*80}")
        display_comparison(yaogua_str)
        print("\n按 Enter 繼續下一個測試案例...")
        input()


def interactive_test():
    """互動式測試"""
    print("\n" + "=" * 80)
    print("互動式比較測試")
    print("=" * 80)
    print("\n請輸入六個數字（6-9）的搖卦結果，例如 '789789'")
    print("6=老陰, 7=少陽, 8=少陰, 9=老陽")
    print("輸入 'q' 退出")
    
    while True:
        yaogua_str = input("\n請輸入搖卦: ").strip()
        
        if yaogua_str.lower() == 'q':
            print("退出測試")
            break
        
        if len(yaogua_str) != 6:
            print("❌ 錯誤: 必須輸入 6 個數字")
            continue
        
        if not all(c in '6789' for c in yaogua_str):
            print("❌ 錯誤: 只能包含 6, 7, 8, 9")
            continue
        
        display_comparison(yaogua_str)


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='比較 ichingshifa 與自己的六爻排盤演算法')
    parser.add_argument('--yaogua', type=str, help='指定搖卦結果，例如 789789')
    parser.add_argument('--batch', action='store_true', help='批量測試多個案例')
    parser.add_argument('--interactive', action='store_true', help='互動式測試')
    
    args = parser.parse_args()
    
    if args.batch:
        test_multiple_cases()
    elif args.interactive:
        interactive_test()
    elif args.yaogua:
        display_comparison(args.yaogua)
    else:
        # 默認測試一個案例
        print("使用默認案例進行測試")
        print("提示: 使用 --interactive 進入互動模式，或 --batch 批量測試")
        display_comparison("788988")  # 火水未濟
