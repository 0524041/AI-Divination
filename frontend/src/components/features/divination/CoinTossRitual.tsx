'use client';

/**
 * CoinTossRitual — 六爻銅錢擲幣儀式（chat-polish 重做）
 *
 * 依真實占卜儀式呈現：六擲（初爻→上爻），每擲三枚方孔銅錢旋轉落下、
 * 翻面定格顯示「字／背」→ 組合判定名稱浮出（如「三背 · 老陰 ⚋ 動」）
 * → 該爻加入側欄小卦象，逐爻由初爻往上堆疊。
 * 每擲約 2 秒、全程約 12 秒；「跳過」立即完成；
 * reduced-motion 不跑動畫幀，以快速文字序列完成。
 *
 * coins 為後端 yaogua 值（＝背面數）：
 * 0=三字(老陽·動) 1=二字一背(少陽) 2=一字二背(少陰) 3=三背(老陰·動)
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

/** 每擲兩階段時長（ms）：旋轉落下 → 定格判定 */
export const COIN_FALL_MS = 1150;
export const COIN_JUDGE_MS = 850;
/** reduced-motion 快速文字序列的每擲時長（ms） */
export const REDUCED_TOSS_MS = 160;

const TOTAL_TOSS = 6;
const ORDINALS = ['一', '二', '三', '四', '五', '六'];

interface ComboInfo {
  /** 組合描述（字背組合） */
  combo: string;
  name: string;
  symbol: string;
  moving: boolean;
}

/** 後端 yaogua 值語義（值＝背面數） */
const COMBOS: Record<number, ComboInfo> = {
  0: { combo: '三字', name: '老陽', symbol: '⚊', moving: true },
  1: { combo: '二字一背', name: '少陽', symbol: '⚊', moving: false },
  2: { combo: '一字二背', name: '少陰', symbol: '⚋', moving: false },
  3: { combo: '三背', name: '老陰', symbol: '⚋', moving: true },
};

const FALLBACK_BACKS = 1;

/** 三枚銅錢的穩定 key（避免以陣列索引為 key） */
const COIN_KEYS = ['coin-a', 'coin-b', 'coin-c'] as const;

/** 六爻堆疊槽位的穩定 key */
const STACK_KEYS = [
  'yao-1', 'yao-2', 'yao-3', 'yao-4', 'yao-5', 'yao-6',
] as const;

type Phase = 'falling' | 'judged';

interface CoinTossRitualProps {
  coins?: number[];
  onComplete: () => void;
}

/** 由 yaogua 值推導三枚銅錢的正反面（前 backs 枚為背，餘為字） */
function facesOf(backs: number): Array<'字' | '背'> {
  const safe = Math.min(Math.max(backs, 0), 3);
  return Array.from({ length: 3 }, (_, i) => (i < safe ? '背' : '字'));
}

/** CSS 繪製的方孔銅錢（金銅色 token，不引入圖檔） */
function BronzeCoin({ face }: { face: '字' | '背' }) {
  return (
    <div
      aria-hidden
      className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-full border-[3px] border-[var(--gold)] shadow-[0_0_18px_rgba(212,175,55,0.25)] flex items-center justify-center"
      style={{
        background:
          'radial-gradient(circle at 35% 30%, color-mix(in srgb, var(--gold) 55%, white), var(--gold) 60%, var(--gold-dark))',
      }}
    >
      {/* 方孔 */}
      <div className="w-3.5 h-3.5 border border-[var(--gold-dark)] bg-background-primary" />
      {face === '字' ? (
        <>
          <span className="absolute top-0.5 text-[10px] leading-none font-semibold text-[color-mix(in_srgb,var(--gold-dark)_80%,black)]">乾</span>
          <span className="absolute bottom-0.5 text-[10px] leading-none font-semibold text-[color-mix(in_srgb,var(--gold-dark)_80%,black)]">隆</span>
          <span className="absolute left-0.5 text-[10px] leading-none font-semibold text-[color-mix(in_srgb,var(--gold-dark)_80%,black)]">通</span>
          <span className="absolute right-0.5 text-[10px] leading-none font-semibold text-[color-mix(in_srgb,var(--gold-dark)_80%,black)]">寶</span>
        </>
      ) : (
        <>
          <span className="absolute top-1 left-2 w-1 h-1 rounded-full bg-[var(--gold-dark)] opacity-50" />
          <span className="absolute bottom-1 right-2 w-1 h-1 rounded-full bg-[var(--gold-dark)] opacity-50" />
        </>
      )}
    </div>
  );
}

