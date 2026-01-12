'use client';

import { cn } from '@/lib/utils';

export interface FooterProps {
    className?: string;
}

/**
 * Shared footer component
 */
export function Footer({ className }: FooterProps) {
    return (
        <footer className={cn(
            'text-center py-8 text-foreground-secondary text-sm border-t border-border-accent/20 mt-auto',
            className
        )}>
            <div className="max-w-7xl mx-auto px-4">
                <p>玄覺空間 - 結合傳統智慧與現代科技</p>
                <p className="mt-2">
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
