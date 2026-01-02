import React, { useState, useEffect, useRef } from 'react';
import { Loader2, X } from 'lucide-react';

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

export default function CoinTossing({ result, aiConfig, onComplete }: CoinTossingProps) {
  const [currentLine, setCurrentLine] = useState(0); // 0-5
  const [phase, setPhase] = useState<'idle' | 'tossing' | 'landed' | 'finished'>('idle');
  const [coinFaces, setCoinFaces] = useState<boolean[]>([true, true, true]); // true=Head, false=Tail
  const [showLineAnimation, setShowLineAnimation] = useState(false);

  // Constants
  const TOSS_DURATION = 2000; // Animation duration in ms
  const AUTO_TIMEOUT = aiConfig?.provider === 'local' ? 20000 : 5000;

  // Determine coin faces based on result
  // 0: Old Yang (3 Heads)
  // 1: Young Yang (1 Head, 2 Tails)
  // 2: Young Yin (2 Heads, 1 Tail)
  // 3: Old Yin (3 Tails)
  const getFaces = (value: number) => {
    switch (value) {
      case 0: return [true, true, true];
      case 1: return [true, false, false].sort(() => Math.random() - 0.5);
      case 2: return [true, true, false].sort(() => Math.random() - 0.5);
      case 3: return [false, false, false];
      default: return [true, true, true];
    }
  };

  const handleToss = () => {
    if (phase !== 'idle') return;
    
    setPhase('tossing');
    
    // Prepare result for this line
    const faces = getFaces(result.coins[currentLine]);
    
    // Wait for animation
    setTimeout(() => {
      setCoinFaces(faces);
      setPhase('landed');
      setShowLineAnimation(true);
      
      // Auto advance to next idle state or finish
      setTimeout(() => {
        setShowLineAnimation(false);
        if (currentLine < 5) {
          setCurrentLine(prev => prev + 1);
          setPhase('idle');
        } else {
          setPhase('finished');
          setTimeout(onComplete, 1000); // Short delay before closing
        }
      }, 1500); // Time to view the result line before next toss button appears
      
    }, TOSS_DURATION);
  };

  // Auto toss timer
  useEffect(() => {
    if (phase === 'idle') {
      const timer = setTimeout(() => {
        handleToss();
      }, AUTO_TIMEOUT);
      return () => clearTimeout(timer);
    }
  }, [phase, currentLine]);

  // Coin Component
  const Coin = ({ index, isSpinning, isHead }: { index: number, isSpinning: boolean, isHead: boolean }) => (
    <div className={`relative w-24 h-24 transition-all duration-1000 ${isSpinning ? 'animate-toss' : ''}`} style={{ animationDelay: `${index * 100}ms` }}>
      <div className={`w-full h-full rounded-full border-4 border-[#d4af37] bg-[#f4e4bc] shadow-lg flex items-center justify-center relative transform-style-3d transition-transform duration-500 ${!isSpinning && !isHead ? 'rotate-y-180' : ''}`}>
        {/* Front (Head) - Yang */}
        <div className={`absolute inset-0 backface-hidden flex items-center justify-center ${!isSpinning && !isHead ? 'opacity-0' : 'opacity-100'}`}>
          <div className="w-12 h-12 border-2 border-[#d4af37] flex items-center justify-center">
            <span className="text-[#d4af37] font-bold text-2xl">陽</span>
          </div>
          <div className="absolute top-1 left-1/2 -translate-x-1/2 text-[#8a7018] text-xs font-bold">乾隆</div>
          <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[#8a7018] text-xs font-bold">通寶</div>
        </div>
        
        {/* Back (Tail) - Yin */}
        <div className={`absolute inset-0 backface-hidden rotate-y-180 flex items-center justify-center bg-[#e6d5a8] ${!isSpinning && isHead ? 'opacity-0' : 'opacity-100'}`}>
           <div className="w-12 h-12 border-2 border-[#8a7018] flex items-center justify-center">
            <span className="text-[#8a7018] font-bold text-2xl">陰</span>
          </div>
        </div>
      </div>
    </div>
  );

  // Line Component
  const HexagramLine = ({ value, isNew }: { value: number, isNew: boolean }) => {
    // 0: Old Yang (Circle) - Moving
    // 1: Young Yang (Solid) - Static
    // 2: Young Yin (Broken) - Static
    // 3: Old Yin (Cross) - Moving
    
    const isYang = value === 0 || value === 1;
    const isMoving = value === 0 || value === 3;
    
    return (
      <div className={`h-12 w-64 flex items-center justify-between bg-gray-800/50 rounded px-4 mb-2 transition-all duration-500 ${isNew ? 'animate-in fade-in slide-in-from-top-4 bg-[var(--gold)]/20' : ''}`}>
        <div className="flex-1 flex justify-center gap-4">
          {isYang ? (
             <div className="w-full h-4 bg-[var(--gold)] rounded-full shadow-[0_0_10px_rgba(212,175,55,0.5)]"></div>
          ) : (
             <>
               <div className="w-[45%] h-4 bg-[var(--gold)] rounded-full"></div>
               <div className="w-[45%] h-4 bg-[var(--gold)] rounded-full"></div>
             </>
          )}
        </div>
        <div className="w-8 flex justify-end">
          {isMoving && (
            <span className="text-xs text-[var(--gold)] animate-pulse">
              {value === 0 ? '○' : '✕'}
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-4">
      <style jsx>{`
        .rotate-y-180 { transform: rotateY(180deg); }
        .backface-hidden { backface-visibility: hidden; }
        .transform-style-3d { transform-style: preserve-3d; }
        @keyframes toss {
          0% { transform: translateY(0) rotateX(0); }
          25% { transform: translateY(-150px) rotateX(720deg); }
          50% { transform: translateY(-100px) rotateX(1440deg); }
          75% { transform: translateY(-50px) rotateX(2160deg); }
          100% { transform: translateY(0) rotateX(2880deg); }
        }
        .animate-toss { animation: toss 1.5s ease-out forwards; }
      `}</style>

      <div className="w-full max-w-2xl flex flex-col items-center gap-8">
        {/* Header */}
        <div className="text-center space-y-2 animate-in fade-in duration-1000">
          <h2 className="text-3xl font-bold text-[var(--gold)] tracking-widest">心中默想 所問之事</h2>
          <p className="text-gray-400 text-lg">心誠則靈 第 {currentLine + 1} 擲</p>
        </div>

        {/* Coins Area */}
        <div className="h-48 flex items-center justify-center gap-8 perspective-1000">
          {phase !== 'finished' && (
            <>
              <Coin index={0} isSpinning={phase === 'tossing'} isHead={coinFaces[0]} />
              <Coin index={1} isSpinning={phase === 'tossing'} isHead={coinFaces[1]} />
              <Coin index={2} isSpinning={phase === 'tossing'} isHead={coinFaces[2]} />
            </>
          )}
        </div>

        {/* Hexagram Stack (Building up) */}
        <div className="w-full max-w-md bg-gray-900/50 p-6 rounded-xl border border-gray-800 min-h-[300px] flex flex-col-reverse justify-start">
           {/* Placeholders for future lines */}
           {Array.from({ length: 6 }).map((_, i) => {
             if (i > currentLine || (i === currentLine && phase !== 'landed' && phase !== 'finished')) {
               return <div key={`placeholder-${i}`} className="h-12 w-full border border-gray-800 border-dashed rounded mb-2 opacity-20"></div>;
             }
             return null;
           })}
           
           {/* Revealed Lines */}
           {result.coins.map((val, i) => {
             if (i < currentLine || (i === currentLine && (phase === 'landed' || phase === 'finished'))) {
               return <HexagramLine key={i} value={val} isNew={i === currentLine && phase === 'landed'} />;
             }
             return null;
           })}
        </div>

        {/* Action Button */}
        <div className="w-full max-w-xs relative">
          {phase === 'idle' && (
            <button
              onClick={handleToss}
              className="w-full py-4 bg-[var(--gold)] text-black font-bold text-xl rounded-xl hover:bg-amber-400 transition relative overflow-hidden group shadow-[0_0_20px_rgba(212,175,55,0.3)]"
            >
              <span className="relative z-10">
                {currentLine === 0 ? '開始擲幣' : currentLine === 5 ? '最後一擲' : '再擲一次'}
              </span>
              <div 
                className="absolute bottom-0 left-0 h-1 bg-black/30 transition-all ease-linear"
                style={{
                  width: '0%',
                  animationName: 'progress',
                  animationDuration: `${AUTO_TIMEOUT}ms`,
                  animationTimingFunction: 'linear',
                  animationFillMode: 'forwards'
                }}
              />
              <style jsx>{`
                @keyframes progress {
                  from { width: 0%; }
                  to { width: 100%; }
                }
              `}</style>
            </button>
          )}
          
          {phase === 'tossing' && (
            <div className="text-center text-[var(--gold)] animate-pulse">
              擲幣中...
            </div>
          )}
          
          {phase === 'landed' && (
            <div className="text-center text-gray-400">
              紀錄中...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
