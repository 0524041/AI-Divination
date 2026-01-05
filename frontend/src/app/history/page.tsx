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
} from 'lucide-react';

interface HistoryItem {
  id: number;
  divination_type: string;
  question: string;
  gender: string | null;
  target: string | null;
  chart_data: {
    benguaming: string;
    bianguaming: string;
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

export default function HistoryPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [htmlContents, setHtmlContents] = useState<Record<number, { mainHtml: string; thinkContent: string }>>({});

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
      if (user.role === 'admin') {
        fetchAllUsers();
      }
    }
  }, [user, selectedUserId]);

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

    let endpoint = '/api/history';

    // Admin 用戶可以查看其他人的紀錄
    if (user?.role === 'admin') {
      if (selectedUserId === 0) {
        // 查看全部
        endpoint = '/api/history/admin/all';
      } else if (selectedUserId !== null) {
        // 查看特定用戶
        endpoint = `/api/history/admin/all?user_id=${selectedUserId}`;
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
      }
    } catch (err) {
      console.error('Fetch history error:', err);
    } finally {
      setLoading(false);
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
      }
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  const handleCopy = async (item: HistoryItem) => {
    // 準備 Markdown 格式文本
    const markdownText = `## 問題\n${item.question}\n\n## 卦象\n${item.chart_data.benguaming} → ${item.chart_data.bianguaming}\n\n## 解盤\n${item.interpretation || '無'}`;

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
                    onClick={() => {
                      setSelectedUserId(null);
                      setShowUserFilter(false);
                    }}
                  >
                    <User size={14} />
                    我的紀錄
                    {selectedUserId === null && <span className="ml-auto">✓</span>}
                  </button>

                  {/* 全部用戶 */}
                  <button
                    className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-700 flex items-center gap-2 ${selectedUserId === 0 ? 'text-[var(--gold)]' : 'text-gray-300'
                      }`}
                    onClick={() => {
                      setSelectedUserId(0);
                      setShowUserFilter(false);
                    }}
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
                      onClick={() => {
                        setSelectedUserId(u.id);
                        setShowUserFilter(false);
                      }}
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
                      
                      {expandedId === item.id && (item.target || item.gender) && (
                        <div className="flex flex-wrap gap-3 mt-2 text-sm text-gray-400">
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

                      <p className="text-sm text-gray-500 mt-1">
                        {item.chart_data.benguaming} → {item.chart_data.bianguaming}
                      </p>
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
                              <span className="text-lg">📊</span>
                              <span>原始數據（點擊展開）</span>
                            </summary>
                            <div className="px-4 pb-4 text-gray-400 text-xs whitespace-pre-wrap border-t border-gray-700 pt-3 font-mono overflow-x-auto">
                              {typeof item.chart_data === 'string' 
                                ? item.chart_data 
                                : JSON.stringify(item.chart_data, null, 2)}
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
      </main>
    </div>
  );
}
