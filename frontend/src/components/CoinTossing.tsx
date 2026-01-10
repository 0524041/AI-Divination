'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { SkipForward } from 'lucide-react';

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

// Yao value meanings
const YAO_INFO: Record<number, { name: string; symbol: string; isYang: boolean; isMoving: boolean }> = {
  0: { name: '老陽', symbol: '○', isYang: true, isMoving: true },
  1: { name: '少陽', symbol: '—', isYang: true, isMoving: false },
  2: { name: '少陰', symbol: '- -', isYang: false, isMoving: false },
  3: { name: '老陰', symbol: '✕', isYang: false, isMoving: true },
};

// Coin Component - 更小的尺寸適應手機
const Coin = ({ index, isSpinning, isHead }: { index: number; isSpinning: boolean; isHead: boolean }) => {
  return (
    <div
      className="w-16 h-16 sm:w-20 sm:h-20 relative"
      style={isSpinning ? {
        animation: `toss 1.5s ease-out forwards`,
        animationDelay: `${index * 80}ms`,
      } : {}}
    >
      <div
        className={`w-full h-full rounded-full border-3 border-[#d4af37] shadow-lg flex items-center justify-center transition-all duration-300 ${isHead ? 'bg-[#f4e4bc]' : 'bg-[#e6d5a8]'
          }`}
        style={{
          transform: !isSpinning && !isHead ? 'rotateY(180deg)' : 'rotateY(0deg)',
        }}
      >
        {isHead ? (
          <div className="flex flex-col items-center justify-center scale-90 sm:scale-100">
            <span className="text-[#8a7018] text-[8px] sm:text-[10px] font-bold">乾隆</span>
            <div className="w-8 h-8 sm:w-10 sm:h-10 border-2 border-[#d4af37] flex items-center justify-center">
              <span className="text-[#d4af37] font-bold text-lg sm:text-xl">陽</span>
            </div>
            <span className="text-[#8a7018] text-[8px] sm:text-[10px] font-bold">通寶</span>
          </div>
        ) : (
          <div className="w-8 h-8 sm:w-10 sm:h-10 border-2 border-[#8a7018] flex items-center justify-center">
            <span className="text-[#8a7018] font-bold text-lg sm:text-xl">陰</span>
          </div>
        )}
      </div>
    </div>
  );
};

// 水平六爻進度顯示
const HexagramProgress = ({ coins, currentLine, phase }: {
  coins: number[];
  currentLine: number;
  phase: string;
}) => {
  return (
    <div className="w-full flex justify-center gap-2 sm:gap-3">
      {Array.from({ length: 6 }).map((_, i) => {
        const isRevealed = i < currentLine || (i === currentLine && (phase === 'landed' || phase === 'finished'));
        const isCurrent = i === currentLine;
        const info = isRevealed ? YAO_INFO[coins[i]] : null;

        return (
          <div
            key={i}
            className={`flex flex-col items-center transition-all duration-300 ${isCurrent && phase !== 'finished' ? 'scale-110' : ''
              }`}
          >
            {/* 爻符號 */}
            <div
              className={`w-10 h-8 sm:w-12 sm:h-10 flex items-center justify-center rounded-lg border-2 transition-all duration-300 ${isRevealed
                  ? info?.isMoving
                    ? 'border-red-400 bg-red-400/20'
                    : 'border-[var(--gold)] bg-[var(--gold)]/20'
                  : isCurrent
                    ? 'border-[var(--gold)]/50 bg-gray-800 animate-pulse'
                    : 'border-gray-700 bg-gray-800/50'
                }`}
            >
              {isRevealed ? (
                <span className={`text-sm sm:text-base font-bold ${info?.isMoving ? 'text-red-400' : 'text-[var(--gold)]'}`}>
                  {info?.isYang ? '━' : '╍'}
                </span>
              ) : (
                <span className="text-gray-600 text-xs">{i + 1}</span>
              )}
            </div>
            {/* 爻名 */}
            <span className={`text-[10px] sm:text-xs mt-1 ${isRevealed
                ? info?.isMoving ? 'text-red-400' : 'text-gray-300'
                : 'text-gray-600'
              }`}>
              {isRevealed ? info?.name : `第${i + 1}爻`}
            </span>
          </div>
        );
      })}
    </div>
  );
};

