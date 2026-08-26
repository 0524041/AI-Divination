'use client';

/**
 * 塔羅占卜頁（Ticket 10）— 統一流程骨架：緣起 → 問事（牌陣＋問題）→ 洗牌 → 揭牌 → 解牌對話
 * 牌面完全由後端抽取（mode:'thread'，前端不送 cards）。
 */

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MessageCircle, RotateCcw, Sparkles } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { DivinationFlow, DivinationStep } from '@/components/features/divination/DivinationFlow';
import { TarotShuffleRitual } from '@/components/features/divination/TarotShuffleRitual';
import { DivinedTarotCard, TarotCardFace } from '@/components/features/divination/TarotCardFace';
import { DivinationChat } from '@/components/features/divination/DivinationChat';
import { AISelector } from '@/components/features/AISelector';
import { useToast } from '@/components/ui/Toast';
import { apiPost } from '@/lib/api-client';

interface TarotResult {
  id: number;
  status: string;
  message: string;
  chart_data: {
    cards?: DivinedTarotCard[];
    spread_name?: string;
  };
}

type SpreadType = 'single' | 'three_card' | 'celtic_cross';

const SPREAD_OPTIONS: { value: SpreadType; name: string; description: string; icon: string; count: number }[] = [
  { value: 'single', name: '單張占卜', description: '快速洞察當前能量或核心問題', icon: '🎴', count: 1 },
  { value: 'three_card', name: '三牌陣', description: '過去－現在－未來的時間線解讀', icon: '🔮', count: 3 },
  { value: 'celtic_cross', name: '凱爾特十字', description: '最全面深入的十張牌綜合解讀', icon: '✨', count: 10 },
];

