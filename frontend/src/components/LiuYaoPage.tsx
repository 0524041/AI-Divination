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
import { HelpCircle, BookOpen, SendHorizonal, Bot } from 'lucide-react';
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

type Mode = 'input' | 'tossing' | 'result';

export function LiuYaoPage() {
  const { settings, geminiApiKey } = useApp();
  const [mode, setMode] = useState<Mode>('input');
  const [question, setQuestion] = useState('');
  const [coins, setCoins] = useState<number[]>([]);
  const [resultData, setResultData] = useState<{
    result: string;
    toolStatus: ToolStatus;
    aiModel?: string;
  } | null>(null);
  
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

  const handleSubmit = useCallback(async () => {
    if (!question.trim()) {
      toast.error('請輸入您想問的問題');
      return;
    }
    
    // 生成六爻結果
    const newCoins = performDivination();
    setCoins(newCoins);
    setMode('tossing');
  }, [question]);

  const handleTossingComplete = useCallback(async () => {
    console.log('[LiuYaoPage] handleTossingComplete called');
    console.log('[LiuYaoPage] question:', question);
    console.log('[LiuYaoPage] coins:', coins);
    console.log('[LiuYaoPage] settings?.ai_provider:', settings?.ai_provider);
    
    try {
      const apiKey = settings?.ai_provider === 'gemini' ? geminiApiKey || undefined : undefined;
      
      console.log('[LiuYaoPage] Calling api.divinate...');
      const response = await api.divinate({
        question,
        coins,
      }, apiKey);
      
      console.log('[LiuYaoPage] Response received:', response);

      setResultData({
        result: response.result,
        toolStatus: response.tool_status,
        aiModel: response.ai_model,
      });
      setMode('result');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '占卜失敗，請稍後再試');
      setMode('input');
    }
  }, [question, coins, settings?.ai_provider, geminiApiKey]);

  const handleCloseResult = () => {
    setMode('input');
    setQuestion('');
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
        {/* Current AI Model */}
        <div className="flex items-center justify-center gap-2 mt-3 text-base text-foreground/70">
          <Bot className="w-4 h-4" />
          <span>AI 模型：</span>
          <span className="text-[var(--gold)]">
            {settings?.ai_provider === 'gemini' ? 'Gemini (gemini-3-flash-preview)' : settings?.local_model_name || 'Local AI'}
          </span>
        </div>
      </div>

      {/* Input Card */}
      <Card className="glass-panel w-full max-w-2xl">
        <CardContent className="p-6">
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
