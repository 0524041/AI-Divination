'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Navbar } from '@/components/layout/Navbar';
import { AISelector, AIConfig } from '@/components/features/AISelector';
import { MarkdownRenderer } from '@/components/features/MarkdownRenderer';
import { ZiweiChart } from '@/components/ziwei/ZiweiChart';
import { apiGet, apiPost, apiDelete } from '@/lib/api-client';
import { TAIWAN_CITIES } from '@/lib/taiwan-cities';
import {
  Compass,
  BookOpen,
  HelpCircle,
  Send,
  Loader2,
  Copy,
  Share2,
  Check,
  X,
  User,
  Calendar,
  MapPin,
  Users,
} from 'lucide-react';

type Step = 'intro' | 'input' | 'chart' | 'result';
type Tab = 'divine' | 'intro' | 'tutorial';
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

interface ChartData {
  natal_chart: {
    palaces: Array<{
      index: number;
      name: string;
      heavenly_stem: string;
      earthly_branch: string;
      major_stars: Array<{ name: string; brightness?: string }>;
      minor_stars: Array<{ name: string }>;
      decadal?: { range: string };
    }>;
    earthly_branch_of_soul_palace: string;
    earthly_branch_of_body_palace: string;
    five_elements_class: string;
    birth_info: {
      name: string;
      gender: string;
      original_time: string;
      adjusted_time: string;
      location: string;
      is_twin: boolean;
      twin_order?: string;
    };
  };
  horoscope?: Record<string, unknown>;
  query_type: string;
  query_date?: string;
}

interface DivinationResult {
  id: number;
  status: string;
  message: string;
}

// Constants
const MAX_WAIT_GEMINI = 60 * 1000;
const MAX_WAIT_LOCAL = 180 * 1000;
const AI_TIMEOUT = 5 * 60 * 1000;

