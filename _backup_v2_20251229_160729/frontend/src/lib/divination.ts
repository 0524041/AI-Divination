/**
 * 六爻搖卦工具函數
 * 
 * 每次擲三枚硬幣，計算背面個數：
 * - 0 個背面 (3正) = 老陰 (⚋ 動爻，變陽)
 * - 1 個背面 (2正1負) = 少陽 (⚊)
 * - 2 個背面 (1正2負) = 少陰 (⚋)
 * - 3 個背面 (3負) = 老陽 (⚊ 動爻，變陰)
 */

export interface CoinResult {
  value: number; // 0-3，代表背面個數
  isMoving: boolean; // 是否為動爻（老陰或老陽）
  isYang: boolean; // 是否為陽爻
  symbol: string; // 爻象符號
  label: string; // 描述
}

/**
 * 模擬擲一次三枚硬幣
 * @returns 0-3 的數字，代表背面個數
 */
export function tossCoin(): number {
  // 每枚硬幣 50% 機率正面或背面
  let backs = 0;
  for (let i = 0; i < 3; i++) {
    if (Math.random() > 0.5) {
      backs++;
    }
  }
  return backs;
}

/**
 * 完成六次搖卦
 * @returns 6 個數字的陣列，從初爻到上爻
 */
export function performDivination(): number[] {
  const coins: number[] = [];
  for (let i = 0; i < 6; i++) {
    coins.push(tossCoin());
  }
  return coins;
}

/**
 * 解析硬幣結果
 */
export function parseCoinResult(value: number): CoinResult {
  switch (value) {
    case 0:
      return {
        value: 0,
        isMoving: true,
        isYang: false,
        symbol: '⚋ ○',
        label: '老陰 (3正)',
      };
    case 1:
      return {
        value: 1,
        isMoving: false,
        isYang: true,
        symbol: '⚊',
        label: '少陽 (2正1負)',
      };
    case 2:
      return {
        value: 2,
        isMoving: false,
        isYang: false,
        symbol: '⚋',
        label: '少陰 (1正2負)',
      };
    case 3:
      return {
        value: 3,
        isMoving: true,
        isYang: true,
        symbol: '⚊ ×',
        label: '老陽 (3負)',
      };
    default:
      return {
        value,
        isMoving: false,
        isYang: false,
        symbol: '?',
        label: '未知',
      };
  }
}

/**
 * 獲取爻位名稱
 */
export function getYaoName(index: number): string {
  const names = ['初爻', '二爻', '三爻', '四爻', '五爻', '上爻'];
  return names[index] || `第${index + 1}爻`;
}

/**
 * 獲取硬幣顯示的 CSS 類
 */
export function getCoinDisplayClass(value: number): string {
  switch (value) {
    case 0:
      return 'bg-gradient-to-r from-blue-600 to-blue-800 text-white'; // 老陰
    case 1:
      return 'bg-gradient-to-r from-amber-500 to-yellow-600 text-black'; // 少陽
    case 2:
      return 'bg-gradient-to-r from-slate-500 to-slate-700 text-white'; // 少陰
    case 3:
      return 'bg-gradient-to-r from-red-500 to-red-700 text-white'; // 老陽
    default:
      return 'bg-gray-500';
  }
}
