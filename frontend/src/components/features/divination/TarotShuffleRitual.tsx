'use client';

/**
 * TarotShuffleRitual — 塔羅洗牌＋逐張翻牌儀式（Ticket 10）
 *
 * 牌面由後端決定（cards prop），本元件只負責節奏呈現：
 * 扇形洗牌 ~2.5s → 逐張翻牌揭示（name_cn ＋ 正/逆位）。
 * 可跳過；reduced-motion 直接完成。
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { DivinedTarotCard, TarotCardFace } from './TarotCardFace';

const SHUFFLE_MS = 2500;
const REVEAL_STEP_MS = 700;
const FAN_COUNT = 7;

interface TarotShuffleRitualProps {
  cards: DivinedTarotCard[];
  onComplete: () => void;
}

/** 牌背 */
function CardBack({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        'aspect-[2/3] rounded-xl border-2 border-[var(--gold)] bg-background-secondary relative overflow-hidden',
        className
      )}
    >
      <div className="absolute inset-0 opacity-25 bg-[radial-gradient(circle_at_center,_var(--gold)_1px,_transparent_1px)] bg-[length:12px_12px]" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-12 h-12 border border-[var(--gold)] rounded-full flex items-center justify-center">
          <div className="w-7 h-7 border border-[var(--gold)] rotate-45 flex items-center justify-center">
            <div className="w-3 h-3 bg-[var(--gold)] opacity-30 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function TarotShuffleRitual({ cards, onComplete }: TarotShuffleRitualProps) {
  const reducedMotion = useReducedMotion();
  const [stage, setStage] = useState<'shuffle' | 'reveal'>('shuffle');
  const [revealed, setRevealed] = useState(0);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const finishedRef = useRef(false);

  const finish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    onCompleteRef.current();
  }, []);

  useEffect(() => {
    if (reducedMotion || cards.length === 0) {
      finish();
      return;
    }
    if (stage === 'shuffle') {
      const t = setTimeout(() => setStage('reveal'), SHUFFLE_MS);
      return () => clearTimeout(t);
    }
    if (revealed >= cards.length) {
      const t = setTimeout(finish, 450);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setRevealed((v) => v + 1), REVEAL_STEP_MS);
    return () => clearTimeout(t);
  }, [stage, revealed, reducedMotion, cards.length, finish]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-8 px-4 py-12 overflow-x-hidden">
      {stage === 'shuffle' ? (
        <>
          <div className="relative w-56 h-80 flex items-center justify-center">
            {Array.from({ length: FAN_COUNT }, (_, i) => {
              const fan = `fan-${i}`;
              return (
                <motion.div
                  key={fan}
                  className="absolute w-32"
                  style={{ rotate: (i - (FAN_COUNT - 1) / 2) * 6 }}
                  animate={reducedMotion ? undefined : { x: [-28, 28, -18, 18, 0], y: [4, -4, 2, -2, 0] }}
                  transition={{ duration: 0.62, repeat: 3, ease: 'easeInOut', delay: i * 0.04 }}
                >
                  <CardBack className="w-full shadow-md" />
                </motion.div>
              );
            })}
          </div>
          <p className="font-heading text-xl text-accent tracking-widest animate-pulse">洗牌中，請靜心默念問題…</p>
        </>
      ) : (
        <>
          <p className="font-heading text-lg text-accent tracking-widest" aria-live="polite">
            揭示命運之牌 {revealed} / {cards.length}
          </p>
          <div
            className={cn(
              'flex flex-wrap justify-center items-start gap-5 md:gap-8',
              cards.length > 5 && 'max-w-4xl'
            )}
          >
            {cards.map((card, index) => {
              const slot = `drawn-slot-${card.id}`;
              const isRevealed = index < revealed;
              return (
                <motion.div
                  key={slot}
                  initial={false}
                  animate={isRevealed ? { opacity: 1, scale: 1 } : { opacity: 0.35, scale: 0.94 }}
                  transition={{ duration: 0.4 }}
                >
                  {isRevealed ? (
                    <TarotCardFace card={card} size="sm" />
                  ) : (
                    <CardBack className="w-20 md:w-24" />
                  )}
                </motion.div>
              );
            })}
          </div>
        </>
      )}

      <Button type="button" variant="ghost" size="sm" onClick={finish}>
        跳過動畫，直接揭牌
      </Button>
    </div>
  );
}
