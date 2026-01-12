'use client';

import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';

interface ThemeToggleProps {
  className?: string;
  variant?: 'icon' | 'dropdown';
}

export function ThemeToggle({ className, variant = 'icon' }: ThemeToggleProps) {
  const { theme, setTheme, resolvedTheme } = useTheme();

  if (variant === 'icon') {
    return (
      <button
        onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
        className={cn(
          'p-2 rounded-lg transition-colors cursor-pointer',
          'hover:bg-accent-light text-foreground-secondary hover:text-accent',
          className
        )}
        aria-label="Toggle theme"
      >
        {resolvedTheme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
      </button>
    );
  }

  return (
    <div className={cn('flex gap-2', className)}>
      {(['light', 'dark', 'system'] as const).map((t) => (
        <button
          key={t}
          onClick={() => setTheme(t)}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg transition-colors cursor-pointer',
            theme === t
              ? 'bg-accent text-background-primary'
              : 'bg-background-card hover:bg-accent-light text-foreground-secondary'
          )}
        >
          {t === 'light' && <Sun size={16} />}
          {t === 'dark' && <Moon size={16} />}
          {t === 'system' && <Monitor size={16} />}
          <span className="capitalize">{t === 'system' ? '系統' : t === 'light' ? '淺色' : '深色'}</span>
        </button>
      ))}
    </div>
  );
}
