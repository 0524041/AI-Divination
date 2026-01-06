'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Compass,
  History as HistoryIcon,
  Settings,
  Trash2,
  Copy,
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
} from 'lucide-react';

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

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (user) {
      fetchHistory();
      // 始終獲取統計（包括 admin 查看其他用戶時）
      fetchStatistics();
      if (user.role === 'admin') {
        fetchAllUsers();
      }
    }
  }, [user, selectedUserId, currentPage]);

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

    // Admin 用戶可以查看其他人的紀錄
    if (user?.role === 'admin') {
      if (selectedUserId === 0) {
        // 查看全部
        endpoint = `/api/history/admin/all?page=${currentPage}&page_size=${pageSize}`;
      } else if (selectedUserId !== null) {
        // 查看特定用戶
        endpoint = `/api/history/admin/all?user_id=${selectedUserId}&page=${currentPage}&page_size=${pageSize}`;
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

  const toggleExpand = async (item: HistoryItem) => {
    if (expandedId === item.id) {
      setExpandedId(null);
      return;
    }

    setExpandedId(item.id);

    // 渲染 Markdown
    if (item.interpretation && !htmlContents[item.id]) {
      try {
        const { parseMarkdown } = await import('@/lib/markdown');
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
    setStatistics(null); // 清空統計資料，等待重新加載
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      completed: 'bg-green-500/20 text-green-400',
      processing: 'bg-yellow-500/20 text-yellow-400',
      pending: 'bg-blue-500/20 text-blue-400',
      error: 'bg-red-500/20 text-red-400',
      cancelled: 'bg-gray-500/20 text-gray-400',
    };
    const labels: Record<string, string> = {
      completed: '已完成',
      processing: '處理中',
      pending: '等待中',
      error: '錯誤',
      cancelled: '已取消',
    };
    return (
      <span className={`text-xs px-2 py-1 rounded ${styles[status] || styles.pending}`}>
        {labels[status] || status}
      </span>
    );
  };

  return (
    <div className="min-h-screen">
      {/* 導航欄 - 增加 z-index 防止下拉選單被遮擋 */}
      <nav className="glass-card mx-4 mt-4 px-6 py-4 flex items-center justify-between relative z-50">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-gray-400 hover:text-[var(--gold)]">
            <ArrowLeft size={24} />
          </Link>
          <div className="flex items-center gap-3">
            <HistoryIcon className="text-[var(--gold)]" size={24} />
            <h1 className="text-xl font-bold text-[var(--gold)]">歷史紀錄</h1>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Admin 用戶篩選器 */}
          {user?.role === 'admin' && (
            <div className="relative user-filter-dropdown">
              <button
                className="flex items-center gap-2 px-3 py-2 bg-gray-800 rounded-lg text-sm hover:bg-gray-700 transition"
                onClick={() => setShowUserFilter(!showUserFilter)}
              >
                <Filter size={16} className="text-[var(--gold)]" />
                <span className="text-gray-300">
                  {selectedUserId === null
                    ? '我的紀錄'
                    : selectedUserId === 0
                      ? '全部用戶'
                      : allUsers.find(u => u.id === selectedUserId)?.username || '篩選用戶'}
                </span>
                <ChevronDown size={16} className={`text-gray-400 transition ${showUserFilter ? 'rotate-180' : ''}`} />
              </button>

              {showUserFilter && (
                <div className="absolute top-full right-0 mt-2 w-48 bg-gray-800 rounded-lg shadow-xl border border-gray-700 py-2 z-50">
                  {/* 我的紀錄 */}
                  <button
                    className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-700 flex items-center gap-2 ${selectedUserId === null ? 'text-[var(--gold)]' : 'text-gray-300'
                      }`}
                    onClick={() => handleUserFilterChange(null)}
                  >
                    <User size={14} />
                    我的紀錄
                    {selectedUserId === null && <span className="ml-auto">✓</span>}
                  </button>

                  {/* 全部用戶 */}
                  <button
                    className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-700 flex items-center gap-2 ${selectedUserId === 0 ? 'text-[var(--gold)]' : 'text-gray-300'
                      }`}
                    onClick={() => handleUserFilterChange(0)}
                  >
                    <Users size={14} />
                    全部用戶
                    {selectedUserId === 0 && <span className="ml-auto">✓</span>}
                  </button>

                  {/* 分隔線 */}
                  {allUsers.length > 0 && (
                    <div className="border-t border-gray-700 my-2"></div>
                  )}

                  {/* 用戶列表 */}
                  {allUsers.map((u) => (
                    <button
                      key={u.id}
                      className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-700 flex items-center gap-2 ${selectedUserId === u.id ? 'text-[var(--gold)]' : 'text-gray-300'
                        }`}
                      onClick={() => handleUserFilterChange(u.id)}
                    >
                      <User size={14} />
                      <span className="truncate">{u.username}</span>
                      {u.role === 'admin' && (
                        <span className="text-xs bg-[var(--gold)]/20 text-[var(--gold)] px-1 rounded">Admin</span>
                      )}
                      {selectedUserId === u.id && <span className="ml-auto">✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="hidden md:flex items-center gap-4">
            <Link href="/" className="text-gray-300 hover:text-[var(--gold)]">
              <Compass size={20} />
            </Link>
            <Link href="/settings" className="text-gray-300 hover:text-[var(--gold)]">
              <Settings size={20} />
            </Link>
          </div>
        </div>
      </nav>

      {/* 主內容 */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* 統計卡片 - 始終顯示統計資訊 */}
        {statistics && (
          <div className="mb-6">
            {/* 統計標題 - 顯示當前查看的統計範圍 */}
            {user?.role === 'admin' && selectedUserId !== null && (
              <div className="mb-3 flex items-center gap-2 text-sm text-gray-400">
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
              <div className="glass-card p-4 flex items-center gap-3 hover:border-[var(--gold)]/30 transition-all">
                <div className="p-2.5 bg-[var(--gold)]/10 text-[var(--gold)] rounded-lg shrink-0">
                  <TrendingUp size={20} />
                </div>
                <div>
                  <div className="text-xs text-gray-400 mb-0.5">歷史總計</div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-bold text-gray-200">
                      {statistics.total_count}
                    </span>
                    <span className="text-xs text-gray-500">次</span>
                  </div>
                </div>
              </div>

              {/* 今日計數 */}
              <div className="glass-card p-4 flex items-center gap-3 hover:border-blue-500/30 transition-all">
                <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-lg shrink-0">
                  <Calendar size={20} />
                </div>
                <div>
                  <div className="text-xs text-gray-400 mb-0.5">今日占卜</div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-bold text-gray-200">
                      {statistics.today_count}
                    </span>
                    <span className="text-xs text-gray-500">次</span>
                  </div>
                </div>
              </div>

              {/* 最常用類型 */}
              <div className="glass-card p-4 flex items-center gap-3 hover:border-purple-500/30 transition-all">
                <div className="p-2.5 bg-purple-500/10 text-purple-400 rounded-lg shrink-0">
                  <BarChart3 size={20} />
                </div>
                <div>
                  <div className="text-xs text-gray-400 mb-0.5">近期偏好 (7天)</div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-base font-bold text-gray-200 truncate max-w-[100px]" title={getDivinationTypeName(statistics.last_7_days_most_used_type)}>
                      {getDivinationTypeName(statistics.last_7_days_most_used_type)}
                    </span>
                    <span className="text-xs text-gray-500">
                      {statistics.last_7_days_type_counts[statistics.last_7_days_most_used_type] || 0}次
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-4 animate-spin-slow">☯</div>
            <p className="text-gray-400">載入中...</p>
          </div>
        ) : history.length === 0 ? (
          <div className="text-center py-12">
            <HistoryIcon className="mx-auto mb-4 text-gray-600" size={48} />
            <p className="text-gray-400">還沒有任何紀錄</p>
            <Link href="/liuyao" className="btn-gold inline-block mt-4">
              開始占卜
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {history.map((item) => (
              <div key={item.id} className="glass-card overflow-hidden">
                {/* 摘要行 */}
                <div
                  className="p-4 cursor-pointer hover:bg-white/5 transition"
                  onClick={() => toggleExpand(item)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <span className="text-xs bg-[var(--gold)]/20 text-[var(--gold)] px-2 py-1 rounded">
                          {getDivinationTypeName(item.divination_type)}
                        </span>
                        {getStatusBadge(item.status)}
                        {selectedUserId !== null && item.username && (
                          <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded flex items-center gap-1">
                            <User size={12} />
                            {item.username}
                          </span>
                        )}
                      </div>
                      <p className={`text-gray-200 ${expandedId === item.id ? 'whitespace-pre-wrap' : 'truncate'}`}>
                        {item.question}
                      </p>
                      
                      {expandedId === item.id && (item.target || item.gender || (item.divination_type === 'tarot' && item.chart_data.spread_name)) && (
                        <div className="flex flex-wrap gap-3 mt-2 text-sm text-gray-400">
                          {/* 塔羅牌顯示牌陣類型 */}
                          {item.divination_type === 'tarot' && item.chart_data.spread_name && (
                            <span className="bg-gray-800 px-2 py-0.5 rounded border border-gray-700">
                              牌陣：<span className="text-gray-300">{item.chart_data.spread_name}</span>
                            </span>
                          )}
                          {/* 六爻等其他占卜顯示對象和性別 */}
                          {item.target && (
                            <span className="bg-gray-800 px-2 py-0.5 rounded border border-gray-700">
                              對象：<span className="text-gray-300">{item.target}</span>
                            </span>
                          )}
                          {item.gender && (
                            <span className="bg-gray-800 px-2 py-0.5 rounded border border-gray-700">
                              性別：<span className="text-gray-300">{item.gender}</span>
                            </span>
                          )}
                        </div>
                      )}

                      {/* 塔羅牌不顯示本卦變卦 */}
                      {item.divination_type !== 'tarot' && (
                        <p className="text-sm text-gray-500 mt-1">
                          {item.chart_data.benguaming} → {item.chart_data.bianguaming}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-xs text-gray-500">{formatDate(item.created_at)}</span>
                      {expandedId === item.id ? (
                        <ChevronUp size={20} className="text-gray-400" />
                      ) : (
                        <ChevronDown size={20} className="text-gray-400" />
                      )}
                    </div>
                  </div>
                </div>

                {/* 展開內容 */}
                {expandedId === item.id && (
                  <div className="border-t border-gray-700 p-4 space-y-4 fade-in">
                    {/* 操作按鈕 */}
                    <div className="flex justify-end gap-3">
                      <button
                        onClick={() => handleCopy(item)}
                        className="px-4 py-2 bg-gray-700 hover:bg-[var(--gold)] text-gray-300 hover:text-gray-900 rounded-lg transition shadow-md flex items-center gap-2"
                      >
                        <Copy size={18} />
                        <span className="font-medium">複製內容</span>
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="px-4 py-2 border border-gray-700 hover:border-red-500/50 text-gray-400 hover:text-red-400 rounded-lg transition flex items-center gap-2"
                      >
                        <Trash2 size={18} />
                        刪除
                      </button>
                    </div>

                    {/* AI 資訊 */}
                    {item.ai_provider && (
                      <div className="text-sm text-gray-500">
                        AI: {item.ai_provider} {item.ai_model && `(${item.ai_model})`}
                      </div>
                    )}

                    {/* 解盤內容 */}
                    {item.interpretation ? (
                      htmlContents[item.id] ? (
                        <div className="space-y-4">
                          {/* Think 內容（可摺疊） */}
                          {htmlContents[item.id].thinkContent && (
                            <details className="bg-gray-800/50 rounded-lg border border-gray-700">
                              <summary className="px-4 py-3 cursor-pointer text-gray-400 hover:text-[var(--gold)] flex items-center gap-2">
                                <span className="text-lg">🧠</span>
                                <span>AI 思考過程（點擊展開）</span>
                              </summary>
                              <div className="px-4 pb-4 text-gray-400 text-sm whitespace-pre-wrap border-t border-gray-700 pt-3">
                                {htmlContents[item.id].thinkContent}
                              </div>
                            </details>
                          )}

                          {/* Raw Data Content */}
                          <details className="bg-gray-800/50 rounded-lg border border-gray-700">
                            <summary className="px-4 py-3 cursor-pointer text-gray-400 hover:text-[var(--gold)] flex items-center gap-2">
                              <span className="text-lg">{item.divination_type === 'tarot' ? '🎴' : '☯'}</span>
                              <span>{item.divination_type === 'tarot' ? '牌陣詳情' : '完整卦象盤面'}（點擊展開）</span>
                            </summary>
                            <div className="px-4 pb-4 text-gray-300 text-sm border-t border-gray-700 pt-3 leading-relaxed">
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
                                        <div className="font-bold text-[var(--gold)] mb-3">{spreadName}</div>
                                        {data.cards?.map((card: any, idx: number) => (
                                          <div key={idx} className="flex items-start gap-3 py-2 border-b border-gray-800 last:border-0">
                                            <span className="text-[var(--gold)] font-bold min-w-[60px]">
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
                                  }
                                  return <div className="whitespace-pre-wrap">{JSON.stringify(data, null, 2)}</div>;
                                } catch (e) {
                                  return <div className="text-red-400">解析失敗</div>;
                                }
                              })()}
                            </div>
                          </details>

                          {/* 主要內容 */}
                          <div
                            className="markdown-content bg-gray-800/30 rounded-xl p-4"
                            dangerouslySetInnerHTML={{ __html: htmlContents[item.id].mainHtml }}
                          />
                        </div>
                      ) : (
                        <div className="text-center py-4">
                          <div className="text-2xl animate-spin-slow">☯</div>
                          <p className="text-gray-500 text-sm mt-2">解析中...</p>
                        </div>
                      )
                    ) : (
                      <p className="text-gray-500">暫無解盤結果</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* 分頁控制 */}
        {!loading && history.length > 0 && (
          <div className="glass-card p-4 mt-6 flex items-center justify-between">
            <div className="text-sm text-gray-400">
              顯示 {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, totalCount)} / 共 {totalCount} 筆
            </div>
            
            {totalPages > 1 ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className={`p-2 rounded-lg border transition ${
                  currentPage === 1
                    ? 'border-gray-700 text-gray-600 cursor-not-allowed'
                    : 'border-gray-700 text-gray-300 hover:border-[var(--gold)] hover:text-[var(--gold)]'
                }`}
              >
                <ChevronLeft size={20} />
              </button>

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
                    <button
                      key={pageNum}
                      onClick={() => handlePageChange(pageNum)}
                      className={`w-10 h-10 rounded-lg border transition ${
                        currentPage === pageNum
                          ? 'border-[var(--gold)] bg-[var(--gold)]/10 text-[var(--gold)] font-bold'
                          : 'border-gray-700 text-gray-300 hover:border-[var(--gold)] hover:text-[var(--gold)]'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className={`p-2 rounded-lg border transition ${
                  currentPage === totalPages
                    ? 'border-gray-700 text-gray-600 cursor-not-allowed'
                    : 'border-gray-700 text-gray-300 hover:border-[var(--gold)] hover:text-[var(--gold)]'
                }`}
              >
                <ChevronRight size={20} />
              </button>
            </div>
            ) : (
              <div className="text-sm text-gray-500">第 1 頁，共 1 頁</div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
