'use client';

import { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, Brain } from 'lucide-react';
import { parseMarkdown, ParsedContent } from '@/lib/markdown';
import { cn } from '@/lib/utils';

export interface MarkdownRendererProps {
    content: string;
    className?: string;
    showThinkingProcess?: boolean;
    thinkingLabel?: string;
}

/**
 * Markdown renderer with think content collapsing
 * Parses AI responses and displays them with proper styling
 */
export function MarkdownRenderer({
    content,
    className,
    showThinkingProcess = true,
    thinkingLabel = 'AI 思考過程',
}: MarkdownRendererProps) {
    const [parsed, setParsed] = useState<ParsedContent>({ mainHtml: '', thinkContent: '' });
    const [thinkExpanded, setThinkExpanded] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!content) {
            setParsed({ mainHtml: '', thinkContent: '' });
            setLoading(false);
            return;
        }

        setLoading(true);
        parseMarkdown(content)
            .then(result => {
                setParsed(result);
                setLoading(false);
            })
            .catch(err => {
                console.error('Markdown parsing error:', err);
                setParsed({ mainHtml: `<p class="text-red-400">解析失敗</p>`, thinkContent: '' });
                setLoading(false);
            });
    }, [content]);

    if (loading) {
        return (
            <div className={cn('animate-pulse space-y-3', className)}>
                <div className="h-4 bg-gray-700 rounded w-3/4"></div>
                <div className="h-4 bg-gray-700 rounded w-1/2"></div>
                <div className="h-4 bg-gray-700 rounded w-5/6"></div>
            </div>
        );
    }

    return (
        <div className={cn('space-y-4', className)}>
            {/* Think Content (collapsible) */}
            {showThinkingProcess && parsed.thinkContent && (
                <div className="bg-gray-800/50 border border-gray-700 rounded-lg overflow-hidden">
                    <button
                        onClick={() => setThinkExpanded(!thinkExpanded)}
                        className="w-full flex items-center gap-2 px-4 py-3 text-left text-gray-400 hover:text-gray-200 hover:bg-gray-700/50 transition-colors"
                    >
                        {thinkExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        <Brain size={16} />
                        <span className="text-sm">{thinkingLabel}</span>
                    </button>

                    {thinkExpanded && (
                        <div className="px-4 pb-4 text-sm text-gray-400 whitespace-pre-wrap border-t border-gray-700">
                            {parsed.thinkContent}
                        </div>
                    )}
                </div>
            )}

            {/* Main Content */}
            <div
                className="markdown-content"
                dangerouslySetInnerHTML={{ __html: parsed.mainHtml }}
            />
        </div>
    );
}
