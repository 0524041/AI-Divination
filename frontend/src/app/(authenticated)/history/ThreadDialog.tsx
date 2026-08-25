'use client';

/**
 * ThreadDialog — 歷史紀錄的對話視窗（Ticket 12）
 *
 * 載入單筆紀錄（GET /api/history/{id}），將既有解盤轉為
 * initialMessages 餵給 ThreadPanel，即可續問。
 */

import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/Dialog';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { ThreadPanel } from '@/components/features/ThreadPanel';
import { apiGet } from '@/lib/api-client';
import type { ChatMessage } from '@/hooks/useThreadStream';

export interface HistoryRecord {
  id: number;
  divination_type: string;
  question: string;
  gender: string | null;
  target: string | null;
  status: string;
  interpretation: string | null;
  created_at: string;
}

const TYPE_NAMES: Record<string, string> = {
  liuyao: '六爻占卜',
  ziwei: '紫微斗數',
  bazi: '八字命盤',
  tarot: '塔羅占卜',
};

/** 將舊制 interpretation 拆成 assistant 訊息（含 think） */
function legacyMessages(interpretation: string | null): ChatMessage[] {
  if (!interpretation) return [];
  return [
    {
      id: 'legacy',
      role: 'assistant',
      content: interpretation.replace(/<think>[\s\S]*?<\/think>/g, ''),
      think: interpretation.match(/<think>([\s\S]*?)<\/think>/)?.[1] ?? null,
    },
  ];
}

interface ThreadDialogProps {
  recordId: number | null;
  question?: string;
  onClose: () => void;
  onQuotaExceeded?: (info: { used: number; limit: number }) => void;
  onError?: (message: string) => void;
}

export function ThreadDialog({ recordId, question, onClose, onQuotaExceeded, onError }: ThreadDialogProps) {
  const [record, setRecord] = useState<HistoryRecord | null>(null);
  const [initialMessages, setInitialMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    if (recordId === null) {
      setRecord(null);
      setInitialMessages([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    apiGet(`/api/history/${recordId}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('載入失敗'))))
      .then((data: HistoryRecord) => {
        if (cancelled) return;
        setRecord(data);
        setInitialMessages(legacyMessages(data.interpretation));
      })
      .catch(() => {
        if (!cancelled) onErrorRef.current?.('無法載入此紀錄');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [recordId]);

  return (
    <Dialog open={recordId !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent title="對話記錄" className="w-[min(94vw,760px)]">
        <div className="mb-3 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            {record && (
              <Badge variant="accent" size="sm">
                {TYPE_NAMES[record.divination_type] ?? record.divination_type}
              </Badge>
            )}
            {question && (
              <p className="text-sm text-foreground-secondary line-clamp-2">{question}</p>
            )}
          </div>
        </div>

        {loading ? (
          <div className="space-y-3 py-6">
            <p className="text-sm text-foreground-muted">載入紀錄中…</p>
            <Skeleton variant="text" className="w-2/3" />
            <Skeleton variant="text" className="w-full" />
            <Skeleton variant="text" className="w-1/2" />
          </div>
        ) : record ? (
          <div className="h-[65vh] rounded-xl border border-border bg-background-primary/40">
            <ThreadPanel
              recordId={record.id}
              initialMessages={initialMessages}
              onQuotaExceeded={onQuotaExceeded}
              onError={onError}
            />
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-foreground-muted">紀錄不存在或已刪除</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
