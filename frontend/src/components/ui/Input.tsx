'use client';

import { forwardRef, InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  variant?: 'default' | 'ghost';
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, variant = 'default', id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s/g, '-');

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-foreground-secondary mb-2">
            {label}
          </label>
        )}
        <input
          id={inputId}
          ref={ref}
          className={cn(
            'w-full px-4 py-3 rounded-xl transition-all duration-300 font-medium',
            'bg-background-card/50 backdrop-blur-sm text-foreground-primary',
            'placeholder:text-foreground-muted/50',
            'focus:outline-none focus:ring-2 focus:ring-accent/50 focus:bg-background-card',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            variant === 'default' && 'border border-border/50 hover:border-accent/30',
            variant === 'ghost' && 'border-transparent bg-transparent hover:bg-input/5',
            error && 'border-red-500/50 focus:ring-red-500/30 bg-red-500/5',
            className
          )}
          {...props}
        />
        {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
