#!/usr/bin/env python3
"""
比較 ichingshifa 套件與自己的六爻排盤演算法
簡化版 - 使用 qigua_time 方法
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


def convert_yaogua_format(yaogua_str: str) -> list:
    """
    轉換 ichingshifa 的搖卦格式到我們的格式
    ichingshifa: 6-9 (6=老陰, 7=少陽, 8=少陰, 9=老陽)
    我們的格式: 0-3 (0=老陽, 1=少陽, 2=少陰, 3=老陰)
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


def compare_single(yaogua_str: str, verbose=True):
    """
    比較單個搖卦的結果
    
    Args:
        yaogua_str: ichingshifa 格式的搖卦 (6-9)
        verbose: 是否顯示詳細信息
    
    Returns:
        dict: 比較結果
    """
    if not ICHINGSHIFA_AVAILABLE:
        if verbose:
            print("\n❌ ichingshifa 套件未安裝，無法比較")
        return None
    
    # 使用 ichingshifa 起卦
    try:
        ichi = Iching()
        # 手動設置搖卦
        ichi.bookgua = [int(c) for c in yaogua_str]
        # 使用時間起卦獲取完整信息
        ichi_full = ichi.qigua_time(2025, 12, 29, 14, 30)
        
        # 提取本卦和之卦信息
        ichi_bengua = ichi_full['本卦']
        ichi_zhigua = ichi_full['之卦']
    except Exception as e:
        if verbose:
            print(f"\n❌ ichingshifa 起卦失敗: {e}")
        return None
    
    # 轉換格式到我們的
    my_yaogua = convert_yaogua_format(yaogua_str)
    
    # 使用我們的演算法
    my_result = get_divination(
        year=2025, month=12, day=29, hour=14, minute=30,
        yaogua=my_yaogua
    )
    
    # 比較結果
    result = {
        'yaogua_ichingshifa': yaogua_str,
        'yaogua_mine': my_yaogua,
        'gua_name_match': ichi_bengua['卦'] == my_result['benguaming'].replace('為', ''),
        'changing_gua_match': ichi_zhigua['卦'] == my_result['bianguaming'].replace('為', '') if my_result['bianguaming'] != '無變卦' else True,
        'ichi_bengua': ichi_bengua['卦'],
        'ichi_zhigua': ichi_zhigua['卦'],
        'my_bengua': my_result['benguaming'],
        'my_zhigua': my_result['bianguaming'],
        'dizhi_diffs': [],
        'liuqin_diffs': [],
        'shiyinggua_diffs': []
    }
    
    # 比較每一爻
    for i in range(6):
        yao_key = f'yao_{i+1}'
        
        # 地支
        ichi_dizhi = ichi_bengua['地支'][i]
        my_dizhi = my_result[yao_key]['origin']['zhi']
        if ichi_dizhi != my_dizhi:
            result['dizhi_diffs'].append({
                'yao': i+1,
                'ichi': ichi_dizhi,
                'mine': my_dizhi
            })
        
        # 六親
        ichi_liuqin = ichi_bengua['六親用神'][i]
        my_liuqin = my_result[yao_key]['origin']['relative']
        if ichi_liuqin != my_liuqin:
            result['liuqin_diffs'].append({
                'yao': i+1,
                'ichi': ichi_liuqin,
                'mine': my_liuqin
            })
        
        # 世應
        ichi_shiyinggua = ichi_bengua['世應爻'][i]
        # 我的演算法中如何表示世應？需要檢查
        my_shiyinggua = my_result[yao_key].get('shiyinggua', '')
        # 簡化比較 - ichingshifa 可能是 "世", "應", "初", "二" 等
        # 我們只比較有實際意義的世應
        if ichi_shiyinggua in ['世', '應'] or my_shiyinggua:
            if ichi_shiyinggua != my_shiyinggua:
                result['shiyinggua_diffs'].append({
                    'yao': i+1,
                    'ichi': ichi_shiyinggua,
                    'mine': my_shiyinggua
                })
    
    if verbose:
        print_comparison(result, ichi_bengua, my_result)
    
    return result


