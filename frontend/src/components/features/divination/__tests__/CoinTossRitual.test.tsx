import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';

/** 可控的 useReducedMotion（framer-motion 會快取 media query，直接 mock hook） */
let mockReducedMotion = false;

vi.mock('framer-motion', async (importOriginal) => {
  const mod = await importOriginal<typeof import('framer-motion')>();
  return {
    ...mod,
    useReducedMotion: () => mockReducedMotion,
  };
});

import {
  CoinTossRitual,
  COIN_FALL_MS,
  COIN_JUDGE_MS,
  REDUCED_TOSS_MS,
} from '@/components/features/divination/CoinTossRitual';

const CYCLE_MS = COIN_FALL_MS + COIN_JUDGE_MS;
/** 六擲＋收尾 */
const TOTAL_STEPS = 7;

/**
 * 小步推進時鐘：act() 結束時才會 flush effects（排程下一階段 timer），
 * 大步一次推完會讓狀態機斷鏈。
 */
function stepThrough(totalMs: number, step = 100) {
  let remaining = totalMs;
  while (remaining > 0) {
    const chunk = Math.min(step, remaining);
    act(() => {
      vi.advanceTimersByTime(chunk);
    });
    remaining -= chunk;
  }
}

beforeEach(() => {
  mockReducedMotion = false;
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('CoinTossRitual（chat-polish 重做）', () => {
  it('六擲完成後六爻名稱序列正確，並呼叫 onComplete', () => {
    const onComplete = vi.fn();
    // 後端語義：值＝背面數。0=三字老陽、1=二字一背少陽、2=一字二背少陰、3=三背老陰
    render(<CoinTossRitual coins={[0, 1, 2, 3, 1, 0]} onComplete={onComplete} />);

    // 第一擲：落下階段；翻面定格後組合浮出
    expect(screen.getByText(/第 1 擲/)).toBeTruthy();
    stepThrough(COIN_FALL_MS);
    expect(screen.getByText('三字')).toBeTruthy();
    expect(screen.getByText('老陽')).toBeTruthy();

    // 走完全部六擲與收尾
    stepThrough(CYCLE_MS * 6 + 1500);
    expect(onComplete).toHaveBeenCalledTimes(1);

    // 堆疊欄含全部四種組合名稱與兩個動爻
    const stack = screen.getByLabelText('卦象堆疊');
    const text = stack.textContent ?? '';
    expect(text).toContain('老陽');
    expect(text).toContain('少陽');
    expect(text).toContain('少陰');
    expect(text).toContain('老陰');
    expect((text.match(/動/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it('每擲節奏約 2 秒、全程不少於 12 秒', () => {
    const onComplete = vi.fn();
    render(<CoinTossRitual coins={[1, 1, 1, 1, 1, 1]} onComplete={onComplete} />);

    stepThrough(CYCLE_MS * 5 - 500);
    expect(onComplete).not.toHaveBeenCalled(); // 五擲未完

    stepThrough(CYCLE_MS * 2 + 1500);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(CYCLE_MS * 6).toBeGreaterThanOrEqual(12000);
  });

  it('skip 立即呼叫 onComplete', () => {
    const onComplete = vi.fn();
    render(<CoinTossRitual coins={[0, 0, 0, 0, 0, 0]} onComplete={onComplete} />);

    fireEvent.click(screen.getByRole('button', { name: /跳過動畫/ }));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('reduced-motion 不跑動畫幀，快速文字序列即完成', () => {
    mockReducedMotion = true;
    const onComplete = vi.fn();
    render(<CoinTossRitual coins={[0, 1, 2, 3, 1, 0]} onComplete={onComplete} />);

    stepThrough(REDUCED_TOSS_MS * TOTAL_STEPS + 300, 80);
    expect(onComplete).toHaveBeenCalledTimes(1);
    // 快速序列總時長遠小於完整動畫
    expect(REDUCED_TOSS_MS * TOTAL_STEPS).toBeLessThan(3000);
  });
});
