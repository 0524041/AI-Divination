import json
from datetime import datetime
from typing import Dict, Any, List, Optional
from pathlib import Path
from lunar_python import Lunar, Solar

from app.schemas.ziwei import ZiweiProcessRequest


class ZiweiService:
    """
    紫微斗數服務層
    負責處理命盤資料、計算流運資訊、並打包 Prompt
    """

    def __init__(self):
        # 簡易地支對應
        self.DIZHI = [
            "子",
            "丑",
            "寅",
            "卯",
            "辰",
            "巳",
            "午",
            "未",
            "申",
            "酉",
            "戌",
            "亥",
        ]

    def calculate_virtual_age(self, birth_date: datetime, query_date: datetime) -> int:
        """
        計算虛歲
        公式：查詢年份 - 出生年份 + 1
        """
        return query_date.year - birth_date.year + 1

    def get_year_branch(self, year: int) -> str:
        """獲取年份的地支 (簡易算法)"""
        # 1984 is Rat (子) - start of cycle for recent times
        # 4 = Rat (子) in (year - 4) % 12
        offset = (year - 4) % 12
        return self.DIZHI[offset]

    def find_palace_by_branch(
        self, palaces: List[Dict[str, Any]], branch: str
    ) -> Optional[Dict[str, Any]]:
        """根據地支尋找宮位"""
        for palace in palaces:
            if palace.get("earthlyBranch") == branch:
                return palace
        return None

    def find_decadal_palace(
        self, palaces: List[Dict[str, Any]], age: int
    ) -> Optional[Dict[str, Any]]:
        """
        尋找大限宮位
        iztro 的宮位資料包含 'decadal': {'range': [start, end]}
        """
        for palace in palaces:
            decadal = palace.get("decadal", {})
            rng = decadal.get("range", [])
            if len(rng) == 2:
                if rng[0] <= age <= rng[1]:
                    return palace
        return None

    def find_age_palace(
        self, palaces: List[Dict[str, Any]], age: int
    ) -> Optional[Dict[str, Any]]:
        """
        尋找小限宮位
        iztro 的宮位資料包含 'ages': [1, 13, 25...]
        """
        for palace in palaces:
            ages = palace.get("ages", [])
            if age in ages:
                return palace
        return None

    def format_chart_data(
        self, chart_data: Dict[str, Any], virtual_age: int, query_year_branch: str
    ) -> Dict[str, Any]:
        """
        將複雜的 iztro chart_data 簡化為 AI 易讀的結構
        並標註流年/大限/小限宮位
        """
        palaces = chart_data.get("palaces", [])
        simplified_palaces = []

        for p in palaces:
            # 判斷是否為特殊宮位
            is_decadal = False
            is_yearly = False
            is_age = False

            # 檢查大限
            decadal = p.get("decadal", {})
            rng = decadal.get("range", [])
            if len(rng) == 2 and rng[0] <= virtual_age <= rng[1]:
                is_decadal = True

            # 檢查流年 (根據地支)
            if p.get("earthlyBranch") == query_year_branch:
                is_yearly = True

            # 檢查小限
            if virtual_age in p.get("ages", []):
                is_age = True

            # 提取星曜 (只取名稱和亮度)
            major_stars = [
                f"{s['name']}({s.get('brightness', '')})"
                + (f"[{s.get('mutagen')}]" if s.get("mutagen") else "")
                for s in p.get("majorStars", [])
            ]
            minor_stars = [s["name"] for s in p.get("minorStars", [])]
            adjective_stars = [s["name"] for s in p.get("adjectiveStars", [])]

            simplified_palaces.append(
                {
                    "宮位": p.get("name"),
                    "地支": p.get("earthlyBranch"),
                    "天干": p.get("heavenlyStem"),
                    "主星": major_stars,
                    "副星": minor_stars,
                    "雜曜": adjective_stars,
                    "大限": f"{rng[0]}-{rng[1]}" if len(rng) == 2 else "",
                    "小限": p.get("ages", []),
                    "標記": [
                        "本命命宮" if p.get("name") == "命宮" else None,
                        "身宮" if p.get("isBodyPalace") else None,
                        "大限命宮" if is_decadal else None,
                        "流年命宮" if is_yearly else None,
                        "小限命宮" if is_age else None,
                    ],
                }
            )
            # Filter out None values in '標記'
            simplified_palaces[-1]["標記"] = [
                m for m in simplified_palaces[-1]["標記"] if m
            ]

        return {
            "局數": chart_data.get("fiveElementsClass"),
            "生肖": chart_data.get("zodiac"),
            "十二宮詳情": simplified_palaces,
        }

    def process_chart(self, request: ZiweiProcessRequest) -> Dict[str, str]:
        """
        處理紫微斗數請求，返回用於 Prompt 的各個區塊
        """
        birth = request.birth_details
        settings = request.query_settings
        chart = request.chart_data

        # 1. 計算參數
        virtual_age = self.calculate_virtual_age(birth.birth_date, settings.query_date)
        query_year_branch = self.get_year_branch(settings.query_date.year)

        # 2. 準備使用者資訊
        # 如果是流年，計算流年當下的虛歲 (雖然通常 query_date 就是當下，但為了精確區分)
        # 其實 calculate_virtual_age 已經是用 query_date 算的，所以 virtual_age 就是「流年虛歲」或「當下虛歲」

        user_info = {
            "姓名": birth.name,
            "性別": birth.gender,
            "當前虛歲": virtual_age,
            "測算類型": settings.query_type,  # natal, yearly, etc.
            "測算時間": settings.query_date.strftime("%Y-%m-%d"),
            "問題": settings.question,
            "備註": "雙胞胎老二 (已套用對宮法)"
            if birth.is_twin and birth.twin_order == "2"
            else "一般",
        }

        # 3. 準備補充說明 (流運定位)
        # 找到大限命宮、流年命宮、小限命宮
        palaces = chart.get("palaces", [])
        decadal_palace = self.find_decadal_palace(palaces, virtual_age)
        yearly_palace = self.find_palace_by_branch(palaces, query_year_branch)
        age_palace = self.find_age_palace(palaces, virtual_age)

        supplementary_info = {
            "流運資訊": {
                "流年年份": settings.query_date.year,
                "流年地支": query_year_branch,
                "當下虛歲": virtual_age,
            },
            "關鍵宮位": {
                "大限命宮": f"{decadal_palace.get('name')}宮 (地支{decadal_palace.get('earthlyBranch')})"
                if decadal_palace
                else "未知",
                "流年命宮": f"{yearly_palace.get('name')}宮 (地支{yearly_palace.get('earthlyBranch')})"
                if yearly_palace
                else "未知",
                "小限命宮": f"{age_palace.get('name')}宮 (地支{age_palace.get('earthlyBranch')})"
                if age_palace
                else "未知",
            },
            "解盤重點": "請重點分析本命盤性格，並結合大限、小限與流年運勢回答用戶問題。",
        }

        # 4. 格式化命盤
        formatted_chart = self.format_chart_data(chart, virtual_age, query_year_branch)

        return {
            "user_info_json": json.dumps(user_info, ensure_ascii=False, indent=2),
            "chart_info_json": json.dumps(
                formatted_chart, ensure_ascii=False, indent=2
            ),
            "supplementary_info_json": json.dumps(
                supplementary_info, ensure_ascii=False, indent=2
            ),
            "question": settings.question,  # 單獨返回問題，供 API 注入
        }

        # 3. 準備補充說明 (流運定位)
        # 找到大限命宮、流年命宮、小限命宮
        palaces = chart.get("palaces", [])
        decadal_palace = self.find_decadal_palace(palaces, virtual_age)
        yearly_palace = self.find_palace_by_branch(palaces, query_year_branch)
        age_palace = self.find_age_palace(palaces, virtual_age)

        supplementary_info = {
            "當前狀態": f"虛歲 {virtual_age} 歲，流年地支為 {query_year_branch}",
            "大限命宮": f"{decadal_palace.get('name')}宮 (地支{decadal_palace.get('earthlyBranch')})"
            if decadal_palace
            else "未知",
            "流年命宮": f"{yearly_palace.get('name')}宮 (地支{yearly_palace.get('earthlyBranch')})"
            if yearly_palace
            else "未知",
            "小限命宮": f"{age_palace.get('name')}宮 (地支{age_palace.get('earthlyBranch')})"
            if age_palace
            else "未知",
            "解盤重點": "請重點分析本命盤性格，並結合大限、小限與流年運勢回答用戶問題。",
        }

        # 4. 格式化命盤
        formatted_chart = self.format_chart_data(chart, virtual_age, query_year_branch)

        return {
            "user_info_json": json.dumps(user_info, ensure_ascii=False, indent=2),
            "chart_info_json": json.dumps(
                formatted_chart, ensure_ascii=False, indent=2
            ),
            "supplementary_info_json": json.dumps(
                supplementary_info, ensure_ascii=False, indent=2
            ),
        }


ziwei_service = ZiweiService()
