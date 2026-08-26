'use client';

/**
 * AISelector — 常駐模型清單選擇器（扁平清單，點選即用）
 *
 * 清單組成：系統預設 Agnes（永遠第一項，不受使用者設定管理）＋
 * 使用者自行新增的 Provider（在 /settings 管理，加了就出現在清單）。
 * 點選任一項立即生效；沒有獨立的「啟用」概念——選中即使用中。
 *
 * 後端語義對應：選自訂項 = activate 該設定；選 Agnes = use-default
 * （停用全部自訂設定 → 解析回落系統預設）。
 */

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Bot, ChevronDown, Check, Settings, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

export interface AIConfig {
    id: number;
    provider: string;
    name: string | null;
    model: string | null;
    has_api_key: boolean;
    local_url: string | null;
    local_model: string | null;
    is_active: boolean;
}

export const DEFAULT_AI_DISPLAY_NAME = 'Agnes（系統預設）';

/** 分享頁等處：由紀錄欄位推得顯示名稱 */
export function getAIProviderDisplayName(provider: string | null, model: string | null): string {
    if (provider === 'opencode' || provider === 'default' || provider === null) {
        return DEFAULT_AI_DISPLAY_NAME;
    }
    return `${provider}${model ? ` (${model})` : ''}`;
}

/** 清單項目顯示名稱：自訂名稱優先，其次 provider 名＋模型 */
export function getAIDisplayName(config: AIConfig): string {
    const base =
        config.name ||
        (config.provider === 'gemini'
            ? 'Gemini'
            : config.provider === 'openai'
              ? 'OpenAI'
              : '自訂模型');
    return config.model && !config.name ? `${base} · ${config.model}` : base;
}

export interface AISelectorProps {
    /** 額外的 CSS class */
    className?: string;
    /** 是否顯示本地 AI 警告 */
    showWarning?: boolean;
    /** 自訂警告訊息 */
    warningMessage?: string;
    /** 樣式變體 */
    variant?: 'default' | 'compact' | 'card';
}

