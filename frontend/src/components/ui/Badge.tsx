import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

export type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'accent' | 'outline';

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function Badge({ children, variant = 'default', size = 'md', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center font-medium rounded-full transition-colors duration-200',
        size === 'sm' && 'px-2 py-0.5 text-xs',
        size === 'md' && 'px-3 py-1 text-sm',
        size === 'lg' && 'px-4 py-1.5 text-base',

        variant === 'default' && 'bg-foreground-muted/10 text-foreground-secondary border border-foreground-muted/10',
        variant === 'success' && 'bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20',
        variant === 'warning' && 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20',
        variant === 'error' && 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20',
        variant === 'accent' && 'bg-accent/10 text-accent border border-accent/20',
        variant === 'outline' && 'bg-transparent border border-foreground-muted text-foreground-secondary',

        className
      )}
    >
      {children}
    </span>
  );
}
