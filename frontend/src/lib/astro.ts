import { astro } from 'iztro';

/**
 * Ziwei Chart Generation Utility using iztro.js
 * 
 * Documentation: https://github.com/SylarLong/iztro
 */

export type Gender = 'male' | 'female'; // iztro uses '男' | '女' but we work with english keys internally

/**
 * Generate a Natal Chart (本命盤)
 */
export const generateNatalChart = (
    solarDateStr: string, // "YYYY-MM-DD"
    timeIndex: number,    // 0-12 (0=Early Rat... 12=Late Rat)
    gender: Gender,
    fixLeap: boolean = true
) => {
    const genderCn = gender === 'male' ? '男' : '女';

    // iztro.astro.bySolar(solarDateStr, timeIndex, gender, fixLeap, language)
    // solarDateStr format: YYYY-M-D or YYYY-MM-DD
    const chart = astro.bySolar(solarDateStr, timeIndex, genderCn, true, 'zh-TW');
    return chart;
};

/**
 * Helper to convert Hour (0-23) to Chinese Time Index (0-12)
 * 23-1: 0 (Early Rat) - but iztro might handle 23 as 0? 
 * Actually iztro typical mapping:
 * 0: 子 (23:00-01:00)
 * 1: 丑 (01:00-03:00)
 * ...
 * 12: invalid/special? 
 * 
 * Let's standardize input:
 * Z (0): 23-1
 * C (1): 1-3
 * Y (2): 3-5
 * M (3): 5-7
 * C (4): 7-9
 * S (5): 9-11
 * W (6): 11-13
 * W (7): 13-15
 * S (8): 15-17
 * Y (9): 17-19
 * X (10): 19-21
 * H (11): 21-23
 * 
 * Note: iztro expects 0 for Early Rat (00:00-01:00) and maybe handled 23 separately?
 * Checking iztro docs (or assumption): usually 0=Zi, 1=Chou... 
 * 
 */
export const getChineseTimeIndex = (hour: number): number => {
    if (hour >= 23 || hour < 1) return 0; // Zi
    if (hour >= 1 && hour < 3) return 1; // Chou
    if (hour >= 3 && hour < 5) return 2; // Yin
    if (hour >= 5 && hour < 7) return 3; // Mao
    if (hour >= 7 && hour < 9) return 4; // Chen
    if (hour >= 9 && hour < 11) return 5; // Si
    if (hour >= 11 && hour < 13) return 6; // Wu
    if (hour >= 13 && hour < 15) return 7; // Wei
    if (hour >= 15 && hour < 17) return 8; // Shen
    if (hour >= 17 && hour < 19) return 9; // You
    if (hour >= 19 && hour < 21) return 10; // Xu
    if (hour >= 21 && hour < 23) return 11; // Hai
    return 0;
};
