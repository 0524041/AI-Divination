'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { Bot, ChevronDown, Check, Settings, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface AIConfig {
    id: number;
    provider: string;
    name: string | null;
    has_api_key: boolean;
    local_url: string | null;
    local_model: string | null;
    is_active: boolean;
}

export interface AISelectorProps {
    /** 額外的 CSS class */
    className?: string;
    /** 當 AI 配置變更時的回調 */
    onConfigChange?: (config: AIConfig | null) => void;
    /** 是否顯示本地 AI 警告 */
    showWarning?: boolean;
    /** 自訂警告訊息 */
    warningMessage?: string;
    /** 樣式變體 */
    variant?: 'default' | 'compact' | 'card';
    /** 外部控制：當前活躍的配置（用於父組件同步狀態） */
    externalActiveConfig?: AIConfig | null;
}

/**
 * 取得 AI 顯示名稱（優先使用自訂名稱）
 */
export function getAIDisplayName(config: AIConfig): string {
    // 優先顯示用戶自訂名稱
    if (config.name) return config.name;
    
    // 否則使用預設名稱
    if (config.provider === 'gemini') return 'Google Gemini';
    if (config.provider === 'openai') return 'OpenAI';
    return `Local AI (${config.local_model})`;
}

/**
 * 可重用的 AI 選擇器組件
 * 顯示當前 AI 配置並允許切換
 */