def print_comparison(result, ichi_bengua, my_result):
    """打印比較結果"""
    print("\n" + "=" * 80)
    print(f"比較結果: {result['yaogua_ichingshifa']}")
    print("=" * 80)
    
    # 卦名
    if result['gua_name_match'] and result['changing_gua_match']:
        print(f"✅ 卦名一致: {result['my_bengua']} → {result['my_zhigua']}")
    else:
        print(f"❌ 卦名不同:")
        print(f"   ichingshifa: {result['ichi_bengua']} → {result['ichi_zhigua']}")
        print(f"   我的演算法: {result['my_bengua']} → {result['my_zhigua']}")
    
    # 地支
    if len(result['dizhi_diffs']) == 0:
        print(f"✅ 地支（納甲）完全一致")
    else:
        print(f"❌ 地支有 {len(result['dizhi_diffs'])}/6 爻不同:")
        for diff in result['dizhi_diffs']:
            print(f"   {diff['yao']}爻: ichingshifa={diff['ichi']}, 我的={diff['mine']}")
    
    # 六親
    if len(result['liuqin_diffs']) == 0:
        print(f"✅ 六親完全一致")
    else:
        print(f"❌ 六親有 {len(result['liuqin_diffs'])}/6 爻不同:")
        for diff in result['liuqin_diffs']:
            print(f"   {diff['yao']}爻: ichingshifa={diff['ichi']}, 我的={diff['mine']}")
    
    # 世應
    if len(result['shiyinggua_diffs']) == 0:
        print(f"✅ 世應完全一致")
    else:
        print(f"❌ 世應有 {len(result['shiyinggua_diffs'])}/6 爻不同:")
        for diff in result['shiyinggua_diffs']:
            print(f"   {diff['yao']}爻: ichingshifa={diff['ichi']}, 我的={diff['mine']}")
    
    # 詳細對比
    print("\n" + "-" * 80)
    print("詳細對比:")
    print("-" * 80)
    print(f"{'爻位':<6} {'ichingshifa':<20} {'我的演算法':<20} {'狀態'}")
    print("-" * 80)
    
    for i in range(6):
        yao_key = f'yao_{i+1}'
        ichi_line = f"{ichi_bengua['地支'][i]} {ichi_bengua['六親用神'][i]} {ichi_bengua['世應爻'][i]}"
        my_line = f"{my_result[yao_key]['origin']['zhi']} {my_result[yao_key]['origin']['relative']} {my_result[yao_key].get('shiyinggua', '')}"
        status = "✅" if ichi_line == my_line else "❌"
        print(f"{i+1}爻    {ichi_line:<20} {my_line:<20} {status}")


def batch_test():
    """批量測試常見卦象"""
    test_cases = [
        ("777777", "乾為天"),
        ("888888", "坤為地"),
        ("787878", "坎為水"),
        ("979797", "離為火"),
        ("977777", "天風姤"),
        ("888887", "地雷復"),
        ("777888", "泰卦"),
        ("888777", "否卦"),
    ]
    
    print("\n" + "=" * 80)
    print("批量測試")
    print("=" * 80)
    
    total = len(test_cases)
    passed = 0
    
    for yaogua, expected_name in test_cases:
        result = compare_single(yaogua, verbose=False)
        if result:
            all_match = (
                result['gua_name_match'] and 
                result['changing_gua_match'] and
                len(result['dizhi_diffs']) == 0 and
                len(result['liuqin_diffs']) == 0 and
                len(result['shiyinggua_diffs']) == 0
            )
            
            if all_match:
                print(f"✅ {expected_name} ({yaogua}): 完全一致")
                passed += 1
            else:
                print(f"❌ {expected_name} ({yaogua}): 有差異")
                if not result['gua_name_match']:
                    print(f"   卦名: ichingshifa={result['ichi_bengua']}, 我的={result['my_bengua']}")
                if len(result['dizhi_diffs']) > 0:
                    print(f"   地支: {len(result['dizhi_diffs'])}/6 爻不同")
                if len(result['liuqin_diffs']) > 0:
                    print(f"   六親: {len(result['liuqin_diffs'])}/6 爻不同")
                if len(result['shiyinggua_diffs']) > 0:
                    print(f"   世應: {len(result['shiyinggua_diffs'])}/6 爻不同")
    
    print("\n" + "=" * 80)
    print(f"測試結果: {passed}/{total} 個案例完全一致")
    print("=" * 80)


def main():
    """主函數"""
    import argparse
    
    parser = argparse.ArgumentParser(description='比較 ichingshifa 與自己的六爻排盤演算法')
    parser.add_argument('--yaogua', type=str, help='搖卦（6-9格式，如 777777）')
    parser.add_argument('--batch', action='store_true', help='批量測試')
    
    args = parser.parse_args()
    
    if args.batch:
        batch_test()
    elif args.yaogua:
        compare_single(args.yaogua)
    else:
        # 默認測試乾為天
        print("使用默認測試案例: 乾為天 (777777)")
        compare_single("777777")


if __name__ == '__main__':
    main()
