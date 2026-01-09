#!/usr/bin/env python3
"""
周易六十四卦爬蟲工具
從 https://www.eee-learning.com/simple64/ 抓取六十四卦的詳解內容
"""

import requests
from bs4 import BeautifulSoup
import json
import csv
import re
import time
from typing import Dict, List, Optional
from dataclasses import dataclass, asdict
from pathlib import Path


@dataclass
class HexagramData:
    """卦象資料結構"""
    number: int                    # 卦序 (1-64)
    name: str                      # 卦名 (如：乾卦)
    symbol: str                    # 卦象符號 (如：䷀)
    core_text: str                 # 卦辭原文 (如：乾，元亨利貞)
    xiang_text: str                # 象傳 (如：天行健，君子以自強不息)
    general: str                   # 諸事解釋
    love: str                      # 愛情
    career: str                    # 事業
    wealth: str                    # 財運
    advice: str                    # 建議
    detailed_explanation: str      # 詳細解釋
    source_url: str                # 來源網址


def fetch_hexagram(number: int, delay: float = 0.5) -> Optional[HexagramData]:
    """
    抓取單一卦象資料
    
    Args:
        number: 卦序 (1-64)
        delay: 請求間隔秒數，避免過度請求
        
    Returns:
        HexagramData 或 None (失敗時)
    """
    url = f"https://www.eee-learning.com/simple64/{number}"
    
    try:
        time.sleep(delay)  # 禮貌性延遲
        
        headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8',
        }
        
        response = requests.get(url, headers=headers, timeout=30)
        response.raise_for_status()
        response.encoding = 'utf-8'
        
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # 找到主要內容區域
        content_div = soup.find('div', class_='field--name-body')
        if not content_div:
            content_div = soup.find('article')
        
        if not content_div:
            print(f"警告: 卦 {number} 找不到內容區域")
            return None
        
        # 取得 HTML 內容（保留結構）
        html_content = str(content_div)
        
        # 取得純文字內容（用於備用解析）
        full_text = content_div.get_text(separator='\n', strip=True)
        
        # 解析卦名
        title_elem = soup.find('h1') or soup.find('title')
        title_text = title_elem.get_text(strip=True) if title_elem else f"{number}. 未知卦"
        
        # 從標題提取卦名
        name_match = re.search(r'(\d+)\.\s*(\S+卦)', title_text)
        name = name_match.group(2) if name_match else f"第{number}卦"
        
        # 提取卦象符號 (Unicode 卦象字符 ䷀-䷿)
        symbol_match = re.search(r'[䷀-䷿]', full_text)
        symbol = symbol_match.group(0) if symbol_match else ""
        
        # 提取卦辭原文 (卦象符號後到《象》之前的內容)
        core_text = ""
        xiang_text = ""
        
        # 使用正則表達式提取
        core_match = re.search(r'[䷀-䷿]\s*(.+?)(?=《象》|$)', full_text, re.DOTALL)
        if core_match:
            core_text = core_match.group(1).strip().split('\n')[0].strip()
        
        # 提取象傳
        xiang_match = re.search(r'《象》曰[：:](.+?)(?=諸事|愛情|$)', full_text, re.DOTALL)
        if xiang_match:
            xiang_text = xiang_match.group(1).strip().split('\n')[0].strip()
        
        # === 使用 HTML 結構解析欄位 ===
        # 找到包含「諸事」的段落
        def extract_fields_from_html(html: str) -> Dict[str, str]:
            """從 HTML 中提取結構化欄位"""
            fields = {
                'general': '',
                'love': '',
                'career': '',
                'wealth': '',
                'advice': ''
            }
            
            # 將 HTML 簡化處理
            # 將 <br> 和 <br/> 替換為特殊分隔符
            html_cleaned = re.sub(r'<br\s*/?>', '\n', html)
            # 移除其他 HTML 標籤但保留內容
            text = re.sub(r'<[^>]+>', '', html_cleaned)
            # 規範化空白
            text = re.sub(r'\s+', ' ', text)
            
            # 定義欄位關鍵字
            field_patterns = [
                ('general', r'諸事[：:]\s*'),
                ('love', r'愛情[：:]\s*'),
                ('career', r'事業[：:]\s*'),
                ('wealth', r'財運[：:]\s*'),
                ('advice', r'建議[：:]\s*'),
            ]
            
            # 找到每個欄位的位置
            positions = []
            for field_name, pattern in field_patterns:
                match = re.search(pattern, text)
                if match:
                    positions.append((match.start(), match.end(), field_name))
            
            # 按位置排序
            positions.sort(key=lambda x: x[0])
            
            # 提取每個欄位的內容
            for i, (start, end, field_name) in enumerate(positions):
                # 找到下一個欄位的開始位置，或者使用文本結尾
                if i + 1 < len(positions):
                    next_start = positions[i + 1][0]
                else:
                    # 最後一個欄位（通常是「建議」），不需要截斷
                    # 讓它包含完整的建議內容
                    next_start = len(text)
                
                content = text[end:next_start].strip()
                # 清理內容
                content = re.sub(r'\s+', ' ', content)
                fields[field_name] = content
            
            return fields
        
        # 提取欄位
        parsed_fields = extract_fields_from_html(html_content)
        
        general = parsed_fields['general']
        love = parsed_fields['love']
        career = parsed_fields['career']
        wealth = parsed_fields['wealth']
        advice = parsed_fields['advice']
        
        # 如果建議太長，截取合適的長度（但要保留較完整的內容）
        if advice and len(advice) > 400:
            # 找到合適的截斷點（句號結尾）
            sentences = re.split(r'(?<=[。！？])', advice)
            advice_short = ''
            # 保留前幾個句子，目標長度 300-400 字
            for s in sentences:
                if len(advice_short) + len(s) < 350:
                    advice_short += s
                elif not advice_short:
                    advice_short = s
                else:
                    break
            advice = advice_short.strip()
        
        # 提取詳細解釋 - 建議後面的內容
        detailed = ""
        # 找到建議欄位之後的詳細解釋
        advice_match = re.search(r'建議[：:].*?(?=\n[^\s]|\n\n)', full_text, re.DOTALL)
        if advice_match:
            remaining = full_text[advice_match.end():].strip()
            # 移除尾部雜訊
            remaining = re.sub(r'(參考閱讀|焦林值日|六日七分).*$', '', remaining, flags=re.DOTALL)
            remaining = re.sub(r'\s+', ' ', remaining).strip()
            if len(remaining) > 50:
                detailed = remaining
        
        return HexagramData(
            number=number,
            name=name,
            symbol=symbol,
            core_text=core_text,
            xiang_text=xiang_text,
            general=general,
            love=love,
            career=career,
            wealth=wealth,
            advice=advice,
            detailed_explanation=detailed,
            source_url=url
        )
        
    except requests.RequestException as e:
        print(f"錯誤: 無法抓取卦 {number} - {e}")
        return None
    except Exception as e:
        print(f"錯誤: 解析卦 {number} 時發生錯誤 - {e}")
        return None


