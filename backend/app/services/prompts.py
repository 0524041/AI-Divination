"""
Prompt 組裝器（Ticket 04 起逐步取代單體模板）

設計（spec：模組化片段）：
- system prompt 由「角色/知識庫/規則/安全檢核」片段組成；現階段六爻沿用
  既有 liuyao_system.md 作為角色+知識+規則基底，輸出模板指令改由
  對話式規則附加（不再要求一次性完整報告骨架）。
- 盤面以繁中緊湊結構化文字注入 user message 首段；
  只附卦辭＋象傳精簡參考（移除諸事/愛情/事業/財運/詳解預烤段落），
  解讀完全交給 AI。
"""

from pathlib import Path

from app.core.config import BASE_DIR
from app.utils.hexagram_db import get_hexagram_by_name

_PROMPTS_DIR = Path(BASE_DIR) / "prompts"

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
    """回傳 (system_prompt, user_message)"""
    system = load_prompt("liuyao_system.md") + "\n" + CONVERSATION_RULES
    return system, build_liuyao_context(question, gender, target, chart_data)
