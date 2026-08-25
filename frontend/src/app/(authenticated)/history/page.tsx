'use client';

/**
 * 歷史 → 對話紀錄頁（Ticket 12）
 *
 * - 列表：GET /api/history（分頁＋搜尋）；admin 可切換 /api/history/admin/all
 * - 開啟對話：ThreadDialog 內嵌 ThreadPanel，可續問
 * - 統計：GET /api/history/statistics
 * - pending/processing 每 3 秒靜默輪詢刷新
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  BarChart3,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Copy,
  History as HistoryIcon,
  MessageCircle,
  Search,
  Share2,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { Dialog, DialogContent, DialogClose } from '@/components/ui/Dialog';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/contexts/AuthContext';
import { apiDelete, apiGet, apiPost } from '@/lib/api-client';
import type { User } from '@/contexts/AuthContext';
import { ThreadDialog } from './ThreadDialog';

interface ChartData {
  benguaming?: string;
  bianguaming?: string;
  spread_name?: string;
  query_type?: string;
  query_date?: string;
  [key: string]: unknown;
}

interface HistoryItem {
  id: number;
  divination_type: string;
  question: string;
  gender: string | null;
  target: string | null;
  chart_data: ChartData;
  interpretation: string | null;
  ai_provider: string | null;
  ai_model: string | null;
  status: string;
  created_at: string;
  username?: string;
}

interface Statistics {
  total_count: number;
  today_count: number;
  last_7_days_most_used_type: string;
  last_7_days_type_counts: Record<string, number>;
}

const PAGE_SIZE = 20;

const TYPE_NAMES: Record<string, string> = {
  liuyao: '六爻占卜',
  ziwei: '紫微斗數',
  bazi: '八字命盤',
  tarot: '塔羅占卜',
};

const STATUS_VARIANTS: Record<string, 'success' | 'warning' | 'default' | 'error'> = {
  completed: 'success',
  processing: 'warning',
  pending: 'default',
  error: 'error',
  cancelled: 'default',
};

const STATUS_LABELS: Record<string, string> = {
  completed: '已完成',
  processing: '處理中',
  pending: '等待中',
  error: '錯誤',
  cancelled: '已取消',
};

function formatDate(dateStr: string): string {
  // 後端回傳 UTC 無時區標記，補 'Z' 讓瀏覽器正確轉換
  const utcDateStr = dateStr.endsWith('Z') ? dateStr : `${dateStr}Z`;
  return new Date(utcDateStr).toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** 組出複製用的 Markdown 文本 */
function buildCopyText(item: HistoryItem): string {
  let chartInfo = '';
  if (item.divination_type === 'tarot') {
    chartInfo = `牌陣：${item.chart_data.spread_name || '未知'}\n\n`;
    const cards = item.chart_data.cards as Array<{ name_cn: string; name: string; reversed: boolean; position: string }> | undefined;
    if (Array.isArray(cards)) {
      chartInfo += '抽牌結果：\n';
      cards.forEach((card, index) => {
        const positionName =
          card.position === 'past' ? '過去' :
          card.position === 'present' ? '現在' :
          card.position === 'future' ? '未來' : card.position;
        chartInfo += `${index + 1}. ${positionName}：${card.name_cn} (${card.name})${card.reversed ? ' (逆位)' : ''}\n`;
      });
    }
  } else {
    chartInfo = `${item.chart_data.benguaming ?? ''} → ${item.chart_data.bianguaming ?? ''}`;
  }
  return `## 問題\n${item.question}\n\n## ${item.divination_type === 'tarot' ? '牌陣' : '卦象'}\n${chartInfo}\n\n## 解盤\n${item.interpretation || '無'}`;
}

async function copyText(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      /* fall through */
    }
  }
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0';
    document.body.appendChild(textArea);
    textArea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textArea);
    return ok;
  } catch {
    return false;
  }
}

