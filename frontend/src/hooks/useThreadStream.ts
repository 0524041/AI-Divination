'use client';

/**
 * useThreadStream — 對話串流狀態機（Ticket 08）
 *
 * 封裝 /api/records/* SSE 通道：
 * - loadInitial(recordId)   首解（若未完成）
 * - sendFollowup(question)  追問
 * - retryLast()             重試最後回應
 * - abort()                 中止當前生成
 *
 * 訊息形狀與後端 ThreadMessage 對齊；think 獨立欄位供摺疊。
 */

import { useCallback, useRef, useState } from 'react';
import type { ModelSelection } from '@/hooks/useAIModels';
import { modelSelectionToQuery } from '@/hooks/useAIModels';

export type StreamPhase = 'idle' | 'connecting' | 'streaming' | 'error' | 'done';

export interface ChatMessage {
  id: number | string;
  role: 'user' | 'assistant';
  content: string;
  think?: string | null;
  model?: string | null;
}

function getToken(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('token') ?? '';
}

interface StreamCallbacks {
  onQuotaExceeded?: (info: { used: number; limit: number }) => void;
  onError?: (message: string) => void;
}

export function useThreadStream(callbacks?: StreamCallbacks) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [phase, setPhase] = useState<StreamPhase>('idle');
  const [errorKind, setErrorKind] = useState<string | null>(null);
  /** 後端 meta 事件回報的整體上下文估算（含 system＋盤面＋錨點） */
  const [contextTokens, setContextTokens] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const cbRef = useRef(callbacks);
  cbRef.current = callbacks;

  const abort = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setPhase((p) => (p === 'streaming' ? 'idle' : p));
  }, []);

  /**
   * 執行一條 SSE 請求並把 delta 即時合併進 messages。
   * assistantPlaceholderId：串流中的暫存訊息 id。
   */
  const runStream = useCallback(
    async (
      url: string,
      init: { method: 'GET' | 'POST'; body?: unknown },
      placeholderId: string
    ) => {
      const controller = new AbortController();
      abortRef.current = controller;
      setPhase('connecting');
      setErrorKind(null);

      // 樂觀插入空的 assistant 訊息
      setMessages((prev) => [
        ...prev,
        { id: placeholderId, role: 'assistant', content: '', think: '' },
      ]);

      try {
        const token = getToken();
        const fullUrl = url.includes('?') ? `${url}&token=${token}` : `${url}?token=${token}`;

        const response = await fetch(fullUrl, {
          method: init.method,
          headers: init.body
            ? { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
            : { Authorization: `Bearer ${token}` },
          body: init.body ? JSON.stringify(init.body) : undefined,
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          const detail = await response.json().catch(() => null);
          const info = detail?.detail;
          if (typeof info === 'object' && info?.kind === 'quota_exceeded') {
            cbRef.current?.onQuotaExceeded?.({ used: info.used, limit: info.limit });
          }
          throw new Error(
            typeof info === 'string' ? info : info?.message ?? `HTTP ${response.status}`
          );
        }

        setPhase('streaming');

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let eventName = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            if (line.startsWith(': ')) continue; // heartbeat
            if (line.startsWith('event: ')) {
              eventName = line.slice(7).trim();
              continue;
            }
            if (!line.startsWith('data: ') || !eventName) continue;
            const data = JSON.parse(line.slice(6));

            if (eventName === 'delta') {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === placeholderId
                    ? {
                        ...m,
                        content:
                          data.type === 'thinking'
                            ? m.content
                            : m.content + data.text,
                        think:
                          data.type === 'thinking'
                            ? (m.think ?? '') + data.text
                            : m.think,
                      }
                    : m
                )
              );
            } else if (eventName === 'done') {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === placeholderId
                    ? {
                        ...m,
                        id: data.message_id,
                        content: data.content,
                        think: data.think,
                        model: data.model,
                      }
                    : m
                )
              );
              setPhase('done');
            } else if (eventName === 'error') {
              throw new Error(data.message ?? data.kind);
            } else if (eventName === 'meta' && typeof data.context_tokens === 'number') {
              setContextTokens(data.context_tokens);
            }
            eventName = eventName === 'meta' ? eventName : eventName;
          }
        }
        setPhase((p) => (p === 'done' ? 'done' : 'idle'));
      } catch (err) {
        // 使用者主動中止：保留已收到的部分內容，不視為錯誤
        if (err instanceof DOMException && err.name === 'AbortError') {
          setMessages((prev) =>
            prev.filter(
              (m) => !(m.id === placeholderId && !m.content && !m.think)
            )
          );
          setPhase('idle');
          return;
        }
        const message =
          err instanceof Error ? err.message : '未知錯誤，請稍後再試';
        // 移除空佔位訊息
        setMessages((prev) =>
          prev.filter((m) => !(m.id === placeholderId && !m.content))
        );
        setErrorKind('stream');
        setPhase('error');
        cbRef.current?.onError?.(message);
      } finally {
        abortRef.current = null;
      }
    },
    []
  );

  /** 首解：從後端載入既有訊息（已完成的 thread），或開啟首解串流
   *
   * selection（可選）：本次解盤綁定的模型（spec: ai-model-selection），
   * 後端會寫入紀錄，追問/重試沿用。
   */
  const openThread = useCallback(
    async (
      record: { id: number; interpretation?: string | null },
      selection?: ModelSelection | null
    ) => {
      // 先呈現既有解盤（遷移資料）
      if (record.interpretation) {
        setMessages([
          {
            id: 'legacy',
            role: 'assistant',
            content: record.interpretation.replace(/<think>[\s\S]*?<\/think>/g, ''),
            think: record.interpretation.match(/<think>([\s\S]*?)<\/think>/)?.[1] ?? null,
          },
        ]);
        setPhase('idle');
        return;
      }
      const suffix = selection ? `?${modelSelectionToQuery(selection)}` : '';
      await runStream(
        `/api/records/${record.id}/stream${suffix}`,
        { method: 'GET' },
        `s-${record.id}`
      );
    },
    [runStream]
  );

  const sendFollowup = useCallback(
    async (recordId: number, question: string, selection?: ModelSelection | null) => {
      setMessages((prev) => [
        ...prev,
        { id: `u-${Date.now()}`, role: 'user', content: question },
      ]);
      await runStream(
        `/api/records/${recordId}/followup`,
        {
          method: 'POST',
          body: {
            question,
            ...(selection
              ? {
                  connection_id: selection.connectionId ?? 'system',
                  model_id: selection.modelId,
                }
              : {}),
          },
        },
        `f-${Date.now()}`
      );
    },
    [runStream]
  );

  const retryLast = useCallback(
    async (recordId: number) => {
      // 移除最後一則助手訊息（UI 立即反映替換語意）
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        return last?.role === 'assistant' ? prev.slice(0, -1) : prev;
      });
      await runStream(
        `/api/records/${recordId}/retry`,
        { method: 'POST' },
        `r-${Date.now()}`
      );
    },
    [runStream]
  );

  return {
    messages,
    phase,
    errorKind,
    contextTokens,
    isStreaming: phase === 'streaming' || phase === 'connecting',
    openThread,
    sendFollowup,
    retryLast,
    abort,
    setMessages,
  };
}
