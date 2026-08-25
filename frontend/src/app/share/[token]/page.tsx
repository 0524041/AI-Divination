'use client';

/**
 * 公開分享頁（Ticket 15）
 *
 * GET /api/share/{token}（免登入）。相容兩種後端回應：
 * - 含 messages[]（新制 thread）→ 渲染訊息時間軸
 * - 僅 interpretation（舊制）→ 直接以 Markdown 渲染
 *
 * 盤面摘要依占卜類型：六爻→卦名/干支；塔羅→牌陣與卡牌；
 * 紫微→五行局/命宮主星。
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AlertCircle, Clock, Compass, Share2 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { MarkdownRenderer } from '@/components/features/MarkdownRenderer';
import { getAIProviderDisplayName } from '@/components/features/AISelector';
import { secureApiRequest } from '@/lib/api-client';

interface SharedCard {
  name: string;
  name_cn: string;
  reversed: boolean;
  position: string;
}

interface SharedData {
  divination_type: string;
  question: string;
  gender: string | null;
  target: string | null;
  chart_data: {
    benguaming?: string;
    bianguaming?: string;
    bazi?: string;
    spread?: string;
    spread_name?: string;
    cards?: SharedCard[];
    fiveElementsClass?: string;
    palaces?: Array<Record<string, unknown>>;
    [key: string]: unknown;
  };
  chart_data_display: string | null;
  interpretation: string | null;
  ai_provider: string | null;
  ai_model: string | null;
  messages?: Array<{ role: 'user' | 'assistant'; content: string; think?: string | null }> | null;
}

const TYPE_NAMES: Record<string, string> = {
  liuyao: '六爻占卜',
  ziwei: '紫微斗數',
  bazi: '八字命盤',
  tarot: '塔羅占卜',
};

const SPREAD_NAMES: Record<string, string> = {
  three_card: '三牌陣（過去-現在-未來）',
  single: '單抽牌',
  celtic_cross: '凱爾特十字',
};

function positionLabel(position: string): string {
  if (position === 'past') return '過去';
  if (position === 'present') return '現在';
  if (position === 'future') return '未來';
  return position;
}

/** 從紫微命盤資料中取出命宮主星名稱 */
function extractMingGongStars(palaces?: Array<Record<string, unknown>>): string[] {
  if (!Array.isArray(palaces)) return [];
  const ming = palaces.find((p) => typeof p.name === 'string' && String(p.name).includes('命宮'));
  if (!ming) return [];
  const stars: string[] = [];
  for (const key of ['MajorStars', 'stars', 'SoftStars']) {
    const list = ming[key];
    if (!Array.isArray(list)) continue;
    for (const star of list) {
      const name = typeof star === 'string' ? star : (star as { name?: string })?.name;
      if (typeof name === 'string' && name && !stars.includes(name)) stars.push(name);
    }
  }
  return stars;
}

