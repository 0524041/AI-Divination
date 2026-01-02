'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import CoinTossing from '@/components/CoinTossing';
import {
  ArrowLeft,
  Compass,
  History,
  Settings,
  BookOpen,
  HelpCircle,
  Send,
  Loader2,
  Copy,
  X,
  AlertTriangle,
  Bot,
  ChevronDown,
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

interface AIConfig {
  id: number;
  provider: string;
  has_api_key: boolean;
  local_url: string | null;
  local_model: string | null;
  is_active: boolean;
}

const AI_TIMEOUT = 5 * 60 * 1000; // 5 分鐘
const TOSS_TIMEOUT_GEMINI = 5000;
const TOSS_TIMEOUT_LOCAL = 20000;
const TOTAL_ESTIMATED_GEMINI = 40000;
const TOTAL_ESTIMATED_LOCAL = 160000;

export default function LiuYaoPage() {
  const router = useRouter();
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
  const [tossIndex, setTossIndex] = useState(0);
  const [tossStartTime, setTossStartTime] = useState(0);
  const [currentTossStartTime, setCurrentTossStartTime] = useState(0);
  const [aiProgressDuration, setAiProgressDuration] = useState(0);
  const [aiProgress, setAiProgress] = useState(0);

  // AI 設定相關
  const [aiConfigs, setAiConfigs] = useState<AIConfig[]>([]);
  const [activeAI, setActiveAI] = useState<AIConfig | null>(null);
  const [showAISelector, setShowAISelector] = useState(false);

  // 控制器用於取消請求
  const abortControllerRef = useRef<AbortController | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const waitingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 檢查登入並載入 AI 設定
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }
    fetchAIConfigs();
  }, [router]);

  const fetchAIConfigs = async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/settings/ai', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const configs = await res.json();
        setAiConfigs(configs);
        const active = configs.find((c: AIConfig) => c.is_active);
        setActiveAI(active || null);
      }
    } catch (err) {
      console.error('Fetch AI configs error:', err);
    }
  };

  const handleSwitchAI = async (configId: number) => {
    const token = localStorage.getItem('token');
    try {
      await fetch(`/api/settings/ai/${configId}/activate`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      });
      await fetchAIConfigs();
      setShowAISelector(false);
    } catch (err) {
      console.error('Switch AI error:', err);
    }
  };

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

  // 輪詢結果
  useEffect(() => {
    if (!result || interpretation || !showResult) return;

    // 開始 AI 進度條動畫
    if (aiProgress === 0 && aiProgressDuration > 0) {
      // 給一點延遲讓 UI 渲染完成
      setTimeout(() => setAiProgress(100), 100);
    }

    const startTime = Date.now();

    // 等待時間計時器 (保留用於顯示實際等待時間，如果需要的話，或者用於超時檢查)
    waitingTimerRef.current = setInterval(() => {
      setWaitingTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    const pollResult = async () => {
      // 超時檢查
      if (Date.now() - startTime > AI_TIMEOUT) {
        clearAllTimers();
        setInterpretation('AI 解盤超時，請稍後在歷史紀錄中查看結果');
        return;
      }

      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`/api/history/${result.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

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

    pollIntervalRef.current = setInterval(pollResult, 3000);
    pollResult(); // 立即執行一次

    return () => {
      clearAllTimers();
    };
  }, [result, interpretation]);

  const finishTossing = () => {
    setIsTossing(false);
    setShowResult(true);
    
    // 計算 AI 解盤預估剩餘時間
    const totalEstimated = activeAI?.provider === 'local' ? TOTAL_ESTIMATED_LOCAL : TOTAL_ESTIMATED_GEMINI;
    const timeSpent = Date.now() - tossStartTime;
    const remaining = Math.max(10000, totalEstimated - timeSpent); // 至少留 10 秒
    
    setAiProgressDuration(remaining);
    setAiProgress(0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;

    setError('');
    setLoading(true);
    setResult(null);
    setInterpretation(null);
    setWaitingTime(0);
    
    // 擲幣初始化
    setIsTossing(true);
    setTossIndex(0);
    setTossStartTime(Date.now());

    // 建立新的 AbortController
    abortControllerRef.current = new AbortController();

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/divination/liuyao', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ question, gender, target }),
        signal: abortControllerRef.current.signal,
      });

      const data = await res.json();

      if (res.ok) {
        setResult(data);
        // 注意：這裡不設定 setShowResult(true)，因為要先顯示擲幣動畫
      } else {
        setError(data.detail || '占卜失敗');
        setIsTossing(false);
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        setError('占卜已取消');
      } else {
        setError('無法連接伺服器');
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
      const token = localStorage.getItem('token');
      await fetch(`/api/divination/${result.id}/cancel`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
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

  // 取得 AI 顯示名稱
  const getAIDisplayName = (config: AIConfig) => {
    if (config.provider === 'gemini') {
      return 'Google Gemini';
    }
    return `Local AI (${config.local_model})`;
  };

  return (
    <div className="min-h-screen">
      {/* 導航欄 */}
      <nav className="glass-card mx-4 mt-4 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-gray-400 hover:text-[var(--gold)]">
            <ArrowLeft size={24} />
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-3xl">☯</span>
            <h1 className="text-xl font-bold text-[var(--gold)]">六爻占卜</h1>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-4">
          <Link href="/" className="text-gray-300 hover:text-[var(--gold)]">
            <Compass size={20} />
          </Link>
          <Link href="/history" className="text-gray-300 hover:text-[var(--gold)]">
            <History size={20} />
          </Link>
          <Link href="/settings" className="text-gray-300 hover:text-[var(--gold)]">
            <Settings size={20} />
          </Link>
        </div>
      </nav>

      {/* 分頁選項 */}
      <div className="max-w-4xl mx-auto px-4 mt-6">
        <div className="flex gap-2 border-b border-gray-700 pb-2">
          <button
            className={`px-4 py-2 rounded-t-lg transition ${activeTab === 'divine' ? 'bg-[var(--gold)]/20 text-[var(--gold)]' : 'text-gray-400 hover:text-gray-200'
              }`}
            onClick={() => setActiveTab('divine')}
          >
            <Compass size={18} className="inline mr-2" />
            占卜
          </button>
          <button
            className={`px-4 py-2 rounded-t-lg transition ${activeTab === 'intro' ? 'bg-[var(--gold)]/20 text-[var(--gold)]' : 'text-gray-400 hover:text-gray-200'
              }`}
            onClick={() => setActiveTab('intro')}
          >
            <BookOpen size={18} className="inline mr-2" />
            說明
          </button>
          <button
            className={`px-4 py-2 rounded-t-lg transition ${activeTab === 'tutorial' ? 'bg-[var(--gold)]/20 text-[var(--gold)]' : 'text-gray-400 hover:text-gray-200'
              }`}
            onClick={() => setActiveTab('tutorial')}
          >
            <HelpCircle size={18} className="inline mr-2" />
            教學
          </button>
        </div>
      </div>

      {/* 內容區 */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* 占卜頁面 */}
        {activeTab === 'divine' && (
          <div className="space-y-6">
            {/* 當進 AI 顯示與切換 */}
            <div className="glass-card p-4 relative z-20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Bot className="text-[var(--gold)]" size={20} />
                  <span className="text-sm text-gray-400">當前 AI：</span>
                  {activeAI ? (
                    <span className="text-[var(--gold)] font-medium">{getAIDisplayName(activeAI)}</span>
                  ) : (
                    <span className="text-red-400">未設定</span>
                  )}
                </div>
                <div className="relative">
                  <button
                    onClick={() => setShowAISelector(!showAISelector)}
                    className="text-sm text-gray-400 hover:text-[var(--gold)] flex items-center gap-1"
                  >
                    切換 AI
                    <ChevronDown size={16} />
                  </button>
                  {showAISelector && aiConfigs.length > 0 && (
                    <div className="absolute right-0 top-full mt-2 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-10 min-w-[200px]">
                      {aiConfigs.map((config) => (
                        <button
                          key={config.id}
                          onClick={() => handleSwitchAI(config.id)}
                          className={`w-full text-left px-4 py-3 hover:bg-gray-700 first:rounded-t-lg last:rounded-b-lg ${config.is_active ? 'text-[var(--gold)]' : 'text-gray-300'
                            }`}
                        >
                          <div className="flex items-center justify-between">
                            <span>{getAIDisplayName(config)}</span>
                            {config.is_active && <span className="text-xs">✓</span>}
                          </div>
                        </button>
                      ))}
                      <Link
                        href="/settings"
                        className="block w-full text-center px-4 py-2 text-sm text-gray-500 hover:text-[var(--gold)] border-t border-gray-700"
                      >
                        管理 AI 設定
                      </Link>
                    </div>
                  )}
                </div>
              </div>
              {activeAI?.provider === 'local' && (
                <div className="mt-3 flex items-start gap-2 text-xs text-amber-400/80 bg-amber-400/10 rounded-lg p-2">
                  <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                  <span>使用 Local AI 時，解盤最長可能需要等待 5 分鐘，取決於您的電腦性能。建議升級硬體或是使用雲端 AI 解盤以獲得更快的回應速度。</span>
                </div>
              )}
            </div>

            <form onSubmit={handleSubmit} className="glass-card p-6 space-y-6">
              {/* 性別選擇 */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">性別</label>
                <div className="flex gap-4">
                  <button
                    type="button"
                    className={`flex-1 py-3 rounded-lg border transition ${gender === 'male'
                      ? 'border-[var(--gold)] bg-[var(--gold)]/20 text-[var(--gold)]'
                      : 'border-gray-600 text-gray-400 hover:border-gray-500'
                      }`}
                    onClick={() => setGender('male')}
                  >
                    ♂ 男
                  </button>
                  <button
                    type="button"
                    className={`flex-1 py-3 rounded-lg border transition ${gender === 'female'
                      ? 'border-[var(--gold)] bg-[var(--gold)]/20 text-[var(--gold)]'
                      : 'border-gray-600 text-gray-400 hover:border-gray-500'
                      }`}
                    onClick={() => setGender('female')}
                  >
                    ♀ 女
                  </button>
                </div>
              </div>

              {/* 對象選擇 */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">算命對象</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {[
                    { value: 'self', label: '自己' },
                    { value: 'parent', label: '父母' },
                    { value: 'friend', label: '朋友' },
                    { value: 'other', label: '對方' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      className={`py-2 rounded-lg border transition ${target === opt.value
                        ? 'border-[var(--gold)] bg-[var(--gold)]/20 text-[var(--gold)]'
                        : 'border-gray-600 text-gray-400 hover:border-gray-500'
                        }`}
                      onClick={() => setTarget(opt.value as typeof target)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 問題輸入 */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">請輸入您想詢問的問題</label>
                <textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  className="input-dark w-full h-32 resize-none"
                  placeholder="例如：我近期的事業運勢如何？這份工作是否適合我？"
                  maxLength={500}
                />
                <p className="text-right text-xs text-gray-500 mt-1">{question.length}/500</p>
              </div>

              {/* 錯誤訊息 */}
              {error && (
                <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 text-red-400 text-sm">{error}</div>
              )}

              {/* 提交按鈕 */}
              <button type="submit" className="btn-gold w-full flex items-center justify-center gap-2" disabled={loading || !question.trim() || !activeAI}>
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
              </button>
              {!activeAI && (
                <p className="text-center text-sm text-amber-400">
                  請先到<Link href="/settings" className="underline hover:text-[var(--gold)]">設定頁面</Link>配置 AI 服務
                </p>
              )}
            </form>
          </div>
        )}

        {/* 說明頁面 */}
        {activeTab === 'intro' && (
          <div className="glass-card p-6 markdown-content">
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
          </div>
        )}

        {/* 教學頁面 */}
        {activeTab === 'tutorial' && (
          <div className="glass-card p-6 markdown-content">
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
          </div>
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
            <div className="glass-card w-full max-w-4xl">
              {/* 標題 */}
              <div className="flex items-center justify-between p-6 border-b border-gray-700">
                <h2 className="text-xl font-bold text-[var(--gold)] flex items-center gap-2">
                  <span className="text-2xl">☯</span>
                  卦象解析
                </h2>
                <button onClick={() => setShowResult(false)} className="text-gray-400 hover:text-white">
                  <X size={24} />
                </button>
              </div>

              {/* 內容 */}
              <div className="p-6 space-y-6">
                {/* 卦象信息 */}
                <div className="bg-[var(--gold)]/10 border border-[var(--gold)]/30 rounded-xl p-4">
                  <div className="flex flex-wrap gap-4 text-sm">
                    <div>
                      <span className="text-gray-400">本卦：</span>
                      <span className="text-[var(--gold)] font-bold">{result.chart_data.benguaming}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">變卦：</span>
                      <span className="text-[var(--gold)] font-bold">{result.chart_data.bianguaming}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">卦宮：</span>
                      <span>{result.chart_data.guashen}宮</span>
                    </div>
                    <div>
                      <span className="text-gray-400">空亡：</span>
                      <span>{result.chart_data.kongwang}</span>
                    </div>
                  </div>
                </div>

                {/* 硬幣結果 */}
                <div>
                  <h3 className="text-lg font-bold mb-3">擲幣結果（從下到上）</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {coinDescriptions.map((desc, i) => (
                      <div key={i} className="bg-gray-800/50 rounded-lg p-3 flex justify-between items-center">
                        <span className="text-gray-400">第 {i + 1} 爻</span>
                        <span className={desc.type === '動' ? 'text-[var(--gold)]' : 'text-gray-300'}>{desc.text}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* AI 解盤 */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-bold">大師解盤</h3>
                    {interpretation && (
                      <button onClick={handleCopy} className="text-gray-400 hover:text-[var(--gold)] flex items-center gap-1 text-sm">
                        <Copy size={16} />
                        複製
                      </button>
                    )}
                  </div>

                  {interpretation ? (
                    <div className="space-y-4">
                      {/* Think 內容（可摺疊） */}
                      {parsedContent.thinkContent && (
                        <details className="bg-gray-800/50 rounded-lg border border-gray-700">
                          <summary className="px-4 py-3 cursor-pointer text-gray-400 hover:text-[var(--gold)] flex items-center gap-2">
                            <span className="text-lg">🧠</span>
                            <span>AI 思考過程（點擊展開）</span>
                          </summary>
                          <div className="px-4 pb-4 text-gray-400 text-sm whitespace-pre-wrap border-t border-gray-700 pt-3">
                            {parsedContent.thinkContent}
                          </div>
                        </details>
                      )}

                      {/* 主要內容 */}
                      <div className="markdown-content bg-gray-800/30 rounded-xl p-6" dangerouslySetInnerHTML={{ __html: parsedContent.mainHtml }} />
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <Loader2 className="animate-spin mx-auto mb-4 text-[var(--gold)]" size={40} />
                      <p className="text-gray-400">AI 解盤中 請耐心等待</p>
                      
                      <div className="w-full max-w-xs mx-auto mt-4 bg-gray-700 rounded-full h-2 overflow-hidden">
                        <div 
                          className="h-full bg-[var(--gold)] transition-all ease-linear"
                          style={{ 
                            width: `${aiProgress}%`,
                            transitionDuration: `${aiProgress === 100 ? aiProgressDuration : 0}ms`
                          }}
                        />
                      </div>

                      {/* 取消按鈕 */}
                      <button
                        onClick={handleCancel}
                        disabled={isCancelling}
                        className="mt-6 px-6 py-2 border border-red-500/50 text-red-400 rounded-lg hover:bg-red-500/10 transition flex items-center gap-2 mx-auto"
                      >
                        {isCancelling ? (
                          <>
                            <Loader2 className="animate-spin" size={16} />
                            取消中...
                          </>
                        ) : (
                          <>
                            <X size={16} />
                            取消占卜
                          </>
                        )}
                      </button>

                      <p className="text-gray-600 text-xs mt-4">
                        提示：您可以關閉此視窗，結果會自動存入歷史紀錄
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
