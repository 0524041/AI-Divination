"""紫微斗數排盤服務"""

from datetime import datetime, timedelta
from typing import Dict, Any, Optional
import json
from iztro_py import astro
from app.data.taiwan_cities import calculate_solar_time_offset


class ZiweiService:
    """紫微斗數排盤服務"""

    @staticmethod
    def adjust_solar_time(birth_datetime: datetime, location: str) -> datetime:
        """真太陽時校正"""
        offset = calculate_solar_time_offset(location)
        return birth_datetime + timedelta(minutes=offset)

    @staticmethod
    def datetime_to_time_index(dt: datetime) -> int:
        """將時間轉換為 iztro 的 timeIndex (0-12)"""
        hour = dt.hour
        if 0 <= hour < 1:
            return 0
        elif 1 <= hour < 3:
            return 1
        elif 3 <= hour < 5:
            return 2
        elif 5 <= hour < 7:
            return 3
        elif 7 <= hour < 9:
            return 4
        elif 9 <= hour < 11:
            return 5
        elif 11 <= hour < 13:
            return 6
        elif 13 <= hour < 15:
            return 7
        elif 15 <= hour < 17:
            return 8
        elif 17 <= hour < 19:
            return 9
        elif 19 <= hour < 21:
            return 10
        elif 21 <= hour < 23:
            return 11
        else:
            return 12

    @staticmethod
    def apply_twin_method(natal_chart: Dict[str, Any]) -> Dict[str, Any]:
        """雙胞胎對宮法處理(老二)"""
        palaces = natal_chart.get("palaces", [])
        migration_idx = None

        for i, palace in enumerate(palaces):
            if palace.get("name") == "遷移":
                migration_idx = i
                break

        if migration_idx is None:
            raise ValueError("找不到遷移宮")

        new_palaces = palaces[migration_idx:] + palaces[:migration_idx]

        twin_chart = natal_chart.copy()
        twin_chart["palaces"] = new_palaces
        twin_chart["earthly_branch_of_soul_palace"] = palaces[migration_idx].get(
            "earthly_branch"
        )
        twin_chart["is_twin_younger"] = True

        return twin_chart

    @staticmethod
    def serialize_star(star) -> Dict[str, Any]:
        """序列化星曜為中文"""
        return {
            "name": star.translate_name() if hasattr(star, 'translate_name') else str(star.name),
            "brightness": star.translate_brightness() if hasattr(star, 'translate_brightness') else star.brightness,
            "type": star.type if hasattr(star, 'type') else None,
            "mutagen": star.mutagen if hasattr(star, 'mutagen') else None,
        }

    @staticmethod
    def serialize_palace(palace) -> Dict[str, Any]:
        """序列化宮位為中文"""
        return {
            "index": palace.index,
            "name": palace.translate_name() if hasattr(palace, 'translate_name') else str(palace.name),
            "heavenly_stem": palace.translate_heavenly_stem() if hasattr(palace, 'translate_heavenly_stem') else str(palace.heavenly_stem),
            "earthly_branch": palace.translate_earthly_branch() if hasattr(palace, 'translate_earthly_branch') else str(palace.earthly_branch),
            "major_stars": [ZiweiService.serialize_star(s) for s in palace.major_stars],
            "minor_stars": [ZiweiService.serialize_star(s) for s in palace.minor_stars],
            "is_body_palace": palace.is_body_palace,
            "decadal": {"range": f"{palace.decadal.range[0]}-{palace.decadal.range[1]}"} if palace.decadal and hasattr(palace.decadal, 'range') else None,
            "ages": list(palace.ages) if palace.ages else [],
        }

    @staticmethod
    def serialize_chart(chart) -> Dict[str, Any]:
        """序列化整個命盤為中文"""
        return {
            "palaces": [ZiweiService.serialize_palace(p) for p in chart.palaces],
            "earthly_branch_of_soul_palace": chart.palaces[0].translate_earthly_branch() if chart.palaces else "",
            "earthly_branch_of_body_palace": next((p.translate_earthly_branch() for p in chart.palaces if p.is_body_palace), ""),
            "five_elements_class": str(chart.five_elements_class) if chart.five_elements_class else "",
            "gender": chart.gender,
            "solar_date": str(chart.solar_date) if chart.solar_date else "",
            "lunar_date": str(chart.lunar_date) if chart.lunar_date else "",
            "time_range": str(chart.time_range) if chart.time_range else "",
        }

    @staticmethod
    def generate_natal_chart(
        name: str,
        gender: str,
        birth_datetime: datetime,
        location: str,
        is_twin: bool = False,
        twin_order: Optional[str] = None,
    ) -> Dict[str, Any]:
        """生成本命命盤"""
        adjusted_time = ZiweiService.adjust_solar_time(birth_datetime, location)

        time_index = ZiweiService.datetime_to_time_index(adjusted_time)

        gender_cn = "男" if gender == "male" else "女"

        date_str = adjusted_time.strftime("%Y-%-m-%-d")

        chart = astro.by_solar(date_str, time_index, gender_cn, language="zh-TW")

        # Use custom serialization with translation
        natal_chart = ZiweiService.serialize_chart(chart)

        if is_twin and twin_order == "younger":
            natal_chart = ZiweiService.apply_twin_method(natal_chart)

        natal_chart["birth_info"] = {
            "name": name,
            "gender": gender,
            "original_time": birth_datetime.isoformat(),
            "adjusted_time": adjusted_time.isoformat(),
            "location": location,
            "is_twin": is_twin,
            "twin_order": twin_order,
        }

        return natal_chart

    @staticmethod
    def generate_horoscope(
        natal_chart_raw: str, query_date: datetime, query_type: str
    ) -> Dict[str, Any]:
        """生成流年/流月/流日命盤"""
        natal_data = json.loads(natal_chart_raw)
        birth_info = natal_data["birth_info"]

        adjusted_time = datetime.fromisoformat(birth_info["adjusted_time"])
        time_index = ZiweiService.datetime_to_time_index(adjusted_time)
        date_str = adjusted_time.strftime("%Y-%-m-%-d")
        gender_cn = "男" if birth_info["gender"] == "male" else "女"

        chart = astro.by_solar(date_str, time_index, gender_cn, language="zh-TW")

        # iztro-py horoscope expects a date string, not datetime
        query_date_str = query_date.strftime("%Y-%-m-%-d")
        horoscope = chart.horoscope(query_date_str)

        # Serialize horoscope data
        result = {"query_date": query_date.isoformat(), "query_type": query_type}

        if query_type == "yearly" and horoscope.yearly:
            result["yearly"] = {
                "name": horoscope.yearly.name,
                "heavenly_stem": str(horoscope.yearly.heavenly_stem),
                "earthly_branch": str(horoscope.yearly.earthly_branch),
            }
        if query_type in ["monthly", "daily"] and horoscope.monthly:
            result["monthly"] = {
                "name": horoscope.monthly.name,
                "heavenly_stem": str(horoscope.monthly.heavenly_stem),
                "earthly_branch": str(horoscope.monthly.earthly_branch),
            }
        if query_type == "daily" and horoscope.daily:
            result["daily"] = {
                "name": horoscope.daily.name,
                "heavenly_stem": str(horoscope.daily.heavenly_stem),
                "earthly_branch": str(horoscope.daily.earthly_branch),
            }

        return result

    @staticmethod
    def format_for_ai(
        natal_chart: Dict[str, Any],
        horoscope: Optional[Dict[str, Any]] = None,
        is_twin_younger: bool = False,
    ) -> str:
        """將命盤資料格式化為 AI Prompt 用的純文字"""
        output = []

        output.append("=== 基本資訊 ===")
        birth_info = natal_chart.get("birth_info", {})
        output.append(f"姓名: {birth_info.get('name')}")
        output.append(f"性別: {birth_info.get('gender')}")
        output.append(f"出生時間: {birth_info.get('original_time')}")
        output.append(f"出生地: {birth_info.get('location')}")

        if is_twin_younger:
            output.append("⚠️ 此為雙胞胎老二，已套用「對宮法」(遷移宮設為命宮)")

        output.append("")

        output.append("=== 本命命盤 ===")
        output.append(f"命宮: {natal_chart.get('earthly_branch_of_soul_palace')}")
        output.append(f"身宮: {natal_chart.get('earthly_branch_of_body_palace')}")
        output.append(f"五行局: {natal_chart.get('five_elements_class')}")
        output.append("")

        output.append("=== 十二宮位 ===")
        for palace in natal_chart.get("palaces", []):
            output.append(f"\n【{palace.get('name')}宮】")
            output.append(f"  天干: {palace.get('heavenly_stem')}")
            output.append(f"  地支: {palace.get('earthly_branch')}")

            major_stars = palace.get("major_stars", [])
            if major_stars:
                output.append(
                    f"  主星: {', '.join([s.get('name') for s in major_stars])}"
                )

            minor_stars = palace.get("minor_stars", [])
            if minor_stars:
                output.append(
                    f"  輔星: {', '.join([s.get('name') for s in minor_stars])}"
                )

        if horoscope:
            output.append("\n\n=== 流運資訊 ===")
            output.append(f"查詢日期: {horoscope.get('query_date')}")
            output.append(f"查詢類型: {horoscope.get('query_type')}")

            if horoscope.get("yearly"):
                output.append("\n【流年】")
                yearly = horoscope["yearly"]
                output.append(f"  天干: {yearly.get('heavenly_stem')}")
                output.append(f"  地支: {yearly.get('earthly_branch')}")

            if horoscope.get("monthly"):
                output.append("\n【流月】")
                monthly = horoscope["monthly"]
                output.append(f"  天干: {monthly.get('heavenly_stem')}")
                output.append(f"  地支: {monthly.get('earthly_branch')}")

            if horoscope.get("daily"):
                output.append("\n【流日】")
                daily = horoscope["daily"]
                output.append(f"  天干: {daily.get('heavenly_stem')}")
                output.append(f"  地支: {daily.get('earthly_branch')}")

        return "\n".join(output)
