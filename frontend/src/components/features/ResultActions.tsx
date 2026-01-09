'use client';

import { CopyButton } from '@/components/ui/CopyButton';
import { ShareButton } from '@/components/ui/ShareButton';
import { cn } from '@/lib/utils';

export interface ResultActionsProps {
    historyId?: number;
    copyText: string;
    className?: string;
    showCopy?: boolean;
    showShare?: boolean;
    copyLabel?: string;
    shareLabel?: string;
}

/**
 * Combined Copy + Share actions for result pages
 */
export function ResultActions({
    historyId,
    copyText,
    className,
    showCopy = true,
    showShare = true,
    copyLabel = '複製結果',
    shareLabel = '分享',
}: ResultActionsProps) {
    return (
        <div className={cn('flex items-center gap-3', className)}>
            {showCopy && (
                <CopyButton
                    text={copyText}
                    variant="outline"
                    size="sm"
                    onCopied={() => alert('已複製到剪貼簿')}
                >
                    {copyLabel}
                </CopyButton>
            )}

            {showShare && historyId && (
                <ShareButton
                    historyId={historyId}
                    variant="gold"
                    size="sm"
                >
                    {shareLabel}
                </ShareButton>
            )}
        </div>
    );
}
