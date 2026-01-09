#!/usr/bin/env python3
"""
六十四卦知識庫工具
提供六十四卦資料的讀取和查詢功能

此模組提供統一的介面來讀取六十四卦的資訊，包含：
- 卦名、卦象符號
- 卦辭、象傳
- 諸事、愛情、事業、財運、建議
- 詳細解釋
- 來源網址

使用範例：
    from app.utils.hexagram_db import (
        get_hexagram,
        get_hexagram_by_name,
        get_hexagram_interpretation,
        get_all_hexagrams,
    )
    
    # 根據卦序查詢
    hexagram = get_hexagram(1)
    print(hexagram['name'])  # 乾卦
    
    # 根據卦名查詢
    hexagram = get_hexagram_by_name("坤卦")
    
    # 取得完整解釋
    interpretation = get_hexagram_interpretation(11)
    print(interpretation)
"""

import csv
from pathlib import Path
from typing import Dict, List, Optional


# 資料檔案路徑
DATA_DIR = Path(__file__).parent.parent.parent / "data"
HEXAGRAMS_CSV = DATA_DIR / "hexagrams_64.csv"


# ============================================================
# 傳統卦名（上卦+下卦）到卦序的對照表
# 用於 liuyao.py 的卦名格式轉換
# ============================================================

TRADITIONAL_NAME_TO_NUMBER = {
    # 第 1-8 卦
    '乾為天': 1, '坤為地': 2, '水雷屯': 3, '山水蒙': 4, 
    '水天需': 5, '天水訟': 6, '地水師': 7, '水地比': 8,
    # 第 9-16 卦
    '風天小畜': 9, '天澤履': 10, '地天泰': 11, '天地否': 12,
    '天火同人': 13, '火天大有': 14, '地山謙': 15, '雷地豫': 16,
    # 第 17-24 卦
    '澤雷隨': 17, '山風蠱': 18, '地澤臨': 19, '風地觀': 20,
    '火雷噬嗑': 21, '山火賁': 22, '山地剝': 23, '地雷復': 24,
    # 第 25-32 卦
    '天雷無妄': 25, '山天大畜': 26, '山雷頤': 27, '澤風大過': 28,
    '坎為水': 29, '離為火': 30, '澤山咸': 31, '雷風恆': 32,
    # 第 33-40 卦
    '天山遁': 33, '雷天大壯': 34, '火地晉': 35, '地火明夷': 36,
    '風火家人': 37, '火澤睽': 38, '水山蹇': 39, '雷水解': 40,
    # 第 41-48 卦
    '山澤損': 41, '風雷益': 42, '澤天夬': 43, '天風姤': 44,
    '澤地萃': 45, '地風升': 46, '澤水困': 47, '水風井': 48,
    # 第 49-56 卦
    '澤火革': 49, '火風鼎': 50, '震為雷': 51, '艮為山': 52,
    '風山漸': 53, '雷澤歸妹': 54, '雷火豐': 55, '火山旅': 56,
    # 第 57-64 卦
    '巽為風': 57, '兌為澤': 58, '風水渙': 59, '水澤節': 60,
    '風澤中孚': 61, '雷山小過': 62, '水火既濟': 63, '火水未濟': 64,
}

# 卦序到傳統卦名的反向對照
NUMBER_TO_TRADITIONAL_NAME = {v: k for k, v in TRADITIONAL_NAME_TO_NUMBER.items()}


