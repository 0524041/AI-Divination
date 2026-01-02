#!/usr/bin/env python3
import sys
import os
import json
from datetime import datetime

# Add backend path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../backend')))

from app.services.divination_core import get_divination
from ichingshifa import ichingshifa

def map_yaogua_to_shifa(yaogua):
    """
    Map our 0-3 values to ichingshifa's 6-9 values
    Our: 0=老陽, 1=少陽, 2=少陰, 3=老陰
    Shifa: 9=老陽, 7=少陽, 8=少陰, 6=老陰
    """
    mapping = {0: '9', 1: '7', 2: '8', 3: '6'}
    return "".join([mapping[x] for x in yaogua])

def run_comparison(year, month, day, hour, minute, yaogua):
    print(f"\nComparing Case: {year}-{month}-{day} {hour}:{minute}")
    print(f"Yaogua: {yaogua}")
    
    # 1. Get our result
    our_res = get_divination(year, month, day, hour, minute, yaogua)
    
    # 2. Get ichingshifa result
    shifa_input = map_yaogua_to_shifa(yaogua)
    # ichingshifa.Iching().display_pan returns a string, but we want the data
    # We can use qigua_now but that uses current time. 
    # Let's try to find a way to specify time with manual yaogua.
    # Looking at the user's PR: Iching().decode_gua("787987", "庚寅") 
    # But decode_gua doesn't seem to take time easily.
    
    # Actually, the user provided Iching().display_pan(year, month, day, hour, minute)
    # But we want to specify the yaogua.
    
    # Let's try to use Iching() directly and see if we can set the yaogua.
    ichi = ichingshifa.Iching()
    
    # The user example shows:
    # Iching().qigua_now() returns a big dict.
    # Let's try to simulate that with specific yaogua and time.
    
    # Looking at the user's provided 'Quick Start':
    # ichingshifa.Iching().datetime_bookgua('年', '月', '日', '時')
    
    # It turns out ichingshifa's internal state is what we need.
    # Let's try to manually trigger the logic.
    
    # Based on the user's example, it seems we can get the details.
    # However, ichingshifa's API is a bit messy. 
    # Let's try a different approach: check the source or use the displayed output if needed.
    # But wait, the user provided a sample output of qigua_now() which is a dict!
    
    # Let's try to mock the internal state or find the right method.
    # In ichingshifa, Iching().mget_bookgua_details('789789') seems to set some internal state and return something.
    
    try:
        # Trying to use decode_gua logic or similar
        # Based on the user's provided info:
        # ichingshifa.Iching().decode_gua("787987", "庚寅")
        # But we also need the day stems/branches for Liu Shen.
        
        # Let's use get_divination's internal date parsing to get the day gan/zhi
        from lunar_python import Solar
        solar = Solar.fromDate(datetime(year, month, day, hour, minute))
        lunar = solar.getLunar()
        day_gz = f"{lunar.getDayGan()}{lunar.getDayZhi()}"
        
        shifa_res = ichi.decode_gua(shifa_input, day_gz)
        print(f"DEBUG: shifa_res keys: {list(shifa_res.keys())}")
        # print(f"DEBUG: shifa_res: {json.dumps(shifa_res, ensure_ascii=False, indent=2)}")
        
        # Based on the keys, we might need to adjust below.
        ben_data = shifa_res.get('本卦', shifa_res) # Fallback if it's flat
        bian_data = shifa_res.get('之卦', {})
        
    except Exception as e:
        print(f"Error calling ichingshifa: {e}")
        return
    
    # Print Comparison
    print("-" * 60)
    print(f"{'Item':<15} {'Our Implementation':<20} {'shifa':<20}")
    print("-" * 60)
    
    our_ben = our_res['benguaming']
    shifa_ben = ben_data.get('卦', 'N/A')
    print(f"{'Bengua':<15} {our_ben:<20} {shifa_ben:<20} {'✅' if our_ben in shifa_ben or shifa_ben in our_ben else '❌'}")
    
    our_bian = our_res['bianguaming']
    shifa_bian = bian_data.get('卦', 'N/A')
    print(f"{'Biangua':<15} {our_bian:<20} {shifa_bian:<20} {'✅' if our_bian in shifa_bian or shifa_bian in our_bian or (our_bian=='無變卦' and shifa_bian=='N/A') else '❌'}")

    # our_gong = our_res['guashen']
    # shifa_gong = ben_data.get('卦宮', 'N/A')
    
    print("-" * 60)
    print(f"{'Yao':<4} {'Our Zhi':<10} {'Shifa Zhi':<10} {'Our Qin':<10} {'Shifa Qin':<10}")
    
    shifa_zhi = ben_data.get('地支', [])
    shifa_qin = ben_data.get('六親用神', [])
    
    for i in range(1, 7):
        our_yao = our_res[f'yao_{i}']['origin']
        s_zhi = shifa_zhi[i-1] if i-1 < len(shifa_zhi) else 'N/A'
        s_qin = shifa_qin[i-1] if i-1 < len(shifa_qin) else 'N/A'
        
        # Map shifa Qin names (父, 官, 兄, 子, 妻) to our full names
        qin_map = {'父': '父母', '官': '官鬼', '兄': '兄弟', '子': '子孫', '妻': '妻財'}
        s_qin_full = qin_map.get(s_qin, s_qin)
        
        zhi_match = '✅' if our_yao['zhi'] == s_zhi else '❌'
        qin_match = '✅' if our_yao['relative'] == s_qin_full else '❌'
        
        print(f"{i:<4} {our_yao['zhi']:<10} {s_zhi:<10} {our_yao['relative']:<10} {s_qin_full:<10} {zhi_match} {qin_match}")

if __name__ == "__main__":
    # Test cases
    cases = [
        # Case 1: Fire/Water Unfinished -> Mountain/Wind Pest (from test_divination.py)
        (2025, 12, 26, 14, 30, [2, 1, 3, 0, 2, 1]),
        # Case 2: Pure Heaven
        (2025, 12, 26, 14, 30, [1, 1, 1, 1, 1, 1]),
        # Case 3: Random
    ]
    
    for c in cases:
        run_comparison(*c)
