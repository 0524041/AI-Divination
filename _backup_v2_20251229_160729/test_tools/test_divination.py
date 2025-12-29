#!/usr/bin/env python3
"""
六爻排盤算法測試工具
用於驗證 divination_core.py 的排盤結果是否正確
"""

import sys
import json
from datetime import datetime

# 添加 backend 路徑
sys.path.insert(0, '/home/liewei/workspace/AI-Divination/backend')
from app.services.divination_core import (
    get_divination, LiuYaoChart, 
    BAGUA_BITS, BITS_TO_BAGUA, GONG_DIZHI, DIZHI, DIZHI_WUXING
)


def print_chart(result: dict):
    """格式化打印卦盤"""
    print("=" * 60)
    print(f"起卦時間: {result['time']}")
    print(f"八字: {result['bazi']}")
    print(f"空亡: {result['kongwang']}")
    print(f"卦宮: {result['guashen']}")
    print(f"本卦: {result['benguaming']}")
    print(f"變卦: {result['bianguaming']}")
    print("=" * 60)
    
    # 神煞
    if result.get('shensha'):
        shensha_str = ', '.join([f"{s['name']}:{s['zhi']}" for s in result['shensha']])
        print(f"神煞: {shensha_str}")
    
    print("-" * 60)
    print(f"{'爻位':<4} {'六神':<6} {'六親':<6} {'地支':<4} {'五行':<4} {'爻象':<4} {'世應':<4} {'動':<4} {'變爻'}")
    print("-" * 60)
    
    for i in range(6, 0, -1):
        yao = result[f'yao_{i}']
        origin = yao['origin']
        
        # 世應標記
        shi_ying = ''
        if origin['is_subject']:
            shi_ying = '世'
        elif origin['is_object']:
            shi_ying = '應'
        
        # 動爻標記
        moving = '○' if origin['is_changed'] else ''
        
        # 變爻信息
        variant_str = ''
        if yao.get('variant'):
            v = yao['variant']
            variant_str = f"→ {v['relative']} {v['zhi']}{v['wuxing']}"
        
        print(f"{i}爻    {yao['liushen']:<5} {origin['relative']:<5} {origin['zhi']:<3} {origin['wuxing']:<3} {origin['line']:<3} {shi_ying:<3} {moving:<3} {variant_str}")
    
    print("=" * 60)


