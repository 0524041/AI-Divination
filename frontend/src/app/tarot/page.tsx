'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { parseMarkdown } from '@/lib/markdown';
import { Navbar } from '@/components/layout/Navbar';
import { Sparkles, RotateCcw, Play, Check, ChevronDown, Bot, Copy, Share2, Loader2, X, Eye, Settings, History, ArrowLeft } from 'lucide-react';
import { TAROT_CARDS, TarotCardData } from '@/lib/tarot-data';

interface AIConfig {
  id: number;
  provider: string;
  has_api_key: boolean;
  local_url: string | null;
  local_model: string | null;
  is_active: boolean;
}

// 牌背組件 - 增加質感與光澤
const CardBack = ({ onClick, className = "", style, glow = false }: { onClick?: () => void, className?: string, style?: React.CSSProperties, glow?: boolean }) => (
  <div
    onClick={onClick}
    style={style}
    className={`
      aspect-[2/3] bg-gradient-to-br from-indigo-950 to-indigo-900 rounded-lg border border-[var(--gold)] 
      relative overflow-hidden cursor-pointer transition-all duration-300 shadow-lg
      ${glow ? 'shadow-[0_0_15px_rgba(212,175,55,0.5)] border-opacity-100' : 'border-opacity-60 hover:border-opacity-100 hover:shadow-[0_0_10px_rgba(212,175,55,0.3)]'}
      ${className}
    `}
  >
    {/* 紋理背景 */}
    <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_center,_var(--gold)_1px,_transparent_1px)] bg-[length:12px_12px]"></div>

    {/* 神秘符號中心 */}
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="w-16 h-16 border border-[var(--gold)] rounded-full flex items-center justify-center opacity-80">
        <div className="w-10 h-10 border border-[var(--gold)] rotate-45 flex items-center justify-center">
          <div className="w-6 h-6 bg-[var(--gold)] rounded-full opacity-20 animate-pulse"></div>
        </div>
      </div>
    </div>

    {/* 邊框裝飾 */}
    <div className="absolute inset-1 border border-[var(--gold)] border-opacity-30 rounded-md"></div>
  </div>
);

// 牌面組件 - 增加立體感
const TarotCard = ({ card, isRevealed, onClick, positionLabel, size = "normal" }: { card: TarotCardData, isRevealed: boolean, onClick?: () => void, positionLabel?: string, size?: "normal" | "large" }) => {
  return (
    <div className={`flex flex-col items-center gap-3 group ${size === 'large' ? 'w-[60vw] md:w-[22vw] max-w-[320px]' : 'w-full'}`} onClick={onClick}>
      {positionLabel && (
        <div className="text-[var(--gold)] text-sm font-bold uppercase tracking-[0.2em] opacity-80 group-hover:opacity-100 transition-opacity">
          {positionLabel}
        </div>
      )}
      <div className={`relative w-full aspect-[2/3] transition-all duration-700 transform-style-3d ${isRevealed ? 'rotate-y-0' : 'rotate-y-180'}`}>
        {/* Front (Image) */}
        <div className="absolute inset-0 w-full h-full backface-hidden rotate-y-0 rounded-lg overflow-hidden border-2 border-[var(--gold)] shadow-[0_0_20px_rgba(212,175,55,0.2)] bg-black">
          <div className={`w-full h-full h-full relative ${card.reversed ? 'rotate-180' : ''}`}>
            <img
              src={`/tarot-cards/${card.image}`}
              alt={card.name}
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent pt-8 pb-2 px-2 text-center">
              <div className="text-white font-bold text-lg tracking-wide">{card.name_cn}</div>
              <div className="text-[var(--gold)] text-xs uppercase tracking-wider opacity-80">{card.name}</div>
            </div>
          </div>
        </div>

        {/* Back */}
        <div className="absolute inset-0 w-full h-full backface-hidden rotate-y-180">
          <CardBack className="w-full h-full" />
        </div>
      </div>
    </div>
  );
};

type SpreadType = 'three_card' | 'single' | 'celtic_cross';

interface SpreadConfig {
  id: SpreadType;
  name: string;
  description: string;
  cardCount: number;
  positions: string[];
  icon: string;
}

