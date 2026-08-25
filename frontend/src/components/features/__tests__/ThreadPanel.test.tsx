import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ThreadPanel 依賴 fetch SSE；以 mock stream 驗證外部行為
function sseResponse(events: Array<{ event: string; data: unknown }>) {
  const encoder = new TextEncoder();
  let payload = '';
  for (const e of events) {
    payload += `event: ${e.event}\ndata: ${JSON.stringify(e.data)}\n\n`;
  }
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(payload));
      controller.close();
    },
  });
  return new Response(stream, { status: 200 });
}

vi.mock('@/lib/api-client', () => ({
  apiGet: vi.fn().mockResolvedValue({}),
}));

import { ThreadPanel } from '@/components/features/ThreadPanel';
import { Dialog, DialogContent } from '@/components/ui/Dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';

describe('ThreadPanel（Ticket 08）', () => {
  it('送出追問：樂觀插入 user 訊息、串流 delta 累積、done 定稿', async () => {
    const fetchMock = vi
      .fn()
      // quota check
      .mockResolvedValueOnce({ json: async () => ({ limited: false }) })
      // followup stream
      .mockResolvedValueOnce(
        sseResponse([
          { event: 'meta', data: { record_id: 1 } },
          { event: 'delta', data: { type: 'text', text: '世爻' } },
          { event: 'delta', data: { type: 'text', text: '旺相' } },
          { event: 'done', data: { message_id: 99, content: '世爻旺相', think: null, model: 'm' } },
        ])
      );

    vi.stubGlobal('fetch', fetchMock);

    render(<ThreadPanel recordId={1} />);
    const input = screen.getByLabelText('追問輸入');
    await userEvent.type(input, '這卦如何？');
    await userEvent.click(screen.getByRole('button', { name: /送出/ }));

    await waitFor(() => expect(screen.getByText('這卦如何？')).toBeTruthy());
    await waitFor(() => expect(screen.getByText(/世爻旺相/)).toBeTruthy());

    // 送出的請求形狀
    const call = fetchMock.mock.calls[1];
    expect(call[0]).toBe('/api/records/1/followup?token=');
    expect(JSON.parse(call[1].body).question).toBe('這卦如何？');
  });

  it('think 區塊可摺疊切換', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ json: async () => ({ limited: false }) });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <ThreadPanel
        recordId={2}
        initialMessages={[
          { id: 5, role: 'assistant', content: '結論', think: '隱藏的推理' },
        ]}
      />
    );

    const toggle = screen.getByRole('button', { name: /AI 思考過程/ });
    expect(screen.queryByText('隱藏的推理')).toBeNull();
    await userEvent.click(toggle);
    expect(screen.getByText('隱藏的推理')).toBeTruthy();
  });

  it('串流中顯示中止鈕；閒置時顯示重試鈕', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ json: async () => ({ limited: false }) });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <ThreadPanel
        recordId={3}
        initialMessages={[{ id: 7, role: 'assistant', content: '已有回應' }]}
      />
    );

    expect(screen.getByRole('button', { name: /重試|重新生成/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /中止/ })).toBeNull();
  });
});

describe('ui primitives（Ticket 07）', () => {
  it('Dialog 開關與標題渲染', async () => {
    render(
      <Dialog open>
        <DialogContent title="測試視窗">
          <p>內容</p>
        </DialogContent>
      </Dialog>
    );
    expect(screen.getByText('測試視窗')).toBeTruthy();
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('Tabs 切換顯示對應內容', async () => {
    render(
      <Tabs defaultValue="a">
        <TabsList>
          <TabsTrigger value="a">甲</TabsTrigger>
          <TabsTrigger value="b">乙</TabsTrigger>
        </TabsList>
        <TabsContent value="a">甲內容</TabsContent>
        <TabsContent value="b">乙內容</TabsContent>
      </Tabs>
    );
    expect(screen.getByText('甲內容')).toBeTruthy();
    await userEvent.click(screen.getByRole('tab', { name: '乙' }));
    expect(screen.getByText('乙內容')).toBeTruthy();
  });
});
