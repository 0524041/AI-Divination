'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { AISelector, AIConfig } from '@/components/features/AISelector';
import { MarkdownRenderer } from '@/components/features/MarkdownRenderer';
import { ZiweiChart } from '@/components/ziwei/ZiweiChart';
import { apiGet, apiPost, apiDelete } from '@/lib/api-client';
import { TAIWAN_CITIES, TaiwanCity } from '@/lib/taiwan-cities';
import { Lunar, Solar } from 'lunar-javascript';
import {
  generateNatalChart,
  generateHoroscope,
  getChineseTimeIndex,
  calculateTrueSolarTime,
  getChineseHourName,
  Gender
} from '@/lib/astro';
import {
  Compass,
  Send,
  Loader2,
  Copy,
  Share2,
  Check,
  X,
  User,
  Save,
  Calendar,
  MapPin,
  Users,
} from 'lucide-react';

type Step = 'intro' | 'input' | 'chart' | 'result';
type QueryType = 'natal' | 'yearly' | 'monthly' | 'daily';
type DateType = 'solar' | 'lunar';

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
  natalChart: any;
  solarTimeIndex: number;
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

const formatBazi = (baziStr?: string) => {
  if (!baziStr) return '';
  const parts = baziStr.split(' ');
  if (parts.length !== 4) return baziStr;
  return `干支︰${parts[0]}年 ${parts[1]}月 ${parts[2]}日 ${parts[3]}時`;
};

