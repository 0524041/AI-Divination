import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
}

export function Skeleton({ className, variant = 'rectangular' }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse bg-foreground-muted/20',
        variant === 'text' && 'h-4 rounded',
        variant === 'circular' && 'rounded-full',
        variant === 'rectangular' && 'rounded-lg',
        className
      )}
    />
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn('p-6 rounded-xl bg-background-card border border-border', className)}>
      <div className="flex items-start gap-4">
        <Skeleton variant="circular" className="w-12 h-12 flex-shrink-0" />
        <div className="flex-1 space-y-3">
          <Skeleton variant="text" className="w-1/3" />
          <Skeleton variant="text" className="w-full" />
          <Skeleton variant="text" className="w-2/3" />
        </div>
      </div>
    </div>
  );
}
