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
        const baseStyles = 'inline-flex items-center justify-center gap-2 font-medium transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95';

        const variants = {
            primary: 'bg-accent text-white shadow-lg shadow-accent/20 hover:bg-accent-hover hover:shadow-accent/40',
            gold: 'bg-gradient-to-r from-[var(--gold)] to-[var(--gold-dark)] text-white shadow-lg shadow-gold/20 hover:shadow-gold/40 hover:-translate-y-0.5',
            secondary: 'bg-background-card hover:bg-background-card-hover border border-border text-foreground-primary backdrop-blur-sm',
            outline: 'border border-accent/50 text-accent bg-transparent hover:bg-accent/5 hover:border-accent',
            ghost: 'text-foreground-secondary hover:text-accent hover:bg-accent/5',
            danger: 'bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20',
        };

        const sizes = {
            sm: 'px-3 py-1.5 text-sm rounded-lg',
            md: 'px-5 py-2.5 rounded-xl',
            lg: 'px-8 py-3 text-lg rounded-2xl',
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
