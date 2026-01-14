import { astro } from 'iztro';
import { CITY_COORDINATES, TaiwanCity } from './taiwan-cities';
import { getMutagensByHeavenlyStem as getMutagens } from 'iztro/lib/utils';

export type Gender = 'male' | 'female';

export const CHINESE_HOURS = [
  '子', '丑', '寅', '卯', '辰', '巳',
  '午', '未', '申', '酉', '戌', '亥'
];

export function getChineseHourName(index: number): string {
  return CHINESE_HOURS[index % 12];
}

export function getChineseTimeIndex(hour: number): number {
  if (hour >= 23 || hour < 1) return 0;
  return Math.floor((hour + 1) / 2);
}

function calculateEOT(d: number): number {
  const b = (2 * Math.PI * (d - 81)) / 365;
  return 9.87 * Math.sin(2 * b) - 7.53 * Math.cos(b) - 1.5 * Math.sin(b);
}

function getDayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  const oneDay = 1000 * 60 * 60 * 24;
  return Math.floor(diff / oneDay);
}

export function calculateTrueSolarTime(date: Date, location: TaiwanCity) {
  const coords = CITY_COORDINATES[location];
  if (!coords) {
    return {
      solarTime: date,
      offsetMinutes: 0,
      lonOffset: 0,
      eot: 0
    };
  }

  const lonOffset = (coords.lon - 120) * 4;
  const dayOfYear = getDayOfYear(date);
  const eot = calculateEOT(dayOfYear);
  const totalOffsetMinutes = lonOffset + eot;
  const solarTime = new Date(date.getTime() + totalOffsetMinutes * 60 * 1000);

  return {
    solarTime,
    offsetMinutes: totalOffsetMinutes,
    lonOffset,
    eot
  };
}

export function generateNatalChart(
  dateStr: string,
  timeIndex: number,
  gender: Gender
) {
  const genderText = gender === 'male' ? '男' : '女';
  return astro.bySolar(dateStr, timeIndex, genderText, true, 'zh-TW');
}

export function generateHoroscope(
  natalChart: any,
  dateStr: string,
  timeIndex: number
) {
  if (natalChart && typeof natalChart.horoscope === 'function') {
    return natalChart.horoscope(dateStr, timeIndex);
  }
  return natalChart;
}

export function getFlowMutagens(heavenlyStem: string) {
    const stemMap: Record<string, string> = {
        '甲': 'jiaHeavenly',
        '乙': 'yiHeavenly',
        '丙': 'bingHeavenly',
        '丁': 'dingHeavenly',
        '戊': 'wuHeavenly',
        '己': 'jiHeavenly',
        '庚': 'gengHeavenly',
        '辛': 'xinHeavenly',
        '壬': 'renHeavenly',
        '癸': 'guiHeavenly'
    };

    const key = stemMap[heavenlyStem];
    if (!key) return [];
    
    // getMutagens returns [Lu, Quan, Ke, Ji] StarNames
    return getMutagens(key as any);
}

// Add types for richer data extraction
export interface LimitInfo {
    index: number;
    heavenlyStem: string;
    earthlyBranch: string;
    name?: string; // e.g. "大限"
}

export interface DetailedHoroscopeData {
    decadal?: LimitInfo;
    yearly?: LimitInfo;
    monthly?: LimitInfo;
    daily?: LimitInfo;
    age?: LimitInfo;
}