export function AISelector({
    className,
    onConfigChange,
    showWarning = true,
    warningMessage = '使用其他 AI 服務時，解盤最長可能需要等待 5 分鐘，取決於伺服器性能。',
    variant = 'default',
    externalActiveConfig,
}: AISelectorProps) {
    const [configs, setConfigs] = useState<AIConfig[]>([]);
    const [activeConfig, setActiveConfig] = useState<AIConfig | null>(null);
    const [isOpen, setIsOpen] = useState(false);

    // 使用外部配置或內部配置
    const currentConfig = externalActiveConfig !== undefined ? externalActiveConfig : activeConfig;

    // 使用 ref 來存儲 onConfigChange，避免無限重渲染
    const onConfigChangeRef = useRef(onConfigChange);
    onConfigChangeRef.current = onConfigChange;

    const fetchConfigs = useCallback(async () => {
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
                // 通知父組件
                onConfigChangeRef.current?.(active || null);
            }
        } catch (err) {
            console.error('Fetch AI configs error:', err);
        }
    }, []);

    useEffect(() => {
        fetchConfigs();
    }, [fetchConfigs]);

    const handleSwitch = async (configId: number) => {
        try {
            const token = localStorage.getItem('token');
            await fetch(`/api/settings/ai/${configId}/activate`, {
                method: 'PUT',
                headers: { Authorization: `Bearer ${token}` },
            });
            await fetchConfigs();
            setIsOpen(false);
        } catch (err) {
            console.error('Switch AI error:', err);
        }
    };

    // 判斷是否需要顯示警告（非 gemini 的都顯示）
    const shouldShowWarning = showWarning && currentConfig && currentConfig.provider !== 'gemini';

    // Default 樣式
    if (variant === 'default') {
        return (
            <div className={cn('relative z-20', className)}>
                <div className="bg-[rgba(22,33,62,0.8)] backdrop-blur-sm border border-[rgba(212,175,55,0.2)] rounded-xl p-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Bot className="text-[var(--gold)]" size={20} />
                            <span className="text-sm text-gray-400">當前 AI：</span>
                            {currentConfig ? (
                                <span className="text-[var(--gold)] font-medium">{getAIDisplayName(currentConfig)}</span>
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

                    {shouldShowWarning && (
                        <div className="mt-3 flex items-start gap-2 text-xs text-amber-400/80 bg-amber-400/10 rounded-lg p-2">
                            <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                            <span>{warningMessage}</span>
                        </div>
                    )}
                </div>

                {/* Dropdown */}
                {isOpen && configs.length > 0 && (
                    <div className="absolute right-0 top-full mt-2 bg-gray-800 border border-gray-700 rounded-lg shadow-xl min-w-[200px] overflow-hidden animate-in fade-in zoom-in-95 duration-200 z-50">
                        {configs.map((config) => (
                            <button
                                key={config.id}
                                onClick={() => handleSwitch(config.id)}
                                className={cn(
                                    'w-full text-left px-4 py-3 hover:bg-gray-700 transition-colors flex items-center justify-between',
                                    config.is_active ? 'text-[var(--gold)]' : 'text-gray-300'
                                )}
                            >
                                <span>{getAIDisplayName(config)}</span>
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

    // Card 樣式（用於塔羅等需要更大按鈕的頁面）
    if (variant === 'card') {
        return (
            <div className={cn('relative z-20', className)}>
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="w-full flex items-center justify-between px-6 py-4 bg-gray-800/40 border border-gray-700 rounded-2xl hover:border-[var(--gold)] hover:bg-gray-800/60 transition-all duration-300 backdrop-blur-sm"
                >
                    <div className="flex items-center gap-4">
                        <div className="p-2 bg-[var(--gold)]/10 rounded-lg">
                            <Bot className="text-[var(--gold)]" size={24} />
                        </div>
                        <div className="text-left">
                            <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">AI 解盤服務</div>
                            <div className="font-medium text-gray-200 text-lg">
                                {currentConfig ? getAIDisplayName(currentConfig) : '未設定 AI'}
                            </div>
                        </div>
                    </div>
                    <ChevronDown size={20} className={cn('text-gray-400 transition-transform duration-300', isOpen && 'rotate-180')} />
                </button>

                {isOpen && configs.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-[#1a1a2e] border border-gray-700 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        {configs.map((config) => {
                            const isSelected = currentConfig?.id === config.id;
                            return (
                                <button
                                    key={config.id}
                                    onClick={() => handleSwitch(config.id)}
                                    className={cn(
                                        'w-full px-6 py-4 flex items-center justify-between hover:bg-gray-800 transition',
                                        isSelected && 'bg-[var(--gold)]/5'
                                    )}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={cn(
                                            'w-2 h-2 rounded-full',
                                            isSelected ? 'bg-[var(--gold)] shadow-[0_0_10px_var(--gold)]' : 'bg-gray-600'
                                        )} />
                                        <span className={isSelected ? 'text-[var(--gold)] font-medium' : 'text-gray-300'}>
                                            {getAIDisplayName(config)}
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

                {shouldShowWarning && (
                    <div className="mt-3 flex items-start gap-2 text-xs text-amber-400/80 bg-amber-400/10 rounded-lg p-3">
                        <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                        <span>{warningMessage}</span>
                    </div>
                )}
            </div>
        );
    }

    // Compact 樣式
    return (
        <div className={cn('relative z-20', className)}>
            <div className="flex items-center gap-2">
                <Bot className="text-[var(--gold)]" size={16} />
                <span className="text-sm text-gray-400">AI:</span>
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="text-sm text-[var(--gold)] hover:underline flex items-center gap-1"
                >
                    {currentConfig ? getAIDisplayName(currentConfig) : '未設定'}
                    <ChevronDown size={14} className={cn('transition-transform', isOpen && 'rotate-180')} />
                </button>
            </div>

            {isOpen && configs.length > 0 && (
                <div className="absolute left-0 top-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl min-w-[180px] overflow-hidden z-50">
                    {configs.map((config) => (
                        <button
                            key={config.id}
                            onClick={() => handleSwitch(config.id)}
                            className={cn(
                                'w-full text-left px-3 py-2 text-sm hover:bg-gray-700 transition-colors flex items-center justify-between',
                                config.is_active ? 'text-[var(--gold)]' : 'text-gray-300'
                            )}
                        >
                            <span>{getAIDisplayName(config)}</span>
                            {config.is_active && <Check size={12} />}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
