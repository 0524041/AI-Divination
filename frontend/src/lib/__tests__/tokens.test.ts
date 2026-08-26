import { describe, expect, it } from 'vitest';
import { CONTEXT_TOKEN_BUDGET, estimateTokens } from '@/lib/tokens';

describe('estimateTokens（與後端共用語意）', () => {
  it('空字串為 0', () => {
    expect(estimateTokens('')).toBe(0);
  });

  it('ASCII 約 4 字元/token', () => {
    expect(estimateTokens('abcd')).toBe(1);
    expect(estimateTokens('abcde')).toBe(2);
  });

  it('CJK 約 1 字/token，中英混排分開計算', () => {
    expect(estimateTokens('占卜')).toBe(2);
    expect(estimateTokens('測試abc測試')).toBe(5);
    expect(estimateTokens('！？')).toBe(2); // 全形標點
  });

  it('預算上限為 48000', () => {
    expect(CONTEXT_TOKEN_BUDGET).toBe(48000);
  });
});
