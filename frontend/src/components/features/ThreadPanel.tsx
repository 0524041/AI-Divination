'use client';

/**
 * ThreadPanel — 對話面板（Ticket 08）
 *
 * 訊息列表（氣泡）＋串流游標＋think 即時摺疊＋輸入框＋中止/重試。
 * Markdown 渲染統一經 MarkdownRenderer（唯一 sanitise 出口）。
 */

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Brain, Loader2, RotateCcw, Send, Square } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { MarkdownRenderer } from '@/components/features/MarkdownRenderer';
import { ModelSelector } from '@/components/features/ModelSelector';
import { ChatMessage, useThreadStream } from '@/hooks/useThreadStream';
import { useModelSelection, type ModelSelection } from '@/hooks/useAIModels';
import { CONTEXT_TOKEN_BUDGET, estimateTokens } from '@/lib/tokens';
import { cn } from '@/lib/utils';

/** 估算超過預算此比例時轉朱砂警示 */
const BUDGET_WARN_RATIO = 0.8;

function ThinkBlock({ think }: { think: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-0.5 text-xs text-foreground-muted hover:text-accent hover:border-border-accent"
        aria-expanded={open}
      >
        <Brain size={13} />
        AI 思考過程{open ? '（點擊收起）' : ''}
      </button>
      {open && (
        <div className="mt-2 rounded-lg border border-border bg-background-primary/60 p-3 text-xs text-foreground-muted whitespace-pre-wrap max-h-56 overflow-y-auto">
          {think}
        </div>
      )}
    </div>
  );
}

export interface ThreadPanelProps {
  recordId: number;
  initialMessages?: ChatMessage[];
  /** 揭卦步驟選的模型（首解綁定）；未提供時用「我的預設模型」 */
  initialModelSelection?: ModelSelection | null;
  onQuotaExceeded?: (info: { used: number; limit: number }) => void;
  onError?: (message: string) => void;
}

export function ThreadPanel({
  recordId,
  initialMessages = [],
  initialModelSelection,
  onQuotaExceeded,
  onError,
}: ThreadPanelProps) {
  const stream = useThreadStream({ onQuotaExceeded, onError });
  const modelState = useModelSelection();
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      if (initialMessages.length > 0) {
        stream.setMessages(initialMessages);
      }
      if (initialModelSelection) {
        modelState.setSelection(initialModelSelection);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [stream.messages]);

  const streaming = stream.isStreaming;
  const lastIsAssistant =
    stream.messages.length > 0 &&
    stream.messages[stream.messages.length - 1].role === 'assistant';

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const question = input.trim();
    if (!question || streaming) return;
    setInput('');
    await stream.sendFollowup(recordId, question, modelState.selection);
  };

  return (
    <div className="flex flex-col h-full" data-testid="thread-panel">
      {/* 訊息流 */}
      <div
        className="flex-1 overflow-y-auto space-y-4 p-4 min-h-[300px]"
        role="log"
        aria-live="polite"
      >
        {stream.messages.length === 0 && (
          <p className="text-center text-sm text-foreground-muted py-8">
            解盤尚未開始，送出問題或等待串流…
          </p>
        )}
        {stream.messages.map((message, index) => (
          <div
            key={message.id}
            className={cn(
              'max-w-full md:max-w-[85%] rounded-xl px-4 py-3 text-sm leading-relaxed',
              message.role === 'user'
                ? 'ml-auto bg-accent text-background-primary rounded-br-sm'
                : 'mr-auto border border-border bg-background-card rounded-bl-sm'
            )}
          >
            {message.role === 'assistant' && message.think && (
              <ThinkBlock think={message.think} />
            )}
            {message.role === 'assistant' ? (
              message.content ? (
                <MarkdownRenderer
                  content={message.content}
                  streaming={streaming && index === stream.messages.length - 1}
                />
              ) : message.think ? (
                <span className="inline-flex items-center gap-2 text-foreground-muted">
                  <Brain size={14} className="animate-pulse" /> 正在思考…
                </span>
              ) : (
                <span className="inline-flex items-center gap-2 text-foreground-muted">
                  <Loader2 size={14} className="animate-spin" /> 正在解讀…
                </span>
              )
            ) : (
              message.content
            )}
          </div>
        ))}
        {streaming && (
          <span className="inline-block w-2 h-4 bg-accent animate-pulse ml-1" aria-hidden />
        )}
        <div ref={bottomRef} />
      </div>

      {/* 錯誤列 */}
      {stream.phase === 'error' && (
        <div className="mx-4 mb-2 rounded-lg border border-[var(--cinnabar)]/50 bg-[var(--cinnabar)]/10 px-3 py-2 text-xs text-[var(--cinnabar)]">
          回應失敗，請重試或更換 AI 設定。
        </div>
      )}

      {/* 對話窗內的模型選擇：切換後影響後續追問（並同步紀錄綁定） */}
      <div className="mx-4 mb-1">
        <ModelSelector
          variant="compact"
          value={modelState.selection}
          onChange={modelState.setSelection}
        />
      </div>

      {/* 上下文預算條 */}
      <ContextBudgetBar messages={stream.messages} contextTokens={stream.contextTokens} />

      {/* 訪客額度提示 */}
      <GuestQuotaNotice />

      {/* 輸入區 */}
      <form onSubmit={handleSubmit} className="border-t border-border p-3 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="針對卦象追問…"
          disabled={streaming}
          aria-label="追問輸入"
          maxLength={1000}
          className="flex-1 rounded-lg border border-border bg-background-secondary px-3 py-2 text-sm text-foreground-primary placeholder:text-foreground-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
        />
        {streaming ? (
          <>
            <Button type="button" variant="danger" size="sm" onClick={stream.abort}>
              <Square size={15} /> 中止
            </Button>
          </>
        ) : (
          <>
            {lastIsAssistant && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => stream.retryLast(recordId)}
                aria-label="重新生成最後回應"
              >
                <RotateCcw size={15} /> 重試
              </Button>
            )}
            <Button type="submit" variant="gold" size="sm" disabled={!input.trim()}>
              <Send size={15} /> 送出
            </Button>
          </>
        )}
      </form>
    </div>
  );
}

