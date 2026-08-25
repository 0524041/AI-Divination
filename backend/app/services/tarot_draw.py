"""
塔羅抽牌演算法（Ticket 05：牌組決定權移至後端）

- 78 張標準牌組（與前端 tarot-data.ts 同源）
- 洗牌以系統安全亂數（random.SystemRandom），正逆位各約 50%
- 牌陣：single(1) / three_card(3) / celtic_cross(10)
"""

import random

SPREAD_SIZES = {"single": 1, "three_card": 3, "celtic_cross": 10}

SPREAD_POSITIONS = {
    "single": ["single"],
    "three_card": ["past", "present", "future"],
    "celtic_cross": [
        "heart",
        "challenge",
        "conscious",
        "foundation",
        "past",
        "future",
        "attitude",
        "external",
        "hopes_fears",
        "outcome",
    ],
}

POSITION_NAMES = {
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


def _c(id: int, name: str, name_cn: str, image: str) -> dict:
    return {"id": id, "name": name, "name_cn": name_cn, "image": image}


MAJOR_ARCANA = [
    ("The Fool", "愚者", "fool.jpg"),
    ("The Magician", "魔術師", "magician.jpg"),
    ("The High Priestess", "女祭司", "high-priestess.jpg"),
    ("The Empress", "皇后", "empress.jpg"),
    ("The Emperor", "皇帝", "emperor.jpg"),
    ("The Hierophant", "教皇", "hierophant.jpg"),
    ("The Lovers", "戀人", "lovers.jpg"),
    ("The Chariot", "戰車", "chariot.jpg"),
    ("Strength", "力量", "strength.jpg"),
    ("The Hermit", "隱士", "hermit.jpg"),
    ("Wheel of Fortune", "命運之輪", "wheel-fortune.jpg"),
    ("Justice", "正義", "justice.jpg"),
    ("The Hanged Man", "倒吊人", "hanged-man.jpg"),
    ("Death", "死神", "death.jpg"),
    ("Temperance", "節制", "temperance.jpg"),
    ("The Devil", "惡魔", "devil.jpg"),
    ("The Tower", "高塔", "tower.jpg"),
    ("The Star", "星星", "star.jpg"),
    ("The Moon", "月亮", "moon.jpg"),
    ("The Sun", "太陽", "sun.jpg"),
    ("Judgement", "審判", "judgement.jpg"),
    ("The World", "世界", "world.jpg"),
]

SUITS = [
    ("Wands", "權杖", "wands"),
    ("Cups", "聖杯", "cups"),
    ("Swords", "寶劍", "swords"),
    ("Pentacles", "錢幣", "pentacles"),
]

RANKS = [
    ("Ace", "一"),
    ("Two", "二"),
    ("Three", "三"),
    ("Four", "四"),
    ("Five", "五"),
    ("Six", "六"),
    ("Seven", "七"),
    ("Eight", "八"),
    ("Nine", "九"),
    ("Ten", "十"),
    ("Page", "侍者"),
    ("Knight", "騎士"),
    ("Queen", "皇后"),
    ("King", "國王"),
]


def build_deck() -> list[dict]:
    """78 張標準牌組"""
    deck: list[dict] = []
    for idx, (name, name_cn, image) in enumerate(MAJOR_ARCANA):
        deck.append(_c(idx, name, name_cn, image))
    card_id = len(MAJOR_ARCANA)
    for suit_en, suit_cn, image_prefix in SUITS:
        for rank_en, rank_cn in RANKS:
            deck.append(
                _c(
                    card_id,
                    f"{rank_en} of {suit_en}",
                    f"{suit_cn}{rank_cn}",
                    f"{card_id - len(MAJOR_ARCANA) + 1}-{image_prefix}.jpg"
                    if False
                    else _minor_image(card_id, image_prefix),
                )
            )
            card_id += 1
    return deck


def _minor_image(card_id: int, prefix: str) -> str:
    """小阿爾克那圖檔名沿用前端慣例（rank-prefix.jpg）"""
    rank_index = (card_id - 22) % 14  # 0=Ace ... 13=King
    return f"{_rank_slug(rank_index)}-{prefix}.jpg"


def _rank_slug(rank_index: int) -> str:
    slugs = [
        "ace",
        "two",
        "three",
        "four",
        "five",
        "six",
        "seven",
        "eight",
        "nine",
        "ten",
        "page",
        "knight",
        "queen",
        "king",
    ]
    return slugs[rank_index]


DECK: list[dict] = build_deck()


def draw_cards(spread_type: str, rng=None) -> list[dict]:
    """抽出指定牌陣的牌；伺服器決定牌面與正逆位（前端不再送牌）"""
    if spread_type not in SPREAD_SIZES:
        raise ValueError(f"未知牌陣：{spread_type}")

    rng = rng or random.SystemRandom()
    count = SPREAD_SIZES[spread_type]
    positions = SPREAD_POSITIONS[spread_type]

    drawn = rng.sample(DECK, count)
    cards = []
    for index, card in enumerate(drawn):
        cards.append(
            {
                **card,
                "reversed": rng.random() < 0.5,
                "position": positions[index],
                "position_name": POSITION_NAMES[positions[index]],
            }
        )
    return cards


def validate_cards(cards: list[dict], spread_type: str) -> None:
    """驗證（legacy 路徑）客戶端送來的牌面完整性"""
    expected = SPREAD_SIZES.get(spread_type)
    if expected is None:
        raise ValueError(f"未知牌陣：{spread_type}")
    if not isinstance(cards, list) or len(cards) != expected:
        raise ValueError(f"牌數不符：{spread_type} 需要 {expected} 張")
    ids = set()
    for card in cards:
        if not isinstance(card, dict):
            raise ValueError("牌面格式錯誤")
        for field in ("id", "name", "name_cn"):
            if field not in card:
                raise ValueError(f"牌面缺少欄位：{field}")
        if int(card["id"]) in ids:
            raise ValueError("牌面重複")
        ids.add(int(card["id"]))
