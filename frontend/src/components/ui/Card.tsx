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
                    'rounded-xl transition-all duration-300',
                    (effectiveVariant === 'default') && 'bg-background-card border border-border',
                    (effectiveVariant === 'glass') && 'bg-background-card backdrop-blur-md border border-border-accent',
                    (effectiveVariant === 'outline') && 'bg-transparent border border-border',
                    
                    isGolden && 'border-accent/50 shadow-[0_0_20px_rgba(212,175,55,0.1)]',
                    
                    (hover || isInteractive) && 'cursor-pointer hover:border-accent hover:shadow-lg hover:shadow-accent/10',
                    onClick && 'cursor-pointer',

                    padding === 'sm' && 'p-3',
                    padding === 'md' && 'p-6',
                    padding === 'lg' && 'p-8',
                    
                    className
                )}
                {...props}
            >
                {children}
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