export default function HistoryPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  // 分頁
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // 搜尋
  const [searchTerm, setSearchTerm] = useState('');
  const [searchInputValue, setSearchInputValue] = useState('');

  // Admin 用戶篩選：null=自己、0=全部、其他=特定用戶
  const isAdmin = user?.role === 'admin';
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

  // 統計
  const [statistics, setStatistics] = useState<Statistics | null>(null);

  // 對話視窗 & 刪除確認
  const [openThreadId, setOpenThreadId] = useState<number | null>(null);
  const [openThreadQuestion, setOpenThreadQuestion] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<HistoryItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const historyEndpoint = useMemo(() => {
    if (isAdmin && selectedUserId !== null) {
      const base =
        selectedUserId === 0
          ? `/api/history/admin/all?`
          : `/api/history/admin/all?user_id=${selectedUserId}&`;
      return `${base}page=${currentPage}&page_size=${PAGE_SIZE}${searchTerm ? `&search=${encodeURIComponent(searchTerm)}` : ''}`;
    }
    return `/api/history?page=${currentPage}&page_size=${PAGE_SIZE}${searchTerm ? `&search=${encodeURIComponent(searchTerm)}` : ''}`;
  }, [isAdmin, selectedUserId, currentPage, searchTerm]);

  const fetchHistory = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const res = await apiGet(historyEndpoint);
        if (res.ok) {
          const data = await res.json();
          setHistory(data.items || []);
          setTotalCount(data.total || 0);
          setTotalPages(Math.max(1, Math.ceil((data.total || 0) / PAGE_SIZE)));
        }
      } catch (err) {
        console.error('Fetch history error:', err);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [historyEndpoint]
  );

  const fetchStatistics = useCallback(async () => {
    let endpoint = '/api/history/statistics';
    if (isAdmin && selectedUserId !== null) {
      endpoint += `?user_id=${selectedUserId}`;
    }
    try {
      const res = await apiGet(endpoint);
      if (res.ok) setStatistics(await res.json());
    } catch (err) {
      console.error('Fetch statistics error:', err);
    }
  }, [isAdmin, selectedUserId]);

  useEffect(() => {
    if (!user) return;
    fetchHistory();
    fetchStatistics();
  }, [user, fetchHistory, fetchStatistics]);

  useEffect(() => {
    if (user?.role === 'admin') {
      apiGet('/api/admin/users')
        .then((res) => (res.ok ? res.json() : []))
        .then(setAllUsers)
        .catch((err) => console.error('Fetch users error:', err));
    }
  }, [user]);

  // 輪詢：有進行中的紀錄時每 3 秒靜默刷新
  useEffect(() => {
    const hasPending = history.some(
      (item) => item.status === 'pending' || item.status === 'processing'
    );
    if (!hasPending || loading) return;

    const interval = setInterval(() => {
      fetchHistory(true);
    }, 3000);
    return () => clearInterval(interval);
  }, [history, loading, fetchHistory]);

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleUserFilterChange = (value: string) => {
    setSelectedUserId(value === 'mine' ? null : Number(value));
    setCurrentPage(1);
  };

  const handleRetry = async (item: HistoryItem) => {
    try {
      const res = await apiPost(`/api/history/${item.id}/retry`);
      if (res.ok) {
        setHistory((prev) =>
          prev.map((h) =>
            h.id === item.id ? { ...h, status: 'pending', interpretation: null } : h
          )
        );
        toast('已送出重新解盤', { kind: 'success' });
      } else {
        const data = await res.json().catch(() => null);
        toast(data?.detail || '重試失敗', { kind: 'error' });
      }
    } catch {
      toast('重試請求發送失敗', { kind: 'error' });
    }
  };

  const handleCopy = async (item: HistoryItem) => {
    const ok = await copyText(buildCopyText(item));
    toast(ok ? '已複製到剪貼簿' : '複製失敗，請手動複製內容', {
      kind: ok ? 'success' : 'error',
    });
  };

  const handleShare = async (item: HistoryItem) => {
    try {
      const res = await apiPost('/api/share/create', { history_id: item.id });
      if (!res.ok) throw new Error('建立分享連結失敗');
      const data = await res.json();
      const shareUrl = `${window.location.origin}${data.share_url}`;
      const copied = await copyText(shareUrl);
      toast(copied ? '分享連結已複製到剪貼簿' : `分享連結：${shareUrl}`, {
        kind: copied ? 'success' : 'info',
        title: '分享',
      });
    } catch (err) {
      console.error('Share error:', err);
      toast('建立分享連結失敗', { kind: 'error' });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await apiDelete(`/api/history/${deleteTarget.id}`);
      if (res.ok) {
        setHistory((prev) => prev.filter((h) => h.id !== deleteTarget.id));
        setTotalCount((c) => Math.max(0, c - 1));
        fetchStatistics();
        toast('紀錄已刪除', { kind: 'success' });
        setDeleteTarget(null);
      } else {
        toast('刪除失敗', { kind: 'error' });
      }
    } catch (err) {
      console.error('Delete error:', err);
      toast('刪除失敗', { kind: 'error' });
    } finally {
      setDeleting(false);
    }
  };

  if (authLoading) {
    return (
      <main className="w-full max-w-4xl mx-auto px-4 py-10 space-y-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </main>
    );
  }

  return (
    <>
      <main className="w-full max-w-4xl mx-auto px-4 py-6">
        {/* 標題 */}
        <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-heading text-2xl font-semibold text-foreground-primary">占卜紀錄</h1>
            <p className="text-sm text-foreground-muted mt-1">開啟任一紀錄即可繼續追問</p>
          </div>
          {isAdmin && (
            <div className="w-48">
              <Select
                label="查看範圍"
                value={selectedUserId === null ? 'mine' : String(selectedUserId)}
                onChange={(e) => handleUserFilterChange(e.target.value)}
                options={[
                  { value: 'mine', label: '我的紀錄' },
                  { value: '0', label: '全部用戶' },
                  ...allUsers.map((u) => ({ value: String(u.id), label: u.username })),
                ]}
              />
            </div>
          )}
        </div>

        {/* 統計 */}
        {statistics && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
            <Card variant="glass" className="p-4 flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-accent/10 text-accent shrink-0" aria-hidden>
                <TrendingUp size={20} />
              </div>
              <div>
                <div className="text-xs text-foreground-muted mb-0.5">歷史總計</div>
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-bold text-foreground-primary">{statistics.total_count}</span>
                  <span className="text-xs text-foreground-muted">次</span>
                </div>
              </div>
            </Card>

            <Card variant="glass" className="p-4 flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-accent-light text-accent shrink-0" aria-hidden>
                <Calendar size={20} />
              </div>
              <div>
                <div className="text-xs text-foreground-muted mb-0.5">今日占卜</div>
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-bold text-foreground-primary">{statistics.today_count}</span>
                  <span className="text-xs text-foreground-muted">次</span>
                </div>
              </div>
            </Card>

            <Card variant="glass" className="p-4 flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-gold/10 text-accent-secondary dark:text-accent shrink-0" aria-hidden>
                <BarChart3 size={20} />
              </div>
              <div>
                <div className="text-xs text-foreground-muted mb-0.5">近期偏好（7 天）</div>
                <div className="flex items-baseline gap-1">
                  <span
                    className="text-base font-bold text-foreground-primary truncate max-w-[110px]"
                    title={TYPE_NAMES[statistics.last_7_days_most_used_type] ?? statistics.last_7_days_most_used_type}
                  >
                    {TYPE_NAMES[statistics.last_7_days_most_used_type] ?? statistics.last_7_days_most_used_type}
                  </span>
                  <span className="text-xs text-foreground-muted">
                    {statistics.last_7_days_type_counts[statistics.last_7_days_most_used_type] || 0} 次
                  </span>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* 搜尋 */}
        <form
          className="mb-6"
          onSubmit={(e) => {
            e.preventDefault();
            handleSearch(searchInputValue.trim());
          }}
        >
          <div className="flex gap-2 items-end">
            <Input
              label="搜尋紀錄"
              type="text"
              value={searchInputValue}
              onChange={(e) => setSearchInputValue(e.target.value)}
              placeholder="輸入問題關鍵字…"
              className="flex-1"
            />
            <Button type="submit" variant="gold" leftIcon={<Search size={16} />}>
              搜尋
            </Button>
            {(searchTerm || searchInputValue) && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setSearchInputValue('');
                  handleSearch('');
                }}
              >
                清除
              </Button>
            )}
          </div>
          {searchTerm && (
            <p className="mt-2 text-sm text-foreground-muted px-1">
              搜尋「<span className="text-accent">{searchTerm}</span>」的結果，共 {totalCount} 筆
            </p>
          )}
        </form>

        {/* 列表 */}
        {loading ? (
          <div className="space-y-4">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : history.length === 0 ? (
          <div className="text-center py-20 rounded-3xl border border-dashed border-border bg-background-card/30">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-accent/5 flex items-center justify-center">
              <HistoryIcon className="text-accent/50" size={40} aria-hidden />
            </div>
            <h2 className="font-heading text-xl font-medium text-foreground-primary mb-2">暫無占卜紀錄</h2>
            <p className="text-foreground-secondary mb-8 max-w-sm mx-auto">
              您的探索之旅尚未開始。嘗試一次占卜，尋找生命的指引。
            </p>
            <Link href="/liuyao">
              <Button type="button" variant="gold">開始第一次占卜</Button>
            </Link>
          </div>
        ) : (
          <ul className="space-y-4 list-none p-0">
            {history.map((item) => (
              <li key={item.id}>
                <Card variant="glass" padding="sm" hover className="group">
                  <button
                    type="button"
                    className="w-full text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-xl"
                    onClick={() => {
                      setOpenThreadId(item.id);
                      setOpenThreadQuestion(item.question);
                    }}
                    aria-label={`開啟對話：${item.question}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                          <Badge variant="accent" size="sm">
                            {TYPE_NAMES[item.divination_type] ?? item.divination_type}
                          </Badge>
                          <Badge variant={STATUS_VARIANTS[item.status] ?? 'default'} size="sm">
                            {STATUS_LABELS[item.status] ?? item.status}
                          </Badge>
                          {selectedUserId !== null && item.username && (
                            <Badge variant="default" size="sm">{item.username}</Badge>
                          )}
                        </div>
                        <p className="text-foreground-primary text-base md:text-lg truncate group-hover:text-accent transition-colors">
                          {item.question}
                        </p>
                        <p className="text-sm text-foreground-muted mt-1 truncate">
                          {item.divination_type === 'tarot'
                            ? item.chart_data.spread_name || ''
                            : `${item.chart_data.benguaming ?? ''} → ${item.chart_data.bianguaming ?? ''}`}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <span className="inline-flex items-center gap-1 text-accent opacity-0 group-hover:opacity-100 transition-opacity text-sm">
                          <MessageCircle size={15} aria-hidden /> 續問
                        </span>
                        <time className="text-xs text-foreground-muted whitespace-nowrap">
                          {formatDate(item.created_at)}
                        </time>
                      </div>
                    </div>
                  </button>

                  {/* 操作列 */}
                  <div className="flex justify-end gap-2 flex-wrap border-t border-border/60 mt-3 pt-3">
                    {item.status === 'error' && (
                      <Button type="button" variant="outline" size="sm" onClick={() => handleRetry(item)}>
                        重試解盤
                      </Button>
                    )}
                    <Button type="button" variant="secondary" size="sm" leftIcon={<MessageCircle size={15} />} onClick={() => {
                      setOpenThreadId(item.id);
                      setOpenThreadQuestion(item.question);
                    }}>
                      對話
                    </Button>
                    <Button type="button" variant="secondary" size="sm" leftIcon={<Share2 size={15} />} onClick={() => handleShare(item)}>
                      分享
                    </Button>
                    <Button type="button" variant="secondary" size="sm" leftIcon={<Copy size={15} />} onClick={() => handleCopy(item)}>
                      複製
                    </Button>
                    <Button type="button" variant="danger" size="sm" leftIcon={<Trash2 size={15} />} onClick={() => setDeleteTarget(item)}>
                      刪除
                    </Button>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}

        {/* 分頁控制 */}
        {!loading && totalPages > 1 && (
          <Card variant="glass" className="p-4 mt-6 flex items-center justify-between flex-wrap gap-3">
            <div className="text-sm text-foreground-muted">
              第 {currentPage} / {totalPages} 頁，共 {totalCount} 筆
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                aria-label="上一頁"
                className="w-9 h-9 p-0"
              >
                <ChevronLeft size={18} />
              </Button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const pageNum =
                  totalPages <= 5
                    ? i + 1
                    : currentPage <= 3
                      ? i + 1
                      : currentPage >= totalPages - 2
                        ? totalPages - 4 + i
                        : currentPage - 2 + i;
                return (
                  <Button
                    key={pageNum}
                    type="button"
                    variant={currentPage === pageNum ? 'gold' : 'outline'}
                    size="sm"
                    onClick={() => handlePageChange(pageNum)}
                    className="w-9 h-9 p-0"
                    aria-label={`第 ${pageNum} 頁`}
                    aria-current={currentPage === pageNum ? 'page' : undefined}
                  >
                    {pageNum}
                  </Button>
                );
              })}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                aria-label="下一頁"
                className="w-9 h-9 p-0"
              >
                <ChevronRight size={18} />
              </Button>
            </div>
          </Card>
        )}
      </main>

      {/* 對話視窗 */}
      <ThreadDialog
        recordId={openThreadId}
        question={openThreadQuestion}
        onClose={() => setOpenThreadId(null)}
        onQuotaExceeded={({ used, limit }) =>
          toast(`今日訪客額度已用完（${used}/${limit}），註冊可解鎖完整對話`, { kind: 'error', title: '額度用盡' })
        }
        onError={(message) => toast(message, { kind: 'error', title: '對話失敗' })}
      />

      {/* 刪除確認 */}
      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent title="刪除紀錄" className="w-[min(92vw,420px)]">
          <p className="text-sm text-foreground-secondary mb-6">
            確定要刪除「{deleteTarget?.question}」嗎？此操作無法復原。
          </p>
          <div className="flex justify-end gap-3">
            <DialogClose asChild>
              <Button type="button" variant="secondary">取消</Button>
            </DialogClose>
            <Button type="button" variant="danger" loading={deleting} onClick={handleDelete}>
              確定刪除
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