export function CoinTossRitual({ coins, onComplete }: CoinTossRitualProps) {
  const reducedMotion = useReducedMotion();
  const [toss, setToss] = useState(0);
  const [phase, setPhase] = useState<Phase>('falling');
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const finishedRef = useRef(false);

  const finish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    onCompleteRef.current();
  }, []);

  useEffect(() => {
    if (toss >= TOTAL_TOSS) {
      const t = setTimeout(finish, reducedMotion ? 100 : 700);
      return () => clearTimeout(t);
    }
    if (!reducedMotion && phase === 'falling') {
      const t = setTimeout(() => setPhase('judged'), COIN_FALL_MS);
      return () => clearTimeout(t);
    }
    // judged（或 reduced-motion 的單步）停留後進入下一擲
    const stepMs = reducedMotion ? REDUCED_TOSS_MS : COIN_JUDGE_MS;
    const t = setTimeout(() => {
      setToss((v) => v + 1);
      setPhase('falling');
    }, stepMs);
    return () => clearTimeout(t);
  }, [toss, phase, reducedMotion, finish]);

  const backsOf = (index: number) =>
    Math.min(Math.max(coins?.[index] ?? FALLBACK_BACKS, 0), 3);

  const landedCount = toss;
  const inProgress = toss < TOTAL_TOSS;
  const currentBacks = inProgress ? backsOf(toss) : null;
  const currentFaces = currentBacks === null ? null : facesOf(currentBacks);
  const currentCombo = currentBacks === null ? null : COMBOS[currentBacks];
  const judgedNow = !reducedMotion && phase === 'judged' && inProgress;

  return (
    <div className="flex-1 flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-14 px-4 py-12">
      {/* 主舞台：三枚銅錢＋進度＋組合判定 */}
      <div className="flex flex-col items-center gap-7 min-w-[260px]">
        <div className="[perspective:800px] flex items-end gap-4">
          {COIN_KEYS.map((key) => {
            const face = (currentFaces ?? facesOf(FALLBACK_BACKS))[COIN_KEYS.indexOf(key)];
            return (
              <motion.div
                key={key}
                initial={false}
                animate={
                  reducedMotion || judgedNow || !inProgress
                    ? undefined
                    : { rotateY: [0, 360, 720, 1080], y: [-46, -12, -26, 0] }
                }
                transition={{ duration: COIN_FALL_MS / 1000, ease: 'easeOut', times: [0, 0.35, 0.7, 1] }}
              >
                {inProgress ? (
                  <BronzeCoin face={face} />
                ) : (
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full border-2 border-dashed border-border" />
                )}
              </motion.div>
            );
          })}
        </div>

        <p className="font-heading text-xl text-accent tracking-widest" aria-live="polite">
          {inProgress ? `六爻之${ORDINALS[toss]}　第 ${toss + 1} 擲` : '六爻俱備'}
        </p>

        {/* 組合判定：翻面定格後浮出 */}
        {currentCombo && inProgress ? (
          <p
            key={`combo-${toss}`}
            aria-live="polite"
            className={cn(
              'flex items-center gap-2 text-lg',
              currentCombo.moving ? 'text-[var(--cinnabar)]' : 'text-foreground-primary'
            )}
          >
            <span className="tracking-wide">{currentCombo.combo}</span>
            <span className="opacity-40">·</span>
            <span className="font-medium">{currentCombo.name}</span>
            <span aria-hidden>{currentCombo.symbol}</span>
            {currentCombo.moving && (
              <span className="rounded-full border border-[var(--cinnabar)] px-1.5 py-0.5 text-xs">動</span>
            )}
          </p>
        ) : (
          <p className="text-lg text-foreground-muted select-none">&nbsp;</p>
        )}

        <Button type="button" variant="ghost" size="sm" onClick={finish}>
          跳過動畫，直接揭卦
        </Button>
      </div>

      {/* 側欄：小卦象堆疊（初爻在下，逐爻向上生長） */}
      <ol
        className="flex flex-row lg:flex-col-reverse gap-1.5 lg:min-h-[300px]"
        aria-label="卦象堆疊"
      >
        {STACK_KEYS.map((key, i) => {
          // 視覺順序：上爻在上、初爻在下（lg 直欄用 col-reverse，行動端橫列直接正序）
          const landed = i < landedCount;
          const combo = COMBOS[backsOf(i)];
          return (
            <li key={key}>
              <div
                className={cn(
                  'min-w-[64px] rounded-lg border px-2 py-1.5 text-center text-xs transition-colors',
                  landed
                    ? combo.moving
                      ? 'border-[color-mix(in_srgb,var(--cinnabar)_55%,transparent)] bg-[color-mix(in_srgb,var(--cinnabar)_10%,transparent)] text-[var(--cinnabar)]'
                      : 'border-border-accent bg-background-card text-foreground-primary'
                    : 'border-dashed border-border text-foreground-muted'
                )}
              >
                <span aria-hidden className="block text-base leading-none">
                  {landed ? combo.symbol : '·'}
                </span>
                <span className="block mt-0.5">
                  {landed ? `${combo.name}${combo.moving ? ' · 動' : ''}` : `第 ${i + 1} 爻`}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
