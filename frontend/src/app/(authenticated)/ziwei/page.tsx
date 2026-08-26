'use client';

/**
 * 紫微占卜頁（Ticket 11）— 統一流程骨架：緣起 → 生辰 → 排盤儀式 → 命盤 → 論命對話
 *
 * 保留：iztro 前端排盤、真太陽時校正、生辰資料 CRUD。
 * 去重複：六份日期選擇區收斂為單一 DateSelectGroup；視圖切換改用 Tabs。
 */

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, MapPin, Save, Star, User, Users } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { useToast } from '@/components/ui/Toast';
import { DivinationFlow, DivinationStep } from '@/components/features/divination/DivinationFlow';
import { ZiweiRevealRitual } from '@/components/features/divination/ZiweiRevealRitual';
import { BirthDataPanel } from '@/components/features/divination/BirthDataPanel';
import { ZiweiChart } from '@/components/ziwei/ZiweiChart';
import { DivinationChat } from '@/components/features/divination/DivinationChat';
import { AISelector } from '@/components/features/AISelector';
import { apiDelete, apiGet, apiPost } from '@/lib/api-client';
import { TAIWAN_CITIES, TaiwanCity } from '@/lib/taiwan-cities';
import {
  calculateTrueSolarTime,
  generateHoroscope,
  generateNatalChart,
  getChineseHourName,
  getChineseTimeIndex,
  Gender,
} from '@/lib/astro';

type QueryType = 'natal' | 'yearly' | 'monthly' | 'daily';

interface BirthData {
  id?: number;
  name: string;
  gender: 'male' | 'female';
  birth_date: string;
  birth_location: string;
  is_twin: boolean;
  twin_order?: 'elder' | 'younger';
}

interface ZiweiChartData {
  natalChart: any;
  solarTimeIndex: number;
}

interface ZiweiResult {
  id: number;
  status: string;
  message: string;
}

const QUERY_OPTIONS: { value: QueryType; label: string; granularity: 'year' | 'month' | 'day' | null }[] = [
  { value: 'natal', label: '本命', granularity: null },
  { value: 'yearly', label: '流年', granularity: 'year' },
  { value: 'monthly', label: '流月', granularity: 'month' },
  { value: 'daily', label: '流日', granularity: 'day' },
];

/** 唯一的日期選擇群組（取代舊版六份複製貼上區塊） */
function DateSelectGroup({ value, onChange, granularity }: {
  value: string;
  onChange: (v: string) => void;
  granularity: 'year' | 'month' | 'day';
}) {
  const [y, m, d] = value.split('-');
  const thisYear = new Date().getFullYear();
  const years = Array.from({ length: 100 }, (_, i) => String(thisYear - 50 + i));
  const months = Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1).padStart(2, '0'), label: `${i + 1} 月` }));
  const days = Array.from({ length: 31 }, (_, i) => ({ value: String(i + 1).padStart(2, '0'), label: `${i + 1} 日` }));
  const build = (ny: string, nm: string, nd: string) => `${ny}-${(nm || '01').padStart(2, '0')}-${(nd || '01').padStart(2, '0')}`;

  return (
    <div className="flex gap-1">
      <Select aria-label="年" value={y} onChange={(e) => onChange(build(e.target.value, m, d))}
        options={years.map((v) => ({ value: v, label: `${v} 年` }))} className="w-24 py-1.5 text-sm" />
      {granularity !== 'year' && (
        <Select aria-label="月" value={m} onChange={(e) => onChange(build(y, e.target.value, d))} options={months} className="w-20 py-1.5 text-sm" />
      )}
      {granularity === 'day' && (
        <Select aria-label="日" value={d} onChange={(e) => onChange(build(y, m, e.target.value))} options={days} className="w-20 py-1.5 text-sm" />
      )}
    </div>
  );
}

const ERROR_BOX =
  'rounded-lg border border-[color-mix(in_srgb,var(--cinnabar)_50%,transparent)] bg-[color-mix(in_srgb,var(--cinnabar)_10%,transparent)] p-3 text-sm text-[var(--cinnabar)]';

const formatBazi = (baziStr?: string) => {
  if (!baziStr) return '';
  const parts = baziStr.split(' ');
  if (parts.length !== 4) return baziStr || '';
  return `干支︰${parts[0]}年 ${parts[1]}月 ${parts[2]}日 ${parts[3]}時`;
};

const EMPTY_BIRTH: BirthData = {
  name: '',
  gender: 'male',
  birth_date: new Date().toISOString().slice(0, 16),
  birth_location: '台北市',
  is_twin: false,
};

