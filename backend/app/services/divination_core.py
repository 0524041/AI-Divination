"""
六爻占卜核心計算庫
直接封裝六爻排盤邏輯，不再依賴 MCP Server
"""

from datetime import datetime
from lunar_python import Lunar, Solar
from typing import List, Dict, Any, Optional
import random

# ========== 基礎數據 ==========

# 天干
TIANGAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']
# 地支
DIZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']
# 五行
WUXING = ['木', '木', '火', '火', '土', '土', '金', '金', '水', '水']  # 對應天干
DIZHI_WUXING = ['水', '土', '木', '木', '土', '火', '火', '土', '金', '金', '土', '水']  # 對應地支

# 六親 (相對於卦宮五行)
LIUQIN = {
    '同': '兄弟',
    '生': '子孫',
    '克': '妻財',
    '被生': '父母',
    '被克': '官鬼'
}

# 六神 (根據日干)
LIUSHEN_MAP = {
    '甲': ['青龍', '朱雀', '勾陳', '螣蛇', '白虎', '玄武'],
    '乙': ['青龍', '朱雀', '勾陳', '螣蛇', '白虎', '玄武'],
    '丙': ['朱雀', '勾陳', '螣蛇', '白虎', '玄武', '青龍'],
    '丁': ['朱雀', '勾陳', '螣蛇', '白虎', '玄武', '青龍'],
    '戊': ['勾陳', '螣蛇', '白虎', '玄武', '青龍', '朱雀'],
    '己': ['勾陳', '螣蛇', '白虎', '玄武', '青龍', '朱雀'],
    '庚': ['白虎', '玄武', '青龍', '朱雀', '勾陳', '螣蛇'],
    '辛': ['白虎', '玄武', '青龍', '朱雀', '勾陳', '螣蛇'],
    '壬': ['玄武', '青龍', '朱雀', '勾陳', '螣蛇', '白虎'],
    '癸': ['玄武', '青龍', '朱雀', '勾陳', '螣蛇', '白虎'],
}

# 八卦基本信息 (卦名, 五行, 世爻位置, 應爻位置)
BAGUA = {
    '乾': {'wuxing': '金', 'shi': 6, 'ying': 3},
    '兌': {'wuxing': '金', 'shi': 5, 'ying': 2},
    '離': {'wuxing': '火', 'shi': 4, 'ying': 1},
    '震': {'wuxing': '木', 'shi': 1, 'ying': 4},
    '巽': {'wuxing': '木', 'shi': 2, 'ying': 5},
    '坎': {'wuxing': '水', 'shi': 3, 'ying': 6},
    '艮': {'wuxing': '土', 'shi': 4, 'ying': 1},
    '坤': {'wuxing': '土', 'shi': 3, 'ying': 6},
}

# 八卦卦象 (從下到上: 初爻, 二爻, 三爻) 1=陽, 0=陰
BAGUA_PATTERN = {
    (1, 1, 1): '乾',  # ☰
    (1, 1, 0): '兌',  # ☱ (初爻陽, 二爻陽, 三爻陰) -> 修正了這裡
    (1, 0, 1): '離',  # ☲
    (1, 0, 0): '震',  # ☳ (初爻陽, 二爻陰, 三爻陰) -> 修正了這裡
    (0, 1, 1): '巽',  # ☴ (初爻陰, 二爻陽, 三爻陽) -> 修正了這裡
    (0, 1, 0): '坎',  # ☵
    (0, 0, 1): '艮',  # ☶ (初爻陰, 二爻陰, 三爻陽) -> 修正了這裡
    (0, 0, 0): '坤',  # ☷
}



