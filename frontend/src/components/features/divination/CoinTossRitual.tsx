'use client';

/**
 * CoinTossRitual — 六爻銅錢擲幣儀式（Ticket 09）
 *
 * 六擲節奏（每擲 ~600ms），完成後回呼 onComplete。
 * coins 為後端回傳的六爻結果（0-3），決定每擲落地的爻象。
 * 可跳過；reduced-motion 直接完成。
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

const TOSS_MS = 600;
const TOTAL_TOSS = 6;
const ORDINALS = ['一', '二', '三', '四', '五', '六'];

/** 後端 yaogua 值語義：0=三字(老陽·動) 1=少陽 2=少陰 3=三背(老陰·動) */
const YAO_RESULTS: Record<number, { name: string; symbol: string; moving: boolean }> = {
  0: { name: '老陽', symbol: '⚊', moving: true },
  1: { name: '少陽', symbol: '⚊', moving: false },
  2: { name: '少陰', symbol: '⚋', moving: false },
  3: { name: '老陰', symbol: '⚋', moving: true },
};

interface CoinTossRitualProps {
  coins?: number[];
  onComplete: () => void;
}

export function CoinTossRitual({ coins, onComplete }: CoinTossRitualProps) {
  const reducedMotion = useReducedMotion();
  const [toss, setToss] = useState(0);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const finishedRef = useRef(false);

  const finish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    onCompleteRef.current();
  }, []);

  useEffect(() => {
    if (reducedMotion) {
      finish();
      return;
    }
    if (toss >= TOTAL_TOSS) {
      const t = setTimeout(finish, 450);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setToss((v) => v + 1), TOSS_MS);
    return () => clearTimeout(t);
  }, [toss, reducedMotion, finish]);

  const resultOf = (value?: number) => YAO_RESULTS[value ?? 1] ?? YAO_RESULTS[1];

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-8 px-4 py-12">
      {/* 銅錢 */}
      <div className="relative w-28 h-28 [perspective:800px]">
        <motion.div
          key={toss}
          initial={{ rotateY: 0 }}
          animate={reducedMotion ? undefined : { rotateY: 1080 }}
          transition={{ duration: 0.55, ease: 'easeOut' }}
          className="w-full h-full rounded-full border-4 border-[var(--gold)] bg-background-card shadow-[0_0_30px_rgba(212,175,55,0.25)] flex items-center justify-center"
        >
          <span aria-hidden className="text-5xl text-[var(--gold)] select-none">☯</span>
        </motion.div>
      </div>

      {/* 進度文字 */}
      <p className="font-heading text-xl text-accent tracking-widest" aria-live="polite">
        {toss < TOTAL_TOSS ? `六爻之${ORDINALS[toss]}` : '六爻俱備'}
      </p>

      {/* 六爻結果槽 */}
      <ol className="flex flex-wrap justify-center gap-2" aria-label="擲幣結果">
        {Array.from({ length: TOTAL_TOSS }, (_, i) => {
          const slot = `yao-${i}`;
          const landed = i < toss;
          const result = resultOf(coins?.[i]);
          return (
            <li
              key={slot}
              className={cn(
                'min-w-[72px] rounded-lg border px-2 py-2 text-center text-xs transition-colors',
                landed
                  ? result.moving
                    ? 'border-[color-mix(in_srgb,var(--cinnabar)_55%,transparent)] bg-[color-mix(in_srgb,var(--cinnabar)_10%,transparent)] text-[var(--cinnabar)]'
                    : 'border-border-accent bg-background-card text-foreground-primary'
                  : 'border-dashed border-border text-foreground-muted'
              )}
            >
              <span className="block opacity-70 mb-0.5">第 {i + 1} 爻</span>
              <span className="text-base leading-none">{landed ? result.symbol : '·'}</span>
              <span className="block mt-0.5">{landed ? `${result.name}${result.moving ? ' · 動' : ''}` : '待擲'}</span>
            </li>
          );
        })}
      </ol>

      <Button type="button" variant="ghost" size="sm" onClick={finish}>
        跳過動畫，直接揭卦
      </Button>
    </div>
  );
}
