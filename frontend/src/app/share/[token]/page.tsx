'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { parseMarkdown } from '@/lib/markdown';
import Link from 'next/link';
import {
    Compass,
    Share2,
    AlertCircle,
    Clock,
} from 'lucide-react';
import { getAIProviderDisplayName } from '@/components/features/AISelector';

interface SharedData {
    divination_type: string;
    question: string;
    gender: string | null;
    target: string | null;
    chart_data: {
        benguaming?: string;
        bianguaming?: string;
        formatted?: string;
        spread?: string;
        spread_name?: string;
        cards?: Array<{
            id: number;
            name: string;
            name_cn: string;
            image: string;
            reversed: boolean;
            position: string;
        }>;
    };
    chart_data_display: string | null;
    interpretation: string | null;
    ai_provider: string | null;
    ai_model: string | null;
}

export default function SharePage() {
    const params = useParams();
    const token = params.token as string;

    const [data, setData] = useState<SharedData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [htmlContent, setHtmlContent] = useState<{ mainHtml: string; thinkContent: string } | null>(null);

    useEffect(() => {
        if (token) {
            fetchSharedData();
        }
    }, [token]);

    const fetchSharedData = async () => {
        try {
            const res = await fetch(`/api/share/${token}`);

            if (res.status === 404) {
                setError('分享連結不存在');
                return;
            }

            if (res.status === 410) {
                setError('分享連結已過期（連結有效期為 7 天）');
                return;
            }

            if (!res.ok) {
                setError('無法載入分享內容');
                return;
            }

            const result = await res.json();
            setData(result);

            // 解析 Markdown
            if (result.interpretation) {
                const parsed = await parseMarkdown(result.interpretation);
                setHtmlContent(parsed);
            }
        } catch (err) {
            console.error('Fetch error:', err);
            setError('載入失敗，請稍後再試');
        } finally {
            setLoading(false);
        }
    };

    const getDivinationTypeName = (type: string) => {
        const types: Record<string, string> = {
            liuyao: '六爻占卜',
            ziwei: '紫微斗數',
            bazi: '八字命盤',
            tarot: '塔羅占卜',
        };
        return types[type] || type;
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="text-6xl mb-4 animate-spin-slow">☯</div>
                    <p className="text-gray-400">載入分享內容...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center px-4">
                <div className="glass-card p-8 text-center max-w-md">
                    <AlertCircle className="mx-auto mb-4 text-red-400" size={48} />
                    <h1 className="text-xl font-bold text-gray-200 mb-2">無法載入</h1>
                    <p className="text-gray-400 mb-6">{error}</p>
                    <Link
                        href="/"
                        className="btn-gold inline-flex items-center gap-2"
                    >
                        <Compass size={18} />
                        前往首頁
                    </Link>
                </div>
            </div>
        );
    }

    if (!data) {
        return null;
    }

    return (
        <div className="min-h-screen">
            {/* 導航欄 */}
            <nav className="glass-card mx-4 mt-4 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Share2 className="text-[var(--gold)]" size={24} />
                    <h1 className="text-xl font-bold text-[var(--gold)]">分享結果</h1>
                </div>
                <Link
                    href="/"
                    className="flex items-center gap-2 text-gray-300 hover:text-[var(--gold)] transition"
                >
                    <Compass size={20} />
                    <span className="hidden sm:inline">自己也想算一卦</span>
                </Link>
            </nav>

            {/* 主內容 */}
            <main className="w-full max-w-4xl mx-auto px-4 py-6">
                {/* 問題卡片 */}
                <div className="glass-card p-6 mb-6">
                    <div className="flex items-center gap-2 mb-4">
                        <span className="text-xs bg-[var(--gold)]/20 text-[var(--gold)] px-2 py-1 rounded">
                            {getDivinationTypeName(data.divination_type)}
                        </span>
                    </div>

                    <h2 className="text-lg font-bold text-gray-200 mb-2">問題</h2>
                    <p className="text-gray-300 whitespace-pre-wrap">{data.question}</p>

                    {/* 額外資訊 */}
                    {(data.target || data.gender || (data.divination_type === 'tarot' && data.chart_data.spread_name)) && (
                        <div className="flex flex-wrap gap-3 mt-4 text-sm text-gray-400">
                            {data.divination_type === 'tarot' && data.chart_data.spread_name && (
                                <span className="bg-gray-800 px-2 py-0.5 rounded border border-gray-700">
                                    牌陣：<span className="text-gray-300">{data.chart_data.spread_name}</span>
                                </span>
                            )}
                            {data.target && (
                                <span className="bg-gray-800 px-2 py-0.5 rounded border border-gray-700">
                                    對象：<span className="text-gray-300">{data.target}</span>
                                </span>
                            )}
                            {data.gender && (
                                <span className="bg-gray-800 px-2 py-0.5 rounded border border-gray-700">
                                    性別：<span className="text-gray-300">{data.gender}</span>
                                </span>
                            )}
                        </div>
                    )}

                    {/* 卦象資訊 */}
                    {data.divination_type !== 'tarot' && data.chart_data.benguaming && (
                        <p className="text-sm text-gray-500 mt-3">
                            {data.chart_data.benguaming} → {data.chart_data.bianguaming || '無變卦'}
                        </p>
                    )}
                </div>

                {/* 解盤內容 */}
                <div className="glass-card p-6 space-y-4">
                    {/* AI 資訊 */}
                    {data.ai_provider && (
                        <div className="text-sm text-gray-500 flex items-center gap-2">
                            <Clock size={14} />
                            AI: {getAIProviderDisplayName(data.ai_provider, data.ai_model)}
                        </div>
                    )}

                    {/* 思考過程（可摺疊） */}
                    {htmlContent?.thinkContent && (
                        <details className="bg-gray-800/50 rounded-lg border border-gray-700">
                            <summary className="px-4 py-3 cursor-pointer text-gray-400 hover:text-[var(--gold)] flex items-center gap-2">
                                <span className="text-lg">🧠</span>
                                <span>AI 思考過程（點擊展開）</span>
                            </summary>
                            <div className="px-4 pb-4 text-gray-400 text-sm whitespace-pre-wrap border-t border-gray-700 pt-3">
                                {htmlContent.thinkContent}
                            </div>
                        </details>
                    )}

                    {/* 卦象盤面（使用簡化版） */}
                    {data.divination_type === 'liuyao' && data.chart_data_display && (
                        <details className="bg-gray-800/50 rounded-lg border border-gray-700">
                            <summary className="px-4 py-3 cursor-pointer text-gray-400 hover:text-[var(--gold)] flex items-center gap-2">
                                <span className="text-lg">☯</span>
                                <span>完整卦象盤面（點擊展開）</span>
                            </summary>
                            <div className="px-4 pb-4 text-gray-300 text-sm border-t border-gray-700 pt-3 leading-relaxed whitespace-pre-wrap font-mono">
                                {data.chart_data_display}
                            </div>
                        </details>
                    )}

                    {/* 塔羅牌陣 */}
                    {data.divination_type === 'tarot' && data.chart_data.cards && (
                        <details className="bg-gray-800/50 rounded-lg border border-gray-700">
                            <summary className="px-4 py-3 cursor-pointer text-gray-400 hover:text-[var(--gold)] flex items-center gap-2">
                                <span className="text-lg">🎴</span>
                                <span>牌陣詳情（點擊展開）</span>
                            </summary>
                            <div className="px-4 pb-4 text-gray-300 text-sm border-t border-gray-700 pt-3 leading-relaxed">
                                <div className="font-bold text-[var(--gold)] mb-3">
                                    {data.chart_data.spread === 'three_card' ? '三牌陣（過去-現在-未來）' :
                                        data.chart_data.spread === 'single' ? '單抽牌' :
                                            data.chart_data.spread === 'celtic_cross' ? '凱爾特十字' : '未知牌陣'}
                                </div>
                                {data.chart_data.cards.map((card, idx) => (
                                    <div key={idx} className="flex items-start gap-3 py-2 border-b border-gray-800 last:border-0">
                                        <span className="text-[var(--gold)] font-bold min-w-[60px]">
                                            {card.position === 'past' ? '過去' :
                                                card.position === 'present' ? '現在' :
                                                    card.position === 'future' ? '未來' : card.position}:
                                        </span>
                                        <span className="flex-1">
                                            {card.name_cn} ({card.name}){card.reversed ? ' (逆位)' : ''}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </details>
                    )}

                    {/* 主要解盤內容 */}
                    {htmlContent?.mainHtml ? (
                        <div
                            className="markdown-content bg-gray-800/30 rounded-xl p-4"
                            dangerouslySetInnerHTML={{ __html: htmlContent.mainHtml }}
                        />
                    ) : (
                        <p className="text-gray-500">暫無解盤結果</p>
                    )}
                </div>

                {/* 底部 CTA */}
                <div className="mt-8 text-center">
                    <Link
                        href="/"
                        className="btn-gold inline-flex items-center gap-2 text-lg px-8 py-3"
                    >
                        <Compass size={20} />
                        自己也想算一卦
                    </Link>
                    <p className="text-gray-500 text-sm mt-4">
                        點擊上方按鈕，開始你的占卜之旅
                    </p>
                </div>
            </main>

            {/* 頁尾 */}
            <footer className="text-center py-8 text-gray-600 text-sm">
                <p>AI 占卜結果僅供參考，請理性看待</p>
            </footer>
        </div>
    );
}
