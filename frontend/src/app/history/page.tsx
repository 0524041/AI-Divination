'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { parseMarkdown } from '@/lib/markdown';
import { Navbar } from '@/components/layout/Navbar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { SkeletonCard } from '@/components/ui/Skeleton';
import {
  History as HistoryIcon,
  Trash2,
  Copy,
  Share2,
  ChevronDown,
  ChevronUp,
  User,
  Filter,
  Users,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Calendar,
  BarChart3,
  Check,
  Search,
} from 'lucide-react';
import { ZiweiChart } from '@/components/ziwei/ZiweiChart';

interface HistoryItem {
  id: number;
  divination_type: string;
  question: string;
  gender: string | null;
  target: string | null;
  chart_data: {
    benguaming?: string;
    bianguaming?: string;
    formatted?: string;
    spread?: string;
    spread_name?: string;
    // Ziwei fields
    palaces?: any[];
    astrolabe?: any; // sometimes iztro might wrap it?
    solarDate?: string;
    lunarDate?: string;
    chineseDate?: string;
    time?: string;
    fiveElementsClass?: string;
    zodiac?: string;
    timeChar?: string;
    correctionNote?: string;
    
    cards?: Array<{
      id: number;
      name: string;
      name_cn: string;
      image: string;
      reversed: boolean;
      position: string;
    }>;
    [key: string]: unknown;
  };
  interpretation: string | null;
  ai_provider: string | null;
  ai_model: string | null;
  status: string;
  created_at: string;
  username?: string;
}

interface UserInfo {
  id: number;
  username: string;
  role: string;
}

interface Statistics {
  total_count: number;
  today_count: number;
  last_7_days_most_used_type: string;
  last_7_days_type_counts: Record<string, number>;
}