def test_case_1():
    """
    測試案例 1: 火水未濟 變 山風蠱
    搖卦: [2, 1, 3, 0, 2, 1]
    - 2 = 少陰 (陰爻，靜)
    - 1 = 少陽 (陽爻，靜)
    - 3 = 老陰 (陰爻，動)
    - 0 = 老陽 (陽爻，動)
    
    本卦爻象 (從下到上):
    1爻: 陰 (少陰)    → yaogua[0]=2
    2爻: 陽 (少陽)    → yaogua[1]=1
    3爻: 陰 (老陰，動) → yaogua[2]=3 -> 變陽
    4爻: 陽 (老陽，動) → yaogua[3]=0 -> 變陰
    5爻: 陰 (少陰)    → yaogua[4]=2
    6爻: 陽 (少陽)    → yaogua[5]=1
    
    內卦 (1-3爻): (陰,陽,陰) = (0,1,0) = 坎
    外卦 (4-6爻): (陽,陰,陽) = (1,0,1) = 離
    本卦: 坎下離上 = 火水未濟
    卦宮: 離 (離宮三世卦)
    
    變卦 (3,4爻變):
    內卦: (0,1,1) = 巽
    外卦: (0,0,1) = 艮
    變卦: 巽下艮上 = 山風蠱
    """
    print("\n" + "=" * 60)
    print("測試案例 1: 火水未濟 → 山風蠱")
    print("搖卦: [2, 1, 3, 0, 2, 1]")
    print("=" * 60)
    
    result = get_divination(
        year=2025, month=12, day=26, hour=14, minute=30,
        yaogua=[2, 1, 3, 0, 2, 1]
    )
    
    print_chart(result)
    
    # 驗證
    errors = []
    
    # 驗證卦名
    if result['benguaming'] != '火水未濟':
        errors.append(f"本卦名錯誤: 期望 '火水未濟', 得到 '{result['benguaming']}'")
    if result['bianguaming'] != '山風蠱':
        errors.append(f"變卦名錯誤: 期望 '山風蠱', 得到 '{result['bianguaming']}'")
    
    # 火水未濟屬離宮 (三世卦)
    if result['guashen'] != '離':
        errors.append(f"卦宮錯誤: 期望 '離', 得到 '{result['guashen']}'")
    
    # 驗證動爻
    yao_3 = result['yao_3']
    yao_4 = result['yao_4']
    
    if not yao_3['origin']['is_changed']:
        errors.append("3爻應該是動爻")
    if not yao_4['origin']['is_changed']:
        errors.append("4爻應該是動爻")
    
    # 驗證變爻
    # 3爻: 坎的內卦第3爻 (陰) → 變成巽的內卦第3爻 (陽)
    # 坎內卦: 寅辰午. 3爻是午火.
    # 巽內卦: 丑亥酉. 3爻是酉金.
    if yao_3.get('variant'):
        if yao_3['variant']['zhi'] != '酉':
            errors.append(f"3爻變爻地支錯誤: 期望 '酉', 得到 '{yao_3['variant']['zhi']}'")
    
    # 4爻: 離的外卦第4爻 (陽) → 變成艮的外卦第4爻 (陰)
    # 離外卦: 酉未巳. 4爻是酉金.
    # 艮外卦: 戌子寅. 4爻是戌土.
    if yao_4.get('variant'):
        if yao_4['variant']['zhi'] != '戌':
            errors.append(f"4爻變爻地支錯誤: 期望 '戌', 得到 '{yao_4['variant']['zhi']}'")
    
    if errors:
        print("\n❌ 發現錯誤:")
        for e in errors:
            print(f"  - {e}")
    else:
        print("\n✅ 測試通過!")
    
    return len(errors) == 0


def test_case_2():
    """
    測試案例 2: 乾為天 (八純卦)
    搖卦: [1, 1, 1, 1, 1, 1] (全少陽，無動爻)
    
    內卦: 陽陽陽 = 乾
    外卦: 陽陽陽 = 乾
    本卦: 乾為天
    卦宮: 乾
    世爻: 6爻 (八純卦世在6)
    """
    print("\n" + "=" * 60)
    print("測試案例 2: 乾為天 (八純卦)")
    print("搖卦: [1, 1, 1, 1, 1, 1]")
    print("=" * 60)
    
    result = get_divination(
        year=2025, month=12, day=26, hour=14, minute=30,
        yaogua=[1, 1, 1, 1, 1, 1]
    )
    
    print_chart(result)
    
    errors = []
    
    if result['benguaming'] != '乾為天':
        errors.append(f"本卦名錯誤: 期望 '乾為天', 得到 '{result['benguaming']}'")
    if result['guashen'] != '乾':
        errors.append(f"卦宮錯誤: 期望 '乾', 得到 '{result['guashen']}'")
    if result['bianguaming'] != '無變卦':
        errors.append(f"變卦應為 '無變卦', 得到 '{result['bianguaming']}'")
    
    # 驗證世爻在6爻
    if not result['yao_6']['origin']['is_subject']:
        errors.append("世爻應在6爻")
    # 驗證應爻在3爻
    if not result['yao_3']['origin']['is_object']:
        errors.append("應爻應在3爻")
    
    # 驗證納甲 (乾卦: 子寅辰午申戌)
    expected_zhi = ['子', '寅', '辰', '午', '申', '戌']
    for i in range(1, 7):
        actual_zhi = result[f'yao_{i}']['origin']['zhi']
        if actual_zhi != expected_zhi[i-1]:
            errors.append(f"{i}爻地支錯誤: 期望 '{expected_zhi[i-1]}', 得到 '{actual_zhi}'")
    
    if errors:
        print("\n❌ 發現錯誤:")
        for e in errors:
            print(f"  - {e}")
    else:
        print("\n✅ 測試通過!")
    
    return len(errors) == 0