export default function TarotPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [step, setStep] = useState<DivinationStep>('intro');
  const [spreadType, setSpreadType] = useState<SpreadType>('three_card');
  const [question, setQuestion] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<TarotResult | null>(null);

  useEffect(() => {
    if (!localStorage.getItem('token')) router.push('/login');
  }, [router]);

  const cards = result?.chart_data.cards ?? [];

  const startDivination = async (e: FormEvent) => {
    e.preventDefault();
    const q = question.trim();
    if (!q) {
      setError('請先輸入您想問的問題');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      // thread 模式：後端抽牌，前端不送任何牌面
      const res = await apiPost('/api/tarot', { question: q, spread_type: spreadType, mode: 'thread' });
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

  /* ===== 揭牌版面 ===== */

  const renderRevealBoard = () => {
    if (cards.length === 0) {
      return <p className="text-center text-foreground-muted py-10">未取得牌面資料</p>;
    }
    if (cards.length === 1) {
      return (
        <div className="flex justify-center">
          <TarotCardFace card={cards[0]} size="lg" />
        </div>
      );
    }
    return (
      <div className="flex flex-col md:flex-row flex-wrap justify-center items-center gap-6 md:gap-8">
        {cards.map((card) => (
          <TarotCardFace key={`board-${card.id}`} card={card} size={spreadType === 'three_card' ? 'md' : 'sm'} />
        ))}
      </div>
    );
  };

  /* ===== Slots ===== */

  const introSlot = (
    <div className="flex-1 flex flex-col items-center text-center space-y-8 py-12 px-4 justify-center">
      <div className="relative w-44 h-64">
        <div aria-hidden className="absolute inset-0 bg-background-secondary rounded-xl border border-[var(--gold)] rotate-6 opacity-60" />
        <div aria-hidden className="absolute inset-0 bg-background-secondary rounded-xl border border-[var(--gold)] -rotate-6 opacity-60" />
        <div className="absolute inset-0 rounded-xl border border-[var(--gold)] bg-background-card shadow-[0_0_40px_rgba(212,175,55,0.15)] flex items-center justify-center">
          <span className="text-6xl select-none">🔮</span>
        </div>
      </div>
      <div className="space-y-5 max-w-xl">
        <h1 className="text-4xl font-heading font-medium text-foreground-primary tracking-tight">探索內心的指引</h1>
        <p className="text-foreground-secondary text-lg leading-relaxed font-light">
          塔羅牌是連結潛意識的鑰匙。
          洗牌之後，命運的訊息將逐一翻開。
        </p>
        <p className="text-accent text-sm font-medium tracking-widest uppercase opacity-80">靜心默念 • 憑直覺而行</p>
      </div>
      <Button type="button" variant="gold" size="lg" className="px-12 rounded-full" onClick={() => setStep('input')}>
        <Sparkles size={22} />
        開始占卜
      </Button>
    </div>
  );

  const inputSlot = (
    <div className="w-full max-w-4xl mx-auto px-4 py-8 space-y-8">
      <div className="text-center space-y-2">
        <h2 className="font-heading text-2xl text-accent">選擇牌陣，默念您的問題</h2>
        <p className="text-foreground-secondary text-sm">不同的牌陣適合不同深度的問題探索</p>
      </div>

      <form onSubmit={startDivination} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {SPREAD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              aria-pressed={spreadType === opt.value}
              onClick={() => setSpreadType(opt.value)}
              className={`text-left rounded-2xl border p-5 transition-all duration-300 ${
                spreadType === opt.value
                  ? 'border-border-accent bg-accent-light shadow-md'
                  : 'border-border bg-background-card hover:border-border-accent'
              }`}
            >
              <span className="text-3xl block mb-2" aria-hidden>{opt.icon}</span>
              <span className="block font-bold text-foreground-primary">{opt.name}</span>
              <span className="block text-sm text-foreground-muted mt-1 leading-relaxed">{opt.description}</span>
              <Badge variant={spreadType === opt.value ? 'accent' : 'default'} size="sm" className="mt-3">
                {opt.count} 張牌
              </Badge>
            </button>
          ))}
        </div>

        <Card variant="glass" className="p-6 space-y-4">
          <div>
            <label htmlFor="tarot-question" className="block text-sm text-foreground-secondary mb-2">您想詢問的問題</label>
            <textarea
              id="tarot-question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="例如：我最近的工作運勢如何？這段感情會有結果嗎？"
              maxLength={500}
              className="w-full h-28 px-4 py-3 rounded-lg bg-background-card border border-border text-foreground-primary placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent resize-none"
            />
            <p className="text-right text-xs text-foreground-muted mt-1">{question.length}/500</p>
          </div>

          {error && (
            <div role="alert" className="rounded-lg border border-[color-mix(in_srgb,var(--cinnabar)_50%,transparent)] bg-[color-mix(in_srgb,var(--cinnabar)_10%,transparent)] p-3 text-sm text-[var(--cinnabar)]">
              {error}
            </div>
          )}

          <Button type="submit" variant="gold" fullWidth size="lg" loading={submitting} disabled={!question.trim()}>
            {!submitting && <RotateCcw size={20} />}
            {submitting ? '洗牌準備中…' : '開始洗牌'}
          </Button>
        </Card>
      </form>
    </div>
  );

  const ritualSlot = (
    <TarotShuffleRitual cards={cards} onComplete={() => setStep('reveal')} />
  );

  const revealSlot = result ? (
    <div className="w-full max-w-5xl mx-auto px-4 py-8 space-y-8">
      <div className="text-center space-y-2">
        <h2 className="font-heading text-2xl text-accent">{result.chart_data.spread_name || '牌陣揭示'}</h2>
        <p className="text-foreground-secondary italic max-w-2xl mx-auto">「{question}」</p>
      </div>

      {renderRevealBoard()}

      {/* 解牌前的 AI 選擇：影響本次解盤與後續追問 */}
      <AISelector variant="card" />

      <div className="flex flex-col sm:flex-row justify-center gap-3 pt-2">
        <Button type="button" variant="gold" size="lg" onClick={() => setStep('chat')}>
          <MessageCircle size={20} />
          請大師解牌
        </Button>
        <Button type="button" variant="outline" size="lg" onClick={restart}>
          <RotateCcw size={18} />
          重新占卜
        </Button>
      </div>
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
        onError={(m) => toast(m, { kind: 'error', title: '解牌發生錯誤' })}
      />
    </div>
  ) : null;

  return (
    <DivinationFlow
      type="tarot"
      currentStep={step}
      introSlot={introSlot}
      inputSlot={inputSlot}
      ritualSlot={ritualSlot}
      revealSlot={revealSlot}
      chatSlot={chatSlot}
    />
  );
}
