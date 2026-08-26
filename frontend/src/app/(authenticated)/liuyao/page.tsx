'use client';

/**
 * 六爻占卜頁（Ticket 09）— 統一流程骨架：緣起 → 問事 → 擲幣 → 揭卦 → 解卦對話
 * 盤面由後端決定（mode:'thread'），首解經 SSE 串流於 ThreadPanel 呈現。
 */

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Compass, MessageCircle, RotateCcw, Send } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { DivinationFlow, DivinationStep } from '@/components/features/divination/DivinationFlow';
import { CoinTossRitual } from '@/components/features/divination/CoinTossRitual';
import { LiuyaoChartCompact, LiuyaoChartData } from '@/components/features/divination/LiuyaoChartCompact';
import { DivinationChat } from '@/components/features/divination/DivinationChat';
import { AISelector } from '@/components/features/AISelector';
import { useToast } from '@/components/ui/Toast';
import { apiPost } from '@/lib/api-client';

interface LiuyaoResult {
  id: number;
  status: string;
  coins: number[];
  chart_data: LiuyaoChartData;
}

type Gender = 'male' | 'female';
type Target = 'self' | 'parent' | 'friend' | 'other';

const TARGET_OPTIONS: { value: Target; label: string }[] = [
  { value: 'self', label: '自己' },
  { value: 'parent', label: '父母' },
  { value: 'friend', label: '朋友' },
  { value: 'other', label: '對方' },
];