# 六十四卦名稱 (下卦, 上卦) -> 卦名
LIUSHISI_GUA = {
    ('乾', '乾'): '乾為天', ('坤', '乾'): '天地否', ('震', '乾'): '天雷無妄', ('巽', '乾'): '天風姤',
    ('坎', '乾'): '天水訟', ('離', '乾'): '天火同人', ('艮', '乾'): '天山遁', ('兌', '乾'): '天澤履',
    ('乾', '坤'): '地天泰', ('坤', '坤'): '坤為地', ('震', '坤'): '地雷復', ('巽', '坤'): '地風升',
    ('坎', '坤'): '地水師', ('離', '坤'): '地火明夷', ('艮', '坤'): '地山謙', ('兌', '坤'): '地澤臨',
    ('乾', '震'): '雷天大壯', ('坤', '震'): '雷地豫', ('震', '震'): '震為雷', ('巽', '震'): '雷風恆',
    ('坎', '震'): '雷水解', ('離', '震'): '雷火豐', ('艮', '震'): '雷山小過', ('兌', '震'): '雷澤歸妹',
    ('乾', '巽'): '風天小畜', ('坤', '巽'): '風地觀', ('震', '巽'): '風雷益', ('巽', '巽'): '巽為風',
    ('坎', '巽'): '風水渙', ('離', '巽'): '風火家人', ('艮', '巽'): '風山漸', ('兌', '巽'): '風澤中孚',
    ('乾', '坎'): '水天需', ('坤', '坎'): '水地比', ('震', '坎'): '水雷屯', ('巽', '坎'): '水風井',
    ('坎', '坎'): '坎為水', ('離', '坎'): '水火既濟', ('艮', '坎'): '水山蹇', ('兌', '坎'): '水澤節',
    ('乾', '離'): '火天大有', ('坤', '離'): '火地晉', ('震', '離'): '火雷噬嗑', ('巽', '離'): '火風鼎',
    ('坎', '離'): '火水未濟', ('離', '離'): '離為火', ('艮', '離'): '火山旅', ('兌', '離'): '火澤睽',
    ('乾', '艮'): '山天大畜', ('坤', '艮'): '山地剝', ('震', '艮'): '山雷頤', ('巽', '艮'): '山風蠱',
    ('坎', '艮'): '山水蒙', ('離', '艮'): '山火賁', ('艮', '艮'): '艮為山', ('兌', '艮'): '山澤損',
    ('乾', '兌'): '澤天夬', ('坤', '兌'): '澤地萃', ('震', '兌'): '澤雷隨', ('巽', '兌'): '澤風大過',
    ('坎', '兌'): '澤水困', ('離', '兌'): '澤火革', ('艮', '兌'): '澤山咸', ('兌', '兌'): '兌為澤',
}

# 八宮所屬地支 (用於安世應和六親)
# 注意：這裡定義的是八純卦的納甲，用於查找內卦和外卦對應的地支
# 內卦取前三個，外卦取後三個
GONG_DIZHI = {
    '乾': ['子', '寅', '辰', '午', '申', '戌'],  # 乾宮 (內子寅辰，外午申戌)
    '兌': ['巳', '卯', '丑', '亥', '酉', '未'],  # 兌宮 (內巳卯丑，外亥酉未)
    '離': ['卯', '丑', '亥', '酉', '未', '巳'],  # 離宮 (內卯丑亥，外酉未巳)
    '震': ['子', '寅', '辰', '午', '申', '戌'],  # 震宮 (內子寅辰，外午申戌)
    '巽': ['丑', '亥', '酉', '未', '巳', '卯'],  # 巽宮 (內丑亥酉，外未巳卯)
    '坎': ['寅', '辰', '午', '申', '戌', '子'],  # 坎宮 (內寅辰午，外申戌子)
    '艮': ['辰', '午', '申', '戌', '子', '寅'],  # 艮宮 (內辰午申，外戌子寅)
    '坤': ['未', '巳', '卯', '丑', '亥', '酉'],  # 坤宮 (內未巳卯，外丑亥酉)
}

# 八卦二進制值 (對應上面的 Pattern，最低位是初爻)
# 例如 震(1,0,0) -> 二進制 001 (Decimal 1)
# 例如 艮(0,0,1) -> 二進制 100 (Decimal 4)
BAGUA_BITS = {
    '乾': 0b111, # 7
    '兌': 0b011, # 3 (注意：這裡要配合上方 Pattern 修改，011 代表 上0中1下1 嗎? 看你的 Pattern 邏輯)
    '離': 0b101, # 5
    '震': 0b001, # 1 (低位是1 -> 初爻是陽)
    '巽': 0b110, # 6 (低位0 -> 初爻陰, 高位11 -> 二三爻陽)
    '坎': 0b010, # 2
    '艮': 0b100, # 4 (高位1 -> 三爻陽)
    '坤': 0b000  # 0
}
# 反向映射
BITS_TO_BAGUA = {v: k for k, v in BAGUA_BITS.items()}


