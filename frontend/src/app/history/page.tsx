'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/contexts/AppContext';
import { api } from '@/lib/api';
import { HistoryItem } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Home, Star, Trash2, Clock } from 'lucide-react';
import { toast } from 'sonner';

export default function HistoryPage() {
  const router = useRouter();
  const { user, isLoading } = useApp();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/');
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    if (user) {
      loadHistory();
    }
  }, [user]);

  const loadHistory = async () => {
    try {
      const data = await api.getHistory();
      setHistory(data);
    } catch (error) {
      toast.error('載入歷史記錄失敗');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleFavorite = async (id: number, isFavorite: boolean) => {
    try {
      await api.toggleFavorite(id, !isFavorite);
      setHistory(prev => prev.map(item => 
        item.id === id ? { ...item, is_favorite: !isFavorite } : item
      ));
    } catch {
      toast.error('操作失敗');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('確定要刪除此記錄嗎？')) return;
    try {
      await api.deleteHistory(id);
      setHistory(prev => prev.filter(item => item.id !== id));
      toast.success('已刪除');
    } catch {
      toast.error('刪除失敗');
    }
  };

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-4xl animate-spin">☯</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="bg-orb orb-1" />
      <div className="bg-orb orb-2" />

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-40 glass-panel border-b border-border/50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.back()}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-bold text-[var(--gold)]">歷史記錄</h1>
          </div>
          <Button variant="ghost" size="icon" onClick={() => router.push('/')}>
            <Home className="w-5 h-5" />
          </Button>
        </div>
      </header>

      {/* Content */}
      <main className="pt-20 pb-12 px-4">
        <div className="max-w-4xl mx-auto">
          {loading ? (
            <div className="text-center py-12">
              <div className="text-4xl animate-spin inline-block">☯</div>
            </div>
          ) : history.length === 0 ? (
            <Card className="glass-panel">
              <CardContent className="py-12 text-center text-muted-foreground">
                尚無占卜記錄
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {history.map((item) => (
                <Card key={item.id} className="glass-panel hover:border-[var(--gold)]/30 transition-colors">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base font-medium truncate">
                          {item.question}
                        </CardTitle>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          <span>{new Date(item.created_at).toLocaleString('zh-TW')}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleToggleFavorite(item.id, item.is_favorite)}
                          className={item.is_favorite ? 'text-[var(--gold)]' : 'text-muted-foreground'}
                        >
                          <Star className={`w-4 h-4 ${item.is_favorite ? 'fill-current' : ''}`} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(item.id)}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-sm text-muted-foreground line-clamp-3">
                      {item.interpretation?.replace(/<[^>]*>/g, '').slice(0, 200)}...
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
