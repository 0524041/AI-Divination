'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Bot, ChevronDown, Check, Settings, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface AIConfig {
    id: number;
    provider: string;
    has_api_key: boolean;
    local_url: string | null;
    local_model: string | null;
    is_active: boolean;
}

export interface AISelectorProps {
    className?: string;
    onConfigChange?: (config: AIConfig) => void;
    showWarning?: boolean;
    warningMessage?: string;
}

/**
 * Reusable AI provider selector dropdown
 * Displays current AI config and allows switching
 */
export function AISelector({
    className,
    onConfigChange,
    showWarning = true,
    warningMessage = '使用 Local AI 時，解盤最長可能需要等待 5 分鐘',
}: AISelectorProps) {
    const [configs, setConfigs] = useState<AIConfig[]>([]);
    const [activeConfig, setActiveConfig] = useState<AIConfig | null>(null);
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        fetchConfigs();
    }, []);

    const fetchConfigs = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/settings/ai', {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                const data = await res.json();
                setConfigs(data);
                const active = data.find((c: AIConfig) => c.is_active);
                setActiveConfig(active || null);
            }
        } catch (err) {
            console.error('Fetch AI configs error:', err);
        }
    };

    const handleSwitch = async (configId: number) => {
        try {
            const token = localStorage.getItem('token');
            await fetch(`/api/settings/ai/${configId}/activate`, {
                method: 'PUT',
                headers: { Authorization: `Bearer ${token}` },
            });
            await fetchConfigs();
            setIsOpen(false);

            const newActive = configs.find(c => c.id === configId);
            if (newActive) {
                onConfigChange?.(newActive);
            }
        } catch (err) {
            console.error('Switch AI error:', err);
        }
    };

    const getDisplayName = (config: AIConfig) => {
        if (config.provider === 'gemini') return 'Google Gemini';
        if (config.provider === 'openai') return 'OpenAI';
        return `Local AI (${config.local_model})`;
    };

    return (
        <div className={cn('relative z-20', className)}>
            {/* Current AI Display */}
            <div className="bg-[rgba(22,33,62,0.8)] backdrop-blur-sm border border-[rgba(212,175,55,0.2)] rounded-xl p-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Bot className="text-[var(--gold)]" size={20} />
                        <span className="text-sm text-gray-400">當前 AI：</span>
                        {activeConfig ? (
                            <span className="text-[var(--gold)] font-medium">{getDisplayName(activeConfig)}</span>
                        ) : (
                            <span className="text-red-400">未設定</span>
                        )}
                    </div>

                    <button
                        onClick={() => setIsOpen(!isOpen)}
                        className="text-sm text-gray-400 hover:text-[var(--gold)] flex items-center gap-1 transition-colors"
                    >
                        切換 AI
                        <ChevronDown size={16} className={cn('transition-transform', isOpen && 'rotate-180')} />
                    </button>
                </div>

                {/* Warning for Local AI */}
                {showWarning && activeConfig?.provider === 'local' && (
                    <div className="mt-3 flex items-start gap-2 text-xs text-amber-400/80 bg-amber-400/10 rounded-lg p-2">
                        <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                        <span>{warningMessage}</span>
                    </div>
                )}
            </div>

            {/* Dropdown */}
            {isOpen && configs.length > 0 && (
                <div className="absolute right-0 top-full mt-2 bg-gray-800 border border-gray-700 rounded-lg shadow-xl min-w-[200px] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                    {configs.map((config) => (
                        <button
                            key={config.id}
                            onClick={() => handleSwitch(config.id)}
                            className={cn(
                                'w-full text-left px-4 py-3 hover:bg-gray-700 transition-colors flex items-center justify-between',
                                config.is_active ? 'text-[var(--gold)]' : 'text-gray-300'
                            )}
                        >
                            <span>{getDisplayName(config)}</span>
                            {config.is_active && <Check size={14} />}
                        </button>
                    ))}

                    <Link
                        href="/settings"
                        className="block w-full text-center px-4 py-2 text-sm text-gray-500 hover:text-[var(--gold)] border-t border-gray-700 transition-colors"
                    >
                        <Settings size={14} className="inline mr-1" />
                        管理 AI 設定
                    </Link>
                </div>
            )}
        </div>
    );
}
