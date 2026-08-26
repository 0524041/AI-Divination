/**
 * 上下文 token 估算（chat-polish spec：字元粗估，與後端共用同一語意）
 *
 * 規則：CJK 字元 ≈ 1 字/token；其他（ASCII 等）≈ 4 字元/token。
 * 不做精確 tokenizer——僅供 48k 整體預算的 UI 顯示。
 */

export const CONTEXT_TOKEN_BUDGET = 48000;

const CJK_RANGES: Array<[number, number]> = [
  [0x2e80, 0x9fff], // CJK 部首、音標、統一表意文字
  [0xf900, 0xfaff], // CJK 相容表意文字
  [0xff00, 0xffef], // 全形標點與字母
];

function isCjk(codePoint: number): boolean {
  return CJK_RANGES.some(([lo, hi]) => lo <= codePoint && codePoint <= hi);
}

export function estimateTokens(text: string): number {
  if (!text) return 0;
  let cjk = 0;
  let other = 0;
  for (const ch of text) {
    if (isCjk(ch.codePointAt(0) ?? 0)) cjk += 1;
    else other += 1;
  }
  return cjk + Math.ceil(other / 4);
}
