'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/contexts/AppContext';
import { api } from '@/lib/api';
import { HistoryItem, User } from '@/types';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Star,
  Trash2,
  Clock,
  Copy,
  Search,
  Filter,
  Users,
  ChevronDown,
  Brain,
  Bot,
} from 'lucide-react';
import { toast } from 'sonner';

// 提取並處理內容的 hook
function useProcessedContent(interpretation: string | undefined) {
  const [htmlContent, setHtmlContent] = useState('');
  
  const { thinkContent, mainContent } = useMemo(() => {
    if (!interpretation) return { thinkContent: '', mainContent: '' };
    
    let think = '';
    let main = interpretation;

    // 提取 <think> 標籤內容
    const thinkMatch = interpretation.match(/<think>([\s\S]*?)<\/think>/i);
    if (thinkMatch) {
      think = thinkMatch[1].trim();
      main = interpretation.replace(/<think>[\s\S]*?<\/think>/i, '').trim();
    }

    // 移除 markdown code fence
    main = main.replace(/^```[\s\S]*?\n/, '').replace(/\n```$/, '').trim();

    return { thinkContent: think, mainContent: main };
  }, [interpretation]);

  useEffect(() => {
    const renderMarkdown = async () => {
      if (typeof window === 'undefined' || !mainContent) {
        setHtmlContent('');
        return;
      }
      
      const { marked } = await import('marked');
      const DOMPurify = (await import('dompurify')).default;
      
      marked.setOptions({
        breaks: true,
        gfm: true,
      });
      
      const rawHtml = await marked.parse(mainContent);
      const cleanHtml = DOMPurify.sanitize(rawHtml);
      setHtmlContent(cleanHtml);
    };
    
    renderMarkdown();
  }, [mainContent]);

  return { thinkContent, htmlContent };
}

