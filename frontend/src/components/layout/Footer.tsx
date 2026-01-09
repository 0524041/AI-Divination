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
        <footer className={cn('text-center py-8 text-gray-500 text-sm', className)}>
            <p>玄覺空間 - 結合傳統智慧與現代科技</p>
            <p className="mt-2">
                <a
                    href="https://github.com/0524041/AI-Divination"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--gold)] hover:underline"
                >
                    GitHub 專案原始碼
                </a>
            </p>
        </footer>
    );
}