def test_case_3():
    """
    測試案例 3: 地天泰 (坤宮三世卦)
    搖卦: [1, 1, 1, 2, 2, 2]
    
    內卦 (1-3爻): yaogua[0,1,2]=[1,1,1] → (1,1,1) = 乾
    外卦 (4-6爻): yaogua[3,4,5]=[2,2,2] → (0,0,0) = 坤
    
    本卦: 乾下坤上 = 地天泰
    
    卦宮: 坤宮三世卦
    """
    print("\n" + "=" * 60)
    print("測試案例 3: 地天泰 (坤宮三世卦)")
    print("搖卦: [1, 1, 1, 2, 2, 2]")
    print("=" * 60)
    
    result = get_divination(
        year=2025, month=12, day=26, hour=14, minute=30,
        yaogua=[1, 1, 1, 2, 2, 2]
    )
    
    print_chart(result)
    
    errors = []
    
    if result['benguaming'] != '地天泰':
        errors.append(f"本卦名錯誤: 期望 '地天泰', 得到 '{result['benguaming']}'")
    
    # 地天泰屬坤宮三世卦
    if result['guashen'] != '坤':
        errors.append(f"卦宮錯誤: 期望 '坤', 得到 '{result['guashen']}'")
    
    # 三世卦世在3爻
    if not result['yao_3']['origin']['is_subject']:
        errors.append("世爻應在3爻 (三世卦)")
    if not result['yao_6']['origin']['is_object']:
        errors.append("應爻應在6爻")
    
    # 納甲驗證：內卦用乾，外卦用坤
    # 乾內: 子寅辰
    # 坤外: 丑亥酉
    expected_zhi = ['子', '寅', '辰', '丑', '亥', '酉']
    for i in range(1, 7):
        actual_zhi = result[f'yao_{i}']['origin']['zhi']
        if actual_zhi != expected_zhi[i-1]:
            errors.append(f"{i}爻地支錯誤: 期望 '{expected_zhi[i-1]}', 得到 '{actual_zhi}'")
    
    if errors:
        print("\n❌ 發現錯誤:")
        for e in errors:
            print(f"  - {e}")
    else:
        print("\n✅ 測試通過!")
    
    return len(errors) == 0


def test_case_4():
    """
    測試案例 4: 天風姤 (乾宮一世卦)
    搖卦: [2, 1, 1, 1, 1, 1]
    
    內卦 (1-3爻): yaogua[0,1,2]=[2,1,1] → (0,1,1) = 巽
    外卦 (4-6爻): yaogua[3,4,5]=[1,1,1] → (1,1,1) = 乾
    
    本卦: 巽下乾上 = 天風姤
    卦宮: 乾宮 (一世卦)
    世爻: 1爻
    """
    print("\n" + "=" * 60)
    print("測試案例 4: 天風姤 (乾宮一世卦)")
    print("搖卦: [2, 1, 1, 1, 1, 1]")
    print("=" * 60)
    
    result = get_divination(
        year=2025, month=12, day=26, hour=14, minute=30,
        yaogua=[2, 1, 1, 1, 1, 1]
    )
    
    print_chart(result)
    
    errors = []
    
    if result['benguaming'] != '天風姤':
        errors.append(f"本卦名錯誤: 期望 '天風姤', 得到 '{result['benguaming']}'")
    if result['guashen'] != '乾':
        errors.append(f"卦宮錯誤: 期望 '乾', 得到 '{result['guashen']}'")
    
    # 一世卦世在1爻
    if not result['yao_1']['origin']['is_subject']:
        errors.append("世爻應在1爻 (一世卦)")
    if not result['yao_4']['origin']['is_object']:
        errors.append("應爻應在4爻")
    
    # 納甲：內卦巽，外卦乾
    # 巽內: 丑亥酉
    # 乾外: 午申戌
    expected_zhi = ['丑', '亥', '酉', '午', '申', '戌']
    for i in range(1, 7):
        actual_zhi = result[f'yao_{i}']['origin']['zhi']
        if actual_zhi != expected_zhi[i-1]:
            errors.append(f"{i}爻地支錯誤: 期望 '{expected_zhi[i-1]}', 得到 '{actual_zhi}'")
    
    if errors:
        print("\n❌ 發現錯誤:")
        for e in errors:
            print(f"  - {e}")
    else:
        print("\n✅ 測試通過!")
    
    return len(errors) == 0