# ========== 工具函數 ==========

def get_wuxing_relation(source: str, target: str) -> str:
    """獲取五行生克關係"""
    wuxing_order = ['木', '火', '土', '金', '水']
    s_idx = wuxing_order.index(source)
    t_idx = wuxing_order.index(target)
    
    if s_idx == t_idx:
        return '同'
    elif (s_idx + 1) % 5 == t_idx:
        return '生'  # 我生
    elif (s_idx + 2) % 5 == t_idx:
        return '克'  # 我克
    elif (s_idx - 1) % 5 == t_idx:
        return '被生'  # 生我
    else:
        return '被克'  # 克我


def get_liuqin(gong_wuxing: str, yao_wuxing: str) -> str:
    """根據卦宮五行和爻五行獲取六親"""
    relation = get_wuxing_relation(gong_wuxing, yao_wuxing)
    return LIUQIN.get(relation, '未知')


def coins_to_yao(coin: int) -> tuple:
    """
    將硬幣結果轉換為爻信息 (假設 coin = 背面的數量)
    3背(Old Yin), 3字(Old Yang), 1背(Young Yang), 2背(Young Yin)
    """
    if coin == 0:  # 0背 (3字) -> 老陽 (動) -> 本爻為陽，變爻為陰
        return (True, True)   # 修正：老陽是陽爻
    elif coin == 1:  # 1背 (2字) -> 少陽 (靜)
        return (True, False)
    elif coin == 2:  # 2背 (1字) -> 少陰 (靜)
        return (False, False)
    else:  # coin == 3, 3背 -> 老陰 (動) -> 本爻為陰，變爻為陽
        return (False, True)  # 修正：老陰是陰爻


def get_kongwang(day_gan: str, day_zhi: str) -> List[str]:
    """計算日空亡"""
    gan_idx = TIANGAN.index(day_gan)
    zhi_idx = DIZHI.index(day_zhi)
    
    # 計算旬首
    xun_start = (zhi_idx - gan_idx) % 12
    
    # 空亡的兩個地支
    kong1 = DIZHI[(xun_start + 10) % 12]
    kong2 = DIZHI[(xun_start + 11) % 12]
    
    return [kong1, kong2]


# ========== 核心排盤類 ==========