export function AISelector({
    className,
    showWarning = true,
    warningMessage = '使用其他 AI 服務時，解盤最長可能需要等待 5 分鐘，取決於伺服器性能。',
    variant = 'default',
}: AISelectorProps) {
    const [configs, setConfigs] = useState<AIConfig[]>([]);
    const [activeConfig, setActiveConfig] = useState<AIConfig | null>(null);
    const [isOpen, setIsOpen] = useState(false);
    const { isGuest } = useAuth();

    const fetchConfigs = useCallback(async () => {
        if (isGuest) {
            setConfigs([]);
            setActiveConfig(null);
            return;
        }
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/settings/ai', {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                const data: AIConfig[] = await res.json();
                setConfigs(data);
                setActiveConfig(data.find((c) => c.is_active) ?? null);
            }
        } catch (err) {
            console.error('Fetch AI configs error:', err);
        }
    }, [isGuest]);

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

    const handleUseDefault = async () => {
        try {
            const token = localStorage.getItem('token');
            // 停用所有自訂設定，解析才會真正回落到系統預設（Agnes）
            await fetch('/api/settings/ai/use-default', {
                method: 'PUT',
                headers: { Authorization: `Bearer ${token}` },
            });
        } catch (err) {
            console.error('Use default AI error:', err);
        }
        await fetchConfigs();
        setIsOpen(false);
    };

    const shouldShowWarning = showWarning && activeConfig && activeConfig.provider !== 'gemini';
    const currentName = activeConfig ? getAIDisplayName(activeConfig) : DEFAULT_AI_DISPLAY_NAME;

    /** 共用下拉清單：Agnes 常駐第一項＋使用者加入的模型 */
    const menu = (size: 'sm' | 'lg') => (
        <div
            className={cn(
                'absolute bg-background-card border border-border shadow-xl overflow-hidden z-50',
                size === 'lg'
                    ? 'top-full left-0 right-0 mt-2 rounded-b-2xl animate-in fade-in zoom-in-95 duration-200'
                    : 'top-full left-0 mt-2 rounded-lg min-w-[220px] animate-in fade-in zoom-in-95 duration-200'
            )}
            role="listbox"
            aria-label="AI 模型清單"
        >
            <button
                type="button"
                role="option"
                aria-selected={!activeConfig}
                onClick={handleUseDefault}
                className={cn(
                    'w-full text-left flex items-center justify-between hover:bg-background-secondary transition-colors',
                    size === 'lg' ? 'px-6 py-4' : 'px-4 py-2.5 text-sm',
                    !activeConfig ? 'text-accent' : 'text-foreground-secondary'
                )}
            >
                <span className="flex items-center gap-2">
                    <Bot size={size === 'lg' ? 16 : 14} aria-hidden />
                    {DEFAULT_AI_DISPLAY_NAME}
                </span>
                {!activeConfig && <Check size={size === 'lg' ? 18 : 12} />}
            </button>

            {configs.map((config) => {
                const isSelected = activeConfig?.id === config.id;
                return (
                    <button
                        key={config.id}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => handleSwitch(config.id)}
                        className={cn(
                            'w-full text-left flex items-center justify-between hover:bg-background-secondary transition-colors',
                            size === 'lg' ? 'px-6 py-4' : 'px-4 py-2.5 text-sm',
                            isSelected ? 'text-accent' : 'text-foreground-secondary'
                        )}
                    >
                        <span>{getAIDisplayName(config)}</span>
                        {isSelected && <Check size={size === 'lg' ? 18 : 12} />}
                    </button>
                );
            })}

            {!isGuest && (
                <Link
                    href="/settings"
                    className={cn(
                        'block w-full text-center text-foreground-muted hover:text-accent border-t border-border transition-colors',
                        size === 'lg' ? 'px-6 py-3 text-sm' : 'px-4 py-2 text-xs'
                    )}
                >
                    <Settings size={size === 'lg' ? 16 : 12} className="inline mr-1" />
                    管理 AI 設定
                </Link>
            )}
        </div>
    );

    // ===== Compact（對話窗內） =====
    if (variant === 'compact') {
        return (
            <div className={cn('relative z-20', className)}>
                <div className="flex items-center gap-2">
                    <Bot className="text-accent" size={16} aria-hidden />
                    <span className="text-sm text-foreground-muted">AI:</span>
                    {isGuest ? (
                        <span className="text-sm text-accent">{DEFAULT_AI_DISPLAY_NAME}</span>
                    ) : (
                        <button
                            type="button"
                            onClick={() => setIsOpen(!isOpen)}
                            aria-expanded={isOpen}
                            aria-haspopup="listbox"
                            className={cn(
                                'text-sm hover:underline flex items-center gap-1',
                                activeConfig ? 'text-accent' : 'text-foreground-secondary'
                            )}
                        >
                            {currentName}
                            <ChevronDown
                                size={14}
                                className={cn('transition-transform', isOpen && 'rotate-180')}
                            />
                        </button>
                    )}
                </div>
                {isOpen && menu('sm')}
            </div>
        );
    }

    // ===== Card（揭卦步驟） =====
    if (variant === 'card') {
        return (
            <div className={cn('relative z-20', className)}>
                <button
                    type="button"
                    onClick={() => !isGuest && setIsOpen(!isOpen)}
                    aria-expanded={isOpen}
                    aria-haspopup="listbox"
                    disabled={isGuest}
                    className="w-full flex items-center justify-between px-6 py-4 bg-background-card border border-border rounded-2xl hover:border-accent hover:shadow-md transition-all duration-300 backdrop-blur-sm group disabled:cursor-default"
                >
                    <div className="flex items-center gap-4">
                        <div className="p-2 bg-accent/10 rounded-lg group-hover:bg-accent/20 transition-colors">
                            <Bot className="text-accent" size={24} aria-hidden />
                        </div>
                        <div className="text-left">
                            <div className="text-xs text-foreground-muted uppercase tracking-wider mb-1">
                                AI 解盤服務{isGuest ? '（訪客固定使用系統預設）' : ''}
                            </div>
                            <div className="font-medium text-foreground-primary text-lg">{currentName}</div>
                        </div>
                    </div>
                    {!isGuest && (
                        <ChevronDown
                            size={20}
                            className={cn(
                                'text-foreground-muted transition-transform duration-300 group-hover:text-accent',
                                isOpen && 'rotate-180'
                            )}
                        />
                    )}
                </button>

                {isOpen && menu('lg')}

                {shouldShowWarning && (
                    <div className="mt-3 flex items-start gap-2 text-xs text-amber-500/90 dark:text-amber-400/80 bg-amber-500/10 rounded-lg p-3">
                        <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                        <span>{warningMessage}</span>
                    </div>
                )}
            </div>
        );
    }

    // ===== Default =====
    return (
        <div className={cn('relative z-20', className)}>
            <div className="bg-background-card/80 backdrop-blur-sm border border-border-accent rounded-xl p-4 shadow-sm">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Bot className="text-accent" size={20} aria-hidden />
                        <span className="text-sm text-foreground-muted">當前 AI：</span>
                        <span className="text-accent font-medium">{currentName}</span>
                    </div>

                    {!isGuest && (
                        <button
                            type="button"
                            onClick={() => setIsOpen(!isOpen)}
                            aria-expanded={isOpen}
                            aria-haspopup="listbox"
                            className="text-sm text-foreground-muted hover:text-accent flex items-center gap-1 transition-colors"
                        >
                            切換 AI
                            <ChevronDown
                                size={16}
                                className={cn('transition-transform', isOpen && 'rotate-180')}
                            />
                        </button>
                    )}
                </div>

                {shouldShowWarning && (
                    <div className="mt-3 flex items-start gap-2 text-xs text-amber-500/90 dark:text-amber-400/80 bg-amber-500/10 rounded-lg p-2">
                        <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                        <span>{warningMessage}</span>
                    </div>
                )}
            </div>

            {isOpen && (
                <div className="absolute right-0 top-full mt-2 min-w-[240px]">{menu('sm')}</div>
            )}
        </div>
    );
}
