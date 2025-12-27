'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useApp } from '@/contexts/AppContext';
import { api } from '@/lib/api';
import { performDivination } from '@/lib/divination';
import { ToolStatus } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CoinTossing } from '@/components/CoinTossing';
import { DivinationResult } from '@/components/DivinationResult';
import { HelpCircle, BookOpen, SendHorizonal, Bot, User, Users, AlertTriangle, Settings as SettingsIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

// 問卦範例
const PLACEHOLDER_EXAMPLES = [
  "我想算一卦...",
  "這周的財運如何？",
  "這份工作適合我嗎？",
  "我和他/她的緣分如何？",
  "最近有什麼需要注意的？",
  "明年的運勢會如何？",
  "這個投資可以進場嗎？",
  "我的健康狀況如何？",
];

// 性別選項
const GENDER_OPTIONS: { id: '男' | '女', label: string, icon: string }[] = [
  { id: '男', label: '男', icon: '👨' },
  { id: '女', label: '女', icon: '👩' },
];

// 占卜對象選項
const TARGET_OPTIONS: { id: '自己' | '父母' | '朋友' | '他人', label: string }[] = [
  { id: '自己', label: '算自己' },
  { id: '父母', label: '算父母' },
  { id: '朋友', label: '算朋友' },
  { id: '他人', label: '算他人' },
];

type Mode = 'input' | 'tossing' | 'result';

export function LiuYaoPage() {
  const router = useRouter();
  const { settings, geminiApiKey, backendApiKeys } = useApp();
  const [mode, setMode] = useState<Mode>('input');
  const [question, setQuestion] = useState('');
  const [gender, setGender] = useState<'男' | '女' | ''>('');
  const [target, setTarget] = useState<'自己' | '父母' | '朋友' | '他人' | ''>('');
  const [coins, setCoins] = useState<number[]>([]);
  const [resultData, setResultData] = useState<{
    id: number;
    result: string;
    toolStatus: ToolStatus;
    aiModel?: string;
  } | null>(null);

  const [userProvider, setUserProvider] = useState<'local' | 'gemini' | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('preferred_ai_provider');
    if (saved === 'local' || saved === 'gemini') {
      setUserProvider(saved);
    }
  }, []);

  const activeProvider = userProvider || settings?.ai_provider || 'local';

  const toggleProvider = (p: 'local' | 'gemini') => {
    setUserProvider(p);
    localStorage.setItem('preferred_ai_provider', p);
    toast.info(`已切換至 ${p === 'gemini' ? 'Gemini' : 'Local AI'}`);
  };

  // 動畫佔位符
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [displayedPlaceholder, setDisplayedPlaceholder] = useState('');
  const [isTyping, setIsTyping] = useState(true);

  // Modal states
  const [showHowTo, setShowHowTo] = useState(false);
  const [showAbout, setShowAbout] = useState(false);

  const inputRef = useRef<HTMLTextAreaElement>(null);

  // 打字動畫效果
  useEffect(() => {
    const currentExample = PLACEHOLDER_EXAMPLES[placeholderIndex];
    let charIndex = 0;
    let timeout: NodeJS.Timeout;

    if (isTyping) {
      // 打字效果
      const typeChar = () => {
        if (charIndex <= currentExample.length) {
          setDisplayedPlaceholder(currentExample.slice(0, charIndex));
          charIndex++;
          timeout = setTimeout(typeChar, 80);
        } else {
          // 打字完成，等待後切換
          timeout = setTimeout(() => {
            setIsTyping(false);
          }, 2000);
        }
      };
      typeChar();
    } else {
      // 刪除效果
      charIndex = currentExample.length;
      const deleteChar = () => {
        if (charIndex >= 0) {
          setDisplayedPlaceholder(currentExample.slice(0, charIndex));
          charIndex--;
          timeout = setTimeout(deleteChar, 40);
        } else {
          // 刪除完成，切換到下一個
          setPlaceholderIndex((prev) => (prev + 1) % PLACEHOLDER_EXAMPLES.length);
          setIsTyping(true);
        }
      };
      deleteChar();
    }

    return () => clearTimeout(timeout);
  }, [placeholderIndex, isTyping]);

  const checkConfig = () => {
    if (activeProvider === 'gemini') {
      const hasKey = !!geminiApiKey || backendApiKeys.gemini;
      if (!hasKey) {
        toast.error('尚未設定 Gemini API Key，請前往設定頁面配置');
        router.push('/settings');
        return false;
      }
    } else {
      const hasLocalConfig = (settings?.local_api_url && settings?.local_model_name) ||
        (backendApiKeys.configs.local?.url && backendApiKeys.configs.local?.model);
      if (!hasLocalConfig) {
        toast.error('尚未設定 Local AI 網址或模型，請前往設定頁面配置');
        router.push('/settings');
        return false;
      }
    }
    return true;
  };

  const handleSubmit = useCallback(async () => {
    if (!question.trim()) {
      toast.error('請輸入您想問的問題');
      return;
    }

    if (!checkConfig()) return;

    // 生成六爻結果
    const newCoins = performDivination();
    setCoins(newCoins);
    setMode('tossing');
  }, [question, activeProvider, geminiApiKey, backendApiKeys, settings, router]);

  const handleTossingComplete = useCallback(async () => {
    try {
      const apiKey = settings?.ai_provider === 'gemini' ? geminiApiKey || undefined : undefined;

      const response = await api.divinate({
        question,
        coins,
        gender: gender || undefined,
        target: target || undefined,
        provider: activeProvider,
      }, apiKey);

      setResultData({
        id: response.id,
        result: response.result || '', // 如果正在處理中，result 為空
        toolStatus: response.tool_status,
        aiModel: response.ai_model,
      });
      setMode('result');
      if (!response.result) {
        toast.success('卦盤已生成！AI 正在後端努力解析中，您可以稍後在歷史紀錄查看完整結果。');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '占卜失敗，請稍後再試');
      setMode('input');
    }
  }, [question, coins, settings?.ai_provider, geminiApiKey]);

  const handleCloseResult = () => {
    setMode('input');
    setQuestion('');
    setGender('');
    setTarget('');
    setCoins([]);
    setResultData(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // 檢查是否在輸入法組字中（中文、日文等）
    if (e.nativeEvent.isComposing || e.keyCode === 229) {
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleCancelDivination = useCallback(() => {
    setMode('input');
    setCoins([]);
    toast.info('已取消占卜');
  }, []);

  if (mode === 'tossing') {
    return <CoinTossing coins={coins} onComplete={handleTossingComplete} onCancel={handleCancelDivination} />;
  }

  if (mode === 'result' && resultData) {
    return (
      <DivinationResult
        question={question}
        historyId={resultData.id}
        result={resultData.result}
        toolStatus={resultData.toolStatus}
        aiModel={resultData.aiModel}
        onClose={handleCloseResult}
      />
    );
  }

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center px-4">
      {/* Title */}
      <div className="text-center mb-8">
        <h1 className="text-4xl lg:text-5xl font-bold text-[var(--gold)] mb-3">六爻占卜</h1>
        <p className="text-xl text-foreground/80">誠心問卦，洞察天機</p>
        {/* AI Provider Switch */}
        <div className="flex flex-col items-center gap-3 mt-4">
          <div className="flex items-center gap-2 text-sm text-foreground/60">
            <Bot className="w-4 h-4" />
            <span>選擇解析 AI：</span>
          </div>
          <div className="flex bg-[var(--gold)]/5 p-1 rounded-full border border-[var(--gold)]/20">
            <button
              onClick={() => toggleProvider('local')}
              className={`px-4 py-1.5 rounded-full text-sm transition-all ${activeProvider === 'local'
                ? 'bg-[var(--gold)] text-black font-medium shadow-lg'
                : 'text-foreground/60 hover:text-foreground'
                }`}
            >
              Local AI ({backendApiKeys.configs.local?.model?.split('/').pop() || settings?.local_model_name?.split('/').pop() || '本地'})
            </button>
            <button
              onClick={() => toggleProvider('gemini')}
              className={`px-4 py-1.5 rounded-full text-sm transition-all ${activeProvider === 'gemini'
                ? 'bg-[var(--gold)] text-black font-medium shadow-lg'
                : 'text-foreground/60 hover:text-foreground'
                }`}
            >
              Gemini 3 Flash
            </button>
          </div>
        </div>
      </div>

      {/* Configuration Status Alert */}
      {(() => {
        const isGemini = activeProvider === 'gemini';
        const hasGeminiKey = !!geminiApiKey || backendApiKeys.gemini;
        const hasLocalConfig = (settings?.local_api_url && settings?.local_model_name) ||
          (backendApiKeys.configs.local?.url && backendApiKeys.configs.local?.model);

        if ((isGemini && !hasGeminiKey) || (!isGemini && !hasLocalConfig)) {
          return (
            <div className="w-full max-w-2xl mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center justify-between animate-pulse">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                <div>
                  <p className="text-red-200 font-medium">目前的 AI 尚未配置</p>
                  <p className="text-red-300/70 text-sm">請先前往設定頁面完成 AI 配置，否則將無法解卦</p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="border-red-500/50 text-red-200 hover:bg-red-500/20"
                onClick={() => router.push('/settings')}
              >
                <SettingsIcon className="w-4 h-4 mr-2" />
                去設定
              </Button>
            </div>
          );
        }
        return null;
      })()}

      {/* Input Card */}
      <Card className="glass-panel w-full max-w-2xl">
        <CardContent className="p-6">
          {/* Gender & Target Selection */}
          <div className="mb-6 space-y-4">
            {/* Gender Selection */}
            <div>
              <label className="block text-sm font-medium text-foreground/70 mb-2">
                <User className="w-4 h-4 inline-block mr-1" />
                您的性別
              </label>
              <div className="flex gap-3">
                {GENDER_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => setGender(option.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-all ${gender === option.id
                      ? 'border-[var(--gold)] bg-[var(--gold)]/10 text-[var(--gold)]'
                      : 'border-[var(--gold)]/30 hover:border-[var(--gold)]/50 text-foreground/70'
                      }`}
                  >
                    <span className="text-xl">{option.icon}</span>
                    <span>{option.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Target Selection */}
            <div>
              <label className="block text-sm font-medium text-foreground/70 mb-2">
                <Users className="w-4 h-4 inline-block mr-1" />
                占卜對象
              </label>
              <div className="flex flex-wrap gap-2">
                {TARGET_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => setTarget(option.id)}
                    className={`px-4 py-2 rounded-lg border-2 transition-all ${target === option.id
                      ? 'border-[var(--gold)] bg-[var(--gold)]/10 text-[var(--gold)]'
                      : 'border-[var(--gold)]/30 hover:border-[var(--gold)]/50 text-foreground/70'
                      }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Question Input */}
          <div className="relative">
            <textarea
              ref={inputRef}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={displayedPlaceholder}
              className="w-full h-32 bg-transparent border-2 border-[var(--gold)]/30 rounded-xl p-4 text-lg resize-none focus:outline-none focus:border-[var(--gold)] transition-colors placeholder:text-foreground/40"
            />
            <Button
              onClick={handleSubmit}
              disabled={!question.trim()}
              className="absolute bottom-4 right-4 btn-gold rounded-full px-6"
            >
              <SendHorizonal className="w-5 h-5 mr-2" />
              開始占卜
            </Button>
          </div>

          <p className="text-base text-foreground/60 mt-3 text-center">
            按 Enter 開始占卜，Shift + Enter 換行
          </p>
        </CardContent>
      </Card>

      {/* Help Buttons */}
      <div className="flex gap-4 mt-6">
        <Button
          variant="ghost"
          onClick={() => setShowHowTo(true)}
          className="text-foreground/70 hover:text-[var(--gold)]"
        >
          <HelpCircle className="w-5 h-5 mr-2" />
          如何問卦？
        </Button>
        <Button
          variant="ghost"
          onClick={() => setShowAbout(true)}
          className="text-foreground/70 hover:text-[var(--gold)]"
        >
          <BookOpen className="w-5 h-5 mr-2" />
          什麼是六爻？
        </Button>
      </div>

      {/* How To Dialog */}
      <Dialog open={showHowTo} onOpenChange={setShowHowTo}>
        <DialogContent className="glass-panel max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl text-[var(--gold)]">如何問卦？</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-base leading-relaxed">
            <section>
              <h3 className="text-lg font-semibold text-[var(--gold)] mb-2">🎯 問卦原則</h3>
              <ul className="space-y-2 text-muted-foreground">
                <li>• <strong>一事一問</strong>：每次只問一個問題</li>
                <li>• <strong>誠心誠意</strong>：心中默念問題，保持專注</li>
                <li>• <strong>問題明確</strong>：避免模糊不清的問法</li>
                <li>• <strong>不問重複</strong>：同一件事不要反覆占卜</li>
              </ul>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-[var(--gold)] mb-2">✅ 好的問法</h3>
              <ul className="space-y-1 text-muted-foreground">
                <li>• 「這份工作是否適合我？」</li>
                <li>• 「這周的財運如何？」</li>
                <li>• 「與某人合作是否順利？」</li>
              </ul>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-[var(--gold)] mb-2">❌ 不當問法</h3>
              <ul className="space-y-1 text-muted-foreground">
                <li>• 「我會中樂透嗎？」（涉及賭博）</li>
                <li>• 「他什麼時候會死？」（涉及生死）</li>
                <li>• 「我應該選A還是B？」（太模糊）</li>
              </ul>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-[var(--gold)] mb-2">⏰ 占卜時機</h3>
              <p className="text-muted-foreground">
                心靜時占卜最佳。避免在情緒激動、酒後、深夜子時占卜。
              </p>
            </section>
          </div>
        </DialogContent>
      </Dialog>

      {/* About LiuYao Dialog */}
      <Dialog open={showAbout} onOpenChange={setShowAbout}>
        <DialogContent className="glass-panel max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl text-[var(--gold)]">什麼是六爻？</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-base leading-relaxed">
            <section>
              <h3 className="text-lg font-semibold text-[var(--gold)] mb-2">📚 六爻簡介</h3>
              <p className="text-muted-foreground">
                六爻是中國傳統占卜方法之一，源自《易經》。通過投擲三枚銅錢六次，
                得出六個爻位，組成一個卦象，再根據卦象解讀吉凶禍福。
              </p>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-[var(--gold)] mb-2">🪙 起卦方式</h3>
              <p className="text-muted-foreground">
                傳統方法是用三枚銅錢，字面（有字）為陰，背面為陽。
                投擲六次，每次根據三枚錢的陰陽組合，確定一個爻。
                本系統採用電腦模擬，原理相同。
              </p>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-[var(--gold)] mb-2">📖 卦象結構</h3>
              <ul className="space-y-1 text-muted-foreground">
                <li>• <strong>六爻</strong>：初爻到上爻，共六個位置</li>
                <li>• <strong>本卦</strong>：當前狀態的卦象</li>
                <li>• <strong>變卦</strong>：發展趨勢的卦象</li>
                <li>• <strong>世應</strong>：代表自己和對方/事物</li>
                <li>• <strong>六親</strong>：父母、兄弟、子孫、妻財、官鬼</li>
                <li>• <strong>六神</strong>：青龍、朱雀、勾陳、螣蛇、白虎、玄武</li>
              </ul>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-[var(--gold)] mb-2">🤖 AI 解卦</h3>
              <p className="text-muted-foreground">
                本系統結合傳統六爻排盤與現代 AI 技術，
                為您提供專業的卦象分析和建議。
                AI 會根據卦象、爻位、五行生剋等因素，
                給出貼合您問題的詳細解讀。
              </p>
            </section>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
