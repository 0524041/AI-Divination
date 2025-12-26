'use client';

import { ReactNode } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Sidebar } from '@/components/Sidebar';
import { AuthForm } from '@/components/AuthForm';
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
    <div className="min-h-screen">
      {/* Background effects */}
      <div className="bg-orb orb-1" />
      <div className="bg-orb orb-2" />

      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <main
        className={cn(
          "min-h-screen transition-all duration-300",
          "lg:pl-16", // collapsed sidebar width
          "pt-4 pb-8 px-4 lg:px-8"
        )}
      >
        <div className="max-w-6xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
