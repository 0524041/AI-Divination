'use client';

import { useMemo } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ToolStatus, StructuredResult } from '@/types';
import { X, Copy, Star, ChevronDown, Brain } from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';

// 配置 marked - 同步渲染
const renderer = new marked.Renderer();

// 自訂標題渲染
renderer.heading = ({ text, depth }: { text: string; depth: number }) => {
  const tag = `h${depth}`;
  return `<${tag}>${text}</${tag}>\n`;
};

// 自訂段落渲染
renderer.paragraph = ({ text }: { text: string }) => {
  return `<p>${text}</p>\n`;
};

// 自訂列表項渲染
renderer.listitem = ({ text }: { text: string }) => {
  return `<li>${text}</li>\n`;
};

marked.use({
  renderer,
  breaks: true,
  gfm: true,
  async: false,
});

interface DivinationResultProps {
  question: string;
  result: string;
  toolStatus: ToolStatus;
  onClose: () => void;
}

export function DivinationResult({ question, result, toolStatus, onClose }: DivinationResultProps) {
  const [showThinking, setShowThinking] = useState(false);

  // 解析結果
  const { thinkContent, mainContent, structuredData } = useMemo(() => {
    let think = '';
    let main = result;
    let structured: StructuredResult | null = null;

    // 提取 <think> 標籤內容
    const thinkMatch = result.match(/<think>([\s\S]*?)<\/think>/i);
    if (thinkMatch) {
      think = thinkMatch[1].trim();
      main = result.replace(/<think>[\s\S]*?<\/think>/i, '').trim();
    }

    // 嘗試解析 JSON 格式
    try {
      // 移除可能的 markdown 代碼塊標記
      let jsonStr = main;
      const jsonMatch = main.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1];
      }
      
      const parsed = JSON.parse(jsonStr);
      if (parsed.summary && parsed.overview && parsed.sections) {
        structured = parsed as StructuredResult;
      }
    } catch {
      // 不是 JSON，保持 Markdown 格式
    }

    return { thinkContent: think, mainContent: main, structuredData: structured };
  }, [result]);

  // 將 Markdown 轉換為 HTML (使用 DOMPurify 清理)
  const htmlContent = useMemo(() => {
    if (structuredData) return '';
    // 使用同步版本的 parse
    const rawHtml = marked.parse(mainContent, { async: false }) as string;
    // 在瀏覽器環境使用 DOMPurify
    if (typeof window !== 'undefined') {
      return DOMPurify.sanitize(rawHtml);
    }
    return rawHtml;
  }, [mainContent, structuredData]);

  const handleCopy = async () => {
    try {
      const textToCopy = structuredData
        ? `問題：${question}\n\n${structuredData.summary}\n\n${structuredData.guidance.conclusion}\n\n${structuredData.guidance.suggestions.join('\n')}`
        : `問題：${question}\n\n${mainContent}`;
      await navigator.clipboard.writeText(textToCopy);
      toast.success('已複製到剪貼簿');
    } catch {
      toast.error('複製失敗');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80">
      <Card className="glass-panel w-full max-w-[95vw] lg:max-w-5xl xl:max-w-6xl max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <CardHeader className="flex-shrink-0 border-b border-border/50 px-4 sm:px-6">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-[var(--gold)] text-base sm:text-lg">
              <Star className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
              卦象解析
            </CardTitle>
            <div className="flex items-center gap-2 sm:gap-4">
              {/* Status indicators */}
              <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm">
                <div className="flex items-center gap-1">
                  <div className={`status-dot ${toolStatus.get_divination_tool === 'success' ? 'success' : toolStatus.get_divination_tool === 'error' ? 'error' : ''}`} />
                  <span className="text-muted-foreground hidden sm:inline">排盤</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className={`status-dot ${toolStatus.get_current_time === 'success' ? 'success' : toolStatus.get_current_time === 'error' ? 'error' : ''}`} />
                  <span className="text-muted-foreground hidden sm:inline">天時</span>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose} className="flex-shrink-0">
                <X className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </CardHeader>

        {/* Content */}
        <CardContent className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Question */}
          <div className="bg-muted/30 rounded-lg p-4">
            <span className="text-[var(--gold)] font-medium">問題：</span>
            <span className="ml-2">{question}</span>
          </div>

          {/* Thinking Process (Collapsible) */}
          {thinkContent && (
            <div className="border border-border/50 rounded-lg overflow-hidden">
              <button
                className="w-full flex items-center justify-between p-4 hover:bg-muted/20 transition-colors"
                onClick={() => setShowThinking(!showThinking)}
              >
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Brain className="w-4 h-4" />
                  <span>大師思考過程</span>
                </div>
                <ChevronDown className={`w-4 h-4 transition-transform ${showThinking ? 'rotate-180' : ''}`} />
              </button>
              {showThinking && (
                <div className="p-4 pt-0 text-sm text-muted-foreground whitespace-pre-wrap border-t border-border/50">
                  {thinkContent}
                </div>
              )}
            </div>
          )}

          {/* Structured Result */}
          {structuredData ? (
            <div className="space-y-6">
              {/* Summary Banner */}
              <div className="bg-gradient-to-r from-[var(--gold)]/20 to-transparent border-l-4 border-[var(--gold)] p-4 rounded-r-lg">
                <p className="text-lg font-medium">{structuredData.summary}</p>
              </div>

              {/* Overview */}
              <div className="text-center py-4">
                <h3 className="text-xl font-bold text-[var(--gold)]">{structuredData.overview.title}</h3>
                <p className="text-muted-foreground mt-1">{structuredData.overview.meaning}</p>
              </div>

              <Separator />

              {/* Sections */}
              {structuredData.sections.map((section, index) => (
                <div key={index} className="space-y-2">
                  <h4 className="font-semibold text-[var(--gold)] flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-[var(--gold)]/20 flex items-center justify-center text-sm">
                      {index + 1}
                    </span>
                    {section.title}
                  </h4>
                  <p className="text-card-foreground/90 leading-relaxed pl-8">
                    {section.content}
                  </p>
                </div>
              ))}

              <Separator />

              {/* Guidance */}
              <div className="bg-muted/20 rounded-lg p-6 space-y-4">
                <Badge variant="secondary" className="text-lg px-4 py-1">
                  {structuredData.guidance.conclusion}
                </Badge>
                
                <ul className="space-y-2">
                  {structuredData.guidance.suggestions.map((suggestion, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-[var(--gold)]">•</span>
                      <span>{suggestion}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-4 pt-4 border-t border-border/50 text-center">
                  <p className="text-[var(--gold)] italic">「{structuredData.guidance.motto}」</p>
                </div>
              </div>
            </div>
          ) : (
            /* Markdown Content */
            <div
              className="markdown-content"
              dangerouslySetInnerHTML={{ __html: htmlContent }}
            />
          )}
        </CardContent>

        {/* Footer */}
        <div className="flex-shrink-0 p-4 border-t border-border/50 flex justify-end">
          <Button onClick={handleCopy} className="btn-gold">
            <Copy className="w-4 h-4 mr-2" />
            複製結果
          </Button>
        </div>
      </Card>
    </div>
  );
}
