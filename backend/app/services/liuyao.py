"""
六爻占卜核心計算庫
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

# 八卦基本信息
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
    (1, 1, 1): '乾',
    (1, 1, 0): '兌',
    (1, 0, 1): '離',
    (1, 0, 0): '震',
    (0, 1, 1): '巽',
    (0, 1, 0): '坎',
    (0, 0, 1): '艮',
    (0, 0, 0): '坤',
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

# 八宮所屬地支
GONG_DIZHI = {
    '乾': ['子', '寅', '辰', '午', '申', '戌'],
    '兌': ['巳', '卯', '丑', '亥', '酉', '未'],
    '離': ['卯', '丑', '亥', '酉', '未', '巳'],
    '震': ['子', '寅', '辰', '午', '申', '戌'],
    '巽': ['丑', '亥', '酉', '未', '巳', '卯'],
    '坎': ['寅', '辰', '午', '申', '戌', '子'],
    '艮': ['辰', '午', '申', '戌', '子', '寅'],
    '坤': ['未', '巳', '卯', '丑', '亥', '酉'],
}

# 八卦二進制值
BAGUA_BITS = {
    '乾': 0b111, '兌': 0b011, '離': 0b101, '震': 0b001,
    '巽': 0b110, '坎': 0b010, '艮': 0b100, '坤': 0b000
}
BITS_TO_BAGUA = {v: k for k, v in BAGUA_BITS.items()}


# ========== 工具函數 ==========

def toss_coins() -> List[int]:
    """
    擲硬幣產生六爻
    返回 6 個數字 (0-3)，代表背面朝上的數量
    0: 三字 (老陽) - 動爻
    1: 二字一背 (少陽) - 靜爻
    2: 一字二背 (少陰) - 靜爻
    3: 三背 (老陰) - 動爻
    """
    coins = []
    for _ in range(6):
        # 擲三枚硬幣，計算背面數量
        backs = sum(random.choice([0, 1]) for _ in range(3))
        coins.append(backs)
    return coins


def get_wuxing_relation(source: str, target: str) -> str:
    """獲取五行生克關係"""
    wuxing_order = ['木', '火', '土', '金', '水']
    s_idx = wuxing_order.index(source)
    t_idx = wuxing_order.index(target)
    
    if s_idx == t_idx:
        return '同'
    elif (s_idx + 1) % 5 == t_idx:
        return '生'
    elif (s_idx + 2) % 5 == t_idx:
        return '克'
    elif (s_idx - 1) % 5 == t_idx:
        return '被生'
    else:
        return '被克'


def get_liuqin(gong_wuxing: str, yao_wuxing: str) -> str:
    """根據卦宮五行和爻五行獲取六親"""
    relation = get_wuxing_relation(gong_wuxing, yao_wuxing)
    return LIUQIN.get(relation, '未知')


def coins_to_yao(coin: int) -> tuple:
    """
    將硬幣結果轉換為爻信息
    返回: (is_yang, is_moving)
    """
    if coin == 0:  # 三字 -> 老陽 (動)
        return (True, True)
    elif coin == 1:  # 二字一背 -> 少陽 (靜)
        return (True, False)
    elif coin == 2:  # 一字二背 -> 少陰 (靜)
        return (False, False)
    else:  # 三背 -> 老陰 (動)
        return (False, True)


def get_kongwang(day_gan: str, day_zhi: str) -> List[str]:
    """計算日空亡"""
    gan_idx = TIANGAN.index(day_gan)
    zhi_idx = DIZHI.index(day_zhi)
    
    xun_start = (zhi_idx - gan_idx) % 12
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
        self.yaogua = yaogua if yaogua else toss_coins()
        
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
        """尋宮安世"""
        up = BAGUA_BITS[upper_name]
        low = BAGUA_BITS[lower_name]
        
        if up == low:
            return upper_name, 6, '本宮卦'
        
        for gong_name, gong_val in BAGUA_BITS.items():
            seq = []
            seq.append(((gong_val, gong_val), 6))
            
            curr_low = gong_val ^ 0b001
            seq.append(((gong_val, curr_low), 1))
            
            curr_low = curr_low ^ 0b010
            seq.append(((gong_val, curr_low), 2))
            
            curr_low = curr_low ^ 0b100
            seq.append(((gong_val, curr_low), 3))
            
            curr_up = gong_val ^ 0b001
            seq.append(((curr_up, curr_low), 4))
            
            curr_up = curr_up ^ 0b010
            seq.append(((curr_up, curr_low), 5))
            
            curr_up = curr_up ^ 0b001
            seq.append(((curr_up, curr_low), 4))
            
            curr_low = gong_val
            seq.append(((curr_up, curr_low), 3))
            
            gua_types = ['本宮卦', '一世卦', '二世卦', '三世卦', '四世卦', '五世卦', '遊魂卦', '歸魂卦']
            for idx, ((outer, inner), shi) in enumerate(seq):
                if outer == up and inner == low:
                    return gong_name, shi, gua_types[idx]
        
        return '乾', 6, '本宮卦'

    def _build_chart(self):
        """構建卦盤"""
        lower_pattern = self._get_gua_pattern(self.yaos, 0, 3)
        upper_pattern = self._get_gua_pattern(self.yaos, 3, 6)
        
        self.lower_gua = BAGUA_PATTERN.get(lower_pattern, '坤')
        self.upper_gua = BAGUA_PATTERN.get(upper_pattern, '坤')
        
        self.bengua_name = LIUSHISI_GUA.get((self.lower_gua, self.upper_gua), '未知卦')
        
        # 計算變卦
        changed_yaos = []
        has_change = False
        for yao in self.yaos:
            if yao['is_moving']:
                has_change = True
                changed_yaos.append({
                    'is_yang': not yao['is_yang'],
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
            self.bian_lower_gua = None
            self.bian_upper_gua = None
        
        # 尋宮安世
        self.gong, self.shi_pos, self.gua_type = self._find_gong_and_shi(self.upper_gua, self.lower_gua)
        self.gong_wuxing = BAGUA[self.gong]['wuxing']
        
        # 安應爻
        self.ying_pos = (self.shi_pos + 3) if self.shi_pos <= 3 else (self.shi_pos - 3)
        
        # 六神
        self.liushen = LIUSHEN_MAP.get(self.day_gan, LIUSHEN_MAP['甲'])
        
        # 納甲
        lower_dizhi_list = GONG_DIZHI.get(self.lower_gua, GONG_DIZHI['乾'])
        upper_dizhi_list = GONG_DIZHI.get(self.upper_gua, GONG_DIZHI['乾'])
        
        if has_change and self.biangua_name:
            bian_lower_dizhi_list = GONG_DIZHI.get(self.bian_lower_gua, GONG_DIZHI['乾'])
            bian_upper_dizhi_list = GONG_DIZHI.get(self.bian_upper_gua, GONG_DIZHI['乾'])
        
        for i, yao in enumerate(self.yaos):
            pos = i + 1
            
            if i < 3:
                yao['zhi'] = lower_dizhi_list[i]
            else:
                yao['zhi'] = upper_dizhi_list[i]
            
            zhi_idx = DIZHI.index(yao['zhi'])
            yao['wuxing'] = DIZHI_WUXING[zhi_idx]
            yao['liuqin'] = get_liuqin(self.gong_wuxing, yao['wuxing'])
            yao['liushen'] = self.liushen[i] if i < len(self.liushen) else '青龍'
            yao['is_shi'] = (pos == self.shi_pos)
            yao['is_ying'] = (pos == self.ying_pos)
            yao['line'] = '⚊' if yao['is_yang'] else '⚋'
            yao['is_kong'] = yao['zhi'] in self.kongwang
            
            if yao['is_moving'] and self.biangua_name:
                if i < 3:
                    variant_zhi = bian_lower_dizhi_list[i]
                else:
                    variant_zhi = bian_upper_dizhi_list[i]
                
                variant_zhi_idx = DIZHI.index(variant_zhi)
                variant_wuxing = DIZHI_WUXING[variant_zhi_idx]
                variant_liuqin = get_liuqin(self.gong_wuxing, variant_wuxing)
                
                yao['variant'] = {
                    'is_yang': not yao['is_yang'],
                    'zhi': variant_zhi,
                    'wuxing': variant_wuxing,
                    'liuqin': variant_liuqin
                }
    
    def get_shensha(self) -> List[Dict[str, Any]]:
        """計算神煞"""
        shensha = []
        
        yima_map = {'寅': '申', '申': '寅', '巳': '亥', '亥': '巳',
                    '子': '寅', '午': '申', '卯': '巳', '酉': '亥',
                    '辰': '寅', '戌': '申', '丑': '亥', '未': '巳'}
        yima = yima_map.get(self.day_zhi, '')
        if yima:
            shensha.append({'name': '驛馬', 'zhi': [yima]})
        
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
            'gua_type': self.gua_type,
            'shensha': self.get_shensha(),
        }
        
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
    
    def format_for_ai(self) -> str:
        """格式化為 AI 可讀的文字"""
        lines = []
        lines.append(f"【起卦時間】{self.dt.strftime('%Y年%m月%d日 %H:%M')}")
        lines.append(f"【四柱】{self.bazi}")
        lines.append(f"【空亡】{''.join(self.kongwang)}")
        lines.append(f"【卦宮】{self.gong}宮 ({self.gong_wuxing})")
        lines.append(f"【本卦】{self.bengua_name} ({self.gua_type})")
        if self.biangua_name:
            lines.append(f"【變卦】{self.biangua_name}")
        lines.append("")
        lines.append("【六爻詳情】（從初爻到上爻）")
        
        yao_names = ['初爻', '二爻', '三爻', '四爻', '五爻', '上爻']
        for i, yao in enumerate(self.yaos):
            marks = []
            if yao['is_shi']:
                marks.append('世')
            if yao['is_ying']:
                marks.append('應')
            if yao['is_moving']:
                marks.append('動')
            if yao['is_kong']:
                marks.append('空')
            
            mark_str = f"[{','.join(marks)}]" if marks else ""
            
            line = f"{yao_names[i]}: {yao['liushen']} {yao['liuqin']}{yao['zhi']}({yao['wuxing']}) {yao['line']} {mark_str}"
            
            if yao.get('variant'):
                v = yao['variant']
                line += f" → {v['liuqin']}{v['zhi']}({v['wuxing']})"
            
            lines.append(line)
        
        # 神煞
        shensha = self.get_shensha()
        if shensha:
            lines.append("")
            lines.append("【神煞】")
            for s in shensha:
                lines.append(f"{s['name']}: {','.join(s['zhi'])}")
        
        return "\n".join(lines)


# ========== 公開 API ==========

def perform_divination(
    question: str,
    dt: Optional[datetime] = None,
    coins: Optional[List[int]] = None
) -> Dict[str, Any]:
    """
    執行六爻占卜
    
    Args:
        question: 問題
        dt: 起卦時間 (預設當前)
        coins: 硬幣結果 (預設隨機)
    
    Returns:
        占卜結果
    """
    if dt is None:
        dt = datetime.now()
    
    chart = LiuYaoChart(dt, coins)
    result = chart.to_dict()
    result['question'] = question
    result['formatted'] = chart.format_for_ai()
    
    return result
