"""
Prompt 組裝器（Ticket 04 起逐步取代單體模板）

設計（spec：模組化片段 + chat-polish 片段組裝）：
- 各類型 system prompt 拆為兩層片段：
  1) 常駐基底：角色＋知識庫＋安全檢核（＋關鍵紅線）
  2) 首次解盤限定：最終輸出結構模板（md 檔內以 OUTPUT-FORMAT 標記圈選）
- 「首次解盤」組合＝基底＋格式模板；「追問」只帶基底，絕不帶格式模板，
  追問時對話模式規則（CONVERSATION_RULES）引導 AI 直接回答而非重吐報告骨架。
- 盤面以繁中緊湊結構化文字注入 user message 首段；
  只附卦辭＋象傳精簡參考（移除諸事/愛情/事業/財運/詳解預烤段落），
  解讀完全交給 AI。
"""

from pathlib import Path

from app.core.config import BASE_DIR
from app.utils.hexagram_db import get_hexagram_by_name

_PROMPTS_DIR = Path(BASE_DIR) / "prompts"

# 輸出格式片段邊界標記：標記之間的內容只在首次解盤拼接
_OUTPUT_FORMAT_START = "<!-- OUTPUT-FORMAT-START -->"
_OUTPUT_FORMAT_END = "<!-- OUTPUT-FORMAT-END -->"

# 各占卜類型的 system prompt 檔名（tarot 依牌陣再細分，見 tarot_prompt_file()）
PROMPT_FILES = {
    "liuyao": "liuyao_system.md",
    "ziwei": "ziwei_system.md",
}

TAROT_PROMPT_FILES = {
    "single": "tarot_system_prompt_single.md",
    "three_card": "tarot_system_prompt_three_card.md",
    "celtic_cross": "tarot_system_prompt_celtic_cross.md",
}


def tarot_prompt_file(spread_type: str | None) -> str:
    return TAROT_PROMPT_FILES.get(spread_type or "", TAROT_PROMPT_FILES["single"])


def prompt_file_for(divination_type: str, chart_data: dict | None = None) -> str:
    """依占卜類型（與牌陣）決定 system prompt 檔名"""
    if divination_type == "tarot":
        return tarot_prompt_file((chart_data or {}).get("spread_type"))
    return PROMPT_FILES.get(divination_type, PROMPT_FILES["liuyao"])

# 追問對話的系統級附加規則（續聊模式）
CONVERSATION_RULES = """
## 對話模式
- 你正在與求測者連續對話。首次回應請給出完整解盤；後續針對追問深入說明。
- 回答口語化、有溫度，但專業判斷不妥協；避免重複貼上整個盤面。
- 盤面資訊已提供於對話開頭，回答時直接引用所需爻位即可。
- 不確定處明確說明，不編造典籍出處。
"""


def load_prompt(name: str) -> str:
    """讀取 prompts/ 下指定檔案內容"""
    return (_PROMPTS_DIR / name).read_text(encoding="utf-8")


def load_prompt_parts(name: str) -> tuple[str, str]:
    """拆分 prompt 檔為（常駐基底, 首次解盤限定輸出格式）

    以 OUTPUT-FORMAT 標記切分；無標記時視為整份皆基底。
    """
    text = load_prompt(name)
    start = text.find(_OUTPUT_FORMAT_START)
    end = text.find(_OUTPUT_FORMAT_END)
    if start == -1 or end == -1 or end < start:
        return text.strip(), ""
    base = (text[:start] + text[end + len(_OUTPUT_FORMAT_END):]).strip()
    output_format = text[start + len(_OUTPUT_FORMAT_START):end].strip()
    return base, output_format


def build_system_prompt(name: str, *, include_format: bool) -> str:
    """組裝 system prompt：常駐基底＋（首次解盤限定）格式模板＋對話模式規則

    追問（include_format=False）絕不帶輸出結構模板。
    """
    base, output_format = load_prompt_parts(name)
    parts = [base]
    if include_format and output_format:
        parts.append(output_format)
    parts.append(CONVERSATION_RULES.strip())
    return "\n\n".join(parts)


