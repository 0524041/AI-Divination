"""上下文 token 估算（chat-polish spec：字元粗估，前後端共用同一語意）

規則：CJK 字元 ≈ 1 字/token；其他（ASCII 等）≈ 4 字元/token。
不做精確 tokenizer——僅供 48k 整體預算的截斷判斷與 UI 顯示。
"""

import math

# 整個請求 messages 的 token 預算上限
CONTEXT_TOKEN_BUDGET = 48_000

_CJK_RANGES = (
    (0x2E80, 0x9FFF),   # CJK 部首、音標、統一表意文字
    (0xF900, 0xFAFF),   # CJK 相容表意文字
    (0xFF00, 0xFFEF),   # 全形標點與字母
)


def _is_cjk(code_point: int) -> bool:
    return any(lo <= code_point <= hi for lo, hi in _CJK_RANGES)


def estimate_tokens(text: str) -> int:
    """估算一段文字的 token 數（CJK≈1字/token，其餘≈4字元/token）"""
    if not text:
        return 0
    cjk = sum(1 for ch in text if _is_cjk(ord(ch)))
    other = len(text) - cjk
    return cjk + math.ceil(other / 4)


def estimate_messages_tokens(messages: list[dict]) -> int:
    """估算訊息列表（含 role 標記開銷）的總 token 數"""
    return sum(estimate_tokens(m.get("content") or "") + 4 for m in messages)
