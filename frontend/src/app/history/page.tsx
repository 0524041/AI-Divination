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

export default function HistoryPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ role: string } | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'mine' | 'all'>('mine');
  const [htmlContents, setHtmlContents] = useState<Record<number, { mainHtml: string; thinkContent: string }>>({});

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (user) {
      fetchHistory();
    }
  }, [user, viewMode]);

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
        setUser(await res.json());
      } else {
        router.push('/login');
      }
    } catch {
      router.push('/login');
    }
  };

  const fetchHistory = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');
    const endpoint = viewMode === 'all' && user?.role === 'admin' ? '/api/history/admin/all' : '/api/history';

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
    try {
      // 準備 Markdown 格式文本
      const markdownText = `## 問題\n${item.question}\n\n## 卦象\n${item.chart_data.benguaming} → ${item.chart_data.bianguaming}\n\n## 解盤\n${item.interpretation || '無'}`;

      // 準備 HTML 格式（用於支援富文本的應用）
      const htmlText = `
<h2>問題</h2>
<p>${item.question}</p>

<h2>卦象</h2>
<p>${item.chart_data.benguaming} → ${item.chart_data.bianguaming}</p>

<h2>解盤</h2>
<div>${item.interpretation?.replace(/\n/g, '<br>') || '無'}</div>
    `.trim();

      // 嘗試使用新的 Clipboard API（支援多種格式）
      if (navigator.clipboard && navigator.clipboard.write) {
        const blob = new Blob([htmlText], { type: 'text/html' });
        const textBlob = new Blob([markdownText], { type: 'text/plain' });

        await navigator.clipboard.write([
          new ClipboardItem({
            'text/html': blob,
            'text/plain': textBlob
          })
        ]);
        alert('已複製到剪貼簿（支援 Markdown 格式）');
      } else {
        // 降級方案：只複製純文字
        await navigator.clipboard.writeText(markdownText);
        alert('已複製到剪貼簿');
      }
    } catch (err) {
      console.error('複製失敗:', err);

      // 最終降級方案：使用舊的 execCommand 方法
      try {
        const textArea = document.createElement('textarea');
        textArea.value = `## 問題\n${item.question}\n\n## 卦象\n${item.chart_data.benguaming} → ${item.chart_data.bianguaming}\n\n## 解盤\n${item.interpretation || '無'}`;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        alert('已複製到剪貼簿');
      } catch (fallbackErr) {
        console.error('降級複製也失敗:', fallbackErr);
        alert('複製失敗，請手動複製內容');
      }
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
    const date = new Date(dateStr);
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
      {/* 導航欄 */}
      <nav className="glass-card mx-4 mt-4 px-6 py-4 flex items-center justify-between">
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
          {user?.role === 'admin' && (
            <div className="flex items-center gap-2 bg-gray-800 rounded-lg p-1">
              <button
                className={`px-3 py-1 rounded text-sm transition ${viewMode === 'mine' ? 'bg-[var(--gold)] text-black' : 'text-gray-400'
                  }`}
                onClick={() => setViewMode('mine')}
              >
                我的
              </button>
              <button
                className={`px-3 py-1 rounded text-sm transition ${viewMode === 'all' ? 'bg-[var(--gold)] text-black' : 'text-gray-400'
                  }`}
                onClick={() => setViewMode('all')}
              >
                全部
              </button>
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
                        {viewMode === 'all' && item.username && (
                          <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded flex items-center gap-1">
                            <User size={12} />
                            {item.username}
                          </span>
                        )}
                      </div>
                      <p className="text-gray-200 truncate">{item.question}</p>
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
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handleCopy(item)}
                        className="text-gray-400 hover:text-[var(--gold)] flex items-center gap-1 text-sm"
                      >
                        <Copy size={16} />
                        複製
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="text-gray-400 hover:text-red-400 flex items-center gap-1 text-sm"
                      >
                        <Trash2 size={16} />
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