def _yao_line(label: str, yao: dict) -> str:
    """單爻一行：六神｜本卦｜變卦｜伏神"""
    origin = yao["origin"]
    marks = []
    if origin.get("is_subject"):
        marks.append("世")
    if origin.get("is_object"):
        marks.append("應")
    mark = "".join(marks)
    moving = "動" if origin.get("is_changed") else ""
    line = (
        f"{label}｜{yao['liushen']}｜{origin['relative']}{origin['zhi']}"
        f"({origin['wuxing']}){mark}{moving}"
    )
    variant = yao.get("variant")
    if variant:
        line += f"→ 變:{variant['relative']}{variant['zhi']}({variant['wuxing']})"
    fushen = origin.get("fushen")
    if fushen:
        line += f"｜伏神:{fushen['relative']}{fushen['zhi']}({fushen['wuxing']})"
    return line


def format_liuyao_chart_compact(chart_data: dict) -> str:
    """六爻盤面 → 繁中緊湊結構化文字（由初爻到上爻）"""
    lines = [
        "【盤面】",
        f"起卦時間：{chart_data.get('time', '未知')}",
        f"干支：{chart_data.get('bazi', '')}　日空：{chart_data.get('kongwang', '')}",
        f"卦宮：{chart_data.get('guashen', '')}宮　本卦：{chart_data.get('benguaming', '')}"
        f"　變卦：{chart_data.get('bianguaming', '無變卦')}　{chart_data.get('gua_type', '')}",
        "",
        "【六爻配置】（由上爻到初爻）",
    ]

    yao_labels = ["yao_6", "yao_5", "yao_4", "yao_3", "yao_2", "yao_1"]
    yao_titles = ["上爻", "五爻", "四爻", "三爻", "二爻", "初爻"]
    for label, title in zip(yao_labels, yao_titles):
        yao = chart_data.get(label)
        if yao:
            lines.append(f"{_yao_line(title, yao)}")

    shensha = chart_data.get("shensha") or []
    if shensha:
        text = "　".join(f"{s['name']}:{','.join(s['zhi'])}" for s in shensha)
        lines.append("")
        lines.append(f"神煞：{text}")

    lines.extend(_hexagram_reference(chart_data.get("benguaming", "")))
    bian_name = chart_data.get("bianguaming")
    if bian_name and bian_name != "無變卦":
        lines.extend(_hexagram_reference(bian_name, is_bian=True))

    return "\n".join(lines)


def _hexagram_reference(name: str, is_bian: bool = False) -> list[str]:
    """精簡卦辭參考：僅卦辭＋象傳（不含預烤詳解段落）"""
    hexagram = get_hexagram_by_name(name) if name else None
    if not hexagram:
        return []

    title = "變卦" if is_bian else "本卦"
    return [
        "",
        f"【{title}參考｜{hexagram.get('traditional_name', name)}】",
        f"卦辭：{hexagram.get('core_text', '')}",
        f"象傳：{hexagram.get('xiang_text', '')}",
    ]


def build_liuyao_context(
    question: str,
    gender: str | None,
    target: str | None,
    chart_data: dict,
) -> str:
    """組出首次解盤的 user message：求測資訊＋問題＋緊湊盤面"""
    parts = ["【求測者】"]
    if gender:
        parts.append(f"性別：{'男' if gender == 'male' else '女'}")
    if target:
        target_names = {
            "self": "本人",
            "parent": "父母",
            "friend": "朋友",
            "other": "其他人",
        }
        parts.append(f"所測之人：{target_names.get(target, target)}")
    parts.append(f"所問之事：{question}")
    parts.append("")
    parts.append(format_liuyao_chart_compact(chart_data))
    return "\n".join(parts)


def build_liuyao_messages(
    question: str,
    gender: str | None,
    target: str | None,
    chart_data: dict,
) -> tuple[str, str]:
    """回傳 (system_prompt, user_message)——首次解盤組合（含格式模板）"""
    system = build_system_prompt(PROMPT_FILES["liuyao"], include_format=True)
    return system, build_liuyao_context(question, gender, target, chart_data)


# ========== 塔羅（Ticket 05） ==========

TAROT_POSITION_NAMES = {
    "single": "單張",
    "past": "過去",
    "present": "現在",
    "future": "未來",
    "heart": "核心",
    "challenge": "挑戰",
    "conscious": "顯意識",
    "foundation": "潛意識",
    "attitude": "自我態度",
    "external": "外部環境",
    "hopes_fears": "希望與恐懼",
    "outcome": "結果",
}


