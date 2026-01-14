declare module 'lunar-javascript' {
  export class Lunar {
    static fromDate(date: Date): Lunar;
    static fromYmd(year: number, month: number, day: number): Lunar;
    
    getYear(): number;
    getMonth(): number;
    getDay(): number;
    getYearInChinese(): string;
    getMonthInChinese(): string;
    getDayInChinese(): string;
    getSolar(): Solar;
    toString(): string;
  }

  export class Solar {
    static fromYmd(year: number, month: number, day: number): Solar;
    toString(): string;
    toYmd(): string;
  }
}