export default function LiuYaoPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [step, setStep] = useState<DivinationStep>('intro');
  const [gender, setGender] = useState<Gender>('male');
  const [target, setTarget] = useState<Target>('self');
  const [question, setQuestion] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<LiuyaoResult | null>(null);

  useEffect(() => {
    if (!localStorage.getItem('token')) router.push('/login');
  }, [router]);

  const startDivination = async (e: FormEvent) => {
    e.preventDefault();
    const q = question.trim();
    if (!q) {
      setError('請輸入您想詢問的問題');
      return;
    }
    if (q.length > 500) {
      setError('問題長度上限為 500 字');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const res = await apiPost('/api/liuyao', { question: q, gender, target, mode: 'thread' });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.detail || '占卜建立失敗，請稍後再試');
      setResult(data);
      setStep('ritual');
    } catch (err) {
      setError(err instanceof Error ? err.message : '連線錯誤，請稍後再試');
    } finally {
      setSubmitting(false);
    }
  };

  const restart = () => {
    setResult(null);
    setQuestion('');
    setError('');
    setStep('input');
  };

  /* ===== Slots ===== */

  const introSlot = (
    <div className="flex-1 flex flex-col items-center text-center space-y-8 py-12 px-4 justify-center">
      <div className="w-44 h-44 relative flex items-center justify-center">
        <div aria-hidden className="absolute inset-0 bg-accent-light rounded-full border border-border-accent" />
        <div aria-hidden className="absolute inset-4 bg-background-card rounded-full border border-border flex items-center justify-center shadow-lg">
          <span className="text-7xl select-none">☯</span>
        </div>
      </div>
      <div className="space-y-5 max-w-xl">
        <h1 className="text-4xl font-heading font-medium text-foreground-primary tracking-tight">探尋易經的智慧</h1>
        <p className="text-foreground-secondary text-lg leading-relaxed font-light">
          六爻占卜源於《易經》，透過六次擲幣的變化，
          洞察事物發展的規律與吉凶。
        </p>
        <p className="text-accent text-sm font-medium tracking-widest uppercase opacity-80">心誠則靈 • 靜心專注</p>
      </div>
      <Button type="button" variant="gold" size="lg" className="px-12 rounded-full" onClick={() => setStep('input')}>
        <Compass size={22} />
        開始占卜
      </Button>
    </div>
  );

  const inputSlot = (
    <div className="w-full max-w-2xl mx-auto px-4 py-8">
      <Card variant="glass" className="p-6">
        <form onSubmit={startDivination} className="space-y-6">
          <div>
            <span className="block text-sm text-foreground-secondary mb-2">性別</span>
            <div className="flex gap-3">
              {([['male', '♂ 男'], ['female', '♀ 女']] as const).map(([value, label]) => (
                <Button
                  key={value}
                  type="button"
                  aria-pressed={gender === value}
                  variant={gender === value ? 'gold' : 'outline'}
                  className="flex-1"
                  onClick={() => setGender(value)}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <span className="block text-sm text-foreground-secondary mb-2">算命對象</span>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {TARGET_OPTIONS.map((opt) => (
                <Button
                  key={opt.value}
                  type="button"
                  aria-pressed={target === opt.value}
                  variant={target === opt.value ? 'gold' : 'outline'}
                  onClick={() => setTarget(opt.value)}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="liuyao-question" className="block text-sm text-foreground-secondary mb-2">請輸入您想詢問的問題</label>
            <textarea
              id="liuyao-question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-background-card border border-border text-foreground-primary placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent h-32 resize-none"
              placeholder="例如：我近期的事業運勢如何？這份工作是否適合我？"
              maxLength={500}
            />
            <p className="text-right text-xs text-foreground-muted mt-1">{question.length}/500</p>
          </div>

          {error && (
            <div role="alert" className="rounded-lg border border-[color-mix(in_srgb,var(--cinnabar)_50%,transparent)] bg-[color-mix(in_srgb,var(--cinnabar)_10%,transparent)] p-3 text-sm text-[var(--cinnabar)]">
              {error}
            </div>
          )}

          <Button type="submit" variant="gold" fullWidth loading={submitting} disabled={!question.trim()}>
            {!submitting && <Send size={18} />}
            {submitting ? '準備中…' : '開始擲幣'}
          </Button>
        </form>
      </Card>
    </div>
  );

  const ritualSlot = (
    <CoinTossRitual coins={result?.coins} onComplete={() => setStep('reveal')} />
  );

  const revealSlot = result ? (
    <div className="w-full max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div className="text-center space-y-2">
        <h2 className="font-heading text-2xl text-accent">卦象已成</h2>
        <p className="text-foreground-secondary italic">「{question}」</p>
      </div>

      <LiuyaoChartCompact chartData={result.chart_data} />

      {/* 解盤前的 AI 選擇：影響本次解盤與後續追問 */}
      <AISelector variant="card" />

      <div className="flex flex-col sm:flex-row justify-center gap-3 pt-2">
        <Button type="button" variant="gold" size="lg" onClick={() => setStep('chat')}>
          <MessageCircle size={20} />
          請大師解盤
        </Button>
        <Button type="button" variant="outline" size="lg" onClick={restart}>
          <RotateCcw size={18} />
          重新占卜
        </Button>
      </div>

      {result.coins.length > 0 && (
        <p className="text-center text-xs text-foreground-muted">
          <Badge variant="default" size="sm">提示</Badge>
          <span className="ml-2">動爻已以朱砂標記；解卦內容將在對話中逐步串流呈現。</span>
        </p>
      )}
    </div>
  ) : null;

  const chatSlot = result ? (
    <div className="flex-1 flex flex-col w-full max-w-4xl mx-auto h-[calc(100dvh-120px)] px-3 py-4">
      <DivinationChat
        recordId={result.id}
        question={question.trim()}
        onQuotaExceeded={({ used, limit }) =>
          toast(`今日 AI 回覆額度已用盡（${used}/${limit}），註冊可解鎖完整對話。`, { kind: 'error', title: '額度上限' })
        }
        onError={(m) => toast(m, { kind: 'error', title: '解盤發生錯誤' })}
      />
    </div>
  ) : null;

  return (
    <DivinationFlow
      type="liuyao"
      currentStep={step}
      introSlot={introSlot}
      inputSlot={inputSlot}
      ritualSlot={ritualSlot}
      revealSlot={revealSlot}
      chatSlot={chatSlot}
    />
  );
}
