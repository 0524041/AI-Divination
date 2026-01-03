'use client';

import React, { useState, useEffect, useCallback } from 'react';

interface CoinTossingProps {
  result: {
    coins: number[];
    chart_data: any;
  };
  aiConfig: {
    provider: string;
    local_model: string | null;
  } | null;
  onComplete: () => void;
}

// Yao value meanings with Chinese names
const YAO_INFO: Record<number, { name: string; symbol: string; isYang: boolean; isMoving: boolean; description: string }> = {
  0: { name: '老陽', symbol: '○', isYang: true, isMoving: true, description: '陽極生陰，變為陰爻' },
  1: { name: '少陽', symbol: '—', isYang: true, isMoving: false, description: '陽爻，靜爻不動' },
  2: { name: '少陰', symbol: '- -', isYang: false, isMoving: false, description: '陰爻，靜爻不動' },
  3: { name: '老陰', symbol: '✕', isYang: false, isMoving: true, description: '陰極生陽，變為陽爻' },
};

// Yao position names
const YAO_POSITIONS = ['初爻', '二爻', '三爻', '四爻', '五爻', '上爻'];

// Coin Component
const Coin = ({ index, isSpinning, isHead }: { index: number; isSpinning: boolean; isHead: boolean }) => {
  const spinStyle: React.CSSProperties = isSpinning
    ? {
      animation: `toss 1.5s ease-out forwards`,
      animationDelay: `${index * 100}ms`,
    }
    : {};

  return (
    <div className="relative w-20 h-20 sm:w-24 sm:h-24" style={spinStyle}>
      <div
        className={`w-full h-full rounded-full border-4 border-[#d4af37] shadow-lg flex items-center justify-center transition-all duration-500 ${isHead ? 'bg-[#f4e4bc]' : 'bg-[#e6d5a8]'
          }`}
        style={{
          transformStyle: 'preserve-3d',
          transform: !isSpinning && !isHead ? 'rotateY(180deg)' : 'rotateY(0deg)',
        }}
      >
        {isHead ? (
          <div className="flex flex-col items-center justify-center">
            <span className="text-[#8a7018] text-[10px] font-bold">乾隆</span>
            <div className="w-10 h-10 border-2 border-[#d4af37] flex items-center justify-center my-0.5">
              <span className="text-[#d4af37] font-bold text-xl">陽</span>
            </div>
            <span className="text-[#8a7018] text-[10px] font-bold">通寶</span>
          </div>
        ) : (
          <div className="w-10 h-10 border-2 border-[#8a7018] flex items-center justify-center">
            <span className="text-[#8a7018] font-bold text-xl">陰</span>
          </div>
        )}
      </div>
    </div>
  );
};

// Line Component with detailed info
const HexagramLine = ({
  value,
  position,
  isNew,
  showDetail,
}: {
  value: number;
  position: number;
  isNew: boolean;
  showDetail: boolean;
}) => {
  const info = YAO_INFO[value];

  return (
    <div
      className={`w-full flex items-center gap-4 p-3 rounded-lg mb-2 transition-all duration-500 ${isNew ? 'bg-[var(--gold)]/20 animate-pulse' : 'bg-gray-800/50'
        }`}
    >
      {/* Position label */}
      <div className="w-12 text-center">
        <span className="text-gray-400 text-sm">{YAO_POSITIONS[position]}</span>
      </div>

      {/* Line visualization */}
      <div className="flex-1 flex justify-center items-center gap-2 h-6">
        {info.isYang ? (
          <div className="w-full h-4 bg-[var(--gold)] rounded-full shadow-[0_0_10px_rgba(212,175,55,0.5)]" />
        ) : (
          <>
            <div className="w-[42%] h-4 bg-[var(--gold)] rounded-full" />
            <div className="w-[10%]" />
            <div className="w-[42%] h-4 bg-[var(--gold)] rounded-full" />
          </>
        )}
      </div>

      {/* Yao info */}
      <div className="w-24 text-right">
        <span
          className={`text-sm font-bold ${info.isMoving ? 'text-red-400' : 'text-gray-300'}`}
        >
          {info.name}
          {info.isMoving && <span className="ml-1 text-red-400">{info.symbol}</span>}
        </span>
        {info.isMoving && showDetail && (
          <p className="text-xs text-gray-500 mt-0.5">變爻</p>
        )}
      </div>
    </div>
  );
};

