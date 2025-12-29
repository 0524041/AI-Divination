'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useApp } from '@/contexts/AppContext';
import { cn } from '@/lib/utils';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar';
import {
  Sparkles,
  History,
  Settings,
  LogOut,
  User2,
} from 'lucide-react';

export function AppSidebar() {
  const pathname = usePathname();
  const { user, logout } = useApp();

  const handleLogout = async () => {
    await logout();
    window.location.href = '/';
  };

  const navItems = [
    {
      id: 'divination',
      label: '六爻占卜',
      icon: Sparkles,
      path: '/',
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

  return (
    <Sidebar collapsible="icon" className="border-r-0 sidebar-hover-expand">
      {/* Header with Logo */}
      <SidebarHeader className="border-b border-border/30">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              asChild
              className="hover:bg-[var(--gold)]/10"
            >
              <Link href="/">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-[var(--gold)]/20 text-[var(--gold)]">
                  <span className="text-xl">☯</span>
                </div>
                <div className="flex flex-col gap-0.5 leading-none">
                  <span className="font-bold text-lg text-[var(--gold)]">靈機一動</span>
                  <span className="text-xs text-muted-foreground">易經占卜系統</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/* Main Navigation */}
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sm text-muted-foreground">功能</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    asChild
                    tooltip={item.label}
                    isActive={pathname === item.path}
                    className={cn(
                      "hover:bg-[var(--gold)]/10 text-base",
                      pathname === item.path &&
                        "bg-[var(--gold)]/20 text-[var(--gold)]"
                    )}
                  >
                    <Link href={item.path}>
                      <item.icon className={cn("!w-5 !h-5", pathname === item.path ? "text-[var(--gold)]" : "")} />
                      <span className="text-base">{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer with User Info */}
      <SidebarFooter className="border-t border-border/30">
        <SidebarMenu>
          {user && (
            <>
              <SidebarMenuItem>
                <SidebarMenuButton
                  className="hover:bg-transparent cursor-default"
                  tooltip={`${user.username} (${user.role === 'admin' ? '管理員' : '用戶'})`}
                >
                  <User2 className="text-[var(--gold)] !w-5 !h-5" />
                  <div className="flex flex-col gap-0.5 leading-none">
                    <span className="font-medium text-base text-[var(--gold)]">{user.username}</span>
                    <span className="text-xs text-muted-foreground">
                      {user.role === 'admin' ? '管理員' : '一般用戶'}
                    </span>
                  </div>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip="登出"
                  onClick={handleLogout}
                  className="hover:bg-destructive/10 hover:text-destructive text-base"
                >
                  <LogOut className="!w-5 !h-5" />
                  <span className="text-base">登出</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </>
          )}
        </SidebarMenu>
      </SidebarFooter>

      {/* Rail for hover expand */}
      <SidebarRail />
    </Sidebar>
  );
}
