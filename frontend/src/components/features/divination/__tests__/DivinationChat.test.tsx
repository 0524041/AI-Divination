import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

vi.mock('@/lib/api-client', () => ({
  apiGet: vi.fn().mockResolvedValue({ ok: false }),
}));

import { DivinationChat } from '@/components/features/divination/DivinationChat';

describe('DivinationChat 版面（chat-polish）', () => {
  it('串流視圖容器放寬至 max-w-4xl、氣泡 85%', async () => {
    // fetch 永不 resolve → 停在首解串流視圖
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})));

    render(<DivinationChat recordId={9} question="測試問題" />);

    await waitFor(() => expect(screen.getByTestId('divination-chat')).toBeTruthy());
    const container = screen.getByTestId('divination-chat');
    expect(container.className).toContain('max-w-4xl');
    expect(container.className).not.toContain('max-w-3xl');
  });
});