export default function CoinTossing({ result, aiConfig, onComplete }: CoinTossingProps) {
  const [currentLine, setCurrentLine] = useState(0);
  const [phase, setPhase] = useState<'idle' | 'tossing' | 'landed' | 'finished'>('idle');
  const [coinFaces, setCoinFaces] = useState<boolean[]>([true, true, true]);

  const TOSS_DURATION = 1800;
  const AUTO_TIMEOUT = aiConfig?.provider === 'local' ? 15000 : 4000;

  const getFaces = useCallback((value: number): boolean[] => {
    switch (value) {
      case 0: return [true, true, true];
      case 1: return [true, true, false].sort(() => Math.random() - 0.5);
      case 2: return [true, false, false].sort(() => Math.random() - 0.5);
      case 3: return [false, false, false];
      default: return [true, true, true];
    }
  }, []);

  const handleToss = useCallback(() => {
    if (phase !== 'idle') return;
    setPhase('tossing');

    const faces = getFaces(result.coins[currentLine]);

    setTimeout(() => {
      setCoinFaces(faces);
      setPhase('landed');

      setTimeout(() => {
        if (currentLine < 5) {
          setCurrentLine(prev => prev + 1);
          setPhase('idle');
        } else {
          setPhase('finished');
          setTimeout(onComplete, 1200);
        }
      }, 1500);
    }, TOSS_DURATION);
  }, [phase, currentLine, result.coins, getFaces, onComplete]);

  useEffect(() => {
    if (phase === 'idle') {
      const timer = setTimeout(handleToss, AUTO_TIMEOUT);
      return () => clearTimeout(timer);
    }
  }, [phase, handleToss, AUTO_TIMEOUT]);

  // 計算當前擲幣結果
  const currentInfo = phase === 'landed' ? YAO_INFO[result.coins[currentLine]] : null;
  const headCount = coinFaces.filter(f => f).length;

  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-b from-gray-900 via-black to-gray-900 flex flex-col">
      {/* CSS Animations */}
      <style dangerouslySetInnerHTML={{
        __html: `
        @keyframes toss {
          0% { transform: translateY(0) rotateX(0); }
          25% { transform: translateY(-80px) rotateX(720deg); }
          50% { transform: translateY(-50px) rotateX(1440deg); }
          75% { transform: translateY(-25px) rotateX(2160deg); }
          100% { transform: translateY(0) rotateX(2880deg); }
        }
        @keyframes progress {
          from { width: 0%; }
          to { width: 100%; }
        }
      `}} />

      {/* 主內容區 - 使用 flex 佈局確保一頁顯示 */}
      <div className="flex-1 flex flex-col items-center justify-between p-4 sm:p-6 max-w-lg mx-auto w-full min-h-0">

        {/* 頂部: Skip 按鈕 + 進度 */}
        <div className="w-full flex items-center justify-between shrink-0">
          <div className="text-gray-400 text-sm">
            第 <span className="text-[var(--gold)] font-bold text-lg">{currentLine + 1}</span> / 6 擲
          </div>
          <button
            onClick={onComplete}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--gold)]/50 text-[var(--gold)] hover:bg-[var(--gold)]/10 transition-all text-sm"
          >
            <SkipForward size={14} />
            <span className="hidden sm:inline">跳過動畫</span>
            <span className="sm:hidden">跳過</span>
          </button>
        </div>

        {/* 標題區 */}
        <div className="text-center shrink-0 py-2 sm:py-4">
          <h2 className="text-xl sm:text-2xl font-bold text-[var(--gold)] tracking-wider">
            心中默想 所問之事
          </h2>
          {phase === 'finished' && (
            <p className="text-gray-400 text-sm mt-2 animate-pulse">六爻已成，等待 AI 解卦...</p>
          )}
        </div>

        {/* 硬幣區 - 固定高度 */}
        <div className="h-24 sm:h-28 flex items-center justify-center gap-4 sm:gap-6 shrink-0">
          {phase !== 'finished' ? (
            <>
              <Coin index={0} isSpinning={phase === 'tossing'} isHead={coinFaces[0]} />
              <Coin index={1} isSpinning={phase === 'tossing'} isHead={coinFaces[1]} />
              <Coin index={2} isSpinning={phase === 'tossing'} isHead={coinFaces[2]} />
            </>
          ) : (
            <div className="text-center">
              <span className="text-4xl">☯</span>
            </div>
          )}
        </div>

        {/* 結果區 - 固定高度避免跳動 */}
        <div className="h-14 sm:h-16 flex items-center justify-center shrink-0">
          {phase === 'landed' && currentInfo ? (
            <div className="bg-gray-800/80 backdrop-blur rounded-xl px-4 sm:px-6 py-2 sm:py-3 border border-gray-700 animate-fadeIn">
              <span className="text-gray-400 text-sm">擲幣結果：</span>
              <span className="text-white mx-2">{headCount}陽 {3 - headCount}陰</span>
              <span className="text-[var(--gold)]">→</span>
              <span className={`ml-2 font-bold ${currentInfo.isMoving ? 'text-red-400' : 'text-[var(--gold)]'}`}>
                {currentInfo.name}
                {currentInfo.isMoving && <span className="text-xs ml-1">(動爻)</span>}
              </span>
            </div>
          ) : phase === 'tossing' ? (
            <span className="text-[var(--gold)] animate-pulse">擲幣中...</span>
          ) : phase === 'finished' ? (
            <span className="text-[var(--gold)]">擲幣完成</span>
          ) : (
            <span className="text-gray-600 text-sm">點擊下方按鈕擲幣</span>
          )}
        </div>

        {/* 六爻進度區 */}
        <div className="w-full shrink-0 py-2 sm:py-4">
          <HexagramProgress coins={result.coins} currentLine={currentLine} phase={phase} />
        </div>

        {/* 行動按鈕區 - 固定高度 */}
        <div className="w-full max-w-xs h-16 flex items-center justify-center shrink-0">
          {phase === 'idle' && (
            <button
              onClick={handleToss}
              className="w-full py-3 sm:py-4 bg-gradient-to-r from-[var(--gold)] to-[#b8962e] text-black font-bold text-lg rounded-xl hover:shadow-[0_0_25px_rgba(212,175,55,0.5)] transition-all relative overflow-hidden"
            >
              <span className="relative z-10">
                {currentLine === 0 ? '開始擲幣' : currentLine === 5 ? '最後一擲' : '繼續擲幣'}
              </span>
              {/* 自動擲幣進度條 */}
              <div
                className="absolute bottom-0 left-0 h-1 bg-black/30"
                style={{
                  animation: `progress ${AUTO_TIMEOUT}ms linear forwards`,
                }}
              />
            </button>
          )}
        </div>

        {/* 底部提示 */}
        <div className="text-center text-gray-500 text-xs shrink-0 pb-2">
          {phase === 'idle' && (
            <span>{Math.round(AUTO_TIMEOUT / 1000)} 秒後自動擲幣</span>
          )}
        </div>
      </div>
    </div>
  );
}
