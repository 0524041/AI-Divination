'use client';

/**
 * ZiweiRevealRitual — 紫微星盤漸亮点燈儀式（Ticket 11）
 *
 * 十二宮格依序亮起（~2.5s），完成後回呼 onComplete。
 * 可跳過；reduced-motion 直接完成。
 */

import { useCallback, useEffect, useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Button } from '@/components/ui/Button';

const TOTAL_MS = 2600;
const STAGGER_MS = 0.16;

/** 與 ZiweiChart 相同的十二宮方位 */
const BRANCHES = ['巳', '午', '未', '申', '酉', '戌', '亥', '子', '丑', '寅', '卯', '辰'];

const GRID_POSITIONS: Record<string, { row: number; col: number }> = {
  巳: { row: 0, col: 0 },
  午: { row: 0, col: 1 },
  未: { row: 0, col: 2 },
  申: { row: 0, col: 3 },
  酉: { row: 1, col: 3 },
  戌: { row: 2, col: 3 },
  亥: { row: 3, col: 3 },
  子: { row: 3, col: 2 },
  丑: { row: 3, col: 1 },
  寅: { row: 3, col: 0 },
  卯: { row: 2, col: 0 },
  辰: { row: 1, col: 0 },
};

interface ZiweiRevealRitualProps {
  onComplete: () => void;
}

export function ZiweiRevealRitual({ onComplete }: ZiweiRevealRitualProps) {
  const reducedMotion = useReducedMotion();
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
    const t = setTimeout(finish, TOTAL_MS);
    return () => clearTimeout(t);
  }, [reducedMotion, finish]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-8 px-4 py-12">
      <div
        role="img"
        aria-label="紫微斗數十二宮次第亮起"
        className="relative w-full max-w-md aspect-square grid grid-cols-4 grid-rows-4 gap-[3px] p-[3px] rounded-xl border border-border-accent bg-background-card"
      >
        {/* 中央資訊塊 */}
        <motion.div
          initial={{ opacity: reducedMotion ? 1 : 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="col-start-2 row-start-2 col-span-2 row-span-2 z-10 flex flex-col items-center justify-center gap-2 bg-background-secondary/95 border border-border"
        >
          <span aria-hidden className="text-3xl text-accent select-none">✦</span>
          <span className="font-heading text-lg text-accent tracking-[0.3em]">紫微斗數</span>
        </motion.div>

        {BRANCHES.map((branch, index) => {
          const pos = GRID_POSITIONS[branch];
          return (
            <motion.div
              key={`palace-${branch}`}
              initial={reducedMotion ? false : { opacity: 0.08, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={reducedMotion ? undefined : { duration: 0.4, delay: STAGGER_MS * index, ease: 'easeOut' }}
              style={{ gridRow: pos.row + 1, gridColumn: pos.col + 1 }}
              className="flex flex-col items-center justify-center gap-1 rounded-md border border-border-accent bg-accent-light"
            >
              <span aria-hidden className="text-accent text-sm select-none">✧</span>
              <span className="text-xs text-foreground-secondary font-heading">{branch}</span>
            </motion.div>
          );
        })}
      </div>

      <p className="font-heading text-lg text-accent tracking-widest animate-pulse" aria-live="polite">
        星曜漸明，命盤浮現…
      </p>

      <Button type="button" variant="ghost" size="sm" onClick={finish}>
        跳過動畫，直接查看命盤
      </Button>
    </div>
  );
}
