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

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setMenuOpen(false);
      setIsClosing(false);
    }, 300); // 300ms matches animation duration
  };

  const [isClosing, setIsClosing] = useState(false);

  return (
    <>
      <div className="flex items-center gap-4">
        {/* Desktop Menu */}
        <div className="hidden md:flex items-center space-x-8">
          {items.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-300 group relative',
                  active
                    ? 'text-accent font-bold'
                    : 'text-foreground-secondary hover:text-foreground-primary'
                )}
              >
                <span className="relative z-10 flex items-center gap-2">
                  <Icon size={18} strokeWidth={active ? 2.5 : 2} className={cn("transition-transform group-hover:scale-110", active ? "text-accent" : "text-foreground-muted group-hover:text-accent")} />
                  {item.label}
                </span>
                {active && (
                  <span className="absolute inset-x-0 -bottom-1 h-0.5 bg-accent rounded-full animate-in fade-in zoom-in duration-300" />
                )}
              </Link>
            );
          })}

          <button
            onClick={logout}
            className="flex items-center gap-2 px-4 py-2 rounded-full text-foreground-secondary hover:text-red-500 hover:bg-red-500/10 transition-all duration-300"
            title="登出"
          >
            <LogOut size={18} strokeWidth={2} />
          </button>
        </div>

        {/* Theme Toggle */}
        <ThemeToggle />

        {/* Mobile Menu Button */}
        <button
          onClick={() => setMenuOpen(true)}
          className="md:hidden p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
        >
          {menuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Menu Overlay and Panel */}
      {(menuOpen || isClosing) && (
        <Portal>
          <div className="fixed inset-0 z-[100] flex justify-end">
            {/* Backdrop */}
            <div
              className={cn(
                "absolute inset-0 bg-black/40 backdrop-blur-[2px]",
                isClosing ? "animate-backdrop-fade-out" : "animate-backdrop-fade"
              )}
              onClick={handleClose}
              aria-hidden="true"
            />

            {/* Sidebar Panel */}
            <div
              className={cn(
                "relative w-full max-w-xs h-[100dvh] bg-background-primary shadow-2xl flex flex-col border-l border-white/10 overflow-hidden",
                isClosing ? "animate-slide-out-right" : "animate-slide-in-right"
              )}
            >

              {/* Decorative Flow Background for Sidebar */}
              <div className="absolute inset-0 pointer-events-none opacity-5">
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-accent/20 to-transparent animate-pulse" />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between px-6 h-20 shrink-0 border-b border-border/50 relative z-10">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-accent/10 text-accent">
                    <span className="text-xl">☯</span>
                  </div>
                  <span className="font-heading font-semibold text-lg tracking-wide text-foreground-primary">
                    玄覺空間
                  </span>
                </div>
                <button
                  onClick={handleClose}
                  className="p-2 -mr-2 text-foreground-secondary hover:text-foreground-primary transition-colors rounded-full hover:bg-black/5 dark:hover:bg-white/5 active:scale-95"
                >
                  <X size={24} strokeWidth={2} />
                </button>
              </div>

              {/* Navigation */}
              <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto relative z-10">
                <div className="px-2 mb-4 text-xs font-bold text-foreground-muted uppercase tracking-widest opacity-80">
                  Menu
                </div>

                {items.map((item, index) => {
                  const Icon = item.icon;
                  const active = isActive(item.href);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={handleClose}
                      className={cn(
                        'group flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all duration-300',
                        active
                          ? 'bg-accent/10 text-accent font-bold shadow-sm ring-1 ring-accent/20 translate-x-1'
                          : 'text-foreground-secondary hover:bg-black/5 dark:hover:bg-white/5 hover:text-foreground-primary hover:translate-x-1'
                      )}
                      style={{ animationDelay: isClosing ? '0ms' : `${index * 50}ms` }}
                    >
                      <Icon
                        size={22}
                        strokeWidth={active ? 2.5 : 2}
                        className={cn(
                          'transition-colors',
                          active ? 'text-accent' : 'text-foreground-muted group-hover:text-foreground-primary'
                        )}
                      />
                      <span className="font-semibold text-base tracking-wide">{item.label}</span>
                    </Link>
                  );
                })}
              </nav>

              {/* Footer Actions */}
              <div className="p-6 mt-auto border-t border-border/50 bg-background-secondary/30 relative z-10">
                <div className="space-y-3">
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-3 w-full px-4 py-3 text-red-500 hover:bg-red-500/10 rounded-xl transition-colors group font-semibold"
                  >
                    <LogOut size={20} strokeWidth={2} className="group-hover:scale-110 transition-transform" />
                    <span className="font-medium text-sm">登出帳號</span>
                  </button>
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

