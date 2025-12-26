'use client';

import { useEffect, useState } from 'react';
import { parseCoinResult, getYaoName, getCoinDisplayClass } from '@/lib/divination';
import { Card, CardContent } from '@/components/ui/card';

interface CoinTossingProps {
  coins: number[];
  onComplete: () => void;
}

export function CoinTossing({ coins, onComplete }: CoinTossingProps) {
  const [visibleCoins, setVisibleCoins] = useState<number[]>([]);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    // 逐個顯示硬幣結果
    let currentIndex = 0;
    const interval = setInterval(() => {
      if (currentIndex < coins.length) {
        setVisibleCoins((prev) => [...prev, coins[currentIndex]]);
        currentIndex++;
      } else {
        clearInterval(interval);
        setIsComplete(true);
        setTimeout(onComplete, 1500);
      }
    }, 600);

    return () => clearInterval(interval);
  }, [coins, onComplete]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90">
      <Card className="glass-panel w-full max-w-md mx-4">
        <CardContent className="p-8 text-center">
          <h2 className="text-2xl font-bold text-[var(--gold)] mb-6 flex items-center justify-center gap-2">
            <span className="animate-spin" style={{ animationDuration: '1s' }}>
              ☯
            </span>
            誠心搖卦中...
          </h2>

          <div className="flex flex-col-reverse gap-3 my-8">
            {visibleCoins.map((coin, index) => {
              const result = parseCoinResult(coin);
              return (
                <div
                  key={index}
                  className="flex items-center gap-4 animate-in slide-in-from-bottom duration-300"
                >
                  <span className="text-sm text-muted-foreground w-12">
                    {getYaoName(index)}
                  </span>
                  <div
                    className={`flex-1 py-3 px-4 rounded-lg font-semibold ${getCoinDisplayClass(coin)} coin-flip`}
                  >
                    <span className="mr-2">{result.symbol}</span>
                    <span className="text-sm opacity-80">{result.label}</span>
                  </div>
                  {result.isMoving && (
                    <span className="text-xs text-[var(--gold)]">動爻</span>
                  )}
                </div>
              );
            })}
          </div>

          {isComplete && (
            <p className="text-muted-foreground animate-pulse">
              卦象已定，正在解盤...
            </p>
          )}

          {!isComplete && (
            <div className="flex justify-center gap-2">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-8 h-8 rounded-full bg-[var(--gold)] animate-bounce"
                  style={{ animationDelay: `${i * 0.1}s` }}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