const SPREAD_CONFIGS: SpreadConfig[] = [
  {
    id: 'single',
    name: '單張占卜',
    description: '快速洞察當前能量或核心問題',
    cardCount: 1,
    positions: ['核心'],
    icon: '🎴'
  },
  {
    id: 'three_card',
    name: '三牌陣',
    description: '過去-現在-未來的時間線解讀',
    cardCount: 3,
    positions: ['過去', '現在', '未來'],
    icon: '🔮'
  },
  {
    id: 'celtic_cross',
    name: '凱爾特十字',
    description: '最全面深入的10張牌綜合解讀',
    cardCount: 10,
    positions: ['核心', '挑戰', '顯意識', '潛意識', '過去', '未來', '自我', '外部', '希望/恐懼', '結果'],
    icon: '✨'
  }
];

export default function TarotPage() {
  const router = useRouter();
  const [step, setStep] = useState<'intro' | 'spread_select' | 'input' | 'shuffle' | 'select' | 'reveal' | 'interpreting' | 'result'>('intro');
  const [spreadType, setSpreadType] = useState<SpreadType>('three_card');
  const [question, setQuestion] = useState('');
  const [shuffledDeck, setShuffledDeck] = useState<TarotCardData[]>([]);
  const [selectedCards, setSelectedCards] = useState<TarotCardData[]>([]);
  const [revealedCount, setRevealedCount] = useState(0);
  const [interpretation, setInterpretation] = useState('');
  const [loading, setLoading] = useState(false);
  const [historyId, setHistoryId] = useState<number | null>(null);
  const [htmlContent, setHtmlContent] = useState<{ mainHtml: string; thinkContent: string } | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [sharingState, setSharingState] = useState<'idle' | 'loading' | 'success'>('idle');

  // 洗牌動畫狀態
  const [isShuffling, setIsShuffling] = useState(false);
  const [reshuffleCount, setReshuffleCount] = useState(0);

  // AI 設定相關
  const [aiConfigs, setAiConfigs] = useState<AIConfig[]>([]);
  const [activeAI, setActiveAI] = useState<AIConfig | null>(null);
  const [showAISelector, setShowAISelector] = useState(false);

  // 初始化
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }
    fetchAIConfigs();
  };

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

  const startDivination = () => {
    setStep('spread_select');
  };

  const selectSpread = (type: SpreadType) => {
    setSpreadType(type);
    setStep('input');
  };

  const getCurrentSpreadConfig = () => {
    return SPREAD_CONFIGS.find(c => c.id === spreadType) || SPREAD_CONFIGS[1];
  };

  const getPositionLabel = (index: number) => {
    const config = getCurrentSpreadConfig();
    return config.positions[index] || `位置 ${index + 1}`;
  };

  const confirmSelection = async () => {
    const maxCards = getCurrentSpreadConfig().cardCount;
    if (selectedCards.length === maxCards) {
      // 立即提交给后端开始AI处理
      await submitToBackend();
      // 进入翻牌阶段
      setStep('reveal');
      setRevealedCount(0);
    }
  };

  const submitToBackend = async () => {
    try {
      const token = localStorage.getItem('token');
      const getCardPosition = (index: number) => {
        if (spreadType === 'single') return 'single';
        if (spreadType === 'three_card') {
          return index === 0 ? 'past' : index === 1 ? 'present' : 'future';
        }
        // celtic_cross
        const positions = ['heart', 'challenge', 'conscious', 'foundation', 'past', 'future', 'attitude', 'external', 'hopes_fears', 'outcome'];
        return positions[index] || `position_${index + 1}`;
      };

      const cardsPayload = selectedCards.map((card, index) => ({
        id: card.id,
        name: card.name,
        name_cn: card.name_cn,
        image: card.image,
        reversed: card.reversed || false,
        position: getCardPosition(index)
      }));

      const res = await fetch('/api/tarot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          question,
          cards: cardsPayload,
          spread_type: spreadType
        })
      });

      if (res.ok) {
        const data = await res.json();
        setHistoryId(data.id);
        // 后台已经开始处理，但不立即轮询
      } else {
        alert('提交失敗，請稍後再試');
      }
    } catch (err) {
      console.error(err);
      alert('發生錯誤');
    }
  };

  const handleShuffle = () => {
    if (!question.trim()) {
      alert('請先輸入您想問的問題');
      return;
    }
    if (!activeAI) {
      alert('請先設定 AI 服務');
      return;
    }
    setStep('shuffle');
    setIsShuffling(true);

    // 模擬洗牌動畫
    setTimeout(() => {
      setIsShuffling(false);
      performShuffle();
      setStep('select');
    }, 3000);
  };

  const handleReshuffle = () => {
    if (reshuffleCount >= 3) return;
    setStep('shuffle');
    setIsShuffling(true);
    setReshuffleCount(prev => prev + 1);
    setSelectedCards([]); // 重洗時清空選擇

    setTimeout(() => {
      setIsShuffling(false);
      performShuffle();
      setStep('select');
    }, 2000);
  };

  const performShuffle = () => {
    // 複製並為每張牌隨機分配正逆位
    const deck = TAROT_CARDS.map(card => ({
      ...card,
      reversed: Math.random() < 0.5
    }));

    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    setShuffledDeck(deck);
  };

  const handleSelectCard = (card: TarotCardData) => {
    const maxCards = getCurrentSpreadConfig().cardCount;
    // Check if already selected
    if (selectedCards.find(c => c.id === card.id)) {
      // Deselect
      setSelectedCards(selectedCards.filter(c => c.id !== card.id));
      return;
    }

    // Select (limit to maxCards)
    if (selectedCards.length >= maxCards) return;

    setSelectedCards([...selectedCards, card]);
  };

  const handleReveal = (index: number) => {
    if (index !== revealedCount) return; // 依序翻牌
    setRevealedCount(prev => prev + 1);
  };

  const submitDivination = async () => {
    if (!historyId) {
      alert('系統錯誤：找不到占卜記錄');
      return;
    }

    setStep('interpreting');
    setLoading(true);

    // 先检查一次结果是否已经完成
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/history/${historyId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'completed') {
          // AI已经完成，直接显示结果
          setInterpretation(data.interpretation);

          // 解析 Markdown
          try {
            const result = await parseMarkdown(data.interpretation);
            setHtmlContent(result);
          } catch (err) {
            console.error('Markdown parsing error:', err);
            setHtmlContent({ mainHtml: `<p class="text-red-400">解析失敗: ${err}</p>`, thinkContent: '' });
          }

          setStep('result');
          setLoading(false);
          return;
        } else if (data.status === 'error') {
          alert('AI 解盤失敗');
          setLoading(false);
          setStep('reveal');
          return;
        }
      }
    } catch (err) {
      console.error('Check result error:', err);
    }

    // 如果还没完成，继续轮询
    pollResult(historyId);
  };

  const pollResult = async (id: number) => {
    const token = localStorage.getItem('token');
    const check = async () => {
      try {
        const res = await fetch(`/api/history/${id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.status === 'completed') {
            setInterpretation(data.interpretation);

            // 解析 Markdown
            try {
              const result = await parseMarkdown(data.interpretation);
              setHtmlContent(result);
            } catch (err) {
              console.error('Markdown parsing error:', err);
              setHtmlContent({ mainHtml: `<p class="text-red-400">解析失敗: ${err}</p>`, thinkContent: '' });
            }

            setStep('result');
            setLoading(false);
          } else if (data.status === 'error') {
            alert('AI 解盤失敗');
            setLoading(false);
            setStep('reveal');
          } else {
            setTimeout(check, 2000);
          }
        }
      } catch (err) {
        console.error(err);
        setTimeout(check, 2000);
      }
    };
    check();
  };

  const handleCancel = async () => {
    setIsCancelling(true);
    try {
      const token = localStorage.getItem('token');
      await fetch('/api/tarot/cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ history_id: historyId })
      });
      setStep('input');
      setLoading(false);
      setInterpretation('');
    } catch (err) {
      console.error('Cancel error:', err);
      alert('取消失敗');
    } finally {
      setIsCancelling(false);
    }
  };

  const handleCopy = async () => {
    // 使用正確的牌陣位置標籤
    const cardText = selectedCards.map((c, i) =>
      `${getPositionLabel(i)}: ${c.name_cn} (${c.name})`
    ).join('\n');

    const spreadName = getCurrentSpreadConfig().name;
    const markdownText = `## 問題\n${question}\n\n## 牌陣類型\n${spreadName}\n\n## 抽到的牌\n${cardText}\n\n## AI 解盤\n${interpretation}`;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(markdownText);
        alert('已複製到剪貼簿');
        return;
      } catch (err) {
        console.warn('Clipboard API 失敗', err);
      }
    }
    alert('複製失敗，請手動複製內容');
  };

  const handleShare = async () => {
    if (!historyId) {
      alert('系統錯誤：找不到占卜記錄');
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) return;

    setSharingState('loading');

    // Safari 修復：使用 ClipboardItem + Promise 方式
    // 關鍵：navigator.clipboard.write() 必須在用戶手勢上下文中同步呼叫
    // 但可以傳入一個 Promise 給 ClipboardItem，讓 async 操作在 Promise 內執行

    const getShareUrl = async (): Promise<string> => {
      const res = await fetch('/api/share/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ history_id: historyId }),
      });
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


  return (
    <div className="min-h-screen flex flex-col pb-20 overflow-x-hidden">
      {/* 背景裝飾 */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_0%,_rgba(21,21,40,1)_0%,_rgba(10,10,10,1)_80%)]"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[var(--gold)] opacity-[0.03] blur-[100px] rounded-full"></div>
      </div>

      {/* 使用共用 Navbar */}
      <Navbar
        pageTitle="塔羅占卜"
        pageIcon={<Sparkles className="text-[var(--gold)]" size={24} />}
        showBackButton
        backHref="/"
      />

      {/* 主要內容區域 */}
      <main className={`relative z-10 pt-8 px-4 transition-all duration-500 ${step === 'select' ? 'w-full max-w-[1800px] mx-auto' : (step === 'reveal' || step === 'interpreting' || step === 'result' ? 'w-full max-w-[1600px] mx-auto' : 'max-w-4xl mx-auto')}`}>

        {/* Intro Phase */}
        {step === 'intro' && (
          <div className="flex flex-col items-center text-center space-y-12 fade-in min-h-[70vh] justify-center">
            <div className="relative w-64 h-96 animate-float">
              <div className="absolute inset-0 bg-indigo-900 rounded-xl border border-[var(--gold)] transform rotate-6 opacity-30 blur-sm"></div>
              <div className="absolute inset-0 bg-indigo-900 rounded-xl border border-[var(--gold)] transform -rotate-6 opacity-30 blur-sm"></div>
              <CardBack className="w-full h-full absolute inset-0 shadow-[0_0_50px_rgba(212,175,55,0.2)]" glow />
            </div>

            <div className="space-y-6 max-w-2xl">
              <h2 className="text-4xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[var(--gold)] to-white">
                探索內心的指引
              </h2>
              <p className="text-gray-300 text-lg leading-relaxed font-light">
                塔羅牌是連結潛意識的鑰匙。<br />
                透過「過去、現在、未來」的三張牌陣，<br />
                洞察當下的處境，回顧過去的影響，並展望未來的可能性。
              </p>
            </div>

            <button onClick={startDivination} className="btn-gold px-16 py-5 text-xl flex items-center gap-3 shadow-[0_0_30px_rgba(212,175,55,0.3)] hover:shadow-[0_0_50px_rgba(212,175,55,0.5)]">
              <Play size={24} fill="currentColor" />
              開始占卜
            </button>
          </div>
        )}

        {/* Spread Selection Phase */}
        {step === 'spread_select' && (
          <div className="max-w-5xl mx-auto space-y-8 fade-in pt-10">
            <div className="text-center space-y-3 mb-12">
              <h2 className="text-3xl font-bold text-[var(--gold)]">選擇牌陣類型</h2>
              <p className="text-gray-400">不同的牌陣適合不同深度的問題探索</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {SPREAD_CONFIGS.map((spread) => (
                <button
                  key={spread.id}
                  onClick={() => selectSpread(spread.id)}
                  className="group relative bg-gray-900/50 backdrop-blur-sm border-2 border-gray-800 rounded-2xl p-8 hover:border-[var(--gold)] transition-all duration-300 hover:shadow-[0_0_30px_rgba(212,175,55,0.2)] hover:scale-105"
                >
                  {/* Icon */}
                  <div className="text-6xl mb-4 transition-transform group-hover:scale-110">
                    {spread.icon}
                  </div>

                  {/* Title */}
                  <h3 className="text-2xl font-bold text-[var(--gold)] mb-2">
                    {spread.name}
                  </h3>

                  {/* Description */}
                  <p className="text-gray-400 text-sm leading-relaxed mb-4">
                    {spread.description}
                  </p>

                  {/* Card Count Badge */}
                  <div className="inline-block px-4 py-2 bg-[var(--gold)]/10 border border-[var(--gold)]/30 rounded-full">
                    <span className="text-[var(--gold)] font-semibold">{spread.cardCount} 張牌</span>
                  </div>

                  {/* Hover Effect */}
                  <div className="absolute inset-0 bg-gradient-to-br from-[var(--gold)]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl pointer-events-none"></div>
                </button>
              ))}
            </div>

            {/* Back Button */}
            <div className="text-center pt-8">
              <button
                onClick={() => setStep('intro')}
                className="btn-gold-outline px-8 py-3"
              >
                返回
              </button>
            </div>
          </div>
        )}

        {/* Input Phase */}
        {step === 'input' && (
          <div className="max-w-2xl mx-auto space-y-8 fade-in pt-10">
            <div className="text-center space-y-3">
              <div className="flex items-center justify-center gap-3 mb-4">
                <span className="text-4xl">{SPREAD_CONFIGS.find(s => s.id === spreadType)?.icon}</span>
                <span className="text-lg text-[var(--gold)] font-semibold">
                  {SPREAD_CONFIGS.find(s => s.id === spreadType)?.name}
                </span>
              </div>
              <h2 className="text-3xl font-bold text-[var(--gold)]">默念您的問題</h2>
              <p className="text-gray-400">保持內心平靜，將專注力放在您想尋求指引的事物上</p>
            </div>

            {/* AI Selector */}
            <div className="relative group z-20">
              <button
                onClick={() => setShowAISelector(!showAISelector)}
                className="w-full flex items-center justify-between px-6 py-4 bg-gray-800/40 border border-gray-700 rounded-2xl hover:border-[var(--gold)] hover:bg-gray-800/60 transition-all duration-300 backdrop-blur-sm"
              >
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-[var(--gold)]/10 rounded-lg">
                    <Bot className="text-[var(--gold)]" size={24} />
                  </div>
                  <div className="text-left">
                    <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">AI 解盤服務</div>
                    <div className="font-medium text-gray-200 text-lg">
                      {activeAI ? (
                        activeAI.provider === 'gemini' ? 'Google Gemini Pro' : 'Local AI Model'
                      ) : (
                        '未設定 AI'
                      )}
                    </div>
                  </div>
                </div>
                <ChevronDown size={20} className={`text-gray-400 transition-transform duration-300 ${showAISelector ? 'rotate-180' : ''}`} />
              </button>

              {showAISelector && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-[#1a1a2e] border border-gray-700 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                  {aiConfigs.map((config) => {
                    const isSelected = activeAI?.id === config.id;
                    return (
                      <button
                        key={config.id}
                        onClick={() => handleSwitchAI(config.id)}
                        className={`w-full px-6 py-4 flex items-center justify-between hover:bg-gray-800 transition ${isSelected ? 'bg-[var(--gold)]/5' : ''
                          }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${isSelected ? 'bg-[var(--gold)] shadow-[0_0_10px_var(--gold)]' : 'bg-gray-600'}`} />
                          <span className={isSelected ? 'text-[var(--gold)] font-medium' : 'text-gray-300'}>
                            {config.provider === 'gemini' ? 'Google Gemini' : `Local AI (${config.local_model})`}
                          </span>
                        </div>
                        {isSelected && <Check size={18} className="text-[var(--gold)]" />}
                      </button>
                    );
                  })}
                  <Link
                    href="/settings"
                    className="w-full px-6 py-4 flex items-center gap-3 text-gray-400 hover:bg-gray-800 hover:text-[var(--gold)] border-t border-gray-800 transition"
                  >
                    <Settings size={18} />
                    <span>管理 AI 設定</span>
                  </Link>
                </div>
              )}
            </div>

            <div className="relative">
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="例如：我最近的工作運勢如何？這段感情會有結果嗎？"
                className="w-full h-48 bg-gray-800/30 border border-gray-700 rounded-2xl p-6 text-xl text-gray-200 focus:border-[var(--gold)] focus:ring-1 focus:ring-[var(--gold)] focus:bg-gray-800/50 transition-all outline-none resize-none placeholder:text-gray-600"
              />
              <div className="absolute bottom-4 right-4 text-gray-600 text-sm">
                {question.length} 字
              </div>
            </div>

            <button
              onClick={handleShuffle}
              className="btn-gold w-full py-5 text-xl flex items-center justify-center gap-3 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RotateCcw size={24} />
              開始洗牌
            </button>

            {/* Back Button */}
            <div className="text-center pt-4">
              <button
                onClick={() => setStep('spread_select')}
                className="btn-gold-outline px-8 py-3 flex items-center justify-center gap-2 mx-auto"
              >
                <ArrowLeft size={18} />
                返回選擇牌陣
              </button>
            </div>
          </div>
        )}

        {/* Shuffle Phase */}
        {step === 'shuffle' && (
          <div className="flex flex-col items-center justify-center h-[70vh] space-y-12 fade-in">
            <div className="relative w-64 h-64 flex items-center justify-center">
              {/* 圓形洗牌動畫 */}
              {[...Array(12)].map((_, i) => (
                <div
                  key={i}
                  className="absolute w-32 h-48 origin-bottom transition-all duration-500"
                  style={{
                    transform: `rotate(${i * 30}deg) translateY(-20px)`,
                    animation: `spin 3s linear infinite`,
                    animationDelay: `${i * 0.1}s`
                  }}
                >
                  <CardBack className="w-full h-full shadow-md" />
                </div>
              ))}
            </div>
            <div className="text-center space-y-2">
              <p className="text-[var(--gold)] text-2xl font-bold animate-pulse">洗牌中...</p>
              <p className="text-gray-500">請保持專注</p>
            </div>
          </div>
        )}

        {/* Select Phase */}
        {step === 'select' && (
          <div className="fade-in flex flex-col h-[calc(100vh-100px)]">
            <div className="text-center space-y-2 mb-6 flex-shrink-0">
              <h2 className="text-3xl font-bold text-[var(--gold)]">
                請憑直覺選出 {getCurrentSpreadConfig().cardCount} 張牌
              </h2>
              <p className="text-gray-400">
                已選擇：<span className="text-[var(--gold)] font-bold text-xl">{selectedCards.length}</span> / {getCurrentSpreadConfig().cardCount}
              </p>
              <p className="text-sm text-gray-500">
                {getCurrentSpreadConfig().name} - {getCurrentSpreadConfig().description}
              </p>
            </div>

            {/* Card Grid - Full Width & Responsive */}
            <div className="flex-1 overflow-y-auto px-2 pb-32 custom-scrollbar">
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 2xl:grid-cols-12 gap-3 md:gap-4 mx-auto max-w-[1920px]">
                {shuffledDeck.map((card, index) => {
                  const isSelected = selectedCards.find(c => c.id === card.id);
                  return (
                    <div
                      key={card.id}
                      className={`
                        relative transition-all duration-500 ease-out
                        ${isSelected ? 'opacity-0 scale-0' : 'opacity-100 scale-100 hover:-translate-y-4 hover:z-10'}
                      `}
                      style={{
                        animationDelay: `${index * 0.015}s`,
                        animationFillMode: 'both'
                      }}
                    >
                      <div className="animate-deal">
                        <CardBack
                          onClick={() => handleSelectCard(card)}
                          className={`w-full shadow-lg hover:shadow-[0_0_15px_rgba(212,175,55,0.4)] hover:border-[var(--gold)] transition-all duration-300`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Selected Cards Bar - Fixed Bottom - Optimized for Zoom/Responsive */}
            <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#0a0a0a]/95 backdrop-blur-xl border-t border-[var(--gold)]/30 pb-2 pt-2 md:pb-4 md:pt-4 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] transition-all duration-300">
              <div className="w-full max-w-[98%] 2xl:max-w-[1800px] mx-auto px-2 md:px-6 flex flex-row items-center justify-between gap-4">

                {/* Selected Cards Slots - Scrollable Area with Centering */}
                <div className="flex-1 overflow-x-auto custom-scrollbar flex items-center justify-start xl:justify-center px-1">
                  <div className="flex gap-2 md:gap-4 flex-nowrap min-w-max py-2 px-1">
                    {Array.from({ length: getCurrentSpreadConfig().cardCount }, (_, i) => {
                      const card = selectedCards[i];
                      return (
                        <div key={i} className="relative group flex-shrink-0">
                          <div className={`
                            w-16 h-24 sm:w-20 sm:h-32 md:w-24 md:h-36 rounded-lg border-2 border-dashed transition-all duration-300 flex items-center justify-center
                            ${card ? 'border-transparent' : 'border-gray-700 bg-gray-800/30'}
                          `}>
                            {card ? (
                              <div className="w-full h-full animate-deal relative">
                                <CardBack className="w-full h-full border-[var(--gold)] shadow-[0_0_15px_rgba(212,175,55,0.3)]" />
                                <button
                                  onClick={() => handleSelectCard(card)}
                                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1.5 shadow-lg hover:bg-red-600 transition opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100 z-10"
                                >
                                  <X size={12} />
                                </button>
                              </div>
                            ) : (
                              <span className="text-gray-600 font-bold text-xl md:text-2xl">{i + 1}</span>
                            )}
                          </div>
                          <div className="text-center text-[10px] md:text-xs text-[var(--gold)] mt-1 md:mt-2 font-medium uppercase tracking-widest truncate max-w-[64px] sm:max-w-[80px] md:max-w-[96px]">
                            {getPositionLabel(i)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Actions - Fixed Right, non-shrinking */}
                <div className="flex-shrink-0 flex flex-row items-center gap-2 md:gap-4 pl-2 md:pl-6 border-l border-gray-800/50">
                  {reshuffleCount < 3 && selectedCards.length === 0 && (
                    <button
                      onClick={handleReshuffle}
                      className="p-3 md:px-6 md:py-3 rounded-xl border border-gray-700 text-gray-400 hover:text-[var(--gold)] hover:border-[var(--gold)] transition flex items-center gap-2 whitespace-nowrap"
                      title="重新洗牌"
                    >
                      <RotateCcw size={18} />
                      <span className="hidden md:inline">重新洗牌</span>
                    </button>
                  )}

                  <button
                    onClick={confirmSelection}
                    disabled={selectedCards.length !== getCurrentSpreadConfig().cardCount}
                    className={`
                      px-6 py-3 md:px-10 md:py-4 rounded-xl font-bold text-base md:text-lg flex items-center gap-2 md:gap-3 transition-all duration-300 whitespace-nowrap
                      ${selectedCards.length === getCurrentSpreadConfig().cardCount
                        ? 'bg-gradient-to-r from-[var(--gold)] to-[var(--gold-dark)] text-black hover:scale-105 shadow-[0_0_20px_rgba(212,175,55,0.4)]'
                        : 'bg-gray-800 text-gray-600 cursor-not-allowed border border-gray-700'}
                    `}
                  >
                    <Check size={20} className="md:w-6 md:h-6" />
                    <span className="hidden sm:inline">確認牌陣</span>
                    <span className="sm:hidden">確認</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Reveal Phase */}
        {(step === 'reveal' || step === 'interpreting' || step === 'result') && (
          <div className="space-y-12 fade-in pb-20">
            <div className="text-center space-y-3">
              <h2 className="text-3xl font-bold text-[var(--gold)]">
                {step === 'reveal' ? '揭示命運' : '命運的指引'}
              </h2>
              <p className="text-gray-400 max-w-2xl mx-auto italic">"{question}"</p>
            </div>

            {/* Cards Display */}
            <div className={`flex ${spreadType === 'celtic_cross' ? 'flex-wrap' : 'flex-col md:flex-row'} justify-center items-center gap-6 md:gap-8 lg:gap-10 min-h-[600px]`}>
              {selectedCards.map((card, index) => (
                <div
                  key={card.id}
                  className={`transition-all duration-700 ${step === 'reveal' && index > revealedCount ? 'opacity-50 scale-90 blur-[1px]' : 'opacity-100 scale-100'
                    } ${spreadType === 'celtic_cross' ? 'w-[20vw] md:w-[15vw] max-w-[180px]' : ''}`}
                >
                  <TarotCard
                    card={card}
                    isRevealed={index < revealedCount || step !== 'reveal'}
                    onClick={() => step === 'reveal' && handleReveal(index)}
                    positionLabel={getPositionLabel(index)}
                    size={spreadType === 'celtic_cross' ? 'normal' : 'large'}
                  />
                </div>
              ))}
            </div>

            {/* Action Button for Reveal */}
            {step === 'reveal' && (
              <div className="flex justify-center h-24 items-center">
                {revealedCount < getCurrentSpreadConfig().cardCount ? (
                  <p className="text-gray-500 animate-pulse">請依序點擊卡牌翻開...</p>
                ) : (
                  <button onClick={submitDivination} className="btn-gold px-16 py-5 text-xl flex items-center gap-3 animate-fade-in-up shadow-[0_0_30px_rgba(212,175,55,0.3)]">
                    <Sparkles size={24} />
                    AI 解讀牌義
                  </button>
                )}
              </div>
            )}

            {/* Loading State */}
            {step === 'interpreting' && (
              <div className="text-center py-12 space-y-6">
                <div className="relative w-24 h-24 mx-auto">
                  <div className="absolute inset-0 border-4 border-[var(--gold)] border-t-transparent rounded-full animate-spin"></div>
                  <div className="absolute inset-4 border-4 border-indigo-500 border-b-transparent rounded-full animate-spin-slow"></div>
                  <div className="absolute inset-0 flex items-center justify-center text-2xl">🔮</div>
                </div>
                <div>
                  <h3 className="text-xl text-[var(--gold)] font-medium mb-2">AI 正在連結宇宙能量...</h3>
                  <p className="text-gray-500">正在分析牌陣與問題的關聯</p>
                </div>

                <button
                  onClick={handleCancel}
                  disabled={isCancelling}
                  className="px-6 py-2 border border-red-500/30 text-red-400 rounded-full hover:bg-red-500/10 transition flex items-center gap-2 mx-auto text-sm"
                >
                  {isCancelling ? <Loader2 className="animate-spin" size={14} /> : <X size={14} />}
                  取消占卜
                </button>
              </div>
            )}

            {/* Result Display */}
            {step === 'result' && interpretation && (
              <div className="max-w-4xl mx-auto bg-[#16162a]/80 backdrop-blur-md rounded-2xl p-8 md:p-12 border border-[var(--gold)]/20 shadow-2xl fade-in relative overflow-hidden">
                {/* Decorative Elements */}
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-transparent via-[var(--gold)] to-transparent opacity-50"></div>

                {/* Action Buttons */}
                <div className="absolute top-6 right-6 flex items-center gap-2">
                  <button
                    onClick={handleShare}
                    disabled={sharingState === 'loading'}
                    className={`p-2.5 rounded-xl transition-all shadow-lg flex items-center gap-2 group ${sharingState === 'success'
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-800 hover:bg-[var(--gold)] text-gray-400 hover:text-gray-900'
                      }`}
                    title="分享結果"
                  >
                    {sharingState === 'loading' ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : sharingState === 'success' ? (
                      <Check size={18} />
                    ) : (
                      <Share2 size={18} />
                    )}
                    <span className="text-sm font-medium hidden group-hover:inline">
                      {sharingState === 'success' ? '已複製連結' : '分享'}
                    </span>
                  </button>
                  <button
                    onClick={handleCopy}
                    className="p-2.5 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-gray-200 rounded-xl transition-all shadow-lg flex items-center gap-2 group"
                    title="複製完整內容"
                  >
                    <Copy size={18} />
                    <span className="text-sm font-medium hidden group-hover:inline">複製</span>
                  </button>
                </div>

                <h3 className="text-2xl font-bold text-[var(--gold)] mb-8 flex items-center gap-3 border-b border-gray-800 pb-4">
                  <Sparkles size={24} />
                  牌義解析
                </h3>

                {htmlContent ? (
                  <div className="space-y-6">
                    {/* Think Content */}
                    {htmlContent.thinkContent && (
                      <details className="group bg-gray-900/50 rounded-xl border border-gray-800 overflow-hidden">
                        <summary className="px-6 py-4 cursor-pointer text-gray-400 hover:text-[var(--gold)] flex items-center gap-3 transition-colors">
                          <span className="text-xl">🧠</span>
                          <span className="font-medium">AI 思考過程</span>
                          <ChevronDown size={16} className="group-open:rotate-180 transition-transform ml-auto" />
                        </summary>
                        <div className="px-6 pb-6 text-gray-400 text-sm whitespace-pre-wrap border-t border-gray-800 pt-4 leading-relaxed font-mono">
                          {htmlContent.thinkContent}
                        </div>
                      </details>
                    )}

                    {/* Card Spread Details */}
                    <details className="group bg-gray-900/50 rounded-xl border border-gray-800 overflow-hidden">
                      <summary className="px-6 py-4 cursor-pointer text-gray-400 hover:text-[var(--gold)] flex items-center gap-3 transition-colors">
                        <span className="text-xl">🎴</span>
                        <span className="font-medium">牌陣詳情</span>
                        <ChevronDown size={16} className="group-open:rotate-180 transition-transform ml-auto" />
                      </summary>
                      <div className="px-6 pb-6 text-gray-300 text-sm border-t border-gray-800 pt-4 leading-relaxed space-y-3">
                        <div className="font-bold text-[var(--gold)] mb-3">{getCurrentSpreadConfig().name}</div>
                        {selectedCards.map((card, index) => (
                          <div key={card.id} className="flex items-start gap-3 py-2 border-b border-gray-800 last:border-0">
                            <span className="text-[var(--gold)] font-bold min-w-[80px]">
                              {getPositionLabel(index)}:
                            </span>
                            <span className="flex-1">
                              {card.name_cn} ({card.name})
                            </span>
                          </div>
                        ))}
                      </div>
                    </details>

                    {/* Main Content */}
                    <div
                      className="markdown-content text-gray-200 leading-loose text-lg"
                      dangerouslySetInnerHTML={{ __html: htmlContent.mainHtml }}
                    />
                  </div>
                ) : (
                  <div className="whitespace-pre-wrap text-gray-300 leading-loose text-lg">
                    {interpretation}
                  </div>
                )}

                <div className="mt-12 flex justify-center pt-8 border-t border-gray-800">
                  <Link href="/history" className="btn-gold-outline px-10 py-3 flex items-center gap-2 group">
                    <History size={20} className="group-hover:rotate-12 transition-transform" />
                    查看歷史紀錄
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}

      </main>
    </div>
  );
}