class LiuYaoChart:
    """六爻排盤核心類"""
    
    def __init__(self, dt: datetime, yaogua: Optional[List[int]] = None):
        """
        初始化六爻盤
        dt: 起卦時間
        yaogua: 搖卦結果 (6個0-3的數字)，如果不提供則隨機生成
        """
        self.dt = dt
        self.yaogua = yaogua if yaogua else [random.randint(0, 3) for _ in range(6)]
        
        # 農曆和八字
        solar = Solar.fromDate(dt)
        self.lunar = Lunar.fromSolar(solar)
        
        # 四柱
        self.year_gan = self.lunar.getYearGan()
        self.year_zhi = self.lunar.getYearZhi()
        self.month_gan = self.lunar.getMonthGan()
        self.month_zhi = self.lunar.getMonthZhi()
        self.day_gan = self.lunar.getDayGan()
        self.day_zhi = self.lunar.getDayZhi()
        self.hour_gan = self.lunar.getTimeGan()
        self.hour_zhi = self.lunar.getTimeZhi()
        
        self.bazi = f"{self.year_gan}{self.year_zhi} {self.month_gan}{self.month_zhi} {self.day_gan}{self.day_zhi} {self.hour_gan}{self.hour_zhi}"
        
        # 空亡
        self.kongwang = get_kongwang(self.day_gan, self.day_zhi)
        
        # 解析爻
        self._parse_yaos()
        
        # 排盤
        self._build_chart()
    
    def _parse_yaos(self):
        """解析六爻"""
        self.yaos = []
        for coin in self.yaogua:
            is_yang, is_moving = coins_to_yao(coin)
            self.yaos.append({
                'coin': coin,
                'is_yang': is_yang,
                'is_moving': is_moving
            })
    
    def _get_gua_pattern(self, yaos: List[dict], start: int, end: int) -> tuple:
        """獲取卦象模式"""
        pattern = []
        for i in range(start, end):
            pattern.append(1 if yaos[i]['is_yang'] else 0)
        return tuple(pattern)
    
    def _find_gong_and_shi(self, upper_name: str, lower_name: str) -> tuple:
        """
        尋宮安世：根據上下卦名確定所屬卦宮和世爻位置
        返回: (卦宮名, 世爻位置 1-6)
        
        注意：傳入的 upper_name 是外卦（4-6爻），lower_name 是內卦（1-3爻）
        但在傳統卦序中，外卦是上卦，內卦是下卦
        """
        up = BAGUA_BITS[upper_name]  # 外卦（上卦）的二進制值
        low = BAGUA_BITS[lower_name]  # 內卦（下卦）的二進制值
        
        # 1. 八純卦 (上下相同) -> 六世卦
        if up == low:
            return upper_name, 6
            
        # 2. 遍歷八宮的世系表尋找匹配
        # 每個宮的生成順序：
        # 本宮(6) -> 1世 -> 2世 -> 3世 -> 4世 -> 5世 -> 遊魂(4) -> 歸魂(3)
        # 
        # 傳統世系變爻規則：
        # - 本宮：內外卦皆為本宮卦象
        # - 1世：內卦初爻變
        # - 2世：內卦初二爻變
        # - 3世：內卦三爻全變
        # - 4世：外卦初爻變
        # - 5世：外卦初二爻變
        # - 遊魂：外卦初爻變回（相當於只有外卦二爻變）
        # - 歸魂：內卦恢復本宮（下卦變回本宮）
        
        for gong_name, gong_val in BAGUA_BITS.items():
            seq = []
            
            # 本宮 (世6) - 內外卦皆為本宮
            seq.append(((gong_val, gong_val), 6))
            
            # 1世 (內卦變初爻)
            curr_low = gong_val ^ 0b001
            seq.append(((gong_val, curr_low), 1))
            
            # 2世 (內卦再變二爻)
            curr_low = curr_low ^ 0b010
            seq.append(((gong_val, curr_low), 2))
            
            # 3世 (內卦再變三爻，此時內卦全變為對宮)
            curr_low = curr_low ^ 0b100
            seq.append(((gong_val, curr_low), 3))
            
            # 4世 (外卦變初爻，即第四爻)
            curr_up = gong_val ^ 0b001
            seq.append(((curr_up, curr_low), 4))
            
            # 5世 (外卦再變二爻，即第五爻)
            curr_up = curr_up ^ 0b010
            seq.append(((curr_up, curr_low), 5))
            
            # 遊魂 (外卦初爻變回，即第四爻恢復)
            curr_up = curr_up ^ 0b001
            seq.append(((curr_up, curr_low), 4))
            
            # 歸魂 (內卦恢復本宮)
            curr_low = gong_val
            seq.append(((curr_up, curr_low), 3))
            
            # 檢查是否匹配
            # seq 中的格式是 ((外卦值, 內卦值), 世爻位置)
            for (outer, inner), shi in seq:
                if outer == up and inner == low:
                    return gong_name, shi
                    
        return '乾', 6  # Fallback

    def _build_chart(self):
        """構建卦盤"""
        # 本卦上下卦
        lower_pattern = self._get_gua_pattern(self.yaos, 0, 3)
        upper_pattern = self._get_gua_pattern(self.yaos, 3, 6)
        
        self.lower_gua = BAGUA_PATTERN.get(lower_pattern, '坤')
        self.upper_gua = BAGUA_PATTERN.get(upper_pattern, '坤')
        
        # 本卦名 (注意：LIUSHISI_GUA 的鍵是 (下卦, 上卦))
        self.bengua_name = LIUSHISI_GUA.get((self.lower_gua, self.upper_gua), '未知卦')
        
        # 計算變卦 (動爻變)
        changed_yaos = []
        has_change = False
        for yao in self.yaos:
            if yao['is_moving']:
                has_change = True
                changed_yaos.append({
                    'is_yang': not yao['is_yang'],  # 動則變
                    'is_moving': False
                })
            else:
                changed_yaos.append(yao.copy())
        
        if has_change:
            bian_lower = self._get_gua_pattern(changed_yaos, 0, 3)
            bian_upper = self._get_gua_pattern(changed_yaos, 3, 6)
            self.bian_lower_gua = BAGUA_PATTERN.get(bian_lower, '坤')
            self.bian_upper_gua = BAGUA_PATTERN.get(bian_upper, '坤')
            self.biangua_name = LIUSHISI_GUA.get((self.bian_lower_gua, self.bian_upper_gua), '未知卦')
        else:
            self.biangua_name = None
        
        # 尋宮安世 (修正：使用正確的尋宮算法)
        self.gong, self.shi_pos = self._find_gong_and_shi(self.upper_gua, self.lower_gua)
        self.gong_wuxing = BAGUA[self.gong]['wuxing']
        
        # 安應爻 (世爻對面)
        # 世在1->應4, 2->5, 3->6, 4->1, 5->2, 6->3
        self.ying_pos = (self.shi_pos + 3) if self.shi_pos <= 3 else (self.shi_pos - 3)
        
        # 六神
        self.liushen = LIUSHEN_MAP.get(self.day_gan, LIUSHEN_MAP['甲'])
        
        # 納甲 (修正：內卦用內卦納甲，外卦用外卦納甲)
        # 獲取本卦內外卦的納甲列表
        lower_dizhi_list = GONG_DIZHI.get(self.lower_gua, GONG_DIZHI['乾'])
        upper_dizhi_list = GONG_DIZHI.get(self.upper_gua, GONG_DIZHI['乾'])
        
        # 如果有變卦，準備變卦的納甲
        if has_change and self.biangua_name:
            # 變卦的卦宮（用於定六親? 不，變爻六親仍以本卦卦宮為準，除非是變卦本身的六親）
            # 通常變爻六親是看變出之爻與本宮的關係
            
            # 獲取變卦內外卦的納甲列表
            bian_lower_dizhi_list = GONG_DIZHI.get(self.bian_lower_gua, GONG_DIZHI['乾'])
            bian_upper_dizhi_list = GONG_DIZHI.get(self.bian_upper_gua, GONG_DIZHI['乾'])
        
        for i, yao in enumerate(self.yaos):
            pos = i + 1  # 爻位 1-6
            
            # 地支 (1-3爻取內卦前三，4-6爻取外卦後三)
            if i < 3: # 內卦
                yao['zhi'] = lower_dizhi_list[i]
            else: # 外卦
                yao['zhi'] = upper_dizhi_list[i]
            
            # 五行
            zhi_idx = DIZHI.index(yao['zhi'])
            yao['wuxing'] = DIZHI_WUXING[zhi_idx]
            
            # 六親 (以本卦卦宮五行為準)
            yao['liuqin'] = get_liuqin(self.gong_wuxing, yao['wuxing'])
            
            # 六神
            yao['liushen'] = self.liushen[i] if i < len(self.liushen) else '青龍'
            
            # 世應標記
            yao['is_shi'] = (pos == self.shi_pos)
            yao['is_ying'] = (pos == self.ying_pos)
            
            # 爻象
            yao['line'] = '⚊' if yao['is_yang'] else '⚋'
            
            # 空亡標記
            yao['is_kong'] = yao['zhi'] in self.kongwang
            
            # 變爻信息
            if yao['is_moving'] and self.biangua_name:
                changed_yao = changed_yaos[i]
                
                # 變爻的地支 (從變卦對應位置取)
                if i < 3:
                    variant_zhi = bian_lower_dizhi_list[i]
                else:
                    variant_zhi = bian_upper_dizhi_list[i]
                
                # 變爻的五行
                variant_zhi_idx = DIZHI.index(variant_zhi)
                variant_wuxing = DIZHI_WUXING[variant_zhi_idx]
                
                # 變爻的六親（相對於本卦卦宮）
                variant_liuqin = get_liuqin(self.gong_wuxing, variant_wuxing)
                
                yao['variant'] = {
                    'is_yang': changed_yao['is_yang'],
                    'zhi': variant_zhi,
                    'wuxing': variant_wuxing,
                    'liuqin': variant_liuqin
                }
    
    def get_shensha(self) -> List[Dict[str, Any]]:
        """計算神煞"""
        shensha = []
        
        # 驛馬 (根據日支)
        yima_map = {'寅': '申', '申': '寅', '巳': '亥', '亥': '巳',
                    '子': '寅', '午': '申', '卯': '巳', '酉': '亥',
                    '辰': '寅', '戌': '申', '丑': '亥', '未': '巳'}
        yima = yima_map.get(self.day_zhi, '')
        if yima:
            shensha.append({'name': '驛馬', 'zhi': [yima]})
        
        # 桃花 (根據日支)
        taohua_map = {'寅': '卯', '午': '卯', '戌': '卯',
                      '申': '酉', '子': '酉', '辰': '酉',
                      '巳': '午', '酉': '午', '丑': '午',
                      '亥': '子', '卯': '子', '未': '子'}
        taohua = taohua_map.get(self.day_zhi, '')
        if taohua:
            shensha.append({'name': '桃花', 'zhi': [taohua]})
        
        return shensha
    
    def to_dict(self) -> Dict[str, Any]:
        """輸出為字典格式"""
        result = {
            'yaogua': self.yaogua,
            'time': self.dt.strftime('%Y-%m-%d %H:%M:%S'),
            'bazi': self.bazi,
            'kongwang': ''.join(self.kongwang),
            'guashen': self.gong,
            'benguaming': self.bengua_name,
            'bianguaming': self.biangua_name or '無變卦',
            'shensha': self.get_shensha(),
        }
        
        # 六爻詳情
        yao_names = ['yao_1', 'yao_2', 'yao_3', 'yao_4', 'yao_5', 'yao_6']
        for i, yao in enumerate(self.yaos):
            yao_data = {
                'liushen': yao['liushen'],
                'origin': {
                    'relative': yao['liuqin'],
                    'zhi': yao['zhi'],
                    'wuxing': yao['wuxing'],
                    'line': yao['line'],
                    'is_subject': yao['is_shi'],
                    'is_object': yao['is_ying'],
                    'is_changed': yao['is_moving'],
                }
            }
            
            if yao.get('variant'):
                yao_data['variant'] = {
                    'relative': yao['variant']['liuqin'],
                    'zhi': yao['variant']['zhi'],
                    'wuxing': yao['variant']['wuxing'],
                }
            
            result[yao_names[i]] = yao_data
        
        return result


