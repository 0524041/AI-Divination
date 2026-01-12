'use client';

import { ButtonHTMLAttributes, forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'gold';
    size?: 'sm' | 'md' | 'lg';
    loading?: boolean;
    fullWidth?: boolean;
    icon?: React.ReactNode;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    ({ 
        className, 
        variant = 'primary', 
        size = 'md', 
        loading, 
        fullWidth,
        icon,
        leftIcon, 
        rightIcon,
        children, 
        disabled, 
        ...props 
    }, ref) => {
        const baseStyles = 'inline-flex items-center justify-center gap-2 font-semibold transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed';

        const variants = {
            primary: 'bg-accent text-accent-foreground hover:bg-accent/90 hover:shadow-[0_4px_20px_rgba(212,175,55,0.4)] hover:-translate-y-0.5',
            gold: 'bg-gradient-to-r from-[var(--gold)] to-[var(--gold-dark)] text-[#1a1a2e] hover:shadow-[0_4px_20px_rgba(212,175,55,0.4)] hover:-translate-y-0.5',
            secondary: 'bg-background-card border border-border text-foreground-primary hover:bg-background-card/80',
            outline: 'border border-accent text-accent bg-transparent hover:bg-accent/10',
            ghost: 'text-foreground-secondary hover:text-accent hover:bg-white/5',
            danger: 'bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500/30',
        };

        const sizes = {
            sm: 'px-3 py-1.5 text-sm rounded-md',
            md: 'px-4 py-2.5 rounded-lg',
            lg: 'px-6 py-3 text-lg rounded-xl',
        };

        const effectiveIcon = icon || leftIcon;

        return (
            <button
                ref={ref}
                className={cn(
                    baseStyles, 
                    variants[variant], 
                    sizes[size], 
                    fullWidth && 'w-full',
                    className
                )}
                disabled={disabled || loading}
                {...props}
            >
                {loading && <Loader2 className="animate-spin" size={size === 'sm' ? 14 : size === 'lg' ? 20 : 16} />}
                {!loading && effectiveIcon}
                {children}
                {!loading && rightIcon}
            </button>
        );
    }
);

Button.displayName = 'Button';

export { Button };
