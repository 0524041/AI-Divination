import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

interface ContainerProps {
  children: ReactNode;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  padding?: boolean;
}

export function Container({ 
  children, 
  className, 
  size = 'lg',
  padding = true 
}: ContainerProps) {
  return (
    <div
      className={cn(
        'mx-auto w-full',
        padding && 'px-4 sm:px-6 lg:px-8',
        size === 'sm' && 'max-w-3xl',
        size === 'md' && 'max-w-4xl',
        size === 'lg' && 'max-w-6xl',
        size === 'xl' && 'max-w-7xl',
        size === 'full' && 'max-w-full',
        className
      )}
    >
      {children}
    </div>
  );
}