class HexagramDatabase:
    """
    六十四卦資料庫
    
    提供六十四卦資料的讀取、查詢、和格式化輸出功能。
    使用 CSV 作為資料來源以獲取最完整的卦象資訊。
    """
    
    def __init__(self, data_file: Optional[Path] = None):
        """
        初始化資料庫
        
        Args:
            data_file: 資料檔案路徑，預設為 data/hexagrams_64.csv
        """
        self.data_file = data_file or HEXAGRAMS_CSV
        self._hexagrams: Dict[int, Dict] = {}
        self._name_index: Dict[str, int] = {}
        self._symbol_index: Dict[str, int] = {}
        self._load_data()
    
    def _load_data(self) -> None:
        """從 CSV 載入六十四卦資料"""
        if not self.data_file.exists():
            raise FileNotFoundError(f"資料檔案不存在: {self.data_file}")
        
        with open(self.data_file, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row in reader:
                # 轉換 number 為整數
                number = int(row['number'])
                
                # 取得傳統卦名
                traditional_name = NUMBER_TO_TRADITIONAL_NAME.get(number, '')
                
                # 清理並儲存資料
                hexagram = {
                    'number': number,
                    'name': row.get('name', '').strip(),
                    'traditional_name': traditional_name,  # 添加傳統卦名
                    'symbol': row.get('symbol', '').strip(),
                    'core_text': row.get('core_text', '').strip(),
                    'xiang_text': row.get('xiang_text', '').strip(),
                    'general': row.get('general', '').strip(),
                    'love': row.get('love', '').strip(),
                    'career': row.get('career', '').strip(),
                    'wealth': row.get('wealth', '').strip(),
                    'advice': row.get('advice', '').strip(),
                    'detailed_explanation': row.get('detailed_explanation', '').strip(),
                    'source_url': row.get('source_url', '').strip(),
                }
                
                self._hexagrams[number] = hexagram
                
                # 建立名稱索引（CSV 卦名格式，如「乾卦」）
                name = hexagram['name']
                if name:
                    self._name_index[name] = number
                    # 也支援不帶「卦」字的查詢
                    if name.endswith('卦'):
                        self._name_index[name[:-1]] = number
                
                # 建立傳統卦名索引（liuyao.py 格式，如「天地否」）
                if traditional_name:
                    self._name_index[traditional_name] = number
                
                # 建立符號索引
                symbol = hexagram['symbol']
                if symbol:
                    self._symbol_index[symbol] = number
    
    def get_by_number(self, number: int) -> Optional[Dict]:
        """
        根據卦序取得卦象資料
        
        Args:
            number: 卦序 (1-64)
            
        Returns:
            卦象資料字典，若不存在則返回 None
        """
        return self._hexagrams.get(number)
    
    def get_by_name(self, name: str) -> Optional[Dict]:
        """
        根據卦名取得卦象資料
        
        Args:
            name: 卦名 (如：乾卦、乾、坤卦、坤)
            
        Returns:
            卦象資料字典，若不存在則返回 None
        """
        number = self._name_index.get(name)
        if number:
            return self._hexagrams.get(number)
        return None
    
    def get_by_symbol(self, symbol: str) -> Optional[Dict]:
        """
        根據卦象符號取得卦象資料
        
        Args:
            symbol: 卦象符號 (如：䷀)
            
        Returns:
            卦象資料字典，若不存在則返回 None
        """
        number = self._symbol_index.get(symbol)
        if number:
            return self._hexagrams.get(number)
        return None
    
    def get_all(self) -> List[Dict]:
        """
        取得全部六十四卦資料
        
        Returns:
            所有卦象資料的列表，按卦序排列
        """
        return [self._hexagrams[i] for i in range(1, 65) if i in self._hexagrams]
    
    def search(self, keyword: str) -> List[Dict]:
        """
        搜尋包含關鍵字的卦象
        
        Args:
            keyword: 搜尋關鍵字
            
        Returns:
            符合條件的卦象列表
        """
        results = []
        searchable_fields = [
            'name', 'core_text', 'xiang_text', 'general', 
            'love', 'career', 'wealth', 'advice', 'detailed_explanation'
        ]
        
        for hexagram in self._hexagrams.values():
            for field in searchable_fields:
                if keyword in hexagram.get(field, ''):
                    results.append(hexagram)
                    break
        
        return results
    
    def get_interpretation(self, number: int, include_detailed: bool = True) -> str:
        """
        取得卦象的完整解釋文字
        
        Args:
            number: 卦序 (1-64)
            include_detailed: 是否包含詳細解釋，預設為 True
            
        Returns:
            格式化的解釋文字
        """
        hexagram = self.get_by_number(number)
        if not hexagram:
            return f"找不到第 {number} 卦的資料"
        
        parts = []
        
        # 標題
        parts.append(f"【{hexagram['name']}】 {hexagram['symbol']}")
        parts.append("")
        
        # 卦辭與象傳
        parts.append(f"卦辭：{hexagram['core_text']}")
        parts.append(f"《象》曰：{hexagram['xiang_text']}")
        parts.append("")
        
        # 各面向解讀
        if hexagram.get('general'):
            parts.append(f"諸事：{hexagram['general']}")
        if hexagram.get('love'):
            parts.append(f"愛情：{hexagram['love']}")
        if hexagram.get('career'):
            parts.append(f"事業：{hexagram['career']}")
        if hexagram.get('wealth'):
            parts.append(f"財運：{hexagram['wealth']}")
        
        parts.append("")
        
        # 建議
        if hexagram.get('advice'):
            parts.append(f"建議：{hexagram['advice']}")
            parts.append("")
        
        # 詳細解釋
        if include_detailed and hexagram.get('detailed_explanation'):
            parts.append("【詳細解釋】")
            parts.append(hexagram['detailed_explanation'])
        
        return "\n".join(parts)
    
    def get_brief_interpretation(self, number: int) -> str:
        """
        取得卦象的簡要解釋（不含詳細解釋）
        
        Args:
            number: 卦序 (1-64)
            
        Returns:
            簡要格式化的解釋文字
        """
        return self.get_interpretation(number, include_detailed=False)
    
    def get_advice_text(self, number: int) -> str:
        """
        取得卦象的建議內容
        
        Args:
            number: 卦序 (1-64)
            
        Returns:
            建議文字
        """
        hexagram = self.get_by_number(number)
        if not hexagram:
            return ""
        return hexagram.get('advice', '')
    
    def get_detailed_explanation(self, number: int) -> str:
        """
        取得卦象的詳細解釋
        
        Args:
            number: 卦序 (1-64)
            
        Returns:
            詳細解釋文字
        """
        hexagram = self.get_by_number(number)
        if not hexagram:
            return ""
        return hexagram.get('detailed_explanation', '')
    
    def to_dict(self) -> Dict[int, Dict]:
        """
        將資料庫轉換為字典格式
        
        Returns:
            以卦序為 key 的字典
        """
        return self._hexagrams.copy()


# ============================================================
# 全域實例與快捷函數
# ============================================================

_db: Optional[HexagramDatabase] = None


def get_database() -> HexagramDatabase:
    """
    取得資料庫實例（單例模式）
    
    Returns:
        HexagramDatabase 實例
    """
    global _db
    if _db is None:
        _db = HexagramDatabase()
    return _db


def get_hexagram(number: int) -> Optional[Dict]:
    """
    根據卦序取得卦象資料
    
    Args:
        number: 卦序 (1-64)
        
    Returns:
        卦象資料字典
        
    Example:
        >>> hexagram = get_hexagram(1)
        >>> print(hexagram['name'])
        乾卦
    """
    return get_database().get_by_number(number)


def get_hexagram_by_name(name: str) -> Optional[Dict]:
    """
    根據卦名取得卦象資料
    
    Args:
        name: 卦名（如：乾卦、乾、坤卦、坤）
        
    Returns:
        卦象資料字典
        
    Example:
        >>> hexagram = get_hexagram_by_name("坤")
        >>> print(hexagram['number'])
        2
    """
    return get_database().get_by_name(name)


def get_hexagram_by_symbol(symbol: str) -> Optional[Dict]:
    """
    根據卦象符號取得卦象資料
    
    Args:
        symbol: 卦象符號（如：䷀）
        
    Returns:
        卦象資料字典
    """
    return get_database().get_by_symbol(symbol)


def get_all_hexagrams() -> List[Dict]:
    """
    取得全部六十四卦資料
    
    Returns:
        所有卦象資料的列表，按卦序排列
    """
    return get_database().get_all()


def get_hexagram_dict() -> Dict[int, Dict]:
    """
    取得以卦序為 key 的字典
    
    Returns:
        以卦序為 key 的完整資料字典
    """
    return get_database().to_dict()


def get_hexagram_interpretation(number: int, include_detailed: bool = True) -> str:
    """
    取得卦象的完整解釋文字
    
    Args:
        number: 卦序 (1-64)
        include_detailed: 是否包含詳細解釋
        
    Returns:
        格式化的解釋文字
        
    Example:
        >>> text = get_hexagram_interpretation(11)
        >>> print(text)
        【泰卦】 ䷊
        ...
    """
    return get_database().get_interpretation(number, include_detailed)


def search_hexagrams(keyword: str) -> List[Dict]:
    """
    搜尋包含關鍵字的卦象
    
    Args:
        keyword: 搜尋關鍵字
        
    Returns:
        符合條件的卦象列表
    """
    return get_database().search(keyword)


# ============================================================
# 六十四卦名稱與符號對照表
# ============================================================

HEXAGRAM_NAMES = {
    1: "乾卦", 2: "坤卦", 3: "屯卦", 4: "蒙卦", 5: "需卦", 6: "訟卦", 7: "師卦", 8: "比卦",
    9: "小畜卦", 10: "履卦", 11: "泰卦", 12: "否卦", 13: "同人卦", 14: "大有卦", 15: "謙卦", 16: "豫卦",
    17: "隨卦", 18: "蠱卦", 19: "臨卦", 20: "觀卦", 21: "噬嗑卦", 22: "賁卦", 23: "剝卦", 24: "復卦",
    25: "无妄卦", 26: "大畜卦", 27: "頤卦", 28: "大過卦", 29: "坎卦", 30: "離卦", 31: "咸卦", 32: "恒卦",
    33: "遯卦", 34: "大壯卦", 35: "晉卦", 36: "明夷卦", 37: "家人卦", 38: "睽卦", 39: "蹇卦", 40: "解卦",
    41: "損卦", 42: "益卦", 43: "夬卦", 44: "姤卦", 45: "萃卦", 46: "升卦", 47: "困卦", 48: "井卦",
    49: "革卦", 50: "鼎卦", 51: "震卦", 52: "艮卦", 53: "漸卦", 54: "歸妹卦", 55: "豐卦", 56: "旅卦",
    57: "巽卦", 58: "兌卦", 59: "渙卦", 60: "節卦", 61: "中孚卦", 62: "小過卦", 63: "既濟卦", 64: "未濟卦"
}

HEXAGRAM_SYMBOLS = {
    1: "䷀", 2: "䷁", 3: "䷂", 4: "䷃", 5: "䷄", 6: "䷅", 7: "䷆", 8: "䷇",
    9: "䷈", 10: "䷉", 11: "䷊", 12: "䷋", 13: "䷌", 14: "䷍", 15: "䷎", 16: "䷏",
    17: "䷐", 18: "䷑", 19: "䷒", 20: "䷓", 21: "䷔", 22: "䷕", 23: "䷖", 24: "䷗",
    25: "䷘", 26: "䷙", 27: "䷚", 28: "䷛", 29: "䷜", 30: "䷝", 31: "䷞", 32: "䷟",
    33: "䷠", 34: "䷡", 35: "䷢", 36: "䷣", 37: "䷤", 38: "䷥", 39: "䷦", 40: "䷧",
    41: "䷨", 42: "䷩", 43: "䷪", 44: "䷫", 45: "䷬", 46: "䷭", 47: "䷮", 48: "䷯",
    49: "䷰", 50: "䷱", 51: "䷲", 52: "䷳", 53: "䷴", 54: "䷵", 55: "䷶", 56: "䷷",
    57: "䷸", 58: "䷹", 59: "䷺", 60: "䷻", 61: "䷼", 62: "䷽", 63: "䷾", 64: "䷿"
}


# ============================================================
# 測試程式碼
# ============================================================

if __name__ == "__main__":
    print("=" * 60)
    print("六十四卦知識庫測試")
    print("=" * 60)
    
    db = get_database()
    print(f"✓ 載入資料成功：共 {len(db.get_all())} 卦")
    
    # 測試根據卦序查詢
    print("\n【測試 1】根據卦序查詢（第 1 卦）")
    hexagram = get_hexagram(1)
    if hexagram:
        print(f"   卦名：{hexagram['name']}")
        print(f"   卦象：{hexagram['symbol']}")
        print(f"   卦辭：{hexagram['core_text']}")
        print(f"   諸事：{hexagram['general']}")
        print(f"   財運：{hexagram['wealth']}")
    
    # 測試根據卦名查詢
    print("\n【測試 2】根據卦名查詢（坤）")
    hexagram = get_hexagram_by_name("坤")
    if hexagram:
        print(f"   卦序：{hexagram['number']}")
        print(f"   象傳：{hexagram['xiang_text']}")
    
    # 測試根據符號查詢
    print("\n【測試 3】根據符號查詢（䷂）")
    hexagram = get_hexagram_by_symbol("䷂")
    if hexagram:
        print(f"   卦名：{hexagram['name']}")
        print(f"   諸事：{hexagram['general']}")
    
    # 測試搜尋功能
    print("\n【測試 4】搜尋包含「吉」的卦象")
    results = search_hexagrams("吉")
    print(f"   找到 {len(results)} 個卦象")
    
    # 測試完整解釋
    print("\n【測試 5】第 11 卦完整解釋")
    print("-" * 40)
    print(get_hexagram_interpretation(11))
    
    # 測試詳細解釋
    print("\n【測試 6】取得詳細解釋（第 1 卦）")
    print("-" * 40)
    detailed = db.get_detailed_explanation(1)
    print(detailed[:200] + "..." if len(detailed) > 200 else detailed)
    
    print("\n" + "=" * 60)
    print("✓ 所有測試完成!")
