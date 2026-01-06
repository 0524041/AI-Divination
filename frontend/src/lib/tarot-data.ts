export interface TarotCardData {
  id: number;
  name: string;
  name_cn: string;
  image: string;
  reversed?: boolean;
}

export const TAROT_CARDS: TarotCardData[] = [
  // Major Arcana
  { id: 0, name: "The Fool", name_cn: "愚者", image: "fool.jpg" },
  { id: 1, name: "The Magician", name_cn: "魔術師", image: "magician.jpg" },
  { id: 2, name: "The High Priestess", name_cn: "女祭司", image: "high-priestess.jpg" },
  { id: 3, name: "The Empress", name_cn: "皇后", image: "empress.jpg" },
  { id: 4, name: "The Emperor", name_cn: "皇帝", image: "emperor.jpg" },
  { id: 5, name: "The Hierophant", name_cn: "教皇", image: "hierophant.jpg" },
  { id: 6, name: "The Lovers", name_cn: "戀人", image: "lovers.jpg" },
  { id: 7, name: "The Chariot", name_cn: "戰車", image: "chariot.jpg" },
  { id: 8, name: "Strength", name_cn: "力量", image: "strength.jpg" },
  { id: 9, name: "The Hermit", name_cn: "隱士", image: "hermit.jpg" },
  { id: 10, name: "Wheel of Fortune", name_cn: "命運之輪", image: "wheel-fortune.jpg" },
  { id: 11, name: "Justice", name_cn: "正義", image: "justice.jpg" },
  { id: 12, name: "The Hanged Man", name_cn: "倒吊人", image: "hanged-man.jpg" },
  { id: 13, name: "Death", name_cn: "死神", image: "death.jpg" },
  { id: 14, name: "Temperance", name_cn: "節制", image: "temperance.jpg" },
  { id: 15, name: "The Devil", name_cn: "惡魔", image: "devil.jpg" },
  { id: 16, name: "The Tower", name_cn: "高塔", image: "tower.jpg" },
  { id: 17, name: "The Star", name_cn: "星星", image: "star.jpg" },
  { id: 18, name: "The Moon", name_cn: "月亮", image: "moon.jpg" },
  { id: 19, name: "The Sun", name_cn: "太陽", image: "sun.jpg" },
  { id: 20, name: "Judgement", name_cn: "審判", image: "judgement.jpg" },
  { id: 21, name: "The World", name_cn: "世界", image: "world.jpg" },
  
  // Wands
  { id: 22, name: "Ace of Wands", name_cn: "權杖一", image: "ace-wands.jpg" },
  { id: 23, name: "Two of Wands", name_cn: "權杖二", image: "two-wands.jpg" },
  { id: 24, name: "Three of Wands", name_cn: "權杖三", image: "three-wands.jpg" },
  { id: 25, name: "Four of Wands", name_cn: "權杖四", image: "four-wands.jpg" },
  { id: 26, name: "Five of Wands", name_cn: "權杖五", image: "five-wands.jpg" },
  { id: 27, name: "Six of Wands", name_cn: "權杖六", image: "six-wands.jpg" },
  { id: 28, name: "Seven of Wands", name_cn: "權杖七", image: "seven-wands.jpg" },
  { id: 29, name: "Eight of Wands", name_cn: "權杖八", image: "eight-wands.jpg" },
  { id: 30, name: "Nine of Wands", name_cn: "權杖九", image: "nine-wands.jpg" },
  { id: 31, name: "Ten of Wands", name_cn: "權杖十", image: "ten-wands.jpg" },
  { id: 32, name: "Page of Wands", name_cn: "權杖侍者", image: "page-wands.jpg" },
  { id: 33, name: "Knight of Wands", name_cn: "權杖騎士", image: "knight-wands.jpg" },
  { id: 34, name: "Queen of Wands", name_cn: "權杖皇后", image: "queen-wands.jpg" },
  { id: 35, name: "King of Wands", name_cn: "權杖國王", image: "king-wands.jpg" },

  // Cups
  { id: 36, name: "Ace of Cups", name_cn: "聖杯一", image: "ace-cups.jpg" },
  { id: 37, name: "Two of Cups", name_cn: "聖杯二", image: "two-cups.jpg" },
  { id: 38, name: "Three of Cups", name_cn: "聖杯三", image: "three-cups.jpg" },
  { id: 39, name: "Four of Cups", name_cn: "聖杯四", image: "four-cups.jpg" },
  { id: 40, name: "Five of Cups", name_cn: "聖杯五", image: "five-cups.jpg" },
  { id: 41, name: "Six of Cups", name_cn: "聖杯六", image: "six-cups.jpg" },
  { id: 42, name: "Seven of Cups", name_cn: "聖杯七", image: "seven-cups.jpg" },
  { id: 43, name: "Eight of Cups", name_cn: "聖杯八", image: "eight-cups.jpg" },
  { id: 44, name: "Nine of Cups", name_cn: "聖杯九", image: "nine-cups.jpg" },
  { id: 45, name: "Ten of Cups", name_cn: "聖杯十", image: "ten-cups.jpg" },
  { id: 46, name: "Page of Cups", name_cn: "聖杯侍者", image: "page-cups.jpg" },
  { id: 47, name: "Knight of Cups", name_cn: "聖杯騎士", image: "knight-cups.jpg" },
  { id: 48, name: "Queen of Cups", name_cn: "聖杯皇后", image: "queen-cups.jpg" },
  { id: 49, name: "King of Cups", name_cn: "聖杯國王", image: "king-cups.jpg" },

  // Swords
  { id: 50, name: "Ace of Swords", name_cn: "寶劍一", image: "ace-swords.jpg" },
  { id: 51, name: "Two of Swords", name_cn: "寶劍二", image: "two-swords.jpg" },
  { id: 52, name: "Three of Swords", name_cn: "寶劍三", image: "three-swords.jpg" },
  { id: 53, name: "Four of Swords", name_cn: "寶劍四", image: "four-swords.jpg" },
  { id: 54, name: "Five of Swords", name_cn: "寶劍五", image: "five-swords.jpg" },
  { id: 55, name: "Six of Swords", name_cn: "寶劍六", image: "six-swords.jpg" },
  { id: 56, name: "Seven of Swords", name_cn: "寶劍七", image: "seven-swords.jpg" },
  { id: 57, name: "Eight of Swords", name_cn: "寶劍八", image: "eight-swords.jpg" },
  { id: 58, name: "Nine of Swords", name_cn: "寶劍九", image: "nine-swords.jpg" },
  { id: 59, name: "Ten of Swords", name_cn: "寶劍十", image: "ten-swords.jpg" },
  { id: 60, name: "Page of Swords", name_cn: "寶劍侍者", image: "page-swords.jpg" },
  { id: 61, name: "Knight of Swords", name_cn: "寶劍騎士", image: "knight-swords.jpg" },
  { id: 62, name: "Queen of Swords", name_cn: "寶劍皇后", image: "queen-swords.jpg" },
  { id: 63, name: "King of Swords", name_cn: "寶劍國王", image: "king-swords.jpg" },

  // Pentacles
  { id: 64, name: "Ace of Pentacles", name_cn: "錢幣一", image: "ace-pentacles.jpg" },
  { id: 65, name: "Two of Pentacles", name_cn: "錢幣二", image: "two-pentacles.jpg" },
  { id: 66, name: "Three of Pentacles", name_cn: "錢幣三", image: "three-pentacles.jpg" },
  { id: 67, name: "Four of Pentacles", name_cn: "錢幣四", image: "four-pentacles.jpg" },
  { id: 68, name: "Five of Pentacles", name_cn: "錢幣五", image: "five-pentacles.jpg" },
  { id: 69, name: "Six of Pentacles", name_cn: "錢幣六", image: "six-pentacles.jpg" },
  { id: 70, name: "Seven of Pentacles", name_cn: "錢幣七", image: "seven-pentacles.jpg" },
  { id: 71, name: "Eight of Pentacles", name_cn: "錢幣八", image: "eight-pentacles.jpg" },
  { id: 72, name: "Nine of Pentacles", name_cn: "錢幣九", image: "nine-pentacles.jpg" },
  { id: 73, name: "Ten of Pentacles", name_cn: "錢幣十", image: "ten-pentacles.jpg" },
  { id: 74, name: "Page of Pentacles", name_cn: "錢幣侍者", image: "page-pentacles.jpg" },
  { id: 75, name: "Knight of Pentacles", name_cn: "錢幣騎士", image: "knight-pentacles.jpg" },
  { id: 76, name: "Queen of Pentacles", name_cn: "錢幣皇后", image: "queen-pentacles.jpg" },
  { id: 77, name: "King of Pentacles", name_cn: "錢幣國王", image: "king-pentacles.jpg" },
];