export default function ZiweiPage() {
  const router = useRouter();
  const { isGuest } = useAuth();
  const [step, setStep] = useState<Step>('intro');

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
  const [viewMode, setViewMode] = useState<QueryType>('natal');
  const [dateType, setDateType] = useState<DateType>('solar');
  const [queryDate, setQueryDate] = useState(new Date().toISOString().slice(0, 10)); // Always Solar Date string YYYY-MM-DD
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

  // Display Chart Calculation
  const displayChart = useMemo(() => {
    if (!chartData?.natalChart) return null;
    if (viewMode === 'natal') return chartData.natalChart;

    try {
      return generateHoroscope(chartData.natalChart, queryDate, chartData.solarTimeIndex);
    } catch (e) {
      console.error('Error generating horoscope:', e);
      return chartData.natalChart;
    }
  }, [chartData, viewMode, queryDate]);

  // Lunar Date State (Derived from queryDate when in Lunar mode)
  const currentLunarDate = useMemo(() => {
    const d = new Date(queryDate);
    return Lunar.fromDate(d);
  }, [queryDate]);

  // Handle Lunar Date Inputs
  const handleLunarChange = (type: 'year' | 'month' | 'day', value: number) => {
    const y = type === 'year' ? value : currentLunarDate.getYear();
    const m = type === 'month' ? value : currentLunarDate.getMonth();
    const d = type === 'day' ? value : currentLunarDate.getDay();

    // Create new lunar date and convert to solar
    // Note: handling leap months is complex, here we default to non-leap or first month
    try {
      const lunar = Lunar.fromYmd(y, m, d);
      const solar = lunar.getSolar();
      setQueryDate(solar.toString());
    } catch (e) {
      console.error('Invalid Lunar Date', e);
    }
  };

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
      const dateStr = data.birth_date.endsWith('Z') ? data.birth_date : `${data.birth_date}Z`;
      const date = new Date(dateStr);
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
    } catch {
      alert('刪除失敗');
    }
  };

  const handleCalculateChart = async () => {
    if (!birthData.name.trim()) {
      setError('請輸入姓名');
      return;
    }

    setError('');
    setIsProcessing(true);

    try {
      const dateObj = new Date(birthData.birth_date);

      // Calculate True Solar Time
      const city = (birthData.birth_location || '台北市') as TaiwanCity;
      const {
        solarTime,
        offsetMinutes,
      } = calculateTrueSolarTime(dateObj, city);

      // Determine indices
      const originalHour = dateObj.getHours();
      const originalTimeIndex = getChineseTimeIndex(originalHour);

      const solarHour = solarTime.getHours();
      const solarTimeIndex = getChineseTimeIndex(solarHour);

      const solarHourChar = getChineseHourName(solarTimeIndex);
      const originalHourChar = getChineseHourName(originalTimeIndex);

      // Generate Correction Note
      let correctionNote = '';
      if (originalTimeIndex !== solarTimeIndex) {
        const offsetInt = Math.round(offsetMinutes);
        const sign = offsetInt >= 0 ? '+' : '';
        correctionNote = `經真太陽時校正：時辰由【${originalHourChar}】變更為【${solarHourChar}】（調整 ${sign}${offsetInt} 分）`;
        // Inject original hour for display
        (solarTime as any).originalHourChar = originalHourChar;
        (solarTime as any).finalHourChar = solarHourChar;
      }

      // Generate Chart using Solar Date/Time
      const year = solarTime.getFullYear();
      const month = solarTime.getMonth() + 1;
      const day = solarTime.getDate();
      const solarDateStr = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;

      const chart = generateNatalChart(
        solarDateStr,
        solarTimeIndex,
        birthData.gender as Gender
      );

      // Inject metadata for UI
      (chart as any).correctionNote = correctionNote;
      (chart as any).timeChar = solarHourChar;
      (chart as any).trueSolarTimeObj = solarTime; // Save for display

      setChartData({
        natalChart: chart,
        solarTimeIndex: solarTimeIndex,
      });
      // Reset view to natal on new calculation
      setViewMode('natal');
      setStep('chart');

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

  const handleSaveBirthData = async () => {
    if (!birthData.name.trim()) {
      setError('請輸入姓名');
      return;
    }
    setError('');
    setIsProcessing(true);

    try {
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
        await loadSavedBirthData();
        setSelectedBirthDataId(savedData.id);
        alert('儲存成功！');
      } else {
        alert('儲存失敗');
      }
    } catch {
      alert('儲存失敗');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSubmitQuery = async () => {
    if (!question.trim()) {
      setError('請輸入問題');
      return;
    }
    if (!isGuest && !activeAI) {
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
      // We send the *currently displayed chart* (which could be yearly/monthly) as context
      const chartContext = JSON.stringify(displayChart, (key, value) => {
        if (key === 'astrolabe') return undefined; // avoid circular ref
        return value;
      });

      const res = await apiPost('/api/ziwei', {
        birth_data_id: selectedBirthDataId,
        name: birthData.name,
        gender: birthData.gender,
        birth_date: new Date(birthData.birth_date).toISOString(),
        birth_location: birthData.birth_location,
        is_twin: birthData.is_twin,
        twin_order: birthData.is_twin ? birthData.twin_order : null,
        query_type: viewMode, // Use current view mode
        // Fix: Use Noon time to avoid date shifting due to timezone conversion
        // Appending 'T12:00:00' makes it Local Noon. toISOString() converts to UTC.
        // Noon is safe for all timezones (UTC-12 to UTC+12) to stay on the same day.
        query_date: viewMode !== 'natal' ? new Date(`${queryDate}T12:00:00`).toISOString() : null,
        question,
        chart_data: chartData?.natalChart, // Store Natal chart
        prompt_context: chartContext,      // AI uses the flow chart
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
    if (!chartData?.natalChart) return null;
    return {
      name: birthData.name,
      gender: birthData.gender,
      birthDate: birthData.birth_date.replace('T', ' '),
      location: birthData.birth_location,
      isTwin: birthData.is_twin,
      twinOrder: birthData.twin_order,
    };
  }, [chartData, birthData]);

  // Context Label for AI Question
  const contextLabel = useMemo(() => {
    if (viewMode === 'natal') return '本命（一生運勢）';
    const d = new Date(queryDate);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const day = d.getDate();
    if (viewMode === 'yearly') return `流年運勢（${y}年）`;
    if (viewMode === 'monthly') return `流月運勢（${y}年${m}月）`;
    if (viewMode === 'daily') return `流日運勢（${y}年${m}月${day}日）`;
    return '本命';
  }, [viewMode, queryDate]);

  // Generate True Solar Time formatted string
  const trueSolarTimeString = useMemo(() => {
    if (!chartData?.natalChart) return '';
    const tst = (chartData.natalChart as any).trueSolarTimeObj as Date;
    if (!tst) return '';

    try {
      const lunar = Lunar.fromDate(tst);
      // Format: 農曆:XXXX/XX/XX XX:XX分 X時(時辰)
      // lunar.getYearInChinese() returns e.g. "二零二五"
      // We want simple format maybe? Or traditional. User example: "農曆:XXXX/XX/XX XX:XX分 X時(時辰)"
      // Let's use numeric year for clarity or Chinese if requested.
      // User Example: "農曆:XXXX/XX/XX XX:XX分 X時(時辰)"

      const y = lunar.getYear();
      const m = lunar.getMonth();
      const d = lunar.getDay();

      // Get Time
      const h = tst.getHours();
      const min = tst.getMinutes();

      const timeIndex = getChineseTimeIndex(h);
      const timeChar = getChineseHourName(timeIndex);

      let timeDisplay = `${timeChar}時(${timeChar})`;

      if ((tst as any).originalHourChar && (tst as any).finalHourChar) {
        timeDisplay = `${timeChar}時 (${(tst as any).originalHourChar}時 -> ${(tst as any).finalHourChar}時)`;
      }

      return `農曆:${y}/${m.toString().padStart(2, '0')}/${d.toString().padStart(2, '0')} ${h.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}分 ${timeDisplay}`;
    } catch (e) {
      return '';
    }
  }, [chartData]);


  return (
    <div className="min-h-screen flex flex-col">


      {/* ===== Intro Phase ===== */}
      {step === 'intro' && (
        <div className="flex flex-col items-center text-center space-y-8 animate-in fade-in zoom-in-95 duration-700 py-12 px-4 min-h-[60vh] justify-center">
          <div className="w-48 h-48 relative mb-6 flex items-center justify-center group cursor-pointer" onClick={() => setStep('input')}>
            <div className="absolute inset-0 bg-accent/5 rounded-full border border-accent/20 animate-spin-slow group-hover:bg-accent/10 transition-colors"></div>
            <div className="absolute inset-4 bg-background-card/80 backdrop-blur-sm rounded-full border border-white/10 dark:border-white/5 flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform duration-500">
              <span className="text-8xl select-none group-hover:scale-110 transition-transform duration-300 transform origin-center">🌟</span>
            </div>
          </div>

          <div className="space-y-6 max-w-2xl">
            <h2 className="text-4xl font-heading font-medium text-foreground-primary tracking-tight">探索命運的星圖</h2>
            <p className="text-foreground-secondary text-lg leading-relaxed font-light">
              紫微斗數是中國古代占星術的精髓，<br className="hidden sm:block" />
              透過出生時間排列星盤，洞悉命運軌跡與流年運勢。
            </p>
            <p className="text-accent text-sm font-medium tracking-widest uppercase opacity-80">
              知命造命 • 順勢而為
            </p>
          </div>

          <Button
            onClick={() => setStep('input')}
            variant="gold"
            size="lg"
            className="px-12 py-8 text-xl rounded-full shadow-xl shadow-gold/20 hover:shadow-gold/40 hover:scale-105 transition-all duration-300"
          >
            <Compass size={24} className="mr-3" />
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

            {savedBirthDataList.length > 0 && (
              <div className="mb-6">
                <label htmlFor="saved-birth-data" className="block text-sm text-foreground-secondary mb-2">選擇已儲存的生辰八字</label>
                <Select
                  id="saved-birth-data"
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
              <Input
                label="姓名"
                value={birthData.name}
                onChange={(e) => setBirthData({ ...birthData, name: e.target.value })}
                placeholder="請輸入姓名"
                required
              />

              <div>
                <span className="block text-sm text-foreground-secondary mb-2">性別</span>
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

              <Input
                label="出生日期時間（國曆）"
                type="datetime-local"
                value={birthData.birth_date}
                onChange={(e) => setBirthData({ ...birthData, birth_date: e.target.value })}
                required
              />

              <div>
                <label htmlFor="birth-location" className="block text-sm text-foreground-secondary mb-2">
                  <MapPin size={14} className="inline mr-1" />
                  出生地（用於真太陽時校正）
                </label>
                <Select
                  id="birth-location"
                  value={birthData.birth_location}
                  onChange={(e) => setBirthData({ ...birthData, birth_location: e.target.value })}
                  options={TAIWAN_CITIES.map(city => ({ value: city, label: city }))}
                />
              </div>

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

            <div className="flex flex-col sm:flex-row gap-4 mt-6">
              <Button variant="outline" onClick={() => setStep('intro')} className="w-full sm:w-auto">
                ← 返回
              </Button>
              <div className="flex-1 flex gap-4">
                <Button
                  variant="outline"
                  className="flex-1 border-amber-500/50 text-amber-500 hover:bg-amber-500/10"
                  onClick={handleSaveBirthData}
                  disabled={isProcessing}
                >
                  <Save size={20} className="mr-2" />
                  儲存目前設定
                </Button>
                <Button
                  variant="gold"
                  className="flex-[2]"
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
                      立即排盤
                    </>
                  )}
                </Button>
              </div>
            </div>
          </Card>
        </main>
      )}

      {/* ===== Chart Phase ===== */}
      {step === 'chart' && chartData && displayChart && (
        <main className="w-full max-w-6xl mx-auto px-4 py-6 space-y-6">
          {/* Top Control Bar for View Mode */}
          <Card variant="glass" className="p-4 flex flex-col md:flex-row gap-4 items-center justify-between sticky top-[60px] z-30 shadow-md">
            <div className="flex gap-4 items-center flex-wrap justify-center w-full md:justify-start">
              {/* View Mode Tabs */}
              <div className="flex bg-background-card rounded-lg p-1">
                {(['natal', 'yearly', 'monthly', 'daily'] as QueryType[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setViewMode(mode)}
                    className={`
                       px-4 py-2 rounded-md text-sm font-bold transition-all
                       ${viewMode === mode
                        ? 'bg-accent text-white shadow-sm'
                        : 'text-foreground-secondary hover:text-foreground-primary hover:bg-white/10'}
                     `}
                  >
                    {mode === 'natal' && '本命'}
                    {mode === 'yearly' && '流年'}
                    {mode === 'monthly' && '流月'}
                    {mode === 'daily' && '流日'}
                  </button>
                ))}
              </div>

              {/* Date Type Selector */}
              {viewMode !== 'natal' && (
                <div className="flex bg-background-card rounded-lg p-1 text-xs">
                  <button
                    onClick={() => setDateType('solar')}
                    className={`px-2 py-1.5 rounded ${dateType === 'solar' ? 'bg-amber-600 text-white' : 'text-gray-400'}`}
                  >
                    陽曆
                  </button>
                  <button
                    onClick={() => setDateType('lunar')}
                    className={`px-2 py-1.5 rounded ${dateType === 'lunar' ? 'bg-amber-600 text-white' : 'text-gray-400'}`}
                  >
                    農曆
                  </button>
                </div>
              )}

              {/* Date Picker */}
              <div className="flex gap-2 items-center">
                {viewMode === 'yearly' && (
                  dateType === 'solar' ? (
                    <div className="flex gap-1">
                      <Select
                        value={queryDate.slice(0, 4)}
                        onChange={(e) => setQueryDate(`${e.target.value}-01-01`)}
                        options={Array.from({ length: 100 }, (_, i) => {
                          const year = new Date().getFullYear() - 50 + i;
                          return { value: year.toString(), label: `${year} 年` };
                        })}
                        className="w-24 py-1.5 text-sm"
                      />
                      <Select
                        value="1"
                        disabled={true}
                        options={[{ value: '1', label: '1月' }]}
                        className="w-20 py-1.5 text-sm opacity-50"
                      />
                      <Select
                        value="1"
                        disabled={true}
                        options={[{ value: '1', label: '1日' }]}
                        className="w-20 py-1.5 text-sm opacity-50"
                      />
                    </div>
                  ) : (
                    <div className="flex gap-1">
                      <Select
                        value={currentLunarDate.getYear().toString()}
                        onChange={(e) => handleLunarChange('year', parseInt(e.target.value))}
                        options={Array.from({ length: 100 }, (_, i) => {
                          const year = new Date().getFullYear() - 50 + i;
                          return { value: year.toString(), label: `${year} 年` };
                        })}
                        className="w-24 py-1.5 text-sm"
                      />
                      <Select
                        value="1"
                        disabled={true}
                        options={[{ value: '1', label: '1月' }]}
                        className="w-20 py-1.5 text-sm opacity-50"
                      />
                      <Select
                        value="1"
                        disabled={true}
                        options={[{ value: '1', label: '1日' }]}
                        className="w-20 py-1.5 text-sm opacity-50"
                      />
                    </div>
                  )
                )}
                {viewMode === 'monthly' && (
                  dateType === 'solar' ? (
                    <div className="flex gap-1">
                      <Select
                        value={queryDate.slice(0, 4)}
                        onChange={(e) => setQueryDate(`${e.target.value}-${queryDate.slice(5, 7)}-01`)}
                        options={Array.from({ length: 50 }, (_, i) => {
                          const year = new Date().getFullYear() - 25 + i;
                          return { value: year.toString(), label: `${year}年` };
                        })}
                        className="w-24 py-1.5 text-sm"
                      />
                      <Select
                        value={parseInt(queryDate.slice(5, 7)).toString()}
                        onChange={(e) => setQueryDate(`${queryDate.slice(0, 4)}-${e.target.value.padStart(2, '0')}-01`)}
                        options={Array.from({ length: 12 }, (_, i) => ({ value: (i + 1).toString(), label: `${i + 1}月` }))}
                        className="w-20 py-1.5 text-sm"
                      />
                      <Select
                        value="1"
                        disabled={true}
                        options={[{ value: '1', label: '1日' }]}
                        className="w-20 py-1.5 text-sm opacity-50"
                      />
                    </div>
                  ) : (
                    <div className="flex gap-1">
                      <Select
                        value={currentLunarDate.getYear().toString()}
                        onChange={(e) => handleLunarChange('year', parseInt(e.target.value))}
                        options={Array.from({ length: 50 }, (_, i) => {
                          const year = new Date().getFullYear() - 25 + i;
                          return { value: year.toString(), label: `${year}年` };
                        })}
                        className="w-24 py-1.5 text-sm"
                      />
                      <Select
                        value={currentLunarDate.getMonth().toString()}
                        onChange={(e) => handleLunarChange('month', parseInt(e.target.value))}
                        options={Array.from({ length: 12 }, (_, i) => ({ value: (i + 1).toString(), label: `${i + 1}月` }))}
                        className="w-20 py-1.5 text-sm"
                      />
                      <Select
                        value="1"
                        disabled={true}
                        options={[{ value: '1', label: '1日' }]}
                        className="w-20 py-1.5 text-sm opacity-50"
                      />
                    </div>
                  )
                )}
                {viewMode === 'daily' && (
                  dateType === 'solar' ? (
                    <div className="flex gap-1">
                      <Select
                        value={queryDate.slice(0, 4)}
                        onChange={(e) => setQueryDate(`${e.target.value}-${queryDate.slice(5, 7)}-${queryDate.slice(8, 10)}`)}
                        options={Array.from({ length: 50 }, (_, i) => {
                          const year = new Date().getFullYear() - 25 + i;
                          return { value: year.toString(), label: `${year}年` };
                        })}
                        className="w-24 py-1.5 text-sm"
                      />
                      <Select
                        value={parseInt(queryDate.slice(5, 7)).toString()}
                        onChange={(e) => setQueryDate(`${queryDate.slice(0, 4)}-${e.target.value.padStart(2, '0')}-${queryDate.slice(8, 10)}`)}
                        options={Array.from({ length: 12 }, (_, i) => ({ value: (i + 1).toString(), label: `${i + 1}月` }))}
                        className="w-20 py-1.5 text-sm"
                      />
                      <Select
                        value={parseInt(queryDate.slice(8, 10)).toString()}
                        onChange={(e) => setQueryDate(`${queryDate.slice(0, 4)}-${queryDate.slice(5, 7)}-${e.target.value.padStart(2, '0')}`)}
                        options={Array.from({ length: 31 }, (_, i) => ({ value: (i + 1).toString(), label: `${i + 1}日` }))}
                        className="w-20 py-1.5 text-sm"
                      />
                    </div>
                  ) : (
                    <div className="flex gap-1">
                      <Select
                        value={currentLunarDate.getYear().toString()}
                        onChange={(e) => handleLunarChange('year', parseInt(e.target.value))}
                        options={Array.from({ length: 50 }, (_, i) => {
                          const year = new Date().getFullYear() - 25 + i;
                          return { value: year.toString(), label: `${year}年` };
                        })}
                        className="w-24 py-1.5 text-sm"
                      />
                      <Select
                        value={currentLunarDate.getMonth().toString()}
                        onChange={(e) => handleLunarChange('month', parseInt(e.target.value))}
                        options={Array.from({ length: 12 }, (_, i) => ({ value: (i + 1).toString(), label: `${i + 1}月` }))}
                        className="w-20 py-1.5 text-sm"
                      />
                      <Select
                        value={currentLunarDate.getDay().toString()}
                        onChange={(e) => handleLunarChange('day', parseInt(e.target.value))}
                        options={Array.from({ length: 30 }, (_, i) => ({ value: (i + 1).toString(), label: `${i + 1}日` }))}
                        className="w-20 py-1.5 text-sm"
                      />
                    </div>
                  )
                )}
              </div>

              {/* Lunar/Solar Info Display */}
              <div className="text-xs text-foreground-muted flex flex-col md:flex-row gap-2 md:gap-4 md:ml-auto items-center">
                {displayChart && (
                  <>
                    <span>
                      <span className="opacity-70">真太陽時：</span>
                      {trueSolarTimeString}
                    </span>
                  </>
                )}
              </div>
            </div>
          </Card>

          <ZiweiChart
            chart={displayChart}
            viewMode={viewMode}
            centerInfo={{
              name: birthData.name,
              gender: birthData.gender,
              fiveElements: displayChart.fiveElementsClass,
              birthDate: birthData.birth_date.replace('T', ' '),
              solarDate: displayChart.solarDate,
              lunarDate: displayChart.lunarDate.toString(),
              bazi: formatBazi(chartData.natalChart.chineseDate),
              lunarInfo: {
                description: `${displayChart.lunarDate.toString()} ${displayChart.timeChar || (chartData.natalChart as any).timeChar || ''}時`,
              },
              correctionNote: (chartData.natalChart as any).correctionNote,
            }}
          />

          <Card variant="glass" className="p-6">
            <h3 className="text-xl font-bold text-accent mb-4">AI 解盤</h3>

            <AISelector
              onConfigChange={(config) => setActiveAI(config)}
              showWarning={true}
              warningMessage="使用其他 AI 服務時，解盤最長可能需要等待 5 分鐘。建議使用 Google Gemini 以獲得更快的回應速度。"
            />

            <div className="space-y-4 mt-6">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                  <label htmlFor="question-input" className="block text-sm text-foreground-secondary mb-2">請輸入您的問題</label>
                  <textarea
                    id="question-input"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg bg-background-card border border-border text-foreground-primary placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent h-24 resize-none"
                    placeholder={`請針對「${contextLabel}」提問...`}
                    maxLength={500}
                  />
                  <div className="absolute top-9 right-3 text-xs bg-accent/20 text-accent px-2 py-1 rounded">
                    {contextLabel}
                  </div>
                </div>
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
                  onClick={handleSubmitQuery}
                  disabled={isProcessing || !question.trim() || (!isGuest && !activeAI)}
                  className="flex-1"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="animate-spin mr-2" size={20} />
                      請 AI 解盤
                    </>
                  ) : (
                    <>
                      <Send size={20} className="mr-2" />
                      請 AI 解盤
                    </>
                  )}
                </Button>
              </div>

              {!isGuest && !activeAI && (
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
                {/* 顯示完整命盤（可折疊） */}
                {chartData && displayChart && (
                  <details className="bg-foreground-muted/5 rounded-lg border border-border">
                    <summary className="px-4 py-3 cursor-pointer text-foreground-muted hover:text-accent flex items-center gap-2">
                      <span className="text-lg">☯</span>
                      <span>完整卦象盤面（點擊展開）</span>
                    </summary>
                    <div className="px-4 pb-4 border-t border-border pt-3">
                      <div className="overflow-x-auto">
                        <div className="min-w-[350px] transform scale-[0.8] origin-top-left md:scale-100 md:origin-top">
                          <ZiweiChart
                            chart={displayChart}
                            viewMode={viewMode}
                            centerInfo={{
                              name: birthData.name,
                              gender: birthData.gender,
                              fiveElements: displayChart.fiveElementsClass,
                              birthDate: birthData.birth_date.replace('T', ' '),
                              solarDate: displayChart.solarDate,
                              lunarDate: displayChart.lunarDate.toString(),
                              bazi: formatBazi(chartData.natalChart.chineseDate),
                              lunarInfo: {
                                description: `${displayChart.lunarDate.toString()} ${displayChart.timeChar || (chartData.natalChart as any).timeChar || ''}時`,
                              },
                              correctionNote: (chartData.natalChart as any).correctionNote,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </details>
                )}

                <MarkdownRenderer content={interpretation} />
              </div>
            ) : (
              <p className="text-red-400">{error || '等待結果...'}</p>
            )}

            <div className="mt-8 flex justify-center">
              <Button variant="outline" onClick={() => setStep('chart')}>
                ← 返回命盤
              </Button>
            </div>
          </Card>
        </main>
      )}
    </div>
  );
}
