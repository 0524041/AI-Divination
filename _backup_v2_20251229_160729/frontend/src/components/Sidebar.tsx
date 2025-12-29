'use client';

import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useApp } from '@/contexts/AppContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  ChevronLeft,
  ChevronRight,
  Sparkles,
  History,
  Settings,
  LogOut,
  ChevronDown,
  Hexagon,
  Menu,
  X,
} from 'lucide-react';

export function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useApp();
  const [collapsed, setCollapsed] = useState(true);
  const [divinationOpen, setDivinationOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  const navItems = [
    {
      id: 'divination',
      label: '算卦',
      icon: Sparkles,
      expandable: true,
      children: [
        { id: 'liuyao', label: '六爻占卜', icon: Hexagon, path: '/' },
      ],
    },
    {
      id: 'history',
      label: '歷史記錄',
      icon: History,
      path: '/history',
    },
    {
      id: 'settings',
      label: '設定',
      icon: Settings,
      path: '/settings',
    },
  ];

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="p-4 border-b border-border/50">
        <div className="flex items-center gap-3">
          <span className="text-3xl">☯</span>
          {!collapsed && (
            <div className="overflow-hidden">
              <h1 className="text-xl font-bold text-[var(--gold)] whitespace-nowrap">靈機一動</h1>
              <p className="text-xs text-muted-foreground">易經占卜系統</p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <div key={item.id}>
            {item.expandable ? (
              <>
                <button
                  onClick={() => setDivinationOpen(!divinationOpen)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all",
                    "hover:bg-[var(--gold)]/10 text-foreground",
                    collapsed && "justify-center"
                  )}
                >
                  <item.icon className="w-5 h-5 text-[var(--gold)] flex-shrink-0" />
                  {!collapsed && (
                    <>
                      <span className="flex-1 text-left text-base">{item.label}</span>
                      <ChevronDown
                        className={cn(
                          "w-4 h-4 transition-transform",
                          divinationOpen && "rotate-180"
                        )}
                      />
                    </>
                  )}
                </button>
                {divinationOpen && item.children && (
                  <div className={cn("space-y-1", !collapsed && "ml-4 mt-1")}>
                    {item.children.map((child) => (
                      <button
                        key={child.id}
                        onClick={() => {
                          router.push(child.path);
                          setMobileOpen(false);
                        }}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all",
                          "hover:bg-[var(--gold)]/10",
                          pathname === child.path
                            ? "bg-[var(--gold)]/20 text-[var(--gold)]"
                            : "text-muted-foreground",
                          collapsed && "justify-center"
                        )}
                      >
                        <child.icon className="w-4 h-4 flex-shrink-0" />
                        {!collapsed && <span className="text-sm">{child.label}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <button
                onClick={() => {
                  router.push(item.path!);
                  setMobileOpen(false);
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all",
                  "hover:bg-[var(--gold)]/10",
                  pathname === item.path
                    ? "bg-[var(--gold)]/20 text-[var(--gold)]"
                    : "text-foreground",
                  collapsed && "justify-center"
                )}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                {!collapsed && <span className="text-base">{item.label}</span>}
              </button>
            )}
          </div>
        ))}
      </nav>

      {/* User Section */}
      <div className="p-2 border-t border-border/50">
        {user && (
          <div className={cn("space-y-2", collapsed && "flex flex-col items-center")}>
            {!collapsed && (
              <div className="px-3 py-2">
                <p className="text-sm font-medium text-[var(--gold)]">{user.username}</p>
                <p className="text-xs text-muted-foreground">
                  {user.role === 'admin' ? '管理員' : '一般用戶'}
                </p>
              </div>
            )}
            <Button
              variant="ghost"
              size={collapsed ? "icon" : "default"}
              onClick={handleLogout}
              className={cn(
                "text-muted-foreground hover:text-destructive hover:bg-destructive/10",
                !collapsed && "w-full justify-start"
              )}
            >
              <LogOut className="w-5 h-5" />
              {!collapsed && <span className="ml-2">登出</span>}
            </Button>
          </div>
        )}
      </div>

      {/* Collapse Toggle (Desktop) */}
      <div className="hidden lg:block p-2 border-t border-border/50">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(!collapsed)}
          className="w-full"
        >
          {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
        </Button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-background/80 backdrop-blur border border-border/50"
      >
        <Menu className="w-6 h-6 text-[var(--gold)]" />
      </button>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-black/60"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <aside
        className={cn(
          "lg:hidden fixed top-0 left-0 z-50 h-full w-64 glass-panel rounded-none border-l-0 border-t-0 border-b-0 transition-transform duration-300",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute top-4 right-4 p-1"
        >
          <X className="w-5 h-5" />
        </button>
        <SidebarContent />
      </aside>

      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "hidden lg:flex flex-col fixed top-0 left-0 h-full z-40 glass-panel rounded-none border-t-0 border-l-0 border-b-0 transition-all duration-300",
          collapsed ? "w-16" : "w-64"
        )}
      >
        <SidebarContent />
      </aside>
    </>
  );
}
