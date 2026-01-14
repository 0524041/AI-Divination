
import React from 'react';

interface Star {
  name: string;
  brightness?: string;
  type?: string;
}

interface Palace {
  index: number;
  name: string;
  heavenly_stem: string;
  earthly_branch: string;
  major_stars: Star[];
  minor_stars: Star[];
  adjective_stars?: Star[];
  decadal?: {
    range: string;
  };
  ages?: number[];
}

interface ZiweiChartProps {
  palaces: Palace[];
  soulPalaceBranch: string;
  bodyPalaceBranch: string;
  centerInfo?: {
    name: string;
    gender: string;
    fiveElements: string;
    birthDate: string;
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
  const getPalaceByBranch = (branch: string) => palaces.find(p => p.earthly_branch === branch);

  return (
    <div className="w-full max-w-[800px] mx-auto aspect-square bg-[#1a0b2e] border-2 border-[#d4af37] p-1 relative rounded-lg shadow-2xl overflow-hidden font-serif">
      <div className="absolute inset-0 opacity-10 pointer-events-none bg-center bg-no-repeat"
        style={{ backgroundImage: 'radial-gradient(circle, #d4af37 1px, transparent 1px)', backgroundSize: '20px 20px' }} />

      <div className="grid grid-cols-4 grid-rows-4 h-full w-full gap-1">
        {/* Center Info */}
        <div className="col-start-2 row-start-2 col-span-2 row-span-2 flex flex-col items-center justify-center text-[#d4af37] p-4 text-center border border-[#d4af37]/30 bg-[#1a0b2e]/90 rounded z-10">
          {centerInfo && (
            <>
              <h2 className="text-3xl font-bold mb-2 tracking-widest">{centerInfo.name}</h2>
              <div className="space-y-1 text-sm opacity-80">
                <p>{centerInfo.gender === 'male' ? '乾造' : '坤造'} | {centerInfo.fiveElements}</p>
                <p>{centerInfo.birthDate}</p>
                <div className="mt-4 pt-4 border-t border-[#d4af37]/30 w-full">
                  <p className="text-xs">命宮: {soulPalaceBranch} | 身宮: {bodyPalaceBranch}</p>
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
                relative border border-[#d4af37]/40 p-1 flex flex-col justify-between overflow-hidden transition-all hover:bg-[#d4af37]/10
                ${isSoul ? 'bg-[#d4af37]/20 shadow-inner' : ''}
              `}
              style={{
                gridRow: pos.row + 1,
                gridColumn: pos.col + 1
              }}
            >
              {/* Palace Name & Stem */}
              <div className="flex justify-between items-start text-xs font-bold text-[#d4af37]">
                <span className="bg-[#d4af37] text-[#1a0b2e] px-1 rounded-br">{palace.heavenly_stem}</span>
                <span className="text-sm">{palace.name}</span>
              </div>

              {/* Stars */}
              <div className="flex-1 flex flex-row gap-1 p-1 text-[10px] leading-tight overflow-hidden">
                <div className="flex flex-col gap-1 w-1/2 items-end border-r border-[#d4af37]/20 pr-1">
                  {palace.major_stars?.map((star, idx) => (
                    <span key={idx} className={`font-bold ${star.brightness === '廟' || star.brightness === '旺' ? 'text-red-400' : 'text-red-300'}`}>
                      {star.name} <span className="text-[9px] opacity-70">{star.brightness}</span>
                    </span>
                  ))}
                </div>
                <div className="flex flex-col gap-0.5 w-1/2 pl-1 flex-wrap content-start">
                  {palace.minor_stars?.map((star, idx) => (
                    <span key={idx} className="text-purple-300 scale-95 origin-left whitespace-nowrap">
                      {star.name}
                    </span>
                  ))}
                </div>
              </div>

              {/* Branch & Decadal */}
              <div className="flex justify-between items-end text-xs mt-auto pt-1 border-t border-[#d4af37]/20">
                <span className="text-gray-400 scale-90 origin-bottom-left">
                  {palace.decadal?.range && `限 ${palace.decadal.range}`}
                </span>
                <span className="text-[#d4af37] font-bold text-lg leading-none">{palace.earthly_branch}</span>
              </div>

              {/* Soul/Body Markers */}
              {isSoul && <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[4rem] text-[#d4af37] opacity-10 pointer-events-none font-bold">命</div>}
              {isBody && !isSoul && <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[4rem] text-[#d4af37] opacity-10 pointer-events-none font-bold">身</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
};
