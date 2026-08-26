'use client';

/**
 * MarkdownRenderer — 全站唯一 Markdown 渲染出口（streamdown-render spec）
 *
 * 核心為 Vercel Streamdown：
 * - streaming=true：block 切分＋memoization，僅尾端 block 隨 delta 重渲染；
 *   remend 即時補閉未完成語法（粗體／表格列／code fence）。
 * - streaming=false（static）：單趟渲染，用於已完成內容（分享頁、歷史訊息）。
 *
 * 內容前置：<think> 提取與「AI 整份包 code fence」剝殼；單換行維持 <br> 語義
 * （remark-breaks）；sanitize 由 Streamdown（rehype-sanitize + harden）承擔。
 */

import { useMemo, useState } from 'react';
import { Streamdown } from 'streamdown';
import { ChevronDown, ChevronRight, Brain } from 'lucide-react';
import { cn } from '@/lib/utils';
import 'streamdown/styles.css';

export interface MarkdownRendererProps {
    content: string;
    className?: string;
    showThinkingProcess?: boolean;
    thinkingLabel?: string;
    /** 串流進行中（block memoization＋未完成語法補閉） */
    streaming?: boolean;
}

/**
 * 單換行 → 強制換行（行尾兩空格），維持舊 marked breaks:true 語義。
 * 不用 remark-breaks：它會破壞 GFM 表格解析。文字層處理對表格（尾隨空白被
 * 忽略）與 code fence（整段跳過）皆安全。
 */
function applyHardBreaks(text: string): string {
    const lines = text.split('\n');
    let inFence = false;
    return lines
        .map((line, i) => {
            if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
            if (inFence) return line;
            const next = lines[i + 1];
            if (!next || next.trim() === '' || line.trim() === '') return line;
            if (/[ \t]{2,}$/.test(line)) return line;
            return line.replace(/[ \t]*$/, '  ');
        })
        .join('\n');
}

/** 內容前置：提取 <think>、剝除整份包 code fence 的外殼 */
function preprocessContent(raw: string): { thinkContent: string; body: string } {
    if (!raw) return { thinkContent: '', body: '' };

    const thinkMatch = raw.match(/<think>([\s\S]*?)<\/think>/i);
    const thinkContent = thinkMatch ? thinkMatch[1].trim() : '';
    // 先 trim 再剝殼——AI 輸出常帶前導換行，^``` 錨點才能命中
    let body = (thinkMatch ? raw.replace(/<think>[\s\S]*?<\/think>/gi, '') : raw).trim();

    // 語言標記容忍未收完的串流中間態（如「```m」）
    body = body.replace(/^(```|~~~)[a-zA-Z0-9]*[ \t]*\n?/, '');
    body = body.replace(/\n?(```|~~~)[ \t]*$/, '');
    return { thinkContent, body: applyHardBreaks(body.trim()) };
}

export function MarkdownRenderer({
    content,
    className,
    showThinkingProcess = true,
    thinkingLabel = 'AI 思考過程',
    streaming = false,
}: MarkdownRendererProps) {
    const [thinkExpanded, setThinkExpanded] = useState(false);
    const { thinkContent, body } = useMemo(() => preprocessContent(content), [content]);

    return (
        <div className={cn('space-y-4', className)}>
            {showThinkingProcess && thinkContent && (
                <div className="bg-gray-800/50 border border-gray-700 rounded-lg overflow-hidden">
                    <button
                        type="button"
                        onClick={() => setThinkExpanded(!thinkExpanded)}
                        className="w-full flex items-center gap-2 px-4 py-3 text-left text-gray-400 hover:text-gray-200 hover:bg-gray-700/50 transition-colors"
                    >
                        {thinkExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        <Brain size={16} />
                        <span className="text-sm">{thinkingLabel}</span>
                    </button>

                    {thinkExpanded && (
                        <div className="px-4 pb-4 text-sm text-gray-400 whitespace-pre-wrap border-t border-gray-700">
                            {thinkContent}
                        </div>
                    )}
                </div>
            )}

            <Streamdown
                mode={streaming ? 'streaming' : 'static'}
                isAnimating={streaming}
                allowedTags={{ span: ['class', 'style'] }}
                className="markdown-content"
            >
                {body}
            </Streamdown>
        </div>
    );
}