# ========== 公開 API ==========

def get_current_time() -> str:
    """返回當前時間"""
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def get_divination(
    year: Optional[int] = None,
    month: Optional[int] = None,
    day: Optional[int] = None,
    hour: Optional[int] = None,
    minute: Optional[int] = None,
    yaogua: Optional[List[int]] = None
) -> Dict[str, Any]:
    """
    執行六爻占卜
    
    參數:
        year: 年份 (預設當前)
        month: 月份 (預設當前)
        day: 日期 (預設當前)
        hour: 小時 (預設當前)
        minute: 分鐘 (預設當前)
        yaogua: 搖卦結果 [6個0-3的數字]，如果不提供則隨機
    
    返回:
        完整的卦盤信息字典
    """
    now = datetime.now()
    dt = datetime(
        year=year or now.year,
        month=month or now.month,
        day=day or now.day,
        hour=hour or now.hour,
        minute=minute or now.minute
    )
    
    try:
        chart = LiuYaoChart(dt, yaogua)
        return chart.to_dict()
    except Exception as e:
        return {"error": str(e)}


# 為了向後兼容，保留舊的函數名
def get_divination_tool(**kwargs) -> Dict[str, Any]:
    """向後兼容的占卜函數"""
    return get_divination(**kwargs)


if __name__ == "__main__":
    # 測試
    result = get_divination(yaogua=[1, 2, 3, 0, 1, 2])
    import json
    print(json.dumps(result, ensure_ascii=False, indent=2))
