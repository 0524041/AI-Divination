'use client';

/**
 * ModelSelector — 連線×模型選擇器（spec: ai-model-selection）
 *
 * 受控元件：value/onChange 由頁面持有（選擇綁定在該次占卜，非全域設定）。
 * 清單來源 GET /api/settings/ai/models，依「系統免費模型／我的服務」分組；
 * 訪客固定系統免費模型。管理連線與模型清單在 /settings。
 */

import { useState } from 'react';
import Link from 'next/link';
import { Bot, ChevronDown, Check, Settings, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import {
    modelDisplayName,
    useAIModels,
    type ModelEntry,
    type ModelSelection,
} from '@/hooks/useAIModels';

export const DEFAULT_MODEL_DISPLAY_NAME = 'Agnes（系統預設）';

/** 分享頁等處：由紀錄欄位推得顯示名稱（舊資料相容） */
export function getAIProviderDisplayName(
    provider: string | null,
    model: string | null
): string {
    if (provider === 'opencode' || provider === 'default' || provider === null) {
        return DEFAULT_MODEL_DISPLAY_NAME;
    }
    return `${provider}${model ? ` (${model})` : ''}`;
}

export interface ModelSelectorProps {
    /** 當前選擇；null 時顯示「我的預設模型」 */
    value: ModelSelection | null;
    onChange?: (selection: ModelSelection) => void;
    className?: string;
    variant?: 'default' | 'compact' | 'card';
}

function matches(entry: ModelEntry, selection: ModelSelection | null): boolean {
    if (!selection) return false;
    return (
        (entry.connection_id ?? null) === selection.connectionId &&
        entry.model_id === selection.modelId
    );
}

export function ModelSelector({
    value,
    onChange,
    className,
    variant = 'default',
}: ModelSelectorProps) {
    const [isOpen, setIsOpen] = useState(false);
    const { entries, defaultSelection } = useAIModels();
    const { isGuest } = useAuth();

    const systemEntries = entries.filter((e) => e.source === 'system');
    const userEntries = entries.filter((e) => e.source === 'user');

    const currentEntry = entries.find((e) => matches(e, value)) ?? null;
    const effectiveSelection = value ?? defaultSelection;
    const currentName = currentEntry
        ? modelDisplayName(currentEntry)
        : effectiveSelection
          ? effectiveSelection.modelId
          : DEFAULT_MODEL_DISPLAY_NAME;

    const handleSelect = (entry: ModelEntry) => {
        onChange?.({
            connectionId: entry.connection_id ?? null,
            modelId: entry.model_id,
        });
        setIsOpen(false);
    };

    const shouldShowWarning =
        !!currentEntry && currentEntry.source === 'user' && !currentEntry.connection_id;

    /** 共用下拉清單：系統免費模型／我的服務 分組 */
    const menu = (size: 'sm' | 'lg') => (
        <div
            className={cn(
                'absolute bg-background-card border border-border shadow-xl overflow-hidden z-50 max-h-80 overflow-y-auto',
                size === 'lg'
                    ? 'top-full left-0 right-0 mt-2 rounded-b-2xl animate-in fade-in zoom-in-95 duration-200'
                    : 'top-full left-0 mt-2 rounded-lg min-w-[240px] animate-in fade-in zoom-in-95 duration-200'
            )}
            role="listbox"
            aria-label="AI 模型清單"
        >
            {systemEntries.length > 0 && (
                <>
                    <div
                        className={cn(
                            'text-foreground-muted uppercase tracking-wider bg-background-secondary',
                            size === 'lg' ? 'px-6 pt-3 pb-1 text-xs' : 'px-4 pt-2 pb-1 text-[10px]'
                        )}
                    >
                        系統免費模型
                    </div>
                    {systemEntries.map((entry) => {
                        const isSelected = matches(entry, effectiveSelection);
                        return (
                            <button
                                key={`s-${entry.model_id}`}
                                type="button"
                                role="option"
                                aria-selected={isSelected}
                                onClick={() => handleSelect(entry)}
                                className={cn(
                                    'w-full text-left flex items-center justify-between hover:bg-background-secondary transition-colors',
                                    size === 'lg' ? 'px-6 py-3' : 'px-4 py-2.5 text-sm',
                                    isSelected ? 'text-accent' : 'text-foreground-secondary'
                                )}
                            >
                                <span className="flex items-center gap-2">
                                    <Bot size={size === 'lg' ? 16 : 14} aria-hidden />
                                    {entry.label || entry.model_id}
                                </span>
                                {isSelected && <Check size={size === 'lg' ? 18 : 12} />}
                            </button>
                        );
                    })}
                </>
            )}

            {userEntries.length > 0 && (
                <>
                    <div
                        className={cn(
                            'text-foreground-muted uppercase tracking-wider bg-background-secondary',
                            size === 'lg' ? 'px-6 pt-3 pb-1 text-xs' : 'px-4 pt-2 pb-1 text-[10px]'
                        )}
                    >
                        我的服務
                    </div>
                    {userEntries.map((entry) => {
                        const isSelected = matches(entry, effectiveSelection);
                        return (
                            <button
                                key={`u-${entry.connection_id}-${entry.model_id}`}
                                type="button"
                                role="option"
                                aria-selected={isSelected}
                                onClick={() => handleSelect(entry)}
                                className={cn(
                                    'w-full text-left flex items-center justify-between hover:bg-background-secondary transition-colors',
                                    size === 'lg' ? 'px-6 py-3' : 'px-4 py-2.5 text-sm',
                                    isSelected ? 'text-accent' : 'text-foreground-secondary'
                                )}
                            >
                                <span>{modelDisplayName(entry)}</span>
                                {isSelected && <Check size={size === 'lg' ? 18 : 12} />}
                            </button>
                        );
                    })}
                </>
            )}

            {entries.length === 0 && (
                <p className="px-4 py-3 text-sm text-foreground-muted">目前沒有可用的模型</p>
            )}

            {!isGuest && (
                <Link
                    href="/settings"
                    className={cn(
                        'block w-full text-center text-foreground-muted hover:text-accent border-t border-border transition-colors',
                        size === 'lg' ? 'px-6 py-3 text-sm' : 'px-4 py-2 text-xs'
                    )}
                >
                    <Settings size={size === 'lg' ? 16 : 12} className="inline mr-1" />
                    管理服務連線與模型
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
                    <span className="text-sm text-foreground-muted">模型：</span>
                    {isGuest ? (
                        <span className="text-sm text-accent">{DEFAULT_MODEL_DISPLAY_NAME}</span>
                    ) : (
                        <button
                            type="button"
                            onClick={() => setIsOpen(!isOpen)}
                            aria-expanded={isOpen}
                            aria-haspopup="listbox"
                            className={cn(
                                'text-sm hover:underline flex items-center gap-1',
                                currentEntry ? 'text-accent' : 'text-foreground-secondary'
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
                                AI 解盤模型{isGuest ? '（訪客固定使用系統免費模型）' : ''}
                            </div>
                            <div className="font-medium text-foreground-primary text-lg">
                                {currentName}
                            </div>
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
                        <span>使用自有服務時，回應速度取決於該服務的性能。</span>
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
                        <span className="text-sm text-foreground-muted">當前模型：</span>
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
                            切換模型
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
                        <span>使用自有服務時，回應速度取決於該服務的性能。</span>
                    </div>
                )}
            </div>

            {isOpen && (
                <div className="absolute right-0 top-full mt-2 min-w-[240px]">{menu('sm')}</div>
            )}
        </div>
    );
}
