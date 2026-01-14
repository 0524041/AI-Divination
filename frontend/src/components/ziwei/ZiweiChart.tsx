
import React from 'react';

interface Star {
  name: string;
  brightness?: string;
  type?: 'major' | 'minor' | 'adjective';
  mutagen?: string; // 忌, 祿, etc.
}

interface Palace {
  index: number;
  name: string;
  heavenlyStem: string;
  earthlyBranch: string;
  majorStars: Star[];
  minorStars: Star[];
  adjectiveStars?: Star[];
  decadal?: {
    range: number[]; // iztro usually returns [start, end]
  };
  ages?: number[];
  isBodyPalace?: boolean;
  isSoulPalace?: boolean; // Sometimes included
}

interface ZiweiChartProps {
  palaces: Palace[];
  soulPalaceBranch: string;
  bodyPalaceBranch: string;
  centerInfo?: {
    name: string;
    gender: string;
    fiveElements: string;
    birthDate: string; // Formatted local date
    solarDate: string; // YYYY-MM-DD
    lunarDate: string; // Native string
    lunarInfo?: {
      heavenly_stem_earthly_branch_year: string;
      heavenly_stem_earthly_branch_month: string;
      heavenly_stem_earthly_branch_day: string;
      description: string;
    };
  };
}

// Grid positions (row, col) 0-indexed, 4x4 grid
const GRID_POSITIONS: Record<string, { row: number; col: number }> = {
  '巳': { row: 0, col: 0 },
  '午': { row: 0, col: 1 },
  '未': { row: 0, col: 2 },
  '申': { row: 0, col: 3 },
  '酉': { row: 1, col: 3 },
  '戌': { row: 2, col: 3 },
  '亥': { row: 3, col: 3 },
  '子': { row: 3, col: 2 },
  '丑': { row: 3, col: 1 },
  '寅': { row: 3, col: 0 },
  '卯': { row: 2, col: 0 },
  '辰': { row: 1, col: 0 },
};

export const ZiweiChart: React.FC<ZiweiChartProps> = ({
  palaces,
  soulPalaceBranch,
  bodyPalaceBranch,
  centerInfo
}) => {
  const getPalaceByBranch = (branch: string) => palaces.find(p => p.earthlyBranch === branch);

  return (
    <div className="w-full max-w-[800px] mx-auto aspect-square bg-white dark:bg-[#1a0b2e] border-2 border-amber-200 dark:border-[#d4af37] p-1 relative rounded-lg shadow-2xl overflow-hidden font-serif text-gray-800 dark:text-[#d4af37]">
      <div className="absolute inset-0 opacity-10 pointer-events-none bg-center bg-no-repeat dark:block hidden"
        style={{ backgroundImage: 'radial-gradient(circle, #d4af37 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
      <div className="absolute inset-0 opacity-10 pointer-events-none bg-center bg-no-repeat block dark:hidden"
        style={{ backgroundImage: 'radial-gradient(circle, #000 1px, transparent 1px)', backgroundSize: '20px 20px' }} />

      <div className="grid grid-cols-4 grid-rows-4 h-full w-full gap-1">
        {/* Center Info */}
        <div className="col-start-2 row-start-2 col-span-2 row-span-2 flex flex-col items-center justify-center p-4 text-center border border-amber-200/50 dark:border-[#d4af37]/30 bg-white/90 dark:bg-[#1a0b2e]/90 rounded z-10 backdrop-blur-sm">
          {centerInfo && (
            <>
              <h2 className="text-3xl font-bold mb-2 tracking-widest">{centerInfo.name}</h2>
              <div className="space-y-1 text-sm opacity-80">
                <p className="text-lg font-bold text-amber-600 dark:text-[#d4af37]">
                  {centerInfo.gender === 'male' ? '乾造' : '坤造'} | {centerInfo.fiveElements}
                </p>
                <div className="py-2 space-y-1 border-t border-b border-gray-200 dark:border-[#d4af37]/30 my-2">
                  <p className="text-xs">
                    <span className="opacity-60">陽曆：</span>{centerInfo.solarDate}
                  </p>
                  <p className="text-xs font-serif">
                    <span className="opacity-60">農曆：</span>{centerInfo.lunarInfo?.description}
                  </p>
                  <p className="text-sm font-bold text-amber-700 dark:text-[#f2d06b]">
                    {centerInfo.lunarInfo?.heavenly_stem_earthly_branch_year}年 {' '}
                    {centerInfo.lunarInfo?.heavenly_stem_earthly_branch_month}月 {' '}
                    {centerInfo.lunarInfo?.heavenly_stem_earthly_branch_day}日
                  </p>
                </div>

                <div className="mt-2 text-xs opacity-70">
                  <p>命宮: {soulPalaceBranch} | 身宮: {bodyPalaceBranch}</p>
                </div>
              </div>
            </>
          )}
          {!centerInfo && <span className="text-xl opacity-50">紫微斗數</span>}
        </div>

        {/* 12 Palaces */}
        {Object.entries(GRID_POSITIONS).map(([branch, pos]) => {
          const palace = getPalaceByBranch(branch);
          if (!palace) return null;

          const isSoul = branch === soulPalaceBranch;
          const isBody = branch === bodyPalaceBranch;

          return (
            <div
              key={branch}
              className={`
                relative border border-amber-100 dark:border-[#d4af37]/40 p-1 flex flex-col justify-between overflow-hidden transition-all hover:bg-amber-50 dark:hover:bg-[#d4af37]/10
                ${isSoul ? 'bg-amber-50 dark:bg-[#d4af37]/20 shadow-inner' : ''}
              `}
              style={{
                gridRow: pos.row + 1,
                gridColumn: pos.col + 1
              }}
            >
              {isBody && !isSoul && <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[4rem] text-[#d4af37] opacity-10 pointer-events-none font-bold">身</div>}

              {/* Palace Name (Top Center) */}
              <div className="absolute top-1 left-1/2 -translate-x-1/2 font-bold text-sm bg-amber-100/50 dark:bg-[#d4af37]/20 px-2 py-0.5 rounded-full whitespace-nowrap z-10">
                {palace.name}
              </div>

              {/* Heavenly Stem & Earthly Branch */}
              <div className="absolute bottom-1 right-2 text-xs opacity-60 font-mono">
                {palace.heavenlyStem}{palace.earthlyBranch}
              </div>

              {/* Main Stars (Right Side - Vertical) */}
              <div className="absolute top-8 right-1 flex flex-col items-end gap-1">
                {palace.majorStars.map((star, idx) => (
                  <span key={idx} className={`text-sm font-bold writing-vertical-rl ${star.brightness === '廟' || star.brightness === '旺' ? 'text-red-600 dark:text-[#ff4d4d]' : ''}`}>
                    {star.name}<span className="text-[10px] opacity-70 ml-0.5">{star.brightness}</span>
                    {star.mutagen && <span className="text-[10px] text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/50 rounded-full px-0.5 ml-0.5 block w-fit">{star.mutagen}</span>}
                  </span>
                ))}
              </div>

              {/* Minor Stars (Left Side - Flow) */}
              <div className="absolute top-8 left-1 w-1/2 flex flex-wrap content-start gap-1">
                {palace.minorStars.map((star, idx) => (
                  <span key={idx} className="text-[10px] opacity-80 leading-tight">
                    {star.name}
                  </span>
                ))}
              </div>

              {/* Decadal (Bottom Left) */}
              {palace.decadal && (
                <div className="absolute bottom-1 left-1 text-[10px] opacity-50">
                  {palace.decadal.range[0]}-{palace.decadal.range[1]}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