export default function HistoryPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [htmlContents, setHtmlContents] = useState<Record<number, { mainHtml: string; thinkContent: string }>>({});

  // 分頁相關
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 20;

  // 統計資訊
  const [statistics, setStatistics] = useState<Statistics | null>(null);

  // Admin 篩選功能
  const [allUsers, setAllUsers] = useState<UserInfo[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null); // null = 自己, 0 = 全部
  const [showUserFilter, setShowUserFilter] = useState(false);
  const [userSearchTerm, setUserSearchTerm] = useState('');

  // 歷史紀錄搜尋
  const [historySearchTerm, setHistorySearchTerm] = useState('');
  const [searchInputValue, setSearchInputValue] = useState('');

  // 過濾用戶列表
  const filteredUsers = useMemo(() => {
    if (!userSearchTerm.trim()) return allUsers.slice(0, 10);
    return allUsers
      .filter(u => u.username.toLowerCase().includes(userSearchTerm.toLowerCase()))
      .slice(0, 10);
  }, [allUsers, userSearchTerm]);

  // 分享狀態
  const [sharingState, setSharingState] = useState<Record<number, 'idle' | 'loading' | 'success'>>({});

  useEffect(() => {
    checkAuth();
  }, []);

  // 換頁或切換用戶或搜尋時載入歷史和統計
  useEffect(() => {
    if (user) {
      fetchHistory();
      fetchStatistics(); // 切換用戶時也更新統計資料
    }
  }, [user, selectedUserId, currentPage, historySearchTerm]);

  // 用戶列表只在初始載入時請求一次
  useEffect(() => {
    if (user && user.role === 'admin') {
      fetchAllUsers();
    }
  }, [user]);

  // 點擊外部關閉下拉選單
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.user-filter-dropdown')) {
        setShowUserFilter(false);
      }
    };
    if (showUserFilter) {
      document.addEventListener('click', handleClickOutside);
    }
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showUserFilter]);

  const checkAuth = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const userData = await res.json();
        setUser(userData);
      } else {
        router.push('/login');
      }
    } catch {
      router.push('/login');
    }
  };

  const fetchAllUsers = async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/admin/users', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const users = await res.json();
        setAllUsers(users);
      }
    } catch (err) {
      console.error('Fetch users error:', err);
    }
  };

  const fetchHistory = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');

    let endpoint = `/api/history?page=${currentPage}&page_size=${pageSize}`;

    // 加入搜尋參數
    if (historySearchTerm) {
      endpoint += `&search=${encodeURIComponent(historySearchTerm)}`;
    }

    // Admin 用戶可以查看其他人的紀錄
    if (user?.role === 'admin') {
      if (selectedUserId === 0) {
        // 查看全部
        endpoint = `/api/history/admin/all?page=${currentPage}&page_size=${pageSize}`;
        if (historySearchTerm) {
          endpoint += `&search=${encodeURIComponent(historySearchTerm)}`;
        }
      } else if (selectedUserId !== null) {
        // 查看特定用戶
        endpoint = `/api/history/admin/all?user_id=${selectedUserId}&page=${currentPage}&page_size=${pageSize}`;
        if (historySearchTerm) {
          endpoint += `&search=${encodeURIComponent(historySearchTerm)}`;
        }
      }
      // selectedUserId === null 時查看自己的（使用預設 /api/history）
    }

    try {
      const res = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setHistory(data.items || []);
        setTotalCount(data.total || 0);
        setTotalPages(Math.ceil((data.total || 0) / pageSize));
      }
    } catch (err) {
      console.error('Fetch history error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStatistics = async () => {
    const token = localStorage.getItem('token');

    // 根據當前篩選條件構建 endpoint
    let endpoint = '/api/history/statistics';
    if (user?.role === 'admin') {
      if (selectedUserId === 0) {
        // 查看全部用戶的統計
        endpoint = '/api/history/statistics?user_id=0';
      } else if (selectedUserId !== null) {
        // 查看特定用戶的統計
        endpoint = `/api/history/statistics?user_id=${selectedUserId}`;
      }
      // selectedUserId === null 時查看 admin 自己的統計（不帶參數）
    }


    try {
      const res = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setStatistics(data);
      } else {
        console.error('[History] Statistics fetch failed:', res.status, res.statusText);
      }
    } catch (err) {
      console.error('Fetch statistics error:', err);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('確定要刪除這筆紀錄嗎？')) return;

    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/history/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setHistory((prev) => prev.filter((item) => item.id !== id));
        // 重新獲取統計資料
        fetchStatistics();
      }
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  const handleCopy = async (item: HistoryItem) => {
    // 準備不同占卜類型的文本
    let cardInfo = '';

    if (item.divination_type === 'tarot') {
      // 塔羅牌格式
      cardInfo = `牌陣：${item.chart_data.spread_name || '未知'}\n\n`;
      if (item.chart_data.cards) {
        cardInfo += '抽牌結果：\n';
        item.chart_data.cards.forEach((card, index) => {
          const positionName =
            card.position === 'past' ? '過去' :
              card.position === 'present' ? '現在' :
                card.position === 'future' ? '未來' :
                  card.position;
          cardInfo += `${index + 1}. ${positionName}：${card.name_cn} (${card.name})${card.reversed ? ' (逆位)' : ''}\n`;
        });
      }
    } else {
      // 六爻等其他占卜格式
      cardInfo = `${item.chart_data.benguaming || ''} → ${item.chart_data.bianguaming || ''}`;
    }

    // 準備 Markdown 格式文本
    const markdownText = `## 問題\n${item.question}\n\n## ${item.divination_type === 'tarot' ? '牌陣' : '卦象'}\n${cardInfo}\n\n## 解盤\n${item.interpretation || '無'}`;

    // 優先使用 execCommand（相容性最好）
    const fallbackCopy = () => {
      const textArea = document.createElement('textarea');
      textArea.value = markdownText;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();

      try {
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        return successful;
      } catch (err) {
        document.body.removeChild(textArea);
        return false;
      }
    };

    // 嘗試使用 Clipboard API
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(markdownText);
        alert('已複製到剪貼簿');
        return;
      } catch (err) {
        // Clipboard API 失敗，嘗試 fallback
        console.warn('Clipboard API 失敗，嘗試 fallback:', err);
      }
    }

    // Fallback 方法
    if (fallbackCopy()) {
      alert('已複製到剪貼簿');
    } else {
      alert('複製失敗，請手動複製內容');
    }
  };

  const handleShare = async (item: HistoryItem) => {
    const token = localStorage.getItem('token');
    if (!token) return;

    setSharingState(prev => ({ ...prev, [item.id]: 'loading' }));

    // Safari 修復：使用 ClipboardItem + Promise 方式
    // 關鍵：navigator.clipboard.write() 必須在用戶手勢上下文中同步呼叫
    // 但可以傳入一個 Promise 給 ClipboardItem，讓 async 操作在 Promise 內執行

    // 創建一個 Promise 來獲取分享連結
    const getShareUrl = async (): Promise<string> => {
      const res = await fetch('/api/share/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ history_id: item.id }),
      });

      if (!res.ok) {
        throw new Error('建立分享連結失敗');
      }

      const data = await res.json();
      return `${window.location.origin}${data.share_url}`;
    };

    try {
      // 檢查是否支援 ClipboardItem（Safari 13.1+, Chrome 66+）
      if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
        // Safari 相容方案：使用 ClipboardItem + Promise
        // 這樣 write() 是同步呼叫（保持用戶手勢上下文），但內容是 async 獲取
        const textPromise = getShareUrl().then(url => new Blob([url], { type: 'text/plain' }));
        const clipboardItem = new ClipboardItem({
          'text/plain': textPromise
        });

        await navigator.clipboard.write([clipboardItem]);

        setSharingState(prev => ({ ...prev, [item.id]: 'success' }));
        setTimeout(() => {
          setSharingState(prev => ({ ...prev, [item.id]: 'idle' }));
        }, 3000);
        return;
      }

      // Fallback：傳統方式（Chrome 等較寬容的瀏覽器）
      const shareUrl = await getShareUrl();

      // 嘗試 Clipboard API
      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(shareUrl);
          setSharingState(prev => ({ ...prev, [item.id]: 'success' }));
          setTimeout(() => {
            setSharingState(prev => ({ ...prev, [item.id]: 'idle' }));
          }, 3000);
          return;
        } catch (clipboardErr) {
          console.warn('Clipboard API failed:', clipboardErr);
        }
      }

      // Fallback: execCommand
      const textArea = document.createElement('textarea');
      textArea.value = shareUrl;
      textArea.style.cssText = 'position:fixed;top:0;left:0;width:2em;height:2em;opacity:0';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();

      const copied = document.execCommand('copy');
      document.body.removeChild(textArea);

      if (copied) {
        setSharingState(prev => ({ ...prev, [item.id]: 'success' }));
        setTimeout(() => {
          setSharingState(prev => ({ ...prev, [item.id]: 'idle' }));
        }, 3000);
      } else {
        // 最後手段：顯示連結讓用戶手動複製
        prompt('請手動複製分享連結:', shareUrl);
        setSharingState(prev => ({ ...prev, [item.id]: 'idle' }));
      }
    } catch (err) {
      console.error('Share error:', err);
      alert('建立分享連結失敗');
      setSharingState(prev => ({ ...prev, [item.id]: 'idle' }));
    }
  };


  const toggleExpand = async (item: HistoryItem) => {
    if (expandedId === item.id) {
      setExpandedId(null);
      return;
    }

    setExpandedId(item.id);

    // 渲染 Markdown
    if (item.interpretation && !htmlContents[item.id]) {
      try {
        const result = await parseMarkdown(item.interpretation);
        setHtmlContents((prev) => ({ ...prev, [item.id]: result }));
      } catch (err) {
        console.error('Markdown parsing error:', err);
        setHtmlContents((prev) => ({
          ...prev,
          [item.id]: { mainHtml: `<p class="text-red-400">解析失敗: ${err}</p>`, thinkContent: '' }
        }));
      }
    }
  };

  const formatDate = (dateStr: string) => {
    // 後端傳來的是 UTC 時間但沒有標記時區 (例如 "2024-01-01T12:00:00")
    // 我們手動加上 'Z' 強制瀏覽器將其視為 UTC 時間
    const utcDateStr = dateStr.endsWith('Z') ? dateStr : `${dateStr}Z`;
    const date = new Date(utcDateStr);

    return date.toLocaleString('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getDivinationTypeName = (type: string) => {
    const types: Record<string, string> = {
      liuyao: '六爻占卜',
      ziwei: '紫微斗數',
      bazi: '八字命盤',
      tarot: '塔羅占卜',
    };
    return types[type] || type;
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleUserFilterChange = (userId: number | null) => {
    setSelectedUserId(userId);
    setCurrentPage(1); // 切換用戶時重置到第一頁
    setShowUserFilter(false);
    // 不需要清空統計資料，useEffect 會自動重新獲取
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "success" | "warning" | "default" | "error" | "accent"> = {
      completed: 'success',
      processing: 'warning',
      pending: 'default',
      error: 'error',
      cancelled: 'default',
    };
    const labels: Record<string, string> = {
      completed: '已完成',
      processing: '處理中',
      pending: '等待中',
      error: '錯誤',
      cancelled: '已取消',
    };
    return (
      <Badge variant={variants[status] || 'default'} size="sm">
        {labels[status] || status}
      </Badge>
    );
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* 使用共用 Navbar */}
      <Navbar
        pageTitle="歷史紀錄"
        pageIcon={<HistoryIcon className="text-accent" size={24} />}
        showBackButton
        backHref="/"
      />

      {/* 主內容 */}
      <main className="w-full max-w-4xl mx-auto px-4 py-6">
        {/* Admin 用戶篩選器 - 移動到內容區 */}
        {user?.role === 'admin' && (
          <div className="mb-4 flex items-center justify-between">
            <div className="relative user-filter-dropdown">
              <Button
                variant="secondary"
                onClick={() => setShowUserFilter(!showUserFilter)}
                className="gap-2"
              >
                <Filter size={16} className="text-accent" />
                <span className="text-foreground-secondary">
                  {selectedUserId === null
                    ? '我的紀錄'
                    : selectedUserId === 0
                      ? '全部用戶'
                      : allUsers.find(u => u.id === selectedUserId)?.username || '篩選用戶'}
                </span>
                <ChevronDown size={16} className={`text-foreground-muted transition ${showUserFilter ? 'rotate-180' : ''}`} />
              </Button>

              {showUserFilter && (
                <div className="absolute top-full left-0 mt-2 w-56 bg-background-card rounded-xl shadow-xl border border-border py-2 z-50">
                  {/* 我的紀錄 */}
                  <button
                    className={`w-full px-4 py-2.5 text-left text-sm hover:bg-foreground-muted/10 flex items-center gap-2 ${selectedUserId === null ? 'text-accent' : 'text-foreground-secondary'}`}
                    onClick={() => handleUserFilterChange(null)}
                  >
                    <User size={14} />
                    我的紀錄
                    {selectedUserId === null && <span className="ml-auto">✓</span>}
                  </button>

                  {/* 全部用戶 */}
                  <button
                    className={`w-full px-4 py-2.5 text-left text-sm hover:bg-foreground-muted/10 flex items-center gap-2 ${selectedUserId === 0 ? 'text-accent' : 'text-foreground-secondary'}`}
                    onClick={() => handleUserFilterChange(0)}
                  >
                    <Users size={14} />
                    全部用戶
                    {selectedUserId === 0 && <span className="ml-auto">✓</span>}
                  </button>

                  {/* 分隔線與搜尋 */}
                  {allUsers.length > 0 && (
                    <>
                      <div className="border-t border-border my-2"></div>
                      {/* 搜尋框 */}
                      <div className="px-2 pb-2">
                        <div className="relative">
                          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted" />
                          <input
                            type="text"
                            value={userSearchTerm}
                            onChange={(e) => setUserSearchTerm(e.target.value)}
                            placeholder="搜尋用戶..."
                            className="w-full pl-8 pr-3 py-2 bg-foreground-muted/20 rounded-lg text-sm text-foreground-primary placeholder-foreground-muted focus:outline-none focus:ring-1 focus:ring-accent"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                      </div>
                    </>
                  )}

                  {/* 用戶列表 - 可滾動 */}
                  <div className="max-h-48 overflow-y-auto">
                    {filteredUsers.map((u) => (
                      <button
                        key={u.id}
                        className={`w-full px-4 py-2.5 text-left text-sm hover:bg-foreground-muted/10 flex items-center gap-2 ${selectedUserId === u.id ? 'text-accent' : 'text-foreground-secondary'}`}
                        onClick={() => handleUserFilterChange(u.id)}
                      >
                        <User size={14} />
                        <span className="truncate">{u.username}</span>
                        {u.role === 'admin' && (
                          <span className="text-xs bg-accent/20 text-accent px-1 rounded">Admin</span>
                        )}
                        {selectedUserId === u.id && <span className="ml-auto">✓</span>}
                      </button>
                    ))}
                    {filteredUsers.length === 0 && userSearchTerm && (
                      <div className="px-4 py-2 text-sm text-foreground-muted text-center">
                        找不到符合的用戶
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        {/* 統計卡片 - 始終顯示統計資訊 */}
        {statistics && (
          <div className="mb-6">
            {/* 統計標題 - 顯示當前查看的統計範圍 */}
            {user?.role === 'admin' && selectedUserId !== null && (
              <div className="mb-3 flex items-center gap-2 text-sm text-foreground-muted">
                <BarChart3 size={16} />
                <span>
                  {selectedUserId === 0
                    ? '所有用戶統計'
                    : `用戶 ${allUsers.find(u => u.id === selectedUserId)?.username || '未知'} 的統計`}
                </span>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* 總計數 */}
              <Card variant="glass" className="p-4 flex items-center gap-3 hover:border-accent/30 transition-all">
                <div className="p-2.5 bg-accent/10 text-accent rounded-lg shrink-0">
                  <TrendingUp size={20} />
                </div>
                <div>
                  <div className="text-xs text-foreground-muted mb-0.5">歷史總計</div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-bold text-foreground-primary">
                      {statistics.total_count}
                    </span>
                    <span className="text-xs text-foreground-muted">次</span>
                  </div>
                </div>
              </Card>

              {/* 今日計數 */}
              <Card variant="glass" className="p-4 flex items-center gap-3 hover:border-blue-500/30 transition-all">
                <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-lg shrink-0">
                  <Calendar size={20} />
                </div>
                <div>
                  <div className="text-xs text-foreground-muted mb-0.5">今日占卜</div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-bold text-foreground-primary">
                      {statistics.today_count}
                    </span>
                    <span className="text-xs text-foreground-muted">次</span>
                  </div>
                </div>
              </Card>

              {/* 最常用類型 */}
              <Card variant="glass" className="p-4 flex items-center gap-3 hover:border-purple-500/30 transition-all">
                <div className="p-2.5 bg-purple-500/10 text-purple-400 rounded-lg shrink-0">
                  <BarChart3 size={20} />
                </div>
                <div>
                  <div className="text-xs text-foreground-muted mb-0.5">近期偏好 (7天)</div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-base font-bold text-foreground-primary truncate max-w-[100px]" title={getDivinationTypeName(statistics.last_7_days_most_used_type)}>
                      {getDivinationTypeName(statistics.last_7_days_most_used_type)}
                    </span>
                    <span className="text-xs text-foreground-muted">
                      {statistics.last_7_days_type_counts[statistics.last_7_days_most_used_type] || 0}次
                    </span>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* 歷史紀錄搜尋 */}
        <div className="mb-4">
          <div className="relative">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground-muted" />
            <input
              type="text"
              value={searchInputValue}
              onChange={(e) => setSearchInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setHistorySearchTerm(searchInputValue);
                  setCurrentPage(1);
                }
              }}
              placeholder="搜尋問題內容... (按 Enter 搜尋)"
              className="w-full pl-12 pr-24 py-3 bg-background-card border border-border rounded-xl text-foreground-primary placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-accent/50"
            />
            {(searchInputValue || historySearchTerm) && (
              <button
                onClick={() => {
                  setSearchInputValue('');
                  setHistorySearchTerm('');
                  setCurrentPage(1);
                }}
                className="absolute right-20 top-1/2 -translate-y-1/2 text-foreground-muted hover:text-foreground-primary p-1"
              >
                ✕
              </button>
            )}
            <div className="absolute right-2 top-1/2 -translate-y-1/2">
              <Button
                variant="gold"
                size="sm"
                onClick={() => {
                  setHistorySearchTerm(searchInputValue);
                  setCurrentPage(1);
                }}
              >
                搜尋
              </Button>
            </div>
          </div>
          {historySearchTerm && (
            <div className="mt-2 text-sm text-foreground-muted">
              搜尋「{historySearchTerm}」的結果，共 {totalCount} 筆
            </div>
          )}
        </div>

        {loading ? (
          <div className="space-y-4">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : history.length === 0 ? (
          <div className="text-center py-12">
            <HistoryIcon className="mx-auto mb-4 text-foreground-muted" size={48} />
            <p className="text-foreground-muted">還沒有任何紀錄</p>
            <Link href="/liuyao">
              <Button variant="gold" className="mt-4">
                開始占卜
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {history.map((item) => (
              <Card key={item.id} variant="glass" className="overflow-hidden">
                {/* 摘要行 */}
                <div
                  className="p-4 cursor-pointer hover:bg-foreground-muted/5 transition"
                  onClick={() => toggleExpand(item)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <Badge variant="accent" size="sm">
                          {getDivinationTypeName(item.divination_type)}
                        </Badge>
                        {getStatusBadge(item.status)}
                        {selectedUserId !== null && item.username && (
                          <Badge variant="default" size="sm" className="bg-blue-500/20 text-blue-400 gap-1">
                            <User size={12} />
                            {item.username}
                          </Badge>
                        )}
                      </div>
                      <p className={`text-foreground-primary ${expandedId === item.id ? 'whitespace-pre-wrap' : 'truncate'}`}>
                        {item.question}
                      </p>

                      {expandedId === item.id && (item.target || item.gender || (item.divination_type === 'tarot' && item.chart_data.spread_name) || item.divination_type === 'ziwei') && (
                        <div className="flex flex-wrap gap-3 mt-2 text-sm text-foreground-muted">
                          {/* 塔羅牌顯示牌陣類型 */}
                          {item.divination_type === 'tarot' && item.chart_data.spread_name && (
                            <span className="bg-background-card/50 px-2 py-0.5 rounded border border-border">
                              牌陣：<span className="text-foreground-secondary">{item.chart_data.spread_name}</span>
                            </span>
                          )}
                          {/* 紫微斗數顯示測算類型與日期 */}
                          {item.divination_type === 'ziwei' && (
                            <>
                              <span className="bg-background-card/50 px-2 py-0.5 rounded border border-border">
                                類型：<span className="text-foreground-secondary">
                                  {item.chart_data.query_type === 'natal' ? '本命' :
                                   item.chart_data.query_type === 'yearly' ? '流年' :
                                   item.chart_data.query_type === 'monthly' ? '流月' :
                                   item.chart_data.query_type === 'daily' ? '流日' : '本命'}
                                </span>
                              </span>
                              {item.chart_data.query_type && item.chart_data.query_type !== 'natal' && item.chart_data.query_date && (
                                <span className="bg-background-card/50 px-2 py-0.5 rounded border border-border">
                                  日期：<span className="text-foreground-secondary">
                                    {new Date(item.chart_data.query_date as string).toLocaleDateString('zh-TW')}
                                  </span>
                                </span>
                              )}
                            </>
                          )}
                          {/* 六爻等其他占卜顯示對象和性別 */}
                          {item.target && (
                            <span className="bg-background-card/50 px-2 py-0.5 rounded border border-border">
                              對象：<span className="text-foreground-secondary">{item.target}</span>
                            </span>
                          )}
                          {item.gender && (
                            <span className="bg-background-card/50 px-2 py-0.5 rounded border border-border">
                              性別：<span className="text-foreground-secondary">{item.gender === 'male' || item.gender === '男' ? '男' : '女'}</span>
                            </span>
                          )}
                        </div>
                      )}

                      {/* 塔羅牌不顯示本卦變卦 */}
                      {item.divination_type !== 'tarot' && (
                        <p className="text-sm text-foreground-muted mt-1">
                          {item.chart_data.benguaming} → {item.chart_data.bianguaming}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-xs text-foreground-muted">{formatDate(item.created_at)}</span>
                      {expandedId === item.id ? (
                        <ChevronUp size={20} className="text-foreground-muted" />
                      ) : (
                        <ChevronDown size={20} className="text-foreground-muted" />
                      )}
                    </div>
                  </div>
                </div>

                {/* 展開內容 */}
                {expandedId === item.id && (
                  <div className="border-t border-border p-4 space-y-4 fade-in">
                    {/* 操作按鈕 */}
                    <div className="flex justify-end gap-3">
                      <Button
                        onClick={() => handleShare(item)}
                        disabled={sharingState[item.id] === 'loading'}
                        variant={sharingState[item.id] === 'success' ? 'primary' : 'secondary'}
                        className={sharingState[item.id] === 'success' ? 'bg-green-600 hover:bg-green-700 border-transparent text-white' : ''}
                        leftIcon={
                          sharingState[item.id] === 'loading' ? (
                            <></>
                          ) : sharingState[item.id] === 'success' ? (
                            <Check size={18} />
                          ) : (
                            <Share2 size={18} />
                          )
                        }
                        loading={sharingState[item.id] === 'loading'}
                      >
                        {sharingState[item.id] === 'loading'
                          ? '生成中...'
                          : sharingState[item.id] === 'success'
                            ? '已複製連結！'
                            : '分享'}
                      </Button>

                      <Button
                        onClick={() => handleCopy(item)}
                        variant="secondary"
                        leftIcon={<Copy size={18} />}
                      >
                        複製
                      </Button>
                      <Button
                        onClick={() => handleDelete(item.id)}
                        variant="danger"
                        leftIcon={<Trash2 size={18} />}
                      >
                        刪除
                      </Button>
                    </div>

                    {/* AI 資訊 */}
                    {item.ai_provider && (
                      <div className="text-sm text-foreground-muted">
                        AI: {item.ai_provider} {item.ai_model && `(${item.ai_model})`}
                      </div>
                    )}

                    {/* 解盤內容 */}
                    {item.interpretation ? (
                      htmlContents[item.id] ? (
                        <div className="space-y-4">
                          {/* Think 內容（可摺疊） */}
                          {htmlContents[item.id].thinkContent && (
                            <details className="bg-foreground-muted/5 rounded-lg border border-border">
                              <summary className="px-4 py-3 cursor-pointer text-foreground-muted hover:text-accent flex items-center gap-2">
                                <span className="text-lg">🧠</span>
                                <span>AI 思考過程（點擊展開）</span>
                              </summary>
                              <div className="px-4 pb-4 text-foreground-muted text-sm whitespace-pre-wrap border-t border-border pt-3">
                                {htmlContents[item.id].thinkContent}
                              </div>
                            </details>
                          )}

                          {/* Raw Data Content */}
                          <details className="bg-foreground-muted/5 rounded-lg border border-border">
                            <summary className="px-4 py-3 cursor-pointer text-foreground-muted hover:text-accent flex items-center gap-2">
                              <span className="text-lg">{item.divination_type === 'tarot' ? '🎴' : '☯'}</span>
                              <span>{item.divination_type === 'tarot' ? '牌陣詳情' : '完整卦象盤面'}（點擊展開）</span>
                            </summary>
                            <div className="px-4 pb-4 text-foreground-secondary text-sm border-t border-border pt-3 leading-relaxed">
                              {(() => {
                                try {
                                  const data = typeof item.chart_data === 'string' ? JSON.parse(item.chart_data) : item.chart_data;
                                  if (item.divination_type === 'tarot') {
                                    // 塔羅牌：顯示牌陣
                                    const spreadName = data.spread === 'three_card' ? '三牌陣（過去-現在-未來）' :
                                      data.spread === 'single' ? '單抽牌' :
                                        data.spread === 'celtic_cross' ? '凱爾特十字' : '未知牌陣';
                                    return (
                                      <div className="space-y-3">
                                        <div className="font-bold text-accent mb-3">{spreadName}</div>
                                        {data.cards?.map((card: any, idx: number) => (
                                          <div key={idx} className="flex items-start gap-3 py-2 border-b border-border last:border-0">
                                            <span className="text-accent font-bold min-w-[60px]">
                                              {card.position === 'past' ? '過去' :
                                                card.position === 'present' ? '現在' :
                                                  card.position === 'future' ? '未來' :
                                                    card.position}:
                                            </span>
                                            <span className="flex-1">
                                              {card.name_cn} ({card.name}){card.reversed ? ' (逆位)' : ''}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    );
                                  } else if (item.divination_type === 'liuyao') {
                                    // 六爻：顯示 formatted
                                    return <div className="whitespace-pre-wrap">{data.formatted || JSON.stringify(data, null, 2)}</div>;
                                  } else if (item.divination_type === 'ziwei') {
                                    // 紫微斗數：顯示命盤
                                    // 建構 centerInfo
                                    const centerInfo = {
                                      name: data.name || item.username || '用戶', // 優先使用 chart_data 中的測算者姓名
                                      gender: item.gender === '男' ? 'male' : 'female',
                                      fiveElements: data.fiveElementsClass || '',
                                      birthDate: data.solarDate || '',
                                      solarDate: data.solarDate || '',
                                      lunarDate: data.lunarDate || '',
                                      bazi: data.chineseDate || '',
                                      lunarInfo: {
                                        description: data.lunarDate || ''
                                      },
                                      correctionNote: data.correctionNote
                                    };
                                    
                                    // 判斷 viewMode
                                    const viewMode = (data.query_type as 'natal' | 'yearly' | 'monthly' | 'daily') || 'natal';
                                    
                                    return (
                                      <div className="overflow-x-auto">
                                        <div className="min-w-[350px] transform scale-[0.8] origin-top-left md:scale-100 md:origin-top">
                                          <ZiweiChart 
                                            chart={data} 
                                            centerInfo={centerInfo as any} 
                                            viewMode={viewMode} 
                                          />
                                        </div>
                                      </div>
                                    );
                                  }
                                  return <div className="whitespace-pre-wrap">{JSON.stringify(data, null, 2)}</div>;
                                } catch (e) {
                                  return <div className="text-red-400">解析失敗: {(e as Error).message}</div>;
                                }
                              })()}
                            </div>
                          </details>

                          {/* 主要內容 */}
                          <div
                            className="markdown-content bg-foreground-muted/10 rounded-xl p-4"
                            dangerouslySetInnerHTML={{ __html: htmlContents[item.id].mainHtml }}
                          />
                        </div>
                      ) : (
                        <div className="text-center py-4">
                          <div className="text-2xl animate-spin-slow">☯</div>
                          <p className="text-foreground-muted text-sm mt-2">解析中...</p>
                        </div>
                      )
                    ) : (
                      <p className="text-foreground-muted">暫無解盤結果</p>
                    )}
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}

        {/* 分頁控制 */}
        {!loading && history.length > 0 && (
          <Card variant="glass" className="p-4 mt-6 flex items-center justify-between">
            <div className="text-sm text-foreground-muted">
              顯示 {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, totalCount)} / 共 {totalCount} 筆
            </div>

            {totalPages > 1 ? (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="w-9 h-9 p-0"
                >
                  <ChevronLeft size={20} />
                </Button>

                {/* 頁碼按鈕 */}
                <div className="flex gap-2">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum: number;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }

                    return (
                      <Button
                        key={pageNum}
                        variant={currentPage === pageNum ? 'gold' : 'outline'}
                        size="sm"
                        onClick={() => handlePageChange(pageNum)}
                        className="w-9 h-9 p-0 font-mono"
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="w-9 h-9 p-0"
                >
                  <ChevronRight size={20} />
                </Button>
              </div>
            ) : (
              <div className="text-sm text-foreground-muted">第 1 頁，共 1 頁</div>
            )}
          </Card>
        )}
      </main>
    </div>
  );
}