/** 上下文預算條：>80% 轉朱砂警示
 *
 * 顯示值取「後端組裝回報」與「本地可見訊息估算」的較大者——
 * 後端值涵蓋 system＋盤面＋錨點（本地清單看不到），
 * 本地值反映後端回報後新增的訊息。
 */
function ContextBudgetBar({
  messages,
  contextTokens,
}: {
  messages: ChatMessage[];
  contextTokens: number;
}) {
  const localEstimate = useMemo(
    () => messages.reduce((sum, m) => sum + estimateTokens(m.content), 0),
    [messages]
  );
  const estimated = Math.max(contextTokens, localEstimate);
  const ratio = Math.min(estimated / CONTEXT_TOKEN_BUDGET, 1);
  const warn = estimated > CONTEXT_TOKEN_BUDGET * BUDGET_WARN_RATIO;
  return (
    <div className="mx-4 mb-2" data-testid="context-budget">
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={CONTEXT_TOKEN_BUDGET}
        aria-valuenow={estimated}
        aria-label="上下文用量"
        className={cn(
          'h-1.5 rounded-full overflow-hidden border',
          warn ? 'border-[var(--cinnabar)]/50' : 'border-border'
        )}
      >
        <div
          className={cn('h-full transition-all', warn ? 'bg-[var(--cinnabar)]' : 'bg-accent')}
          style={{ width: `${Math.max(ratio * 100, 2)}%` }}
        />
      </div>
      <p
        className={cn(
          'mt-1 text-right text-[11px]',
          warn ? 'text-[var(--cinnabar)]' : 'text-foreground-muted'
        )}
      >
        上下文約 {(estimated / 1000).toFixed(1)}k / {CONTEXT_TOKEN_BUDGET / 1000}k
      </p>
    </div>
  );
}

/** 訪客額度提示條（接近上限時出現） */
function GuestQuotaNotice() {
  const [quota, setQuota] = useState<{ remaining: number; limit: number } | null>(null);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
    fetch(`/api/records/quota?token=${token}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.limited && data.remaining <= 3) setQuota(data);
      })
      .catch(() => {});
  }, []);

  if (!quota || quota.remaining <= 0) return null;

  return (
    <div className="mx-4 mb-2 rounded-lg border border-border-accent bg-accent-light px-3 py-2 text-xs text-foreground-secondary">
      訪客今日剩餘 {quota.remaining}/{quota.limit} 則回應——註冊可解鎖完整對話。
    </div>
  );
}
