import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

interface BadgeProps {
  children: ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'accent';
  size?: 'sm' | 'md';
  className?: string;
}

export function Badge({ children, variant = 'default', size = 'md', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center font-medium rounded-full',
        size === 'sm' && 'px-2 py-0.5 text-xs',
        size === 'md' && 'px-3 py-1 text-sm',
        variant === 'default' && 'bg-foreground-muted/20 text-foreground-secondary',
        variant === 'success' && 'bg-green-500/20 text-green-400',
        variant === 'warning' && 'bg-amber-500/20 text-amber-400',
        variant === 'error' && 'bg-red-500/20 text-red-400',
        variant === 'accent' && 'bg-accent-light text-accent',
        className
      )}
    >
      {children}
    </span>
  );
}
