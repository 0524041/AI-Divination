import { useState, useEffect } from 'react';
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

      {/* Mobile Menu Overlay and Panel */}
      {/* Mobile Menu Portal */}
      {menuOpen && (
        <Portal>
          <div className="fixed inset-0 z-[100] flex justify-end">
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/30 backdrop-blur-[2px] animate-in fade-in duration-300"
              onClick={() => setMenuOpen(false)}
              aria-hidden="true"
            />

            {/* Sidebar Panel */}
            <div className="relative w-full max-w-xs h-[100dvh] bg-background-primary dark:bg-[#020617] shadow-xl animate-in slide-in-from-right duration-300 flex flex-col border-l border-border/50">

              {/* Header */}
              <div className="flex items-center justify-between px-6 h-20 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-accent/10 text-accent">
                    <span className="text-xl">☯</span>
                  </div>
                  <span className="font-medium text-lg tracking-wide text-foreground-primary">
                    玄覺空間
                  </span>
                </div>
                <button
                  onClick={() => setMenuOpen(false)}
                  className="p-2 -mr-2 text-foreground-secondary hover:text-foreground-primary transition-colors"
                >
                  <X size={24} strokeWidth={1.5} />
                </button>
              </div>

              {/* Navigation */}
              <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
                <div className="px-2 mb-4 text-xs font-medium text-foreground-muted uppercase tracking-wider opacity-60">
                  Menu
                </div>

                {items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMenuOpen(false)}
                      className={cn(
                        'group flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all duration-200',
                        active
                          ? 'bg-neutral-100 dark:bg-white/10 text-accent font-semibold shadow-sm'
                          : 'text-foreground-secondary hover:bg-background-card-hover hover:text-foreground-primary'
                      )}
                    >
                      <Icon
                        size={20}
                        strokeWidth={active ? 2 : 1.5}
                        className={cn(
                          'transition-colors',
                          active ? 'text-accent' : 'text-foreground-muted group-hover:text-foreground-primary'
                        )}
                      />
                      <span className="font-medium text-sm tracking-wide">{item.label}</span>
                    </Link>
                  );
                })}
              </nav>

              {/* Footer Actions */}
              <div className="p-6 mt-auto border-t border-border/30 bg-background-secondary/50 dark:bg-black/10">
                <div className="space-y-3">
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-3 w-full px-4 py-3 text-red-500 hover:bg-red-50/50 dark:hover:bg-red-900/10 rounded-xl transition-colors group"
                  >
                    <LogOut size={20} strokeWidth={1.5} className="group-hover:scale-105 transition-transform" />
                    <span className="font-medium text-sm text-red-600 dark:text-red-400">登出帳號</span>
                  </button>
                </div>

                <div className="mt-6 text-center text-[10px] text-foreground-muted/40 font-mono">
                  v1.3.0 • AI Divination
                </div>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </>
  );
}

// Portal Component to render content at document.body level
function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!mounted) return null;

  return typeof document !== 'undefined'
    ? (require('react-dom').createPortal(children, document.body) as React.ReactNode)
    : null;
}

