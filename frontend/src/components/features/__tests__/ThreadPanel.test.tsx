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

// ThreadPanel 內嵌 AISelector 依賴 AuthContext
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ isGuest: false, user: { username: 'tester', role: 'user' } }),
}));

import { ThreadPanel } from '@/components/features/ThreadPanel';
import { Dialog, DialogContent } from '@/components/ui/Dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';

describe('ThreadPanel（Ticket 08）', () => {
  /** 內嵌 AISelector 後會有 quota／settings 等附帶請求，以 URL 分派 mock */
  function jsonOk() {
    return Promise.resolve({ ok: true, json: async () => ({ limited: false }) });
  }

  it('送出追問：樂觀插入 user 訊息、串流 delta 累積、done 定稿', async () => {
    const fetchMock = vi.fn().mockImplementation((url: unknown) => {
      const u = String(url);
      if (u.includes('/followup')) {
        return Promise.resolve(
          sseResponse([
            { event: 'meta', data: { record_id: 1 } },
            { event: 'delta', data: { type: 'text', text: '世爻' } },
            { event: 'delta', data: { type: 'text', text: '旺相' } },
            { event: 'done', data: { message_id: 99, content: '世爻旺相', think: null, model: 'm' } },
          ])
        );
      }
      return jsonOk();
    });

    vi.stubGlobal('fetch', fetchMock);

    render(<ThreadPanel recordId={1} />);
    const input = screen.getByLabelText('追問輸入');
    await userEvent.type(input, '這卦如何？');
    await userEvent.click(screen.getByRole('button', { name: /送出/ }));

    await waitFor(() => expect(screen.getByText('這卦如何？')).toBeTruthy());
    await waitFor(() => expect(screen.getByText(/世爻旺相/)).toBeTruthy());
    // 每則回應顯示實際使用的模型名稱（spec story 19）
    await waitFor(() =>
      expect(screen.getAllByTestId('message-model').some((el) => el.textContent === 'm')).toBe(true)
    );

    // 送出的請求形狀
    const followupCall = fetchMock.mock.calls.find((c) => String(c[0]).includes('/followup'));
    expect(followupCall![0]).toBe('/api/records/1/followup?token=');
    expect(JSON.parse(followupCall![1].body).question).toBe('這卦如何？');
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

  it('顯示上下文預算條：低用量為一般色', () => {
    const fetchMock = vi.fn().mockResolvedValue({ json: async () => ({ limited: false }) });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <ThreadPanel
        recordId={4}
        initialMessages={[{ id: 1, role: 'assistant', content: '世爻旺相' }]}
      />
    );

    const budget = screen.getByTestId('context-budget');
    expect(budget.textContent).toMatch(/上下文約 0\.0k \/ 48k/);
    expect((budget.querySelector('p') as HTMLElement).className).not.toContain('cinnabar');
  });

  it('預算超過 80% 時轉朱砂警示色', () => {
    const fetchMock = vi.fn().mockResolvedValue({ json: async () => ({ limited: false }) });
    vi.stubGlobal('fetch', fetchMock);

    // 40000 個 CJK 字 ≈ 40k tokens > 48k × 80%
    render(
      <ThreadPanel
        recordId={5}
        initialMessages={[
          { id: 1, role: 'assistant', content: '卦'.repeat(40000) },
        ]}
      />
    );

    const budget = screen.getByTestId('context-budget');
    expect(budget.textContent).toMatch(/上下文約 40\.0k \/ 48k/);
    expect((budget.querySelector('p') as HTMLElement).className).toContain('cinnabar');
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('40000');
  });

  it('預算條採用後端 meta 回報的 context_tokens（涵蓋 system＋盤面＋錨點）', async () => {
    const fetchMock = vi.fn().mockImplementation((url: unknown) => {
      const u = String(url);
      if (u.includes('/followup')) {
        return Promise.resolve(
          sseResponse([
            { event: 'meta', data: { record_id: 1, context_tokens: 20000 } },
            { event: 'done', data: { message_id: 9, content: '回應', think: null, model: 'm' } },
          ])
        );
      }
      return jsonOk();
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<ThreadPanel recordId={6} />);
    await userEvent.type(screen.getByLabelText('追問輸入'), '短問題');
    await userEvent.click(screen.getByRole('button', { name: /送出/ }));

    // 本地可見訊息僅數十 token；顯示值應為後端回報的 20000
    await waitFor(() =>
      expect(screen.getByTestId('context-budget').textContent).toMatch(/上下文約 20\.0k \/ 48k/)
    );
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
