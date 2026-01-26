'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, LogOut, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { useAuth } from '@/contexts/AuthContext';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export interface NavbarClientProps {
  items: NavItem[];
}

export function NavbarClient({ items }: NavbarClientProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const { logout } = useAuth();

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  const handleLogout = () => {
    setMenuOpen(false);
    logout();
  };

  return (
    <>
      <div className="hidden md:flex items-center gap-1">
        {items.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                active
                  ? 'text-accent bg-accent-light/50'
                  : 'text-foreground-secondary hover:text-foreground-primary hover:bg-background-card-hover'
              )}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </Link>
          );
        })}

        <div className="w-px h-5 bg-border mx-2" />

        <ThemeToggle />

        <button
          type="button"
          onClick={logout}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-foreground-secondary hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all duration-200"
        >
          <LogOut size={18} />
          <span>登出</span>
        </button>
      </div>

      <div className="flex items-center gap-2 md:hidden">
        <ThemeToggle />
        <button
          type="button"
          className="p-2 rounded-lg text-foreground-secondary hover:text-foreground-primary hover:bg-background-card-hover transition-colors"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label={menuOpen ? '關閉選單' : '開啟選單'}
        >
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {menuOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 md:hidden cursor-default"
            onClick={() => setMenuOpen(false)}
            aria-label="關閉選單"
          />

          <div className="fixed top-16 right-4 left-4 bg-background-card border border-border rounded-xl shadow-lg z-50 md:hidden animate-in slide-in-from-top-2 fade-in duration-200">
            <nav className="p-3 space-y-1">
              {items.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                      active
                        ? 'text-accent bg-accent-light/50'
                        : 'text-foreground-secondary hover:text-foreground-primary hover:bg-background-card-hover'
                    )}
                  >
                    <Icon size={20} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}

              <div className="h-px bg-border my-2" />

              <button
                type="button"
                onClick={handleLogout}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 w-full transition-colors"
              >
                <LogOut size={20} />
                <span>登出</span>
              </button>
            </nav>
          </div>
        </>
      )}
    </>
  );
}
