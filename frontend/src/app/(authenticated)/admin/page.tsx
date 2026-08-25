'use client';

/**
 * 管理控制台（Ticket 13）
 *
 * - AI 端點：/api/admin/endpoints CRUD＋測試＋預設
 * - 用量統計：/api/admin/usage/stats
 * - 用戶管理：既有 /api/admin/users（自 settings 遷入）
 */

import { ShieldAlert } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';
import { EndpointsPanel } from './EndpointsPanel';
import { UsageCharts } from './UsageCharts';
import { UsersPanel } from './UsersPanel';

function ForbiddenView() {
  return (
    <main className="w-full max-w-md mx-auto px-4 py-24 text-center">
      <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-accent-light flex items-center justify-center">
        <ShieldAlert className="text-accent" size={40} aria-hidden />
      </div>
      <h1 className="font-heading text-2xl font-semibold text-foreground-primary mb-2">無權存取</h1>
      <p className="text-foreground-secondary mb-8">
        此頁面僅限管理員使用。若您應為管理員，請聯繫系統管理者。
      </p>
    </main>
  );
}

export default function AdminPage() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <main className="w-full max-w-5xl mx-auto px-4 py-16 text-center">
        <div className="text-6xl mb-4 animate-spin-slow" aria-hidden>☯</div>
        <p className="text-foreground-secondary">載入中…</p>
      </main>
    );
  }

  if (!user || user.role !== 'admin') {
    return <ForbiddenView />;
  }

  return (
    <main className="w-full max-w-5xl mx-auto px-4 py-6">
      <header className="mb-6">
        <h1 className="font-heading text-2xl font-semibold text-foreground-primary">管理控制台</h1>
        <p className="text-sm text-foreground-muted mt-1">管理系統 AI 端點、檢視用量與管理用戶</p>
      </header>

      <Tabs defaultValue="endpoints">
        <TabsList>
          <TabsTrigger value="endpoints">AI 端點</TabsTrigger>
          <TabsTrigger value="usage">用量統計</TabsTrigger>
          <TabsTrigger value="users">用戶管理</TabsTrigger>
        </TabsList>

        <TabsContent value="endpoints">
          <EndpointsPanel />
        </TabsContent>
        <TabsContent value="usage">
          <UsageCharts />
        </TabsContent>
        <TabsContent value="users">
          <UsersPanel currentUserId={user.id} />
        </TabsContent>
      </Tabs>
    </main>
  );
}
