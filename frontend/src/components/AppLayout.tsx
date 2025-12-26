'use client';

import { ReactNode } from 'react';
import { useApp } from '@/contexts/AppContext';
import { AppSidebar } from '@/components/AppSidebar';
import { AuthForm } from '@/components/AuthForm';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { user, isLoading } = useApp();

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-orb orb-1" />
        <div className="bg-orb orb-2" />
        <div className="text-5xl animate-spin" style={{ animationDuration: '2s' }}>
          ☯
        </div>
      </div>
    );
  }

  // Not logged in
  if (!user) {
    return <AuthForm />;
  }

  return (
    <SidebarProvider defaultOpen={false}>
      {/* Background effects */}
      <div className="bg-orb orb-1" />
      <div className="bg-orb orb-2" />

      {/* Sidebar */}
      <AppSidebar />

      {/* Main Content */}
      <SidebarInset className="bg-transparent">
        {/* Mobile trigger */}
        <header className="flex h-14 shrink-0 items-center gap-2 lg:hidden">
          <div className="flex items-center px-4">
            <SidebarTrigger className="-ml-1 text-[var(--gold)]" />
          </div>
        </header>
        
        <main className="flex-1 px-4 pb-8 lg:px-8">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
