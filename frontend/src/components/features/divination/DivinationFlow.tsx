'use client';

/**
 * DivinationFlow — 占卜統一流程骨架（Tickets 09-11）
 *
 * 受控元件：步驟狀態由頁面持有，本元件只負責
 * 步驟指示器（五點）＋步驟內容 slot 切換轉場。
 */

import { ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';

export type DivinationStep = 'intro' | 'input' | 'ritual' | 'reveal' | 'chat';

export type DivinationType = 'liuyao' | 'tarot' | 'ziwei';

const STEPS: DivinationStep[] = ['intro', 'input', 'ritual', 'reveal', 'chat'];

const STEP_LABELS: Record<DivinationType, Record<DivinationStep, string>> = {
  liuyao: { intro: '緣起', input: '問事', ritual: '擲幣', reveal: '揭卦', chat: '解卦對話' },
  tarot: { intro: '緣起', input: '問事', ritual: '洗牌', reveal: '揭牌', chat: '解牌對話' },
  ziwei: { intro: '緣起', input: '生辰', ritual: '排盤', reveal: '命盤', chat: '論命對話' },
};

export interface DivinationFlowProps {
  type: DivinationType;
  currentStep: DivinationStep;
  introSlot: ReactNode;
  inputSlot: ReactNode;
  ritualSlot: ReactNode;
  revealSlot: ReactNode;
  chatSlot: ReactNode;
}

export function DivinationFlow({
  type,
  currentStep,
  introSlot,
  inputSlot,
  ritualSlot,
  revealSlot,
  chatSlot,
}: DivinationFlowProps) {
  const reducedMotion = useReducedMotion();
  const currentIndex = STEPS.indexOf(currentStep);
  const labels = STEP_LABELS[type];

  const slots: Record<DivinationStep, ReactNode> = {
    intro: introSlot,
    input: inputSlot,
    ritual: ritualSlot,
    reveal: revealSlot,
    chat: chatSlot,
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* 步驟指示器 */}
      <nav aria-label="占卜流程" className="w-full max-w-3xl mx-auto px-4 pt-6">
        <ol className="flex items-center justify-center gap-1 sm:gap-2">
          {STEPS.map((step, index) => {
            const isDone = index < currentIndex;
            const isCurrent = index === currentIndex;
            return (
              <li key={step} className="flex items-center gap-1 sm:gap-2" aria-current={isCurrent ? 'step' : undefined}>
                <span
                  className={cn(
                    'flex items-center gap-1.5 rounded-full px-2 py-1 transition-colors',
                    isCurrent && 'bg-accent-light'
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      'w-2 h-2 rounded-full transition-colors',
                      isDone && 'bg-accent opacity-70',
                      isCurrent && 'bg-accent ring-2 ring-accent-light',
                      !isDone && !isCurrent && 'bg-border'
                    )}
                  />
                  <span
                    className={cn(
                      'text-xs hidden sm:inline transition-colors',
                      isCurrent ? 'text-accent font-medium' : isDone ? 'text-foreground-secondary' : 'text-foreground-muted'
                    )}
                  >
                    {labels[step]}
                  </span>
                </span>
                {index < STEPS.length - 1 && (
                  <span aria-hidden className={cn('w-4 sm:w-8 h-px', index < currentIndex ? 'bg-accent opacity-50' : 'bg-border')} />
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      {/* 步驟內容 */}
      <main className="flex-1 flex flex-col">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={currentStep}
            initial={reducedMotion ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reducedMotion ? undefined : { opacity: 0, y: -12 }}
            transition={{ duration: 0.28, ease: 'easeOut' }}
            className="flex-1 flex flex-col"
          >
            {slots[currentStep]}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