def test_case_5():
    """
    測試案例 5: 地雷復 (坤宮一世卦)
    搖卦: [1, 2, 2, 2, 2, 2]
    
    內卦 (1-3爻): yaogua[0,1,2]=[1,2,2] → (1,0,0) = 震
    外卦 (4-6爻): yaogua[3,4,5]=[2,2,2] → (0,0,0) = 坤
    
    本卦: 震下坤上 = 地雷復
    卦宮: 坤宮 (一世卦)
    世爻: 1爻
    """
    print("\n" + "=" * 60)
    print("測試案例 5: 地雷復 (坤宮一世卦)")
    print("搖卦: [1, 2, 2, 2, 2, 2]")
    print("=" * 60)
    
    result = get_divination(
        year=2025, month=12, day=26, hour=14, minute=30,
        yaogua=[1, 2, 2, 2, 2, 2]
    )
    
    print_chart(result)
    
    errors = []
    
    if result['benguaming'] != '地雷復':
        errors.append(f"本卦名錯誤: 期望 '地雷復', 得到 '{result['benguaming']}'")
    if result['guashen'] != '坤':
        errors.append(f"卦宮錯誤: 期望 '坤', 得到 '{result['guashen']}'")
    
    # 一世卦世在1爻
    if not result['yao_1']['origin']['is_subject']:
        errors.append("世爻應在1爻 (一世卦)")
    if not result['yao_4']['origin']['is_object']:
        errors.append("應爻應在4爻")
    
    # 納甲：內卦震，外卦坤
    # 震內: 子寅辰
    # 坤外: 丑亥酉
    expected_zhi = ['子', '寅', '辰', '丑', '亥', '酉']
    for i in range(1, 7):
        actual_zhi = result[f'yao_{i}']['origin']['zhi']
        if actual_zhi != expected_zhi[i-1]:
            errors.append(f"{i}爻地支錯誤: 期望 '{expected_zhi[i-1]}', 得到 '{actual_zhi}'")
    
    if errors:
        print("\n❌ 發現錯誤:")
        for e in errors:
            print(f"  - {e}")
    else:
        print("\n✅ 測試通過!")
    
    return len(errors) == 0


def test_case_6():
    """
    測試案例 6: 地火明夷 (坎宮遊魂卦)
    搖卦: [1, 2, 1, 2, 2, 2]
    
    內卦 (1-3爻): yaogua[0,1,2]=[1,2,1] → (1,0,1) = 離
    外卦 (4-6爻): yaogua[3,4,5]=[2,2,2] → (0,0,0) = 坤
    
    本卦: 離下坤上 = 地火明夷
    卦宮: 坎宮 (遊魂卦)
    世爻: 4爻
    """
    print("\n" + "=" * 60)
    print("測試案例 6: 地火明夷 (坎宮遊魂卦)")
    print("搖卦: [1, 2, 1, 2, 2, 2]")
    print("=" * 60)
    
    result = get_divination(
        year=2025, month=12, day=26, hour=14, minute=30,
        yaogua=[1, 2, 1, 2, 2, 2]
    )
    
    print_chart(result)
    
    errors = []
    
    if result['benguaming'] != '地火明夷':
        errors.append(f"本卦名錯誤: 期望 '地火明夷', 得到 '{result['benguaming']}'")
    
    if result['guashen'] != '坎':
        errors.append(f"卦宮錯誤: 期望 '坎', 得到 '{result['guashen']}'")
    
    # 遊魂卦世在4爻
    if not result['yao_4']['origin']['is_subject']:
        errors.append("世爻應在4爻 (遊魂卦)")
    if not result['yao_1']['origin']['is_object']:
        errors.append("應爻應在1爻")
    
    # 納甲：內卦離，外卦坤
    # 離內: 卯丑亥
    # 坤外: 丑亥酉
    expected_zhi = ['卯', '丑', '亥', '丑', '亥', '酉']
    for i in range(1, 7):
        actual_zhi = result[f'yao_{i}']['origin']['zhi']
        if actual_zhi != expected_zhi[i-1]:
            errors.append(f"{i}爻地支錯誤: 期望 '{expected_zhi[i-1]}', 得到 '{actual_zhi}'")
    
    if errors:
        print("\n❌ 發現錯誤:")
        for e in errors:
            print(f"  - {e}")
    else:
        print("\n✅ 測試通過!")
    
    return len(errors) == 0


