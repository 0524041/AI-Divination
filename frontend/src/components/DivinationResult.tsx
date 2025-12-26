'use client';

import { useMemo, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { ToolStatus } from '@/types';
import { X, Copy, ChevronDown, Brain, CheckCircle2, Bot } from 'lucide-react';
import { toast } from 'sonner';

interface DivinationResultProps {
  question: string;
  historyId: number;
  result: string;
  toolStatus: ToolStatus;
  aiModel?: string;
  onClose: () => void;
}

export function DivinationResult({ question, historyId, result, toolStatus, aiModel, onClose }: DivinationResultProps) {
  const [showThinking, setShowThinking] = useState(true); // 預設展開思考過程
  const [currentResult, setCurrentResult] = useState(result);
  const [currentAiModel, setCurrentAiModel] = useState(aiModel);
  const [htmlContent, setHtmlContent] = useState('');
  const [isPolling, setIsPolling] = useState(!result);

  // 解析結果，提取思考過程
  const { thinkContent, mainContent } = useMemo(() => {
    let think = '';
    let main = currentResult;

    if (!main) return { thinkContent: '', mainContent: '' };

    // 提取 <think> 標籤內容
    const thinkMatch = main.match(/<think>([\s\S]*?)<\/think>/i);
    if (thinkMatch) {
      think = thinkMatch[1].trim();
      main = main.replace(/<think>[\s\S]*?<\/think>/i, '').trim();
    }

    // 移除 markdown code fence
    main = main.replace(/^```[\s\S]*?\n/, '').replace(/\n```$/, '').trim();

    return { thinkContent: think, mainContent: main };
  }, [currentResult]);

  // Polling logic
  useEffect(() => {
    if (!isPolling) return;

    const poll = async () => {
      try {
        const item = await api.getHistoryItem(historyId);
        if (item.interpretation && item.interpretation !== "processing...") {
          setCurrentResult(item.interpretation);
          setCurrentAiModel(item.ai_model);
          setIsPolling(false);
          toast.success('大師已完成解析！');
        }
      } catch (error) {
        console.error('Polling failed:', error);
      }
    };

    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [isPolling, historyId]);

  // 客戶端 Markdown 渲染
  useEffect(() => {
    const renderMarkdown = async () => {
      if (typeof window === 'undefined') return;

      const { marked } = await import('marked');
      const DOMPurify = (await import('dompurify')).default;

      // 配置 marked
      marked.setOptions({
        breaks: true,
        gfm: true,
      });

      const rawHtml = await marked.parse(mainContent);
      const cleanHtml = DOMPurify.sanitize(rawHtml);
      setHtmlContent(cleanHtml);
    };

    renderMarkdown();
  }, [mainContent]);

  const handleCopy = async () => {
    try {
      const textToCopy = `## 問題\n${question}\n\n## 解卦結果\n${mainContent}`;
      await navigator.clipboard.writeText(textToCopy);
      toast.success('已複製到剪貼簿（Markdown 格式）');
    } catch {
      toast.error('複製失敗');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 overflow-y-auto">
      <Card className="glass-panel w-full max-w-[95vw] lg:max-w-5xl max-h-[95vh] overflow-hidden flex flex-col my-auto">
        {/* Header */}
        <CardHeader className="flex-shrink-0 border-b border-border/50 px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-3 text-xl sm:text-2xl text-[var(--gold)]">
              <span className="text-2xl">☯</span>
              卦象解析
            </CardTitle>
            <div className="flex items-center gap-3 sm:gap-4">
              {/* Status indicators */}
              <div className="hidden sm:flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${toolStatus.get_divination_tool === 'success' ? 'bg-green-500' : 'bg-red-500'}`} />
                  <span className="text-muted-foreground">排盤</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${toolStatus.get_current_time === 'success' ? 'bg-green-500' : 'bg-red-500'}`} />
                  <span className="text-muted-foreground">天時</span>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="w-6 h-6" />
              </Button>
            </div>
          </div>
        </CardHeader>

        {/* Content */}
        <CardContent className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* Question */}
          <div className="bg-[var(--gold)]/10 border border-[var(--gold)]/30 rounded-xl p-4">
            <span className="text-[var(--gold)] font-semibold text-lg">問題：</span>
            <span className="ml-2 text-lg">{question}</span>
          </div>

          {/* Thinking Process (Collapsible) */}
          {thinkContent && (
            <div className="border border-border/50 rounded-xl overflow-hidden">
              <button
                className="w-full flex items-center justify-between p-4 hover:bg-muted/20 transition-colors"
                onClick={() => setShowThinking(!showThinking)}
              >
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Brain className="w-5 h-5" />
                  <span className="text-base">大師思考過程</span>
                </div>
                <ChevronDown className={`w-5 h-5 transition-transform ${showThinking ? 'rotate-180' : ''}`} />
              </button>
              {showThinking && (
                <div className="p-4 pt-0 text-base text-muted-foreground whitespace-pre-wrap border-t border-border/50 leading-relaxed">
                  {thinkContent}
                </div>
              )}
            </div>
          )}

          {/* Main Content - Rendered Markdown */}
          {mainContent ? (
            <div
              className="result-content"
              dangerouslySetInnerHTML={{ __html: htmlContent }}
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
              <div className="animate-spin text-[var(--gold)]">
                <Brain className="w-12 h-12" />
              </div>
              <p className="text-xl text-foreground font-medium">大師正在閉目沉思，調閱天機...</p>
              <p className="text-base text-muted-foreground max-w-md">
                由於高級思考模式運算較慢，且系統為確保結果準確正在全力運算中。
                您可以現在關閉此視窗，解卦完成後會自動存入<strong>歷史紀錄</strong>。
              </p>
            </div>
          )}
        </CardContent>

        {/* Footer */}
        <div className="flex-shrink-0 p-4 border-t border-border/50 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span>六爻占卜</span>
            </div>
            {currentAiModel && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Bot className="w-4 h-4 text-[var(--gold)]" />
                <span>{currentAiModel}</span>
              </div>
            )}
          </div>
          <Button onClick={handleCopy} className="btn-gold">
            <Copy className="w-4 h-4 mr-2" />
            複製結果
          </Button>
        </div>
      </Card>
    </div>
  );
}