def scrape_all_hexagrams(delay: float = 0.5) -> List[HexagramData]:
    """
    抓取全部六十四卦
    
    Args:
        delay: 每次請求間的延遲秒數
        
    Returns:
        HexagramData 列表
    """
    hexagrams = []
    
    for i in range(1, 65):
        print(f"正在抓取第 {i}/64 卦...")
        data = fetch_hexagram(i, delay)
        if data:
            hexagrams.append(data)
            print(f"  ✓ {data.name} 抓取成功")
        else:
            print(f"  ✗ 第 {i} 卦抓取失敗")
    
    return hexagrams


def save_to_json(hexagrams: List[HexagramData], filepath: str) -> None:
    """儲存為 JSON 格式"""
    data = [asdict(h) for h in hexagrams]
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"已儲存 JSON 到: {filepath}")


def save_to_csv(hexagrams: List[HexagramData], filepath: str) -> None:
    """儲存為 CSV 格式"""
    if not hexagrams:
        return
    
    fieldnames = list(asdict(hexagrams[0]).keys())
    
    with open(filepath, 'w', encoding='utf-8-sig', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for h in hexagrams:
            writer.writerow(asdict(h))
    
    print(f"已儲存 CSV 到: {filepath}")


def create_hexagram_dict(hexagrams: List[HexagramData]) -> Dict[int, Dict]:
    """
    建立卦象字典，方便程式查詢使用
    
    Returns:
        以卦序為 key 的字典
    """
    return {h.number: asdict(h) for h in hexagrams}


def main():
    """主程式"""
    print("=" * 50)
    print("周易六十四卦爬蟲工具")
    print("來源: https://www.eee-learning.com/simple64/")
    print("=" * 50)
    print()
    
    # 設定輸出路徑
    script_dir = Path(__file__).parent
    data_dir = script_dir.parent / "data"
    data_dir.mkdir(exist_ok=True)
    
    json_path = data_dir / "hexagrams_64.json"
    csv_path = data_dir / "hexagrams_64.csv"
    
    # 開始抓取
    print("開始抓取六十四卦資料...")
    print()
    
    hexagrams = scrape_all_hexagrams(delay=0.5)
    
    print()
    print(f"成功抓取 {len(hexagrams)}/64 卦")
    print()
    
    if hexagrams:
        # 儲存為 JSON
        save_to_json(hexagrams, str(json_path))
        
        # 儲存為 CSV
        save_to_csv(hexagrams, str(csv_path))
        
        # 顯示範例資料
        print()
        print("範例資料 (第一卦):")
        print("-" * 40)
        first = hexagrams[0]
        print(f"卦序: {first.number}")
        print(f"卦名: {first.name}")
        print(f"卦象: {first.symbol}")
        print(f"卦辭: {first.core_text}")
        print(f"象傳: {first.xiang_text}")
        print(f"諸事: {first.general}")
        print(f"愛情: {first.love}")
        print(f"事業: {first.career}")
        print(f"財運: {first.wealth}")
        print(f"建議: {first.advice[:100]}..." if len(first.advice) > 100 else f"建議: {first.advice}")
    
    print()
    print("完成!")


if __name__ == "__main__":
    main()