export default function ZiweiPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('intro');
  const [activeTab, setActiveTab] = useState<Tab>('divine');

  // Birth Data Form
  const [savedBirthDataList, setSavedBirthDataList] = useState<BirthData[]>([]);
  const [selectedBirthDataId, setSelectedBirthDataId] = useState<number | null>(null);
  const [birthData, setBirthData] = useState<BirthData>({
    name: '',
    gender: 'male',
    birth_date: new Date().toISOString().slice(0, 16),
    birth_location: '台北市',
    is_twin: false,
  });

  // Chart & Query
  const [chartData, setChartData] = useState<ChartData | null>(null);
  const [queryType, setQueryType] = useState<QueryType>('natal');
  const [queryDate, setQueryDate] = useState(new Date().toISOString().slice(0, 10));
  const [question, setQuestion] = useState('');

  // Result
  const [historyId, setHistoryId] = useState<number | null>(null);
  const [interpretation, setInterpretation] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [waitingTime, setWaitingTime] = useState(0);
  const [aiProgress, setAiProgress] = useState(0);
  const [isCancelling, setIsCancelling] = useState(false);

  // AI Config
  const [activeAI, setActiveAI] = useState<AIConfig | null>(null);

  // Share
  const [sharingState, setSharingState] = useState<'idle' | 'loading' | 'success'>('idle');

  // Check login
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
    }
  }, [router]);

  // Load saved birth data
  const loadSavedBirthData = useCallback(async () => {
    try {
      const response = await apiGet('/api/birth-data');
      if (response.ok) {
        const data = await response.json();
        setSavedBirthDataList(data);
      }
    } catch (err) {
      console.error('載入生辰八字失敗', err);
    }
  }, []);

  useEffect(() => {
    loadSavedBirthData();
  }, [loadSavedBirthData]);

  const handleSelectSavedData = (id: number) => {
    const data = savedBirthDataList.find(d => d.id === id);
    if (data) {
      // Parse the date and format for datetime-local input (handle timezone)
      const date = new Date(data.birth_date);
      const localDateStr = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
      setBirthData({
        ...data,
        birth_date: localDateStr
      });
      setSelectedBirthDataId(id);
    }
  };

  const handleDeleteBirthData = async (id: number) => {
    if (!confirm('確定要刪除此生辰八字？')) return;
    try {
      const res = await apiDelete(`/api/birth-data/${id}`);
      if (res.ok) {
        await loadSavedBirthData();
        if (selectedBirthDataId === id) {
          setSelectedBirthDataId(null);
          // Reset form
          setBirthData({
            name: '',
            gender: 'male',
            birth_date: new Date().toISOString().slice(0, 16),
            birth_location: '台北市',
            is_twin: false,
          });
        }
      } else {
        alert('刪除失敗');
      }
    } catch (err) {
      alert('刪除失敗');
    }
  };

  // Calculate chart and auto-save
  const handleCalculateChart = async () => {
    if (!birthData.name.trim()) {
      setError('請輸入姓名');
      return;
    }

    setError('');
    setIsProcessing(true);

    try {
      // Auto-save birth data first
      const saveRes = await apiPost('/api/birth-data', {
        name: birthData.name,
        gender: birthData.gender,
        birth_date: new Date(birthData.birth_date).toISOString(),
        birth_location: birthData.birth_location,
        is_twin: birthData.is_twin,
        twin_order: birthData.is_twin ? birthData.twin_order : null,
      });

      if (saveRes.ok) {
        const savedData = await saveRes.json();
        setSelectedBirthDataId(savedData.id);
        await loadSavedBirthData();
      }

      // Calculate chart
      const calcRes = await apiPost('/api/ziwei/calculate', {
        name: birthData.name,
        gender: birthData.gender,
        birth_date: new Date(birthData.birth_date).toISOString(),
        birth_location: birthData.birth_location,
        is_twin: birthData.is_twin,
        twin_order: birthData.is_twin ? birthData.twin_order : null,
      });

      if (calcRes.ok) {
        const result = await calcRes.json();
        setChartData({
          natal_chart: result.natal_chart,
          query_type: 'natal',
        });
        setStep('chart');
      } else {
        const errData = await calcRes.json();
        setError(errData.detail || '排盤失敗');
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(`排盤錯誤: ${err.message}`);
      } else {
        setError('發生未知錯誤');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // Submit question to AI
  const handleSubmitQuery = async () => {
    if (!question.trim()) {
      setError('請輸入問題');
      return;
    }
    if (!activeAI) {
      setError('請先配置 AI 服務');
      return;
    }

    setError('');
    setIsProcessing(true);
    setInterpretation(null);
    setWaitingTime(0);
    setAiProgress(0);

    const startTime = Date.now();

    try {
      const res = await apiPost('/api/ziwei', {
        birth_data_id: selectedBirthDataId,
        name: birthData.name,
        gender: birthData.gender,
        birth_date: new Date(birthData.birth_date).toISOString(),
        birth_location: birthData.birth_location,
        is_twin: birthData.is_twin,
        twin_order: birthData.is_twin ? birthData.twin_order : null,
        query_type: queryType,
        query_date: queryType !== 'natal' ? new Date(queryDate).toISOString() : null,
        question,
      });

      if (res.ok) {
        const result: DivinationResult = await res.json();
        setHistoryId(result.id);
        setStep('result');
        pollResult(result.id, startTime);
      } else {
        const errData = await res.json();
        setError(errData.detail || '占卜建立失敗');
        setIsProcessing(false);
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(`連線錯誤: ${err.message}`);
      } else {
        setError('發生未知錯誤');
      }
      setIsProcessing(false);
    }
  };

  const pollResult = (id: number, startTime: number) => {
    const maxWait = activeAI?.provider === 'local' ? MAX_WAIT_LOCAL : MAX_WAIT_GEMINI;

    const waitingTimer = setInterval(() => {
      const elapsed = Date.now() - startTime;
      setWaitingTime(Math.floor(elapsed / 1000));
      setAiProgress(Math.min(100, (elapsed / maxWait) * 100));
    }, 1000);

    const pollInterval = setInterval(async () => {
      if (Date.now() - startTime > AI_TIMEOUT) {
        clearInterval(pollInterval);
        clearInterval(waitingTimer);
        setInterpretation('AI 解盤超時，請稍後在歷史紀錄中查看結果');
        setIsProcessing(false);
        return;
      }

      try {
        const res = await apiGet(`/api/history/${id}`);
        if (res.ok) {
          const data = await res.json();
          if (data.status === 'completed' && data.interpretation) {
            clearInterval(pollInterval);
            clearInterval(waitingTimer);
            setInterpretation(data.interpretation);
            setIsProcessing(false);
          } else if (data.status === 'error') {
            clearInterval(pollInterval);
            clearInterval(waitingTimer);
            setInterpretation(data.interpretation || '解盤發生錯誤');
            setIsProcessing(false);
          } else if (data.status === 'cancelled') {
            clearInterval(pollInterval);
            clearInterval(waitingTimer);
            setInterpretation('占卜已取消');
            setIsProcessing(false);
          }
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 2000);
  };

  const handleCancel = async () => {
    if (!historyId) return;
    setIsCancelling(true);
    try {
      await apiPost(`/api/ziwei/${historyId}/cancel`);
    } catch (err) {
      console.error('Cancel error:', err);
    }
    setIsCancelling(false);
    setStep('chart');
    setIsProcessing(false);
  };

  const handleCopy = async () => {
    if (!interpretation) return;
    const text = `## 紫微斗數解盤\n\n${interpretation}`;
    try {
      await navigator.clipboard.writeText(text);
      alert('已複製到剪貼簿');
    } catch {
      alert('複製失敗');
    }
  };

  const handleShare = async () => {
    if (!historyId) return;
    setSharingState('loading');
    try {
      const res = await apiPost('/api/share/create', { history_id: historyId });
      if (res.ok) {
        const data = await res.json();
        const url = `${window.location.origin}${data.share_url}`;
        await navigator.clipboard.writeText(url);
        alert('連結已複製到剪貼簿');
        setSharingState('success');
        setTimeout(() => setSharingState('idle'), 3000);
      } else {
        alert('建立分享連結失敗');
        setSharingState('idle');
      }
    } catch {
      alert('分享失敗');
      setSharingState('idle');
    }
  };

  // Format lunar date info for display
  const birthInfo = useMemo(() => {
    if (!chartData?.natal_chart?.birth_info) return null;
    const info = chartData.natal_chart.birth_info;
    return {
      name: info.name,
      gender: info.gender,
      birthDate: new Date(info.original_time).toLocaleString('zh-TW'),
      location: info.location,
      isTwin: info.is_twin,
      twinOrder: info.twin_order,
    };
  }, [chartData]);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar pageTitle="紫微斗數" showBackButton backHref="/" />

      {/* ===== Intro Phase ===== */}
      {step === 'intro' && (
        <div className="flex flex-col items-center text-center space-y-8 fade-in py-12 px-4 min-h-[500px]">
          <div className="w-48 h-48 relative mb-4 flex items-center justify-center">
            <div className="absolute inset-0 bg-background-card/50 rounded-full border-2 border-accent animate-pulse-slow" />
            <div className="text-8xl">🌟</div>
          </div>

          <div className="space-y-4 max-w-2xl">
            <h2 className="text-3xl font-bold text-accent">探索命運的星圖</h2>
            <p className="text-foreground-secondary leading-relaxed">
              紫微斗數是中國古代占星術的精髓，透過出生時間排列星盤，
              洞悉命運軌跡與流年運勢。以紫微星為主導，配合百餘顆星曜，
              揭示人生各個層面的吉凶禍福。
            </p>
            <p className="text-foreground-muted text-sm">
              請準備好您的出生年月日時（國曆）及出生地點，開始探索您的命盤。
            </p>
          </div>

          <Button onClick={() => setStep('input')} variant="gold" className="px-12 py-6 text-lg">
            <Compass size={20} className="mr-2" />
            開始排盤
          </Button>
        </div>
      )}

      {/* ===== Input Phase ===== */}
      {step === 'input' && (
        <main className="w-full max-w-4xl mx-auto px-4 py-6">
          <Card variant="glass" className="p-6">
            <h2 className="text-xl font-bold text-accent mb-6 flex items-center gap-2">
              <User size={24} />
              輸入生辰八字
            </h2>

            {/* Saved Data Selector */}
            {savedBirthDataList.length > 0 && (
              <div className="mb-6">
                <label className="block text-sm text-foreground-secondary mb-2">選擇已儲存的生辰八字</label>
                <Select
                  value={selectedBirthDataId?.toString() || ''}
                  onChange={(e) => {
                    const id = parseInt(e.target.value);
                    if (id) handleSelectSavedData(id);
                    else setSelectedBirthDataId(null);
                  }}
                  options={[
                    { value: '', label: '--- 新增 ---' },
                    ...savedBirthDataList.map(d => ({
                      value: d.id!.toString(),
                      label: `${d.name} (${d.gender === 'male' ? '男' : '女'})`
                    }))
                  ]}
                />
                {selectedBirthDataId && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteBirthData(selectedBirthDataId)}
                    className="mt-2 text-red-400 hover:text-red-300"
                  >
                    🗑️ 刪除此紀錄
                  </Button>
                )}
              </div>
            )}

            <div className="space-y-4">
              {/* Name */}
              <Input
                label="姓名"
                value={birthData.name}
                onChange={(e) => setBirthData({ ...birthData, name: e.target.value })}
                placeholder="請輸入姓名"
                required
              />

              {/* Gender */}
              <div>
                <label className="block text-sm text-foreground-secondary mb-2">性別</label>
                <div className="flex gap-4">
                  <Button
                    type="button"
                    variant={birthData.gender === 'male' ? 'gold' : 'outline'}
                    className="flex-1"
                    onClick={() => setBirthData({ ...birthData, gender: 'male' })}
                  >
                    ♂ 男
                  </Button>
                  <Button
                    type="button"
                    variant={birthData.gender === 'female' ? 'gold' : 'outline'}
                    className="flex-1"
                    onClick={() => setBirthData({ ...birthData, gender: 'female' })}
                  >
                    ♀ 女
                  </Button>
                </div>
              </div>

              {/* Birth Date */}
              <Input
                label="出生日期時間（國曆）"
                type="datetime-local"
                value={birthData.birth_date}
                onChange={(e) => setBirthData({ ...birthData, birth_date: e.target.value })}
                required
              />

              {/* Location */}
              <div>
                <label className="block text-sm text-foreground-secondary mb-2">
                  <MapPin size={14} className="inline mr-1" />
                  出生地（用於真太陽時校正）
                </label>
                <Select
                  value={birthData.birth_location}
                  onChange={(e) => setBirthData({ ...birthData, birth_location: e.target.value })}
                  options={TAIWAN_CITIES.map(city => ({ value: city, label: city }))}
                />
              </div>

              {/* Twin */}
              <div className="p-4 border border-border rounded-lg bg-background-card/30">
                <label className="flex items-center gap-2 text-foreground-primary cursor-pointer">
                  <input
                    type="checkbox"
                    checked={birthData.is_twin}
                    onChange={(e) => setBirthData({ ...birthData, is_twin: e.target.checked, twin_order: e.target.checked ? 'elder' : undefined })}
                    className="w-5 h-5 accent-accent"
                  />
                  <Users size={18} />
                  <span>雙胞胎</span>
                </label>
                <p className="text-xs text-foreground-muted mt-1 ml-7">
                  若為雙胞胎，老二將套用「對宮法」調整命盤
                </p>

                {birthData.is_twin && (
                  <div className="mt-3 ml-7">
                    <Select
                      label="出生順序"
                      value={birthData.twin_order || 'elder'}
                      onChange={(e) => setBirthData({ ...birthData, twin_order: e.target.value as 'elder' | 'younger' })}
                      options={[
                        { value: 'elder', label: '老大（先出生）' },
                        { value: 'younger', label: '老二（後出生）' },
                      ]}
                    />
                  </div>
                )}
              </div>
            </div>

            {error && (
              <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 text-red-400 text-sm mt-4">
                {error}
              </div>
            )}

            <div className="flex gap-4 mt-6">
              <Button variant="outline" onClick={() => setStep('intro')}>
                ← 返回
              </Button>
              <Button
                variant="gold"
                fullWidth
                onClick={handleCalculateChart}
                disabled={isProcessing || !birthData.name.trim()}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="animate-spin mr-2" size={20} />
                    排盤中...
                  </>
                ) : (
                  <>
                    <Calendar size={20} className="mr-2" />
                    排盤（自動儲存）
                  </>
                )}
              </Button>
            </div>
          </Card>
        </main>
      )}

      {/* ===== Chart Phase ===== */}
      {step === 'chart' && chartData && (
        <main className="w-full max-w-6xl mx-auto px-4 py-6 space-y-6">
          {/* User Info Card */}
          {birthInfo && (
            <Card variant="glass" className="p-4">
              <div className="flex flex-wrap gap-4 text-sm">
                <div><span className="text-foreground-secondary">姓名：</span><span className="text-accent font-bold">{birthInfo.name}</span></div>
                <div><span className="text-foreground-secondary">性別：</span><span>{birthInfo.gender === 'male' ? '男' : '女'}</span></div>
                <div><span className="text-foreground-secondary">出生時間：</span><span>{birthInfo.birthDate}</span></div>
                <div><span className="text-foreground-secondary">出生地：</span><span>{birthInfo.location}</span></div>
                {birthInfo.isTwin && (
                  <div className="text-amber-400">
                    <span>雙胞胎 ({birthInfo.twinOrder === 'elder' ? '老大' : '老二'})</span>
                    {birthInfo.twinOrder === 'younger' && <span className="ml-2 text-xs">已套用對宮法</span>}
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Chart Display */}
          <ZiweiChart
            palaces={chartData.natal_chart.palaces}
            soulPalaceBranch={chartData.natal_chart.earthly_branch_of_soul_palace}
            bodyPalaceBranch={chartData.natal_chart.earthly_branch_of_body_palace}
            centerInfo={{
              name: birthInfo?.name || '',
              gender: birthInfo?.gender || 'male',
              fiveElements: chartData.natal_chart.five_elements_class,
              birthDate: birthInfo?.birthDate || '',
            }}
          />

          {/* AI Query Section */}
          <Card variant="glass" className="p-6">
            <h3 className="text-xl font-bold text-accent mb-4">AI 解盤</h3>

            <AISelector
              onConfigChange={(config) => setActiveAI(config)}
              showWarning={true}
              warningMessage="使用其他 AI 服務時，解盤最長可能需要等待 5 分鐘。建議使用 Google Gemini 以獲得更快的回應速度。"
            />

            <div className="space-y-4 mt-6">
              {/* Query Type */}
              <Select
                label="問卦類型"
                value={queryType}
                onChange={(e) => setQueryType(e.target.value as QueryType)}
                options={[
                  { value: 'natal', label: '本命（一生格局）' },
                  { value: 'yearly', label: '流年（指定年份運勢）' },
                  { value: 'monthly', label: '流月（指定月份運勢）' },
                  { value: 'daily', label: '流日（指定日期運勢）' },
                ]}
              />

              {/* Date Selector for Flow Types */}
              {queryType === 'yearly' && (
                <div>
                  <label className="block text-sm text-foreground-secondary mb-2">選擇年份</label>
                  <Select
                    value={queryDate}
                    onChange={(e) => setQueryDate(e.target.value)}
                    options={Array.from({ length: 100 }, (_, i) => {
                      const year = new Date().getFullYear() - 50 + i;
                      return { value: `${year}-01-01`, label: `${year} 年` };
                    })}
                  />
                </div>
              )}

              {queryType === 'monthly' && (
                <div>
                  <label className="block text-sm text-foreground-secondary mb-2">選擇月份</label>
                  <input
                    type="month"
                    value={queryDate.slice(0, 7)}
                    onChange={(e) => setQueryDate(e.target.value + '-01')}
                    className="w-full px-4 py-3 rounded-lg bg-background-card border border-border text-foreground-primary focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                  />
                </div>
              )}

              {queryType === 'daily' && (
                <div>
                  <label className="block text-sm text-foreground-secondary mb-2">選擇日期</label>
                  <input
                    type="date"
                    value={queryDate.slice(0, 10)}
                    onChange={(e) => setQueryDate(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg bg-background-card border border-border text-foreground-primary focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                  />
                </div>
              )}

              {/* Question Input */}
              <div>
                <label className="block text-sm text-foreground-secondary mb-2">請輸入您的問題</label>
                <textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-background-card border border-border text-foreground-primary placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent h-24 resize-none"
                  placeholder="例如：我的事業運勢如何？財運如何？"
                  maxLength={500}
                />
                <p className="text-right text-xs text-foreground-muted mt-1">{question.length}/500</p>
              </div>

              {error && (
                <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 text-red-400 text-sm">
                  {error}
                </div>
              )}

              <div className="flex gap-4">
                <Button variant="outline" onClick={() => setStep('input')}>
                  ← 修改資料
                </Button>
                <Button
                  variant="gold"
                  fullWidth
                  onClick={handleSubmitQuery}
                  disabled={isProcessing || !question.trim() || !activeAI}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="animate-spin mr-2" size={20} />
                      解盤中...
                    </>
                  ) : (
                    <>
                      <Send size={20} className="mr-2" />
                      請 AI 解盤
                    </>
                  )}
                </Button>
              </div>

              {!activeAI && (
                <p className="text-center text-sm text-amber-400">
                  請先到<Link href="/settings" className="underline hover:text-accent">設定頁面</Link>配置 AI 服務
                </p>
              )}
            </div>
          </Card>
        </main>
      )}

      {/* ===== Result Phase ===== */}
      {step === 'result' && (
        <main className="w-full max-w-4xl mx-auto px-4 py-6">
          <Card variant="glass" className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-accent flex items-center gap-2">
                <span className="text-2xl">🌟</span>
                AI 解盤結果
              </h2>
              {interpretation && !isProcessing && (
                <div className="flex items-center gap-2">
                  <Button
                    onClick={handleShare}
                    disabled={sharingState === 'loading'}
                    variant="ghost"
                    size="sm"
                    className={`gap-2 ${sharingState === 'success' ? 'bg-green-600 text-white' : ''}`}
                  >
                    {sharingState === 'loading' ? <Loader2 size={16} className="animate-spin" /> : sharingState === 'success' ? <><Check size={16} />已複製</> : <><Share2 size={16} />分享</>}
                  </Button>
                  <Button onClick={handleCopy} variant="ghost" size="sm" className="gap-2">
                    <Copy size={16} />
                    複製
                  </Button>
                </div>
              )}
            </div>

            {isProcessing ? (
              <div className="text-center py-12">
                <Loader2 className="animate-spin mx-auto mb-4 text-accent" size={40} />
                <p className="text-foreground-secondary">AI 解盤中，請耐心等待</p>
                <div className="mt-4 text-2xl font-mono text-accent">
                  {Math.floor(waitingTime / 60).toString().padStart(2, '0')}:{(waitingTime % 60).toString().padStart(2, '0')}
                </div>
                <div className="w-full max-w-xs mx-auto mt-4 bg-foreground-muted/20 rounded-full h-2 overflow-hidden">
                  <div className="h-full bg-accent transition-all duration-1000 ease-linear" style={{ width: `${Math.min(aiProgress, 100)}%` }} />
                </div>
                <p className="text-foreground-muted text-sm mt-3">
                  {activeAI?.provider === 'local' ? '本地 AI 解盤最久可能需要 2~3 分鐘' : '雲端 AI 解盤最久約需 1 分鐘'}
                </p>
                <Button onClick={handleCancel} disabled={isCancelling} variant="outline" className="mt-6 border-red-500/50 text-red-400 hover:bg-red-500/10">
                  {isCancelling ? <><Loader2 className="animate-spin mr-2" size={16} />取消中...</> : <><X size={16} className="mr-2" />取消占卜</>}
                </Button>
              </div>
            ) : interpretation ? (
              <div className="space-y-4">
                <MarkdownRenderer content={interpretation} />
              </div>
            ) : (
              <p className="text-red-400">{error || '等待結果...'}</p>
            )}

            <div className="flex gap-4 mt-6">
              <Button variant="outline" onClick={() => setStep('chart')}>
                ← 返回命盤
              </Button>
              <Button variant="gold" fullWidth onClick={() => router.push('/history')}>
                查看歷史紀錄
              </Button>
            </div>
          </Card>
        </main>
      )}
    </div>
  );
}