def test_liuqin():
    """測試六親計算"""
    print("\n" + "=" * 60)
    print("測試: 六親計算驗證")
    print("=" * 60)
    
    # 使用乾為天，卦宮為乾(金)
    result = get_divination(
        year=2025, month=12, day=26, hour=14, minute=30,
        yaogua=[1, 1, 1, 1, 1, 1]  # 乾為天
    )
    
    # 乾宮五行為金，各爻地支及五行:
    # 子(水), 寅(木), 辰(土), 午(火), 申(金), 戌(土)
    # 六親關係 (以金為我):
    # 金生水 -> 子孫 (子)
    # 金克木 -> 妻財 (寅)
    # 土生金 -> 父母 (辰, 戌)
    # 火克金 -> 官鬼 (午)
    # 金同金 -> 兄弟 (申)
    
    expected_liuqin = ['子孫', '妻財', '父母', '官鬼', '兄弟', '父母']
    
    errors = []
    for i in range(1, 7):
        actual = result[f'yao_{i}']['origin']['relative']
        expected = expected_liuqin[i-1]
        if actual != expected:
            errors.append(f"{i}爻六親錯誤: 期望 '{expected}', 得到 '{actual}'")
    
    if errors:
        print("❌ 六親計算錯誤:")
        for e in errors:
            print(f"  - {e}")
    else:
        print("✅ 六親計算正確!")
    
    return len(errors) == 0


def test_random_divination():
    """
    測試隨機起卦
    """
    print("\n" + "=" * 60)
    print("測試: 隨機起卦演示")
    print("=" * 60)
    
    # 不傳入 yaogua，讓系統隨機生成
    result = get_divination()
    
    print(f"隨機搖卦結果: {result['yaogua']}")
    print_chart(result)
    
    # 簡單驗證結構
    if not result.get('benguaming'):
        print("❌ 生成失敗: 無本卦名")
        return False
        
    print("\n✅ 隨機起卦成功!")
    return True


def run_all_tests():
    """運行所有測試"""
    print("\n" + "=" * 60)
    print("六爻排盤算法測試")
    print("=" * 60)
    
    results = []
    
    results.append(("火水未濟 → 山風蠱", test_case_1()))
    results.append(("乾為天 (八純卦)", test_case_2()))
    results.append(("地天泰 (坤宮三世卦)", test_case_3()))
    results.append(("天風姤 (巽宮一世卦)", test_case_4()))
    results.append(("地雷復 (震宮一世卦)", test_case_5()))
    results.append(("火地晉 (乾宮遊魂卦)", test_case_6()))
    results.append(("六親計算", test_liuqin()))
    results.append(("隨機起卦演示", test_random_divination()))
    
    print("\n" + "=" * 60)
    print("測試結果總結")
    print("=" * 60)
    
    passed = 0
    failed = 0
    for name, result in results:
        status = "✅ 通過" if result else "❌ 失敗"
        print(f"  {name}: {status}")
        if result:
            passed += 1
        else:
            failed += 1
    
    print("-" * 60)
    print(f"總計: {passed} 通過, {failed} 失敗")
    
    return failed == 0


if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)