export default function HistoryPage() {
  const router = useRouter();
  const { user, isLoading } = useApp();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [filteredHistory, setFilteredHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterFavorite, setFilterFavorite] = useState<'all' | 'favorite'>('all');
  
  // Admin specific
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('all');
  
  // View detail modal
  const [viewItem, setViewItem] = useState<HistoryItem | null>(null);

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/');
    }
  }, [user, isLoading, router]);

  // Load users for admin
  useEffect(() => {
    if (user && isAdmin) {
      api.getAllUsers().then(setUsers).catch(() => {});
    }
  }, [user, isAdmin]);

  // Load history
  const loadHistory = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const userId = isAdmin ? (selectedUserId === 'all' ? 'all' : parseInt(selectedUserId)) : undefined;
      const data = await api.getHistory(userId as number | 'all' | undefined);
      setHistory(data);
    } catch {
      toast.error('載入歷史記錄失敗');
    } finally {
      setLoading(false);
    }
  }, [user, isAdmin, selectedUserId]);

  useEffect(() => {
    if (user) {
      loadHistory();
    }
  }, [user, loadHistory]);

  // Filter history
  useEffect(() => {
    let result = [...history];
    
    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(item =>
        item.question.toLowerCase().includes(query) ||
        item.interpretation?.toLowerCase().includes(query)
      );
    }
    
    // Favorite filter
    if (filterFavorite === 'favorite') {
      result = result.filter(item => item.is_favorite);
    }
    
    setFilteredHistory(result);
  }, [history, searchQuery, filterFavorite]);

  const handleToggleFavorite = async (id: number, isFavorite: boolean) => {
    try {
      await api.toggleFavorite(id, !isFavorite);
      setHistory(prev =>
        prev.map(item =>
          item.id === id ? { ...item, is_favorite: !isFavorite } : item
        )
      );
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

  const handleCopy = (item: HistoryItem) => {
    // 清理 interpretation 內容
    let content = item.interpretation || '無解讀內容';
    // 移除 think 標籤
    content = content.replace(/<think>[\s\S]*?<\/think>/i, '').trim();
    // 移除 code fence
    content = content.replace(/^```[\s\S]*?\n/, '').replace(/\n```$/, '').trim();
    
    const markdown = `## 問題\n${item.question}\n\n## 解卦結果\n${content}`;
    navigator.clipboard.writeText(markdown);
    toast.success('已複製到剪貼簿（Markdown 格式）');
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-5xl animate-spin" style={{ animationDuration: '2s' }}>☯</div>
      </div>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Page Title */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-[var(--gold)]">歷史記錄</h1>
            <p className="text-muted-foreground mt-1">
              共 {filteredHistory.length} 筆記錄
            </p>
          </div>
        </div>

        {/* Filters */}
        <Card className="glass-panel">
          <CardContent className="p-4">
            <div className="flex flex-col lg:flex-row gap-4">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="搜尋問題或解讀內容..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-10 bg-transparent border-border"
                />
              </div>

              {/* Favorite Filter */}
              <Select value={filterFavorite} onValueChange={(v) => setFilterFavorite(v as 'all' | 'favorite')}>
                <SelectTrigger className="w-full lg:w-40 bg-transparent border-border">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部記錄</SelectItem>
                  <SelectItem value="favorite">僅顯示收藏</SelectItem>
                </SelectContent>
              </Select>

              {/* Admin: User Filter */}
              {isAdmin && (
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger className="w-full lg:w-48 bg-transparent border-border">
                    <Users className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="選擇用戶" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">所有用戶</SelectItem>
                    {users.map(u => (
                      <SelectItem key={u.id} value={u.id.toString()}>
                        {u.username}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </CardContent>
        </Card>

        {/* History List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="text-5xl animate-spin inline-block" style={{ animationDuration: '2s' }}>☯</div>
          </div>
        ) : filteredHistory.length === 0 ? (
          <Card className="glass-panel">
            <CardContent className="py-12 text-center text-muted-foreground">
              {history.length === 0 ? '尚無占卜記錄' : '沒有符合條件的記錄'}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredHistory.map(item => (
              <Card
                key={item.id}
                className="glass-panel hover:border-[var(--gold)]/30 transition-colors cursor-pointer"
                onClick={() => setViewItem(item)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    {/* Main Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-2 py-0.5 rounded-full text-xs bg-[var(--gold)]/20 text-[var(--gold)]">
                          六爻
                        </span>
                        {Boolean(item.is_favorite) && (
                          <Star className="w-4 h-4 fill-[var(--gold)] text-[var(--gold)]" />
                        )}
                        {isAdmin && item.username && (
                          <span className="text-xs text-muted-foreground">
                            by {item.username}
                          </span>
                        )}
                      </div>
                      <h3 className="font-medium text-base truncate mb-1">
                        {item.question}
                      </h3>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {item.interpretation?.replace(/<[^>]*>/g, '').slice(0, 150)}...
                      </p>
                      <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        <span>{formatDate(item.created_at)}</span>
                        {item.ai_model && (
                          <>
                            <span className="mx-1">•</span>
                            <Bot className="w-3 h-3" />
                            <span>{item.ai_model}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-1" onClick={e => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleCopy(item)}
                        title="複製 (Markdown)"
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleToggleFavorite(item.id, item.is_favorite)}
                        className={item.is_favorite ? 'text-[var(--gold)]' : ''}
                        title={item.is_favorite ? '取消收藏' : '加入收藏'}
                      >
                        <Star className={`w-4 h-4 ${item.is_favorite ? 'fill-current' : ''}`} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(item.id)}
                        className="hover:text-destructive"
                        title="刪除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* View Detail Modal */}
      <Dialog open={!!viewItem} onOpenChange={() => setViewItem(null)}>
        <DialogContent className="glass-panel max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl text-[var(--gold)]">
              {viewItem?.question}
            </DialogTitle>
          </DialogHeader>
          {viewItem && (
            <HistoryDetailView
              item={viewItem}
              formatDate={formatDate}
              onCopy={handleCopy}
              onToggleFavorite={handleToggleFavorite}
            />
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

// 詳情視圖組件
function HistoryDetailView({
  item,
  formatDate,
  onCopy,
  onToggleFavorite,
}: {
  item: HistoryItem;
  formatDate: (date: string) => string;
  onCopy: (item: HistoryItem) => void;
  onToggleFavorite: (id: number, isFavorite: boolean) => void;
}) {
  const { thinkContent, htmlContent } = useProcessedContent(item.interpretation);
  const [showThinking, setShowThinking] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Clock className="w-4 h-4" />
        <span>{formatDate(item.created_at)}</span>
        {item.ai_model && (
          <>
            <span>•</span>
            <Bot className="w-4 h-4" />
            <span>{item.ai_model}</span>
          </>
        )}
        {item.is_favorite && (
          <>
            <span>•</span>
            <Star className="w-4 h-4 fill-[var(--gold)] text-[var(--gold)]" />
            <span className="text-[var(--gold)]">已收藏</span>
          </>
        )}
      </div>

      {/* 思考過程折疊區 */}
      {thinkContent && (
        <div className="border border-border rounded-lg overflow-hidden">
          <button
            onClick={() => setShowThinking(!showThinking)}
            className="w-full flex items-center gap-2 px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors"
          >
            <Brain className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground flex-1 text-left">
              AI 思考過程
            </span>
            <ChevronDown
              className={`w-4 h-4 text-muted-foreground transition-transform ${
                showThinking ? 'rotate-180' : ''
              }`}
            />
          </button>
          {showThinking && (
            <div className="px-4 py-3 bg-muted/10 border-t border-border">
              <pre className="text-sm text-muted-foreground whitespace-pre-wrap font-sans leading-relaxed">
                {thinkContent}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* 解讀內容 */}
      <div className="result-content">
        {htmlContent ? (
          <div dangerouslySetInnerHTML={{ __html: htmlContent }} />
        ) : (
          <p className="text-muted-foreground">載入中...</p>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-4 border-t border-border">
        <Button variant="outline" onClick={() => onCopy(item)}>
          <Copy className="w-4 h-4 mr-2" />
          複製結果
        </Button>
        <Button
          variant="outline"
          onClick={() => onToggleFavorite(item.id, item.is_favorite)}
          className={item.is_favorite ? 'text-[var(--gold)] border-[var(--gold)]' : ''}
        >
          <Star className={`w-4 h-4 mr-2 ${item.is_favorite ? 'fill-current' : ''}`} />
          {item.is_favorite ? '取消收藏' : '加入收藏'}
        </Button>
      </div>
    </div>
  );
}

