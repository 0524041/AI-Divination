'use client';

import { HTMLAttributes, forwardRef, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
    variant?: 'default' | 'golden' | 'interactive' | 'glass' | 'outline';
    padding?: 'none' | 'sm' | 'md' | 'lg';
    hover?: boolean;
}

const Card = forwardRef<HTMLDivElement, CardProps>(
    ({ className, variant = 'default', padding, hover = false, onClick, children, ...props }, ref) => {
        const isGolden = variant === 'golden';
        const isInteractive = variant === 'interactive';

        const effectiveVariant = isGolden ? 'default' : (isInteractive ? 'default' : variant);

        return (
            <div
                ref={ref}
                onClick={onClick}
                className={cn(
                    'rounded-2xl transition-all duration-300 relative overflow-hidden',
                    // Default / Glass
                    (effectiveVariant === 'default' || effectiveVariant === 'glass') && 'bg-background-card backdrop-blur-xl border border-white/20 dark:border-white/5 shadow-lg shadow-black/5',

                    // Outline
                    (effectiveVariant === 'outline') && 'bg-transparent border border-border',

                    // Golden Highlight
                    isGolden && 'ring-1 ring-accent/30 shadow-[0_0_30px_rgba(212,175,55,0.15)]',

                    // Interactive / Hover
                    (hover || isInteractive) && 'cursor-pointer hover:translate-y-[-2px] hover:shadow-xl hover:shadow-accent/5 hover:border-accent/30',
                    onClick && 'cursor-pointer',

                    padding === 'sm' && 'p-4',
                    padding === 'md' && 'p-6 sm:p-8',
                    padding === 'lg' && 'p-8 sm:p-10',

                    className
                )}
                {...props}
            >
                {/* Subtle gradient overlay for depth */}
                <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent dark:from-white/5 pointer-events-none" />
                <div className="relative z-10">
                    {children}
                </div>
            </div>
        );
    }
);

Card.displayName = 'Card';

const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
    ({ className, children, ...props }, ref) => (
        <div ref={ref} className={cn('px-6 py-4 border-b border-border flex items-center justify-between', className)} {...props}>
            {children}
        </div>
    )
);
CardHeader.displayName = 'CardHeader';

const CardTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(
    ({ className, children, ...props }, ref) => (
        <h3 ref={ref} className={cn('text-xl font-bold text-foreground-primary', className)} {...props}>
            {children}
        </h3>
    )
);
CardTitle.displayName = 'CardTitle';

const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
    ({ className, children, ...props }, ref) => (
        <div ref={ref} className={cn('p-6', className)} {...props}>
            {children}
        </div>
    )
);
CardContent.displayName = 'CardContent';

const CardFooter = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
    ({ className, children, ...props }, ref) => (
        <div ref={ref} className={cn('px-6 py-4 border-t border-border', className)} {...props}>
            {children}
        </div>
    )
);
CardFooter.displayName = 'CardFooter';

export { Card, CardHeader, CardTitle, CardContent, CardFooter };
