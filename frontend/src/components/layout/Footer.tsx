'use client';

import { cn } from '@/lib/utils';
import { useOnlineCount } from '@/hooks/useOnlineCount';

export interface FooterProps {
    className?: string;
}

/**
 * Shared footer component
 */
export function Footer({ className }: FooterProps) {
    const onlineCount = useOnlineCount();

    return (
        <footer className={cn(
            'text-center py-8 text-foreground-secondary text-sm border-t border-border-accent/20 mt-auto',
            className
        )}>
            <div className="max-w-7xl mx-auto px-4">
                <div className="flex justify-center items-center gap-4 mb-2">
                    <p>玄覺空間 - 結合傳統智慧與現代科技</p>
                    {onlineCount !== null && (
                        <span className="flex items-center gap-1.5 text-xs bg-accent/10 px-2 py-0.5 rounded-full border border-accent/20">
                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                            <span className="text-accent">{onlineCount} 人在線</span>
                        </span>
                    )}
                </div>
                <p>
                    <a
                        href="https://github.com/0524041/AI-Divination"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-accent hover:text-accent-hover hover:underline transition-colors"
                    >
                        GitHub 專案原始碼
                    </a>
                </p>
            </div>
        </footer>
    );
}