def format_tarot_cards_compact(cards: list[dict]) -> str:
    """塔羅牌陣 → 繁中緊湊結構化文字"""
    lines = ["【牌陣】"]
    for index, card in enumerate(cards, start=1):
        position_key = card.get("position") or str(index)
        position = TAROT_POSITION_NAMES.get(position_key, position_key)
        orientation = "逆位" if card.get("reversed") else "正位"
        lines.append(
            f"{index}. {position}｜{card['name_cn']}（{card['name']}）｜{orientation}"
        )
    return "\n".join(lines)


def build_tarot_messages(
    question: str, spread_type: str, cards: list[dict]
) -> tuple[str, str]:
    spread_names = {"single": "單張牌陣", "three_card": "三牌陣（時間流）", "celtic_cross": "凱爾特十字十牌陣"}
    system = build_system_prompt(tarot_prompt_file(spread_type), include_format=True)
    user = (
        f"所問之事：{question}\n"
        f"使用牌陣：{spread_names.get(spread_type, spread_type)}\n\n"
        + format_tarot_cards_compact(cards)
    )
    return system, user


# ========== 紫微（Ticket 05） ==========


def validate_ziwei_chart(chart_data: dict) -> None:
    """紫微盤面 schema 驗證：拒收畸形資料（前端 iztro 產出）"""
    if not isinstance(chart_data, dict):
        raise ValueError("盤面必須是物件")
    palaces = chart_data.get("palaces")
    if not isinstance(palaces, list) or len(palaces) != 12:
        raise ValueError(f"十二宮缺失或不完整（收到 {len(palaces) if isinstance(palaces, list) else '非陣列'} 宮）")
    for palace in palaces:
        if not isinstance(palace, dict):
            raise ValueError("宮位格式錯誤")
        for field in ("name", "earthlyBranch"):
            if not palace.get(field):
                raise ValueError(f"宮位缺少欄位：{field}")
        major_stars = palace.get("majorStars")
        if not isinstance(major_stars, list):
            raise ValueError(f"宮位 {palace.get('name')} 主星格式錯誤")


def format_ziwei_chart_compact(chart_data: dict, birth_summary: dict | None = None) -> str:
    """紫微命盤 → 繁中緊湊結構化文字"""
    lines = ["【命盤】"]
    if birth_summary:
        parts = [
            f"{k}：{v}" for k, v in birth_summary.items() if v
        ]
        if parts:
            lines.extend(parts)
            lines.append("")
    lines.append(f"五行局：{chart_data.get('fiveElementsClass', '未知')}　生肖：{chart_data.get('zodiac', '未知')}")
    lines.append("")
    lines.append("【十二宮】")

    for palace in chart_data.get("palaces", []):
        stars = []
        for star in palace.get("majorStars", []):
            text = star["name"]
            if star.get("brightness"):
                text += f"({star['brightness']})"
            if star.get("mutagen"):
                text += f"[化{star['mutagen']}]"
            stars.append(text)
        minor = [s["name"] for s in palace.get("minorStars", [])]
        adjective = [s["name"] for s in palace.get("adjectiveStars", [])]

        line = f"{palace['name']}｜{palace.get('heavenlyStem', '')}{palace['earthlyBranch']}"
        if stars:
            line += f"｜主星:{'、'.join(stars)}"
        if minor:
            line += f"｜副星:{'、'.join(minor)}"
        if adjective:
            line += f"｜雜曜:{'、'.join(adjective[:6])}"
        decadal = palace.get("decadal", {}).get("range", [])
        if len(decadal) == 2:
            line += f"｜大限:{decadal[0]}-{decadal[1]}"
        if palace.get("isBodyPalace"):
            line += "｜身宮"
        lines.append(line)

    return "\n".join(lines)


def ziwei_birth_summary(birth_details: dict | None) -> dict:
    """紫微出生資料 → 緊湊區塊用的摘要字典"""
    if not birth_details:
        return {}
    return {
        "姓名": birth_details.get("name"),
        "性別": "男" if birth_details.get("gender") == "male" else "女",
        "出生日期": birth_details.get("birth_date"),
        "出生地": birth_details.get("birth_location"),
    }


def build_ziwei_messages(
    question: str,
    chart_data: dict,
    birth_details: dict | None = None,
    query_context: str | None = None,
) -> tuple[str, str]:
    system = build_system_prompt(PROMPT_FILES["ziwei"], include_format=True)
    birth_summary = ziwei_birth_summary(birth_details)

    parts = [f"所問之事：{question}"]
    if query_context:
        parts.append(f"查詢範圍：{query_context}")
    parts.append("")
    parts.append(format_ziwei_chart_compact(chart_data, birth_summary))
    return system, "\n".join(parts)