// Coin result display
const CoinResultDisplay = ({ value, coinFaces }: { value: number; coinFaces: boolean[] }) => {
  const headCount = coinFaces.filter((f) => f).length;
  const info = YAO_INFO[value];

  return (
    <div className="bg-gray-900/80 rounded-xl p-4 border border-gray-700">
      <div className="flex justify-between items-center">
        <div>
          <span className="text-gray-400 text-sm">擲幣結果：</span>
          <span className="text-white ml-2">
            {headCount} 個陽面，{3 - headCount} 個陰面
          </span>
        </div>
        <div className={`font-bold ${info.isMoving ? 'text-red-400' : 'text-[var(--gold)]'}`}>
          → {info.name}
          {info.isMoving && <span className="ml-1 text-xs">(動爻)</span>}
        </div>
      </div>
    </div>
  );
};

export default function CoinTossing({ result, aiConfig, onComplete }: CoinTossingProps) {
  const [currentLine, setCurrentLine] = useState(0); // 0-5
  const [phase, setPhase] = useState<'idle' | 'tossing' | 'landed' | 'finished'>('idle');
  const [coinFaces, setCoinFaces] = useState<boolean[]>([true, true, true]); // true=Head, false=Tail

  // Constants
  const TOSS_DURATION = 2000; // Animation duration in ms
  const AUTO_TIMEOUT = aiConfig?.provider === 'local' ? 20000 : 5000;

  // Determine coin faces based on result value
  const getFaces = useCallback((value: number): boolean[] => {
    // value 0 = 3 heads (老陽), 1 = 2 heads (少陰), 2 = 1 head (少陽), 3 = 0 heads (老陰)
    switch (value) {
      case 0:
        return [true, true, true];
      case 1:
        return [true, true, false].sort(() => Math.random() - 0.5);
      case 2:
        return [true, false, false].sort(() => Math.random() - 0.5);
      case 3:
        return [false, false, false];
      default:
        return [true, true, true];
    }
  }, []);

  const handleToss = useCallback(() => {
    if (phase !== 'idle') return;

    setPhase('tossing');

    // Prepare result for this line
    const faces = getFaces(result.coins[currentLine]);

    // Wait for animation
    setTimeout(() => {
      setCoinFaces(faces);
      setPhase('landed');

      // Auto advance to next idle state or finish
      setTimeout(() => {
        if (currentLine < 5) {
          setCurrentLine((prev) => prev + 1);
          setPhase('idle');
        } else {
          setPhase('finished');
          setTimeout(onComplete, 1500); // Short delay before closing
        }
      }, 2000); // Time to view the result line before next toss
    }, TOSS_DURATION);
  }, [phase, currentLine, result.coins, getFaces, onComplete]);

  // Auto toss timer
  useEffect(() => {
    if (phase === 'idle') {
      const timer = setTimeout(() => {
        handleToss();
      }, AUTO_TIMEOUT);
      return () => clearTimeout(timer);
    }
  }, [phase, handleToss, AUTO_TIMEOUT]);

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-4 overflow-y-auto">
      {/* Global Styles */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes toss {
              0% { transform: translateY(0) rotateX(0); }
              25% { transform: translateY(-120px) rotateX(720deg); }
              50% { transform: translateY(-80px) rotateX(1440deg); }
              75% { transform: translateY(-40px) rotateX(2160deg); }
              100% { transform: translateY(0) rotateX(2880deg); }
            }
            @keyframes progress {
              from { width: 0%; }
              to { width: 100%; }
            }
          `,
        }}
      />

      <div className="w-full max-w-2xl flex flex-col items-center gap-6">
        {/* Header */}
        <div className="w-full flex justify-between items-start px-4">
          <div className="flex-1 text-center space-y-2">
            <h2 className="text-2xl sm:text-3xl font-bold text-[var(--gold)] tracking-widest">
              心中默想 所問之事
            </h2>
            <p className="text-gray-400 text-lg">
              第 <span className="text-[var(--gold)] font-bold text-xl">{currentLine + 1}</span> 擲 /{' '}
              <span className="text-gray-500">{YAO_POSITIONS[currentLine]}</span>
            </p>
          </div>
          <button
            onClick={onComplete}
            className="text-gray-500 hover:text-[var(--gold)] text-sm transition-colors pt-2"
          >
            Skip 電腦自動擲幣 {`>>`}
          </button>
        </div>

        {/* Coins Area */}
        <div className="h-40 flex items-center justify-center gap-6 sm:gap-8">
          {phase !== 'finished' && (
            <>
              <Coin index={0} isSpinning={phase === 'tossing'} isHead={coinFaces[0]} />
              <Coin index={1} isSpinning={phase === 'tossing'} isHead={coinFaces[1]} />
              <Coin index={2} isSpinning={phase === 'tossing'} isHead={coinFaces[2]} />
            </>
          )}
          {phase === 'finished' && (
            <div className="text-center">
              <p className="text-[var(--gold)] text-2xl font-bold mb-2">六爻已成</p>
              <p className="text-gray-400">正在等待 AI 解卦...</p>
            </div>
          )}
        </div>

        {/* Coin Result Display (when landed) */}
        {phase === 'landed' && (
          <CoinResultDisplay value={result.coins[currentLine]} coinFaces={coinFaces} />
        )}

        {/* Hexagram Stack (Building up from bottom) */}
        <div className="w-full max-w-md bg-gray-900/50 p-4 rounded-xl border border-gray-800">
          <div className="flex flex-col-reverse">
            {/* Show all 6 positions */}
            {Array.from({ length: 6 }).map((_, i) => {
              const isRevealed =
                i < currentLine || (i === currentLine && (phase === 'landed' || phase === 'finished'));

              if (isRevealed) {
                return (
                  <HexagramLine
                    key={i}
                    value={result.coins[i]}
                    position={i}
                    isNew={i === currentLine && phase === 'landed'}
                    showDetail={true}
                  />
                );
              }

              return (
                <div
                  key={`placeholder-${i}`}
                  className="h-14 w-full border border-gray-700 border-dashed rounded-lg mb-2 flex items-center justify-center"
                >
                  <span className="text-gray-600 text-sm">{YAO_POSITIONS[i]}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Action Button */}
        <div className="w-full max-w-xs">
          {phase === 'idle' && (
            <button
              onClick={handleToss}
              className="w-full py-4 bg-[var(--gold)] text-black font-bold text-xl rounded-xl hover:bg-amber-400 transition relative overflow-hidden shadow-[0_0_20px_rgba(212,175,55,0.3)]"
            >
              <span className="relative z-10">
                {currentLine === 0 ? '開始擲幣' : currentLine === 5 ? '最後一擲' : '再擲一次'}
              </span>
              <div
                className="absolute bottom-0 left-0 h-1 bg-black/30"
                style={{
                  animationName: 'progress',
                  animationDuration: `${AUTO_TIMEOUT}ms`,
                  animationTimingFunction: 'linear',
                  animationFillMode: 'forwards',
                }}
              />
            </button>
          )}

          {phase === 'tossing' && (
            <div className="text-center text-[var(--gold)] animate-pulse text-lg">擲幣中...</div>
          )}

          {phase === 'landed' && (
            <div className="text-center text-gray-400">記錄 {YAO_POSITIONS[currentLine]}...</div>
          )}

          {phase === 'finished' && (
            <div className="text-center text-[var(--gold)]">擲幣完成，等待解卦...</div>
          )}
        </div>

        {/* Progress indicator */}
        <div className="flex gap-2 mt-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className={`w-3 h-3 rounded-full transition-all ${i < currentLine || (i === currentLine && phase === 'finished')
                ? 'bg-[var(--gold)]'
                : i === currentLine
                  ? 'bg-[var(--gold)]/50 animate-pulse'
                  : 'bg-gray-700'
                }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