export default function SharePage() {
  const params = useParams();
  const token = params.token as string;

  const [data, setData] = useState<SharedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    secureApiRequest(`/api/share/${token}`, { skipAuth: true })
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 404) throw new Error('分享連結不存在');
        if (res.status === 410) throw new Error('分享連結已過期（連結有效期為 7 天）');
        if (!res.ok) throw new Error('無法載入分享內容');
        setData(await res.json());
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message || '載入失敗，請稍後再試');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 animate-spin-slow text-6xl" aria-hidden>☯</div>
          <p className="text-foreground-muted">載入分享內容…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <Card variant="glass" padding="lg" className="max-w-md text-center">
          <AlertCircle className="mx-auto mb-4 text-[var(--cinnabar)]" size={48} aria-hidden />
          <h1 className="font-heading mb-2 text-xl font-semibold text-foreground-primary">無法載入</h1>
          <p className="mb-6 text-foreground-secondary">{error}</p>
          <Link href="/">
            <Button type="button" variant="gold" leftIcon={<Compass size={18} />}>前往首頁</Button>
          </Link>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  const chart = data.chart_data ?? {};
  const threadMessages = Array.isArray(data.messages) ? data.messages : [];
  const messageKeys = threadMessages.map((m, i) => `${m.role}-${i}-${m.content.length}`);
  const mingGongStars = extractMingGongStars(chart.palaces);

  return (
    <div className="min-h-screen">
      {/* 導航 */}
      <nav className="mx-4 mt-4 flex items-center justify-between rounded-2xl border border-border bg-background-card px-6 py-4">
        <div className="flex items-center gap-3">
          <Share2 className="text-accent" size={22} aria-hidden />
          <h1 className="font-heading text-lg font-semibold text-accent">分享結果</h1>
        </div>
        <Link
          href="/"
          className="flex items-center gap-2 text-foreground-secondary transition hover:text-accent"
        >
          <Compass size={20} aria-hidden />
          <span className="hidden sm:inline">自己也想算一卦</span>
        </Link>
      </nav>

      <main className="w-full max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* 問題與摘要 */}
        <Card variant="glass" padding="md">
          <Badge variant="accent" size="sm" className="mb-3">
            {TYPE_NAMES[data.divination_type] ?? data.divination_type}
          </Badge>

          <h2 className="font-heading text-base font-semibold text-foreground-secondary">問題</h2>
          <p className="mt-1 whitespace-pre-wrap text-lg text-foreground-primary">{data.question}</p>

          {(data.target || data.gender) && (
            <div className="mt-3 flex flex-wrap gap-3 text-sm">
              {data.target && (
                <span className="rounded border border-border bg-background-secondary px-2 py-0.5">
                  對象：<span className="text-foreground-secondary">{data.target}</span>
                </span>
              )}
              {data.gender && (
                <span className="rounded border border-border bg-background-secondary px-2 py-0.5">
                  性別：<span className="text-foreground-secondary">{data.gender === 'male' || data.gender === '男' ? '男' : '女'}</span>
                </span>
              )}
            </div>
          )}

          {/* 盤面摘要 */}
          {data.divination_type === 'liuyao' && (
            <dl className="mt-4 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
              <div className="rounded-lg border border-border bg-background-secondary/60 p-3">
                <dt className="text-xs text-foreground-muted">卦名</dt>
                <dd className="mt-0.5 font-heading text-accent">
                  {chart.benguaming || '—'}
                  {chart.bianguaming ? ` → ${chart.bianguaming}` : ''}
                </dd>
              </div>
              <div className="rounded-lg border border-border bg-background-secondary/60 p-3">
                <dt className="text-xs text-foreground-muted">干支</dt>
                <dd className="mt-0.5 text-foreground-secondary">{chart.bazi || '—'}</dd>
              </div>
            </dl>
          )}

          {data.divination_type === 'ziwei' && (
            <dl className="mt-4 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
              <div className="rounded-lg border border-border bg-background-secondary/60 p-3">
                <dt className="text-xs text-foreground-muted">五行局</dt>
                <dd className="mt-0.5 font-heading text-accent">{chart.fiveElementsClass || '—'}</dd>
              </div>
              <div className="rounded-lg border border-border bg-background-secondary/60 p-3">
                <dt className="text-xs text-foreground-muted">命宮主星</dt>
                <dd className="mt-0.5 text-foreground-secondary">
                  {mingGongStars.length > 0 ? mingGongStars.join('、') : '—'}
                </dd>
              </div>
            </dl>
          )}

          {data.divination_type === 'tarot' && (
            <div className="mt-4 rounded-lg border border-border bg-background-secondary/60 p-3 text-sm">
              <p className="text-xs text-foreground-muted">
                牌陣：{chart.spread_name || SPREAD_NAMES[chart.spread ?? ''] || '—'}
              </p>
              <ul className="mt-2 divide-y divide-border/60 list-none p-0">
                {(chart.cards ?? []).map((card) => (
                  <li key={`${card.position}-${card.name}`} className="flex items-start gap-2 py-2 last:border-0">
                    <span className="min-w-[48px] font-medium text-accent">{positionLabel(card.position)}</span>
                    <span className="text-foreground-primary">
                      {card.name_cn}（{card.name}）{card.reversed ? '・逆位' : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>

        {/* 解讀內容 */}
        <Card variant="glass" padding="md">
          {data.ai_provider && (
            <p className="mb-4 flex items-center gap-2 text-sm text-foreground-muted">
              <Clock size={14} aria-hidden />
              AI：{getAIProviderDisplayName(data.ai_provider, data.ai_model)}
            </p>
          )}

          {threadMessages.length > 0 ? (
            /* 新制：thread 訊息時間軸 */
            <div className="space-y-4" role="log" aria-label="對話記錄">
              {threadMessages.map((message, index) => (
                <div key={messageKeys[index]}>
                  {message.role === 'user' ? (
                    <p className="ml-auto w-fit max-w-[90%] rounded-xl rounded-br-sm bg-accent px-4 py-2.5 text-sm text-background-primary">
                      {message.content}
                    </p>
                  ) : (
                    <div className="mr-auto max-w-full rounded-xl rounded-bl-sm border border-border bg-background-secondary/70 p-4">
                      <MarkdownRenderer content={message.content} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : data.interpretation ? (
            /* 舊制：直接渲染解盤 Markdown */
            <MarkdownRenderer content={data.interpretation} />
          ) : (
            <p className="py-4 text-sm text-foreground-muted">暫無解盤結果</p>
          )}
        </Card>

        {/* CTA */}
        <div className="mt-8 text-center">
          <Link href="/">
            <Button type="button" variant="gold" size="lg" leftIcon={<Compass size={20} />}>
              自己也想算一卦
            </Button>
          </Link>
          <p className="mt-4 text-sm text-foreground-muted">點擊上方按鈕，開始你的占卜之旅</p>
        </div>
      </main>

      <footer className="py-8 text-center text-sm text-foreground-muted">
        <p>AI 占卜結果僅供參考，請理性看待</p>
      </footer>
    </div>
  );
}
