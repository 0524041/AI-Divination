import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { MarkdownRenderer } from '@/components/features/MarkdownRenderer';

describe('MarkdownRenderer（streamdown-render spec）', () => {
  it('渲染標題／粗體／清單／表格／程式碼區塊', () => {
    const md = [
      '# 標題一',
      '',
      '**粗體重點**與',
      '',
      '- 甲項',
      '- 乙項',
      '',
      '| 爻位 | 五行 |',
      '| ---- | ---- |',
      '| 初爻 | 木 |',
      '',
      '```text',
      'code body',
      '```',
    ].join('\n');

    const { container } = render(<MarkdownRenderer content={md} />);

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('標題一');
    // Streamdown 以樣式化元素呈現粗體（strong 或帶 font-weight class 的元素）
    const bold = screen.getByText('粗體重點');
    expect(/STRONG|B/i.test(bold.tagName) || /font-(semibold|bold)/.test(bold.className)).toBe(true);
    expect(screen.getByText('甲項')).toBeTruthy();
    expect(container.querySelector('table')).not.toBeNull();
    expect(container.querySelector('pre code')?.textContent).toContain('code body');
  });

  it('單換行轉為 <br>（breaks 語義回歸）', () => {
    render(<MarkdownRenderer content={'第一行\n第二行'} />);
    expect(document.querySelector('.markdown-content br')).not.toBeNull();
  });

  it('<think> 內容不進主體，摺疊標題可展開', async () => {
    render(
      <MarkdownRenderer content="<think>內部推理過程</think>## 對外結論" />
    );

    expect(screen.queryByText(/內部推理過程/)).toBeNull();
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('對外結論');

    await userEvent.click(screen.getByRole('button', { name: /AI 思考過程/ }));
    expect(screen.getByText('內部推理過程')).toBeTruthy();
  });

  it('整份包 code fence 的 AI 輸出會被剝殼', () => {
    const wrapped = ['```markdown', '## 真正的內容', '', '- 重點', '```'].join('\n');
    const { container } = render(<MarkdownRenderer content={wrapped} />);

    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('真正的內容');
    // 剝殼後不應殘留柵欄符號
    expect(container.querySelector('.markdown-content')?.textContent).not.toContain('```');
  });

  it('回歸：帶前導換行的整份 fence 也要剝殼（首解被 AI 包進 ```markdown）', () => {
    // 真實案例：首解開頭有兩個換行，舊版 ^``` 錨點失配 → 整份變成單一 code block
    const wrapped = '\n\n```markdown\n## 卦象總覽\n\n**核心結論**：吉中帶阻。\n```\n';
    const { container } = render(<MarkdownRenderer content={wrapped} />);

    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('卦象總覽');
    expect(container.querySelector('.markdown-content pre')).toBeNull();
  });

  it('串流中間態：語言標記未收完也能剝殼（如「```m」）', () => {
    render(<MarkdownRenderer content={'```m\n## 標題'} />);
    expect(screen.getByRole('heading', { level: 2 })).toBeTruthy();
  });

  it('sanitize：script 與事件屬性被清除', async () => {
    const malicious = '安全文字\n\n<script>window.hacked = 1</script>\n\n<img src=x onerror="alert(1)">';

    await waitFor(() => {
      render(<MarkdownRenderer content={malicious} />);
    });

    expect(document.querySelector('.markdown-content script')).toBeNull();
    expect(document.querySelector('img[onerror]')).toBeNull();
    expect(screen.getByText(/安全文字/)).toBeTruthy();
  });

  it('串流模擬：content 分次增長渲染正確且無拋錯', () => {
    const { rerender } = render(
      <MarkdownRenderer streaming content="# 卦象總覽" />
    );

    rerender(<MarkdownRenderer streaming content={'# 卦象總覽\n\n**核心**：世爻旺'} />);
    rerender(
      <MarkdownRenderer
        streaming
        content={'# 卦象總覽\n\n**核心**：世爻旺相，事業可成。'}
      />
    );

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('卦象總覽');
    expect(screen.getByText(/世爻旺相，事業可成。/)).toBeTruthy();
  });

  it('streaming=false 走 static 模式（完成內容正常渲染）', () => {
    render(<MarkdownRenderer content="## 完整解盤" />);
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('完整解盤');
  });
});
