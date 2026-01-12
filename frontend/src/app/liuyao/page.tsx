'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import CoinTossing from '@/components/CoinTossing';
import { Navbar } from '@/components/layout/Navbar';
import { AISelector, AIConfig } from '@/components/features/AISelector';
import { apiGet, apiPost } from '@/lib/api-client';
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
} from 'lucide-react';

type Tab = 'divine' | 'intro' | 'tutorial';

interface ChartData {
  yaogua: number[];
  time: string;
  bazi: string;
  kongwang: string;
  guashen: string;
  benguaming: string;
  bianguaming: string;
  gua_type: string;
  formatted: string;
  [key: string]: unknown;
}

interface DivinationResult {
  id: number;
  status: string;
  coins: number[];
  chart_data: ChartData;
}

// 最大等待時間常數
const MAX_WAIT_GEMINI = 60 * 1000; // 1 分鐘
const MAX_WAIT_LOCAL = 180 * 1000; // 3 分鐘
const AI_TIMEOUT = 5 * 60 * 1000; // 5 分鐘超時

export default function LiuYaoPage() {
  const router = useRouter();
  const [step, setStep] = useState<'intro' | 'divine'>('intro');
  const [activeTab, setActiveTab] = useState<Tab>('divine');
  const [question, setQuestion] = useState('');
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [target, setTarget] = useState<'self' | 'parent' | 'friend' | 'other'>('self');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DivinationResult | null>(null);
  const [interpretation, setInterpretation] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [error, setError] = useState('');
  const [waitingTime, setWaitingTime] = useState(0);
  const [isCancelling, setIsCancelling] = useState(false);

  // 擲幣相關狀態
  const [isTossing, setIsTossing] = useState(false);
  const [divinationStartTime, setDivinationStartTime] = useState(0); // 按下開始擲幣的時間
  const [resultPageStartTime, setResultPageStartTime] = useState(0); // 回到結果頁面的時間
  const [aiProgress, setAiProgress] = useState(0);

  // AI 設定相關
  const [activeAI, setActiveAI] = useState<AIConfig | null>(null);

  // 分享狀態
  const [sharingState, setSharingState] = useState<'idle' | 'loading' | 'success'>('idle');

  // 控制器用於取消請求
  const abortControllerRef = useRef<AbortController | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const waitingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 檢查登入
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }
  }, [router]);

  // 清理計時器
  const clearAllTimers = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (waitingTimerRef.current) {
      clearInterval(waitingTimerRef.current);
      waitingTimerRef.current = null;
    }
  };

  // 組件卸載時清理
  useEffect(() => {
    return () => {
      clearAllTimers();
    };
  }, []);

  // 輪詢結果 - 修復依賴問題
  useEffect(() => {
    // 只有當顯示結果頁面且還沒有解讀結果時才開始輪詢
    if (!result || interpretation || !showResult) return;

    const maxWait = activeAI?.provider === 'local' ? MAX_WAIT_LOCAL : MAX_WAIT_GEMINI;
    const pollStartTime = Date.now();

    // 每秒更新等待時間和進度條
    waitingTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - (resultPageStartTime || pollStartTime);
      const elapsedSeconds = Math.floor(elapsed / 1000);
      setWaitingTime(elapsedSeconds);

      // 計算進度百分比（基於從按下開始擲幣開始的時間）
      const totalElapsed = Date.now() - (divinationStartTime || pollStartTime);
      const progressPercent = Math.min(100, (totalElapsed / maxWait) * 100);
      setAiProgress(progressPercent);
    }, 1000);

    const pollResult = async () => {
      // 超時檢查
      if (Date.now() - (divinationStartTime || pollStartTime) > AI_TIMEOUT) {
        clearAllTimers();
        setInterpretation('AI 解盤超時，請稍後在歷史紀錄中查看結果');
        return;
      }

      try {
        const res = await apiGet(`/api/history/${result.id}`);

        if (res.ok) {
          const data = await res.json();
          if (data.status === 'completed' && data.interpretation) {
            clearAllTimers();
            setInterpretation(data.interpretation);
          } else if (data.status === 'error') {
            clearAllTimers();
            setInterpretation(data.interpretation || '解盤發生錯誤');
          } else if (data.status === 'cancelled') {
            clearAllTimers();
            setInterpretation('占卜已取消');
          }
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    };

    // 每 2 秒輪詢一次，更快檢測結果
    pollIntervalRef.current = setInterval(pollResult, 2000);
    pollResult(); // 立即執行一次

    return () => {
      clearAllTimers();
    };
  }, [result, interpretation, showResult, activeAI, divinationStartTime, resultPageStartTime]);

  const finishTossing = () => {
    setIsTossing(false);
    setShowResult(true);
    setResultPageStartTime(Date.now()); // 記錄回到結果頁面的時間
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;

    console.log('[LiuYao] handleSubmit started', { question, gender, target });

    setError('');
    setLoading(true);
    setResult(null);
    setInterpretation(null);
    setWaitingTime(0);

    // 擲幣初始化
    setIsTossing(true);
    setDivinationStartTime(Date.now()); // 記錄開始時間
    setAiProgress(0);

    // 建立新的 AbortController
    abortControllerRef.current = new AbortController();

    try {
      console.log('[LiuYao] Sending request to /api/liuyao');
      const res = await apiPost('/api/liuyao', { question, gender, target });
      console.log('[LiuYao] Response received', { status: res.status, statusText: res.statusText });

      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const textBody = await res.text();
        console.error('[LiuYao] Non-JSON response received:', textBody.substring(0, 200));
        throw new Error(`伺服器回應格式錯誤 (Status: ${res.status}): ${textBody.substring(0, 50)}...`);
      }

      const data = await res.json();

      if (res.ok) {
        console.log('[LiuYao] Request successful', data);
        setResult(data);
        // 注意：這裡不設定 setShowResult(true)，因為要先顯示擲幣動畫
      } else {
        console.warn('[LiuYao] Request failed with logic error', data);
        setError(data.detail || '占卜失敗');
        setIsTossing(false);
      }
    } catch (err: unknown) {
      console.error('[LiuYao] Caught error in handleSubmit:', err);

      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          setError('占卜已取消');
        } else {
          // 顯示更詳細的錯誤資訊
          setError(`連線錯誤: ${err.message}`);
        }
      } else {
        setError('發生未知錯誤');
      }
      setIsTossing(false);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!result) return;

    setIsCancelling(true);

    // 取消輪詢
    clearAllTimers();

    // 取消後端處理
    try {
      await apiPost(`/api/liuyao/${result.id}/cancel`);
    } catch (err) {
      console.error('Cancel error:', err);
    }

    setIsCancelling(false);
    setShowResult(false);
    setResult(null);
  };

  const handleCopy = async () => {
    if (!result) {
      alert('沒有可複製的內容');
      return;
    }

    // 準備 Markdown 格式文本
    const markdownText = `## 問題\n${question}\n\n## 卦象\n${result.chart_data.benguaming} → ${result.chart_data.bianguaming}\n\n## 解盤\n${interpretation || '無'}`;

    // 優先使用 execCommand（相容性最好）
    const fallbackCopy = () => {
      const textArea = document.createElement('textarea');
      textArea.value = markdownText;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();

      try {
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        return successful;
      } catch (err) {
        document.body.removeChild(textArea);
        return false;
      }
    };

    // 嘗試使用 Clipboard API
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(markdownText);
        alert('已複製到剪貼簿');
        return;
      } catch (err) {
        // Clipboard API 失敗，嘗試 fallback
        console.warn('Clipboard API 失敗，嘗試 fallback:', err);
      }
    }

    // Fallback 方法
    if (fallbackCopy()) {
      alert('已複製到剪貼簿');
    } else {
      alert('複製失敗，請手動複製內容');
    }
  };

  const handleShare = async () => {
    if (!result) {
      alert('沒有可分享的內容');
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) return;

    setSharingState('loading');

    // Safari 修復：使用 ClipboardItem + Promise 方式
    // 關鍵：navigator.clipboard.write() 必須在用戶手勢上下文中同步呼叫
    // 但可以傳入一個 Promise 給 ClipboardItem，讓 async 操作在 Promise 內執行

    const getShareUrl = async (): Promise<string> => {
      const res = await apiPost('/api/share/create', { history_id: result.id });
      if (!res.ok) {
        throw new Error('建立分享連結失敗');
      }
      const data = await res.json();
      return `${window.location.origin}${data.share_url}`;
    };

    try {
      // 檢查是否支援 ClipboardItem（Safari 13.1+, Chrome 66+）
      if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
        const textPromise = getShareUrl().then(url => new Blob([url], { type: 'text/plain' }));
        const clipboardItem = new ClipboardItem({
          'text/plain': textPromise
        });
        await navigator.clipboard.write([clipboardItem]);
        alert('連結已複製到剪貼簿');
        setSharingState('success');
        setTimeout(() => setSharingState('idle'), 3000);
        return;
      }

      // Fallback：傳統方式
      const shareUrl = await getShareUrl();

      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(shareUrl);
          alert('連結已複製到剪貼簿');
          setSharingState('success');
          setTimeout(() => setSharingState('idle'), 3000);
          return;
        } catch (clipboardErr) {
          console.warn('Clipboard API failed:', clipboardErr);
        }
      }

      // 最後手段：顯示連結讓用戶手動複製
      prompt('連結已建立，請手動複製：', shareUrl);
      setSharingState('idle');
    } catch (err) {
      console.error('Share error:', err);
      alert('建立分享連結失敗');
      setSharingState('idle');
    }
  };


  // 解析 Markdown
  const [parsedContent, setParsedContent] = useState<{ mainHtml: string; thinkContent: string }>({ mainHtml: '', thinkContent: '' });
  useEffect(() => {
    if (!interpretation) {
      setParsedContent({ mainHtml: '', thinkContent: '' });
      return;
    }

    const renderMarkdown = async () => {
      try {
        const { parseMarkdown } = await import('@/lib/markdown');
        const result = await parseMarkdown(interpretation);
        setParsedContent(result);
      } catch (err) {
        console.error('Markdown parsing error:', err);
        setParsedContent({ mainHtml: `<p class="text-red-400">解析失敗</p>`, thinkContent: '' });
      }
    };

    renderMarkdown();
  }, [interpretation]);

  // 硬幣結果描述
  const coinDescriptions = useMemo(() => {
    if (!result) return [];
    return result.coins.map((coin) => {
      switch (coin) {
        case 0:
          return { text: '老陽 ⚊→⚋', type: '動' };
        case 1:
          return { text: '少陽 ⚊', type: '靜' };
        case 2:
          return { text: '少陰 ⚋', type: '靜' };
        case 3:
          return { text: '老陰 ⚋→⚊', type: '動' };
        default:
          return { text: '?', type: '?' };
      }
    });
  }, [result]);

  // 格式化等待時間
  const formatWaitingTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* 使用共用 Navbar */}
      <Navbar
        pageTitle="六爻占卜"
        showBackButton
        backHref="/"
      />

      {/* Intro Phase */}
      {step === 'intro' && (
        <div className="flex flex-col items-center text-center space-y-8 fade-in py-12 px-4 min-h-[500px]">
          <div className="w-48 h-48 relative mb-4 flex items-center justify-center">
            <div className="absolute inset-0 bg-background-card/50 rounded-full border-2 border-accent animate-pulse-slow"></div>
            <div className="text-8xl">☯</div>
          </div>

          <div className="space-y-4 max-w-2xl">
            <h2 className="text-3xl font-bold text-accent">探尋易經的智慧</h2>
            <p className="text-foreground-secondary leading-relaxed">
              六爻占卜源於《易經》，透過三次擲幣的變化，
              洞察事物發展的規律與吉凶。
              結合現代 AI 技術，為您提供深入淺出的解讀。
            </p>
            <p className="text-foreground-muted text-sm">
              心誠則靈，請保持內心平靜，專注於您想詢問的問題。
            </p>
          </div>

          <Button 
            onClick={() => setStep('divine')} 
            variant="gold"
            className="px-12 py-6 text-lg"
          >
            <Compass size={20} className="mr-2" />
            開始占卜
          </Button>
        </div>
      )}

      {/* Main Content */}
      {step === 'divine' && (
        <>
          {/* 分頁選項 */}
          <div className="max-w-4xl mx-auto px-4 mt-6">
            <div className="flex gap-2 border-b border-border pb-2">
              <button
                className={`px-4 py-2 rounded-t-lg transition flex items-center ${activeTab === 'divine' ? 'bg-accent/20 text-accent' : 'text-foreground-secondary hover:text-foreground-primary'
                  }`}
                onClick={() => setActiveTab('divine')}
              >
                <Compass size={18} className="mr-2" />
                占卜
              </button>
              <button
                className={`px-4 py-2 rounded-t-lg transition flex items-center ${activeTab === 'intro' ? 'bg-accent/20 text-accent' : 'text-foreground-secondary hover:text-foreground-primary'
                  }`}
                onClick={() => setActiveTab('intro')}
              >
                <BookOpen size={18} className="mr-2" />
                說明
              </button>
              <button
                className={`px-4 py-2 rounded-t-lg transition flex items-center ${activeTab === 'tutorial' ? 'bg-accent/20 text-accent' : 'text-foreground-secondary hover:text-foreground-primary'
                  }`}
                onClick={() => setActiveTab('tutorial')}
              >
                <HelpCircle size={18} className="mr-2" />
                教學
              </button>
            </div>
          </div>

          {/* 內容區 */}
          <main className="w-full max-w-4xl mx-auto px-4 py-6">
            {/* 占卜頁面 */}
            {activeTab === 'divine' && (
              <div className="space-y-6">
                {/* AI 選擇器 */}
                <AISelector
                  onConfigChange={(config) => setActiveAI(config)}
                  showWarning={true}
                  warningMessage="使用其他 AI 服務時，解盤最長可能需要等待 5 分鐘，取決於伺服器性能。建議使用 Google Gemini 以獲得更快的回應速度。"
                />

                <Card variant="glass" className="p-6">
                  <form onSubmit={handleSubmit} className="space-y-6">
                    {/* 性別選擇 */}
                    <div>
                      <label className="block text-sm text-foreground-secondary mb-2">性別</label>
                      <div className="flex gap-4">
                        <Button
                          type="button"
                          variant={gender === 'male' ? 'gold' : 'outline'}
                          className={`flex-1 ${gender === 'male' ? 'bg-accent/20' : ''}`}
                          onClick={() => setGender('male')}
                        >
                          ♂ 男
                        </Button>
                        <Button
                          type="button"
                          variant={gender === 'female' ? 'gold' : 'outline'}
                          className={`flex-1 ${gender === 'female' ? 'bg-accent/20' : ''}`}
                          onClick={() => setGender('female')}
                        >
                          ♀ 女
                        </Button>
                      </div>
                    </div>

                    {/* 對象選擇 */}
                    <div>
                      <label className="block text-sm text-foreground-secondary mb-2">算命對象</label>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {[
                          { value: 'self', label: '自己' },
                          { value: 'parent', label: '父母' },
                          { value: 'friend', label: '朋友' },
                          { value: 'other', label: '對方' },
                        ].map((opt) => (
                          <Button
                            key={opt.value}
                            type="button"
                            variant={target === opt.value ? 'gold' : 'outline'}
                            className={`${target === opt.value ? 'bg-accent/20' : ''}`}
                            onClick={() => setTarget(opt.value as typeof target)}
                          >
                            {opt.label}
                          </Button>
                        ))}
                      </div>
                    </div>

                    {/* 問題輸入 */}
                    <div>
                      <label className="block text-sm text-foreground-secondary mb-2">請輸入您想詢問的問題</label>
                      <textarea
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                        className="w-full px-4 py-3 rounded-lg bg-background-card border border-border text-foreground-primary placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent h-32 resize-none"
                        placeholder="例如：我近期的事業運勢如何？這份工作是否適合我？"
                        maxLength={500}
                      />
                      <p className="text-right text-xs text-foreground-muted mt-1">{question.length}/500</p>
                    </div>

                    {/* 錯誤訊息 */}
                    {error && (
                      <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 text-red-400 text-sm">{error}</div>
                    )}

                    {/* 提交按鈕 */}
                    <Button 
                      type="submit" 
                      variant="gold" 
                      fullWidth 
                      disabled={loading || !question.trim() || !activeAI}
                      className="flex items-center justify-center gap-2"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="animate-spin" size={20} />
                          準備中...
                        </>
                      ) : (
                        <>
                          <Send size={20} />
                          開始擲幣
                        </>
                      )}
                    </Button>
                    {!activeAI && (
                      <p className="text-center text-sm text-amber-400">
                        請先到<Link href="/settings" className="underline hover:text-accent">設定頁面</Link>配置 AI 服務
                      </p>
                    )}
                  </form>
                </Card>
              </div>
            )}

            {/* 說明頁面 */}
            {activeTab === 'intro' && (
              <Card variant="glass" className="p-6 markdown-content">
                <h2>什麼是六爻占卜？</h2>
                <p>
                  六爻占卜是中國傳統易經占卜術的一種，源自《周易》。透過擲硬幣的方式，產生六個爻位，組成卦象，再根據卦象的變化來預測吉凶。
                </p>

                <h3>基本概念</h3>
                <ul>
                  <li>
                    <strong>本卦</strong>：根據搖出的結果得到的初始卦象
                  </li>
                  <li>
                    <strong>變卦</strong>：動爻變化後得到的卦象
                  </li>
                  <li>
                    <strong>世爻</strong>：代表求測者本人
                  </li>
                  <li>
                    <strong>應爻</strong>：代表對方或環境
                  </li>
                  <li>
                    <strong>用神</strong>：根據所問之事確定的關鍵爻位
                  </li>
                </ul>

                <h3>六親含義</h3>
                <ul>
                  <li>
                    <strong>父母</strong>：文書、學業、房產、長輩
                  </li>
                  <li>
                    <strong>兄弟</strong>：競爭、朋友、阻礙
                  </li>
                  <li>
                    <strong>子孫</strong>：子女、解憂、醫藥
                  </li>
                  <li>
                    <strong>妻財</strong>：財運、妻子、收益
                  </li>
                  <li>
                    <strong>官鬼</strong>：事業、官運、丈夫
                  </li>
                </ul>
              </Card>
            )}

            {/* 教學頁面 */}
            {activeTab === 'tutorial' && (
              <Card variant="glass" className="p-6 markdown-content">
                <h2>如何使用六爻占卜？</h2>

                <h3>步驟一：準備</h3>
                <p>找一個安靜的環境，心中默念您想要詢問的問題，讓自己的心情平靜下來。</p>

                <h3>步驟二：選擇資訊</h3>
                <ol>
                  <li>選擇您的性別</li>
                  <li>選擇算命對象（為自己還是為他人）</li>
                  <li>輸入您想詢問的具體問題</li>
                </ol>

                <h3>步驟三：開始占卜</h3>
                <p>點擊「開始占卜」按鈕，系統會自動為您擲硬幣並排出卦象。</p>

                <h3>步驟四：查看結果</h3>
                <p>AI 大師會根據卦象為您詳細解讀，包括吉凶判斷和行動建議。</p>

                <h3>注意事項</h3>
                <ul>
                  <li>同一件事情不要反覆占卜</li>
                  <li>問題要具體明確</li>
                  <li>保持誠心，信則靈</li>
                </ul>
              </Card>
            )}
          </main>

          {/* 擲幣過程彈窗 */}
          {isTossing && result && (
            <CoinTossing
              result={result}
              aiConfig={activeAI}
              onComplete={finishTossing}
            />
          )}

          {/* 結果彈窗 */}
          {showResult && result && (
            <div className="fixed inset-0 z-50 bg-black/80 overflow-y-auto">
              <div className="min-h-screen flex items-start justify-center p-4 pt-8">
                <Card variant="glass" className="w-full max-w-4xl">
                  {/* 標題 */}
                  <div className="flex items-center justify-between p-6 border-b border-border">
                    <h2 className="text-xl font-bold text-accent flex items-center gap-2">
                      <span className="text-2xl">☯</span>
                      卦象解析
                    </h2>
                    <Button variant="ghost" onClick={() => setShowResult(false)} className="text-foreground-muted hover:text-foreground-primary p-2 h-auto">
                      <X size={24} />
                    </Button>
                  </div>

                  {/* 內容 */}
                  <div className="p-6 space-y-6">
                    {/* 卦象信息 */}
                    <div className="bg-accent/10 border border-accent/30 rounded-xl p-4">
                      <div className="flex flex-wrap gap-4 text-sm">
                        <div>
                          <span className="text-foreground-secondary">本卦：</span>
                          <span className="text-accent font-bold">{result.chart_data.benguaming}</span>
                        </div>
                        <div>
                          <span className="text-foreground-secondary">變卦：</span>
                          <span className="text-accent font-bold">{result.chart_data.bianguaming}</span>
                        </div>
                        <div>
                          <span className="text-foreground-secondary">卦宮：</span>
                          <span>{result.chart_data.guashen}宮</span>
                        </div>
                        <div>
                          <span className="text-foreground-secondary">空亡：</span>
                          <span>{result.chart_data.kongwang}</span>
                        </div>
                      </div>
                    </div>

                    {/* 硬幣結果 */}
                    <div>
                      <h3 className="text-lg font-bold mb-3">擲幣結果（從下到上）</h3>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {coinDescriptions.map((desc, i) => (
                          <div key={i} className="bg-background-card/50 rounded-lg p-3 flex justify-between items-center">
                            <span className="text-foreground-secondary">第 {i + 1} 爻</span>
                            <span className={desc.type === '動' ? 'text-accent' : 'text-foreground-primary'}>{desc.text}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* AI 解盤 */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-lg font-bold">大師解盤</h3>
                        {interpretation && (
                          <div className="flex items-center gap-2">
                            <Button
                              onClick={handleShare}
                              disabled={sharingState === 'loading'}
                              variant="ghost"
                              size="sm"
                              className={`gap-2 ${sharingState === 'success'
                                ? 'bg-green-600 text-white hover:bg-green-700 hover:text-white'
                                : 'text-foreground-secondary hover:text-accent hover:bg-background-card'
                                }`}
                            >
                              {sharingState === 'loading' ? (
                                <Loader2 size={16} className="animate-spin" />
                              ) : sharingState === 'success' ? (
                                <><Check size={16} />已複製連結</>
                              ) : (
                                <><Share2 size={16} />分享</>
                              )}
                            </Button>
                            <Button 
                              onClick={handleCopy} 
                              variant="ghost"
                              size="sm"
                              className="text-foreground-secondary hover:text-accent hover:bg-background-card gap-2"
                            >
                              <Copy size={16} />
                              複製
                            </Button>
                          </div>
                        )}
                      </div>

                      {interpretation ? (
                        <div className="space-y-4">
                          {/* Think 內容（可摺疊） */}
                          {parsedContent.thinkContent && (
                            <details className="bg-background-card/50 rounded-lg border border-border">
                              <summary className="px-4 py-3 cursor-pointer text-foreground-secondary hover:text-accent flex items-center gap-2">
                                <span className="text-lg">🧠</span>
                                <span>AI 思考過程（點擊展開）</span>
                              </summary>
                              <div className="px-4 pb-4 text-foreground-secondary text-sm whitespace-pre-wrap border-t border-border pt-3">
                                {parsedContent.thinkContent}
                              </div>
                            </details>
                          )}

                          {/* Raw Data Content */}
                          <details className="bg-background-card/50 rounded-lg border border-border">
                            <summary className="px-4 py-3 cursor-pointer text-foreground-secondary hover:text-accent flex items-center gap-2">
                              <span className="text-lg">☯</span>
                              <span>完整卦象盤面（點擊展開）</span>
                            </summary>
                            <div className="px-4 pb-4 text-foreground-secondary text-sm whitespace-pre-wrap border-t border-border pt-3 leading-relaxed">
                              {(() => {
                                // 只顯示到第三條 ---- 線（卦象結構結束）
                                const formatted = result.chart_data.formatted || '';
                                const lines = formatted.split('\n');
                                const resultLines = [];
                                let dashCount = 0;
                                for (const line of lines) {
                                  if (line.trim().startsWith('----')) {
                                    dashCount++;
                                    resultLines.push(line);
                                    if (dashCount >= 3) break;
                                    continue;
                                  }
                                  if (line.startsWith('【本卦：') || line.startsWith('【變卦：')) break;
                                  resultLines.push(line);
                                }
                                return resultLines.join('\n');
                              })()}
                            </div>
                          </details>

                          {/* 主要內容 */}
                          <div className="markdown-content bg-background-card/30 rounded-xl p-6" dangerouslySetInnerHTML={{ __html: parsedContent.mainHtml }} />
                        </div>
                      ) : (
                        <div className="text-center py-12">
                          <Loader2 className="animate-spin mx-auto mb-4 text-accent" size={40} />
                          <p className="text-foreground-secondary">AI 解盤中，請耐心等待</p>

                          {/* 等待時間顯示 */}
                          <div className="mt-4 text-2xl font-mono text-accent">
                            {Math.floor(waitingTime / 60).toString().padStart(2, '0')}:{(waitingTime % 60).toString().padStart(2, '0')}
                          </div>

                          {/* 進度條 */}
                          <div className="w-full max-w-xs mx-auto mt-4 bg-foreground-muted/20 rounded-full h-2 overflow-hidden">
                            <div
                              className="h-full bg-accent transition-all duration-1000 ease-linear"
                              style={{ width: `${Math.min(aiProgress, 100)}%` }}
                            />
                          </div>

                          {/* 提示文字 */}
                          <p className="text-foreground-muted text-sm mt-3">
                            {activeAI?.provider === 'local'
                              ? '本地 AI 解盤最久可能需要 2~3 分鐘'
                              : '雲端 AI 解盤最久約需 1 分鐘'}
                          </p>

                          {/* 取消按鈕 */}
                          <Button
                            onClick={handleCancel}
                            disabled={isCancelling}
                            variant="outline"
                            className="mt-6 border-red-500/50 text-red-400 hover:bg-red-500/10 mx-auto"
                          >
                            {isCancelling ? (
                              <>
                                <Loader2 className="animate-spin mr-2" size={16} />
                                取消中...
                              </>
                            ) : (
                              <>
                                <X size={16} className="mr-2" />
                                取消占卜
                              </>
                            )}
                          </Button>

                          <p className="text-foreground-muted text-xs mt-4">
                            提示：您可以關閉此視窗，結果會自動存入歷史紀錄
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
