'use client';

/**
 * DivinationChat — 首解串流 → ThreadPanel 橋接（Tickets 09-11）
 *
 * ThreadPanel 本身不會開啟首解 SSE 通道，本橋接元件：
 * 1. mount 後以 useThreadStream.openThread() 開啟 /api/records/{id}/stream，
 *    逐字渲染首解（含 abort）；
 * 2. 串流結束後交棒給 ThreadPanel（initialMessages 帶入完整訊息＋原問題），
 *    之後追問／中止／重試全由 ThreadPanel 接手。
 * 若首解已完成（重開紀錄），fallback 讀取 /api/history/{id} 的既有解盤；
 * 完全取不回內容時顯示可重試的錯誤狀態。
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, RotateCcw, Square } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { MarkdownRenderer } from '@/components/features/MarkdownRenderer';
import { ThreadPanel } from '@/components/features/ThreadPanel';
import { ChatMessage, useThreadStream } from '@/hooks/useThreadStream';
import { apiGet } from '@/lib/api-client';

interface DivinationChatProps {
  recordId: number;
  /** 原始占卜問題，作為對話流的首則 user 訊息 */
  question?: string;
  onQuotaExceeded?: (info: { used: number; limit: number }) => void;
  onError?: (message: string) => void;
}

export function DivinationChat({ recordId, question, onQuotaExceeded, onError }: DivinationChatProps) {
  const stream = useThreadStream({ onQuotaExceeded, onError });
  const streamRef = useRef(stream);
  streamRef.current = stream;
  const startedRef = useRef(false);
  const [fallbackDone, setFallbackDone] = useState(false);

  const openStream = useCallback(() => {
    if (startedRef.current || !recordId) return;
    startedRef.current = true;
    setFallbackDone(false);
    void streamRef.current.openThread({ id: recordId });
  }, [recordId]);

  useEffect(() => {
    openStream();
  }, [openStream]);

  const handOver = useCallback((): ChatMessage[] => {
    const messages = [...stream.messages];
    if (question && !messages.some((m) => m.role === 'user')) {
      messages.unshift({ id: 'question', role: 'user', content: question });
    }
    return messages;
  }, [stream.messages, question]);

  // 錯誤且無內容：嘗試從 history 取回既有解盤（例如已完成後重入）
  useEffect(() => {
    if (stream.phase !== 'error' || stream.messages.length > 0 || !recordId) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await apiGet(`/api/history/${recordId}`);
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (!data.interpretation || cancelled) return;
        streamRef.current.setMessages([
          {
            id: 'legacy',
            role: 'assistant',
            content: String(data.interpretation).replace(/<think>[\s\S]*?<\/think>/g, ''),
            think: String(data.interpretation).match(/<think>([\s\S]*?)<\/think>/)?.[1] ?? null,
          },
        ]);
      } catch {
        /* 無法回復，顯示錯誤狀態 */
      } finally {
        if (!cancelled) setFallbackDone(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [stream.phase, stream.messages.length, recordId]);

  const streaming = stream.isStreaming;
  const lastAssistant = [...stream.messages].reverse().find((m) => m.role === 'assistant');

  if (!streaming && stream.messages.length > 0) {
    return <ThreadPanel recordId={recordId} initialMessages={handOver()} onQuotaExceeded={onQuotaExceeded} onError={onError} />;
  }

  if (!streaming && stream.phase === 'error' && fallbackDone) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center max-w-3xl w-full mx-auto">
        <p className="text-sm text-[var(--cinnabar)]">解盤連線失敗或內容暫時無法取得。</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            startedRef.current = false;
            openStream();
          }}
        >
          <RotateCcw size={15} /> 重試連線
        </Button>
      </div>
    );
  }

  // 首解進行中：輕量串流視圖
  return (
    <div className="flex-1 flex flex-col max-w-3xl w-full mx-auto" data-testid="divination-chat">
      <div className="flex-1 overflow-y-auto space-y-4 p-4 min-h-[300px]" role="log" aria-live="polite">
        {question && (
          <div className="max-w-[92%] md:max-w-[80%] ml-auto rounded-xl px-4 py-3 text-sm leading-relaxed bg-accent text-background-primary rounded-br-sm">
            {question}
          </div>
        )}
        {lastAssistant && lastAssistant.content ? (
          <div className="max-w-[92%] md:max-w-[80%] mr-auto rounded-xl border border-border bg-background-card rounded-bl-sm">
            <MarkdownRenderer content={lastAssistant.content} />
          </div>
        ) : (
          <p className="text-center text-sm text-foreground-muted py-8 flex items-center justify-center gap-2">
            <Loader2 size={14} className="animate-spin" /> 大師正在連結卦象…
          </p>
        )}
      </div>
      <div className="border-t border-border p-3 flex justify-end">
        <Button type="button" variant="danger" size="sm" onClick={stream.abort}>
          <Square size={15} /> 中止
        </Button>
      </div>
    </div>
  );
}