export default function ZiweiPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [step, setStep] = useState<DivinationStep>('intro');
  const [savedList, setSavedList] = useState<BirthData[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [birthData, setBirthData] = useState<BirthData>({ ...EMPTY_BIRTH });
  const [queryType, setQueryType] = useState<QueryType>('natal');
  const [queryDate, setQueryDate] = useState(new Date().toISOString().slice(0, 10));
  const [question, setQuestion] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [chartData, setChartData] = useState<ZiweiChartData | null>(null);
  const [result, setResult] = useState<ZiweiResult | null>(null);

  useEffect(() => {
    if (!localStorage.getItem('token')) router.push('/login');
  }, [router]);

  /* ===== 生辰資料 CRUD ===== */

  const loadSaved = useCallback(async () => {
    try {
      const res = await apiGet('/api/birth-data');
      if (res.ok) setSavedList(await res.json());
    } catch {
      console.error('載入生辰資料失敗');
    }
  }, []);

  useEffect(() => {
    void loadSaved();
  }, [loadSaved]);

  const applySaved = (id: number) => {
    const data = savedList.find((d) => d.id === id);
    if (!data) return;
    const dateStr = data.birth_date.endsWith('Z') ? data.birth_date : `${data.birth_date}Z`;
    const date = new Date(dateStr);
    const localDateStr = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setBirthData({ ...data, birth_date: localDateStr });
    setSelectedId(id);
  };

  const deleteSaved = async (id: number) => {
    try {
      const res = await apiDelete(`/api/birth-data/${id}`);
      if (!res.ok) throw new Error();
      await loadSaved();
      toast('已刪除生辰資料', { kind: 'success' });
      if (selectedId === id) {
        setSelectedId(null);
        setBirthData({ ...EMPTY_BIRTH });
      }
    } catch {
      toast('刪除失敗，請稍後再試', { kind: 'error' });
    }
  };

  const saveProfile = async () => {
    if (!birthData.name.trim()) {
      setError('請輸入姓名');
      return;
    }
    try {
      const res = await apiPost('/api/birth-data', {
        name: birthData.name,
        gender: birthData.gender,
        birth_date: new Date(birthData.birth_date).toISOString(),
        birth_location: birthData.birth_location,
        is_twin: birthData.is_twin,
        twin_order: birthData.is_twin ? birthData.twin_order : null,
      });
      if (!res.ok) throw new Error();
      const saved = await res.json();
      await loadSaved();
      setSelectedId(saved.id);
      toast('生辰資料已儲存', { kind: 'success' });
    } catch {
      toast('儲存失敗，請稍後再試', { kind: 'error' });
    }
  };

  /* ===== 排盤（iztro ＋ 真太陽時校正） ===== */

  const computeChart = (): ZiweiChartData => {
    const dateObj = new Date(birthData.birth_date);
    const city = (birthData.birth_location || '台北市') as TaiwanCity;
    const { solarTime, offsetMinutes } = calculateTrueSolarTime(dateObj, city);

    const originalTimeIndex = getChineseTimeIndex(dateObj.getHours());
    const solarTimeIndex = getChineseTimeIndex(solarTime.getHours());
    let correctionNote = '';
    if (originalTimeIndex !== solarTimeIndex) {
      const offsetInt = Math.round(offsetMinutes);
      const sign = offsetInt >= 0 ? '+' : '';
      correctionNote = `經真太陽時校正：時辰由【${getChineseHourName(originalTimeIndex)}】變更為【${getChineseHourName(solarTimeIndex)}】（調整 ${sign}${offsetInt} 分）`;
    }

    const pad = (n: number) => String(n).padStart(2, '0');
    const solarDateStr = `${solarTime.getFullYear()}-${pad(solarTime.getMonth() + 1)}-${pad(solarTime.getDate())}`;
    const chart = generateNatalChart(solarDateStr, solarTimeIndex, birthData.gender as Gender) as any;
    chart.correctionNote = correctionNote;
    chart.timeChar = getChineseHourName(solarTimeIndex);
    return { natalChart: chart, solarTimeIndex };
  };

  const startDivination = async (e: FormEvent) => {
    e.preventDefault();
    if (!birthData.name.trim()) {
      setError('請輸入姓名');
      return;
    }
    if (!question.trim()) {
      setError('請輸入您想詢問的問題');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const computed = computeChart();
      const res = await apiPost('/api/ziwei', {
        birth_data_id: selectedId ?? undefined,
        name: birthData.name,
        gender: birthData.gender,
        birth_date: new Date(birthData.birth_date).toISOString(),
        birth_location: birthData.birth_location,
        is_twin: birthData.is_twin,
        twin_order: birthData.is_twin ? birthData.twin_order : null,
        query_type: queryType,
        // 正午時間戳避免時區轉換造成日期偏移
        query_date: queryType !== 'natal' ? new Date(`${queryDate}T12:00:00`).toISOString() : null,
        question: question.trim(),
        chart_data: computed.natalChart,
        mode: 'thread',
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.detail || '占卜建立失敗，請稍後再試');
      setChartData(computed);
      setResult(data);
      setStep('ritual');
    } catch (err) {
      setError(err instanceof Error ? err.message : '連線錯誤，請稍後再試');
    } finally {
      setSubmitting(false);
    }
  };

  /* ===== 命盤顯示 ===== */

  const activeGranularity = QUERY_OPTIONS.find((o) => o.value === queryType)?.granularity ?? null;

  const displayChart = useMemo(() => {
    if (!chartData?.natalChart) return null;
    if (queryType === 'natal') return chartData.natalChart;
    try {
      return generateHoroscope(chartData.natalChart, queryDate, chartData.solarTimeIndex);
    } catch {
      return chartData.natalChart;
    }
  }, [chartData, queryType, queryDate]);

  const renderChart = () => {
    if (!chartData || !displayChart) return null;
    const centerInfo = {
      name: birthData.name,
      gender: birthData.gender,
      fiveElements: displayChart.fiveElementsClass,
      birthDate: birthData.birth_date.replace('T', ' '),
      solarDate: displayChart.solarDate,
      lunarDate: displayChart.lunarDate.toString(),
      bazi: formatBazi(chartData.natalChart.chineseDate),
      lunarInfo: {
        description: `${displayChart.lunarDate.toString()} ${displayChart.timeChar || chartData.natalChart.timeChar || ''}時`,
      },
      correctionNote: chartData.natalChart.correctionNote,
    } as const;
    if (queryType === 'natal') {
      return <ZiweiChart chart={displayChart} viewMode="natal" centerInfo={centerInfo} />;
    }
    return (
      <Tabs defaultValue="horoscope">
        <TabsList>
          <TabsTrigger value="horoscope">{QUERY_OPTIONS.find((o) => o.value === queryType)?.label}</TabsTrigger>
          <TabsTrigger value="natal">本命</TabsTrigger>
        </TabsList>
        <TabsContent value="horoscope"><ZiweiChart chart={displayChart} viewMode={queryType} centerInfo={centerInfo} /></TabsContent>
        <TabsContent value="natal"><ZiweiChart chart={chartData.natalChart} viewMode="natal" centerInfo={centerInfo} /></TabsContent>
      </Tabs>
    );
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
      <div className="relative w-44 h-44 flex items-center justify-center">
        <div aria-hidden className="absolute inset-0 rounded-full border border-border-accent bg-accent-light" />
        <div aria-hidden className="absolute inset-4 rounded-full border border-border bg-background-card shadow-lg flex items-center justify-center">
          <span className="text-6xl select-none">🌟</span>
        </div>
      </div>
      <div className="max-w-xl space-y-5">
        <h1 className="font-heading text-4xl font-medium tracking-tight text-foreground-primary">探索命運的星圖</h1>
        <p className="text-lg font-light leading-relaxed text-foreground-secondary">
          紫微斗數是中國古代占星術的精髓，透過出生時間排列星盤，洞悉命運軌跡與流年運勢。
        </p>
        <p className="text-sm font-medium uppercase tracking-widest text-accent opacity-80">知命造命 • 順勢而為</p>
      </div>
      <Button type="button" variant="gold" size="lg" className="rounded-full px-12" onClick={() => setStep('input')}>
        <Star size={22} /> 開始排盤
      </Button>
    </div>
  );

  const inputSlot = (
    <div className="w-full max-w-2xl mx-auto px-4 py-8 space-y-6">
      <AISelector variant="card" />
      <BirthDataPanel profiles={savedList} selectedId={selectedId} currentName={birthData.name} onDelete={deleteSaved}
        onSelect={(id) => (id ? applySaved(id) : (setSelectedId(null), setBirthData({ ...EMPTY_BIRTH })))} />

      <Card variant="glass" className="p-6">
        <form onSubmit={startDivination} className="space-y-5">
          <h2 className="flex items-center gap-2 font-heading text-xl text-accent">
            <User size={20} /> 輸入生辰與問題
          </h2>

          <Input label="姓名" value={birthData.name} placeholder="請輸入姓名" required
            onChange={(e) => setBirthData({ ...birthData, name: e.target.value })} />

          <div>
            <span className="block text-sm text-foreground-secondary mb-2">性別</span>
            <div className="flex gap-3">
              {([['male', '♂ 男'], ['female', '♀ 女']] as const).map(([value, label]) => (
                <Button key={value} type="button" aria-pressed={birthData.gender === value}
                  variant={birthData.gender === value ? 'gold' : 'outline'} className="flex-1"
                  onClick={() => setBirthData({ ...birthData, gender: value })}>
                  {label}
                </Button>
              ))}
            </div>
          </div>

          <Input label="出生日期時間（國曆）" type="datetime-local" required value={birthData.birth_date}
            onChange={(e) => setBirthData({ ...birthData, birth_date: e.target.value })} />

          <div>
            <label htmlFor="ziwei-birth-location" className="block text-sm font-medium text-foreground-secondary mb-2">
              <MapPin size={14} className="inline mr-1" />
              出生地（用於真太陽時校正）
            </label>
            <Select id="ziwei-birth-location" value={birthData.birth_location}
              onChange={(e) => setBirthData({ ...birthData, birth_location: e.target.value })}
              options={TAIWAN_CITIES.map((city) => ({ value: city, label: city }))} />
          </div>

          <div className="p-4 border border-border rounded-lg bg-background-primary">
            <label htmlFor="ziwei-twin" className="flex items-center gap-2 text-foreground-primary cursor-pointer">
              <input id="ziwei-twin" type="checkbox" checked={birthData.is_twin} className="w-5 h-5 accent-accent"
                onChange={(e) => setBirthData({ ...birthData, is_twin: e.target.checked, twin_order: e.target.checked ? 'elder' : undefined })} />
              <Users size={18} />
              <span>雙胞胎</span>
            </label>
            <p className="text-xs text-foreground-muted mt-1 ml-7">若為雙胞胎，老二將套用「對宮法」調整命盤</p>
            {birthData.is_twin && (
              <div className="mt-3 ml-7">
                <Select label="出生順序" value={birthData.twin_order || 'elder'}
                  onChange={(e) => setBirthData({ ...birthData, twin_order: e.target.value as 'elder' | 'younger' })}
                  options={[{ value: 'elder', label: '老大（先出生）' }, { value: 'younger', label: '老二（後出生）' }]} />
              </div>
            )}
          </div>

          <div>
            <span className="block text-sm text-foreground-secondary mb-2">查詢類型</span>
            <div className="flex flex-wrap gap-2">
              {QUERY_OPTIONS.map((opt) => (
                <Button key={opt.value} type="button" aria-pressed={queryType === opt.value} size="sm"
                  variant={queryType === opt.value ? 'primary' : 'outline'} onClick={() => setQueryType(opt.value)}>
                  {opt.label}
                </Button>
              ))}
            </div>
            {activeGranularity && (
              <div className="mt-3">
                <DateSelectGroup value={queryDate} onChange={setQueryDate} granularity={activeGranularity} />
              </div>
            )}
          </div>

          <div>
            <label htmlFor="ziwei-question" className="block text-sm text-foreground-secondary mb-2">請輸入您想詢問的問題</label>
            <textarea id="ziwei-question" value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={500}
              className="h-24 w-full resize-none rounded-lg border border-border bg-background-card px-4 py-3 text-foreground-primary placeholder:text-foreground-muted focus:border-transparent focus:outline-none focus:ring-2 focus:ring-accent"
              placeholder="例如：我今年的事業發展如何？" />
            <p className="text-right text-xs text-foreground-muted mt-1">{question.length}/500</p>
          </div>

          {error && (
            <div role="alert" className={ERROR_BOX}>{error}</div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 pt-1">
            <Button type="button" variant="outline" onClick={saveProfile}
              disabled={submitting || !birthData.name.trim()} className="sm:w-auto">
              <Save size={18} /> 儲存生辰資料
            </Button>
            <Button type="submit" variant="gold" className="flex-1" loading={submitting} disabled={!birthData.name.trim() || !question.trim()}>
              {!submitting && <Calendar size={20} />}
              {submitting ? '排盤中…' : '排盤並開始論命'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );

  const ritualSlot = <ZiweiRevealRitual onComplete={() => setStep('reveal')} />;

  const revealSlot = result ? (
    <div className="w-full max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div className="text-center space-y-2">
        <h2 className="font-heading text-2xl text-accent">命盤已成</h2>
        <p className="text-foreground-secondary italic max-w-2xl mx-auto">「{question}」</p>
        {(chartData?.natalChart?.correctionNote) && (
          <Badge variant="warning" size="sm">{chartData.natalChart.correctionNote}</Badge>
        )}
      </div>

      <div className="overflow-x-auto">{renderChart()}</div>

      <div className="flex flex-col justify-center gap-3 pt-2 sm:flex-row">
        <Button type="button" variant="gold" size="lg" onClick={() => setStep('chat')}>請大師論命</Button>
        <Button type="button" variant="outline" size="lg" onClick={restart}>修改資料重新排盤</Button>
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
        onError={(m) => toast(m, { kind: 'error', title: '論命發生錯誤' })}
      />
    </div>
  ) : null;

  return (
    <DivinationFlow
      type="ziwei"
      currentStep={step}
      introSlot={introSlot}
      inputSlot={inputSlot}
      ritualSlot={ritualSlot}
      revealSlot={revealSlot}
      chatSlot={chatSlot}
    />
  );
}
