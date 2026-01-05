'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Compass, History, Settings, LogOut, Menu, X } from 'lucide-react';

// 算命類型卡片
const divinationTypes = [
  {
    id: 'liuyao',
    name: '六爻占卜',
    description: '傳統易經六爻排盤，結合 AI 智慧解讀卦象',
    icon: '☯',
    available: true,
    href: '/liuyao',
  },
  {
    id: 'tarot',
    name: '塔羅占卜',
    description: '西方神秘學智慧，透過牌陣指引當下迷津',
    icon: '🔮',
    available: true,
    href: '/tarot',
  },
  {
    id: 'ziwei',
    name: '紫微斗數',
    description: '中國傳統命理學，推算人生運勢走向',
    icon: '⭐',
    available: false,
    href: '#',
  },
  {
    id: 'bazi',
    name: '八字命盤',
    description: '根據出生時間，分析先天命格',
    icon: '🌙',
    available: false,
    href: '#',
  },
  {
    id: 'liunian',
    name: '流年運勢',
    description: '年度運勢分析與趨吉避凶指引',
    icon: '📅',
    available: false,
    href: '#',
  },
];

export default function HomePage() {
  const router = useRouter();
  const [user, setUser] = useState<{ username: string; role: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

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
        const data = await res.json();
        setUser(data);
      } else {
        localStorage.removeItem('token');
        router.push('/login');
      }
    } catch {
      router.push('/login');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-spin-slow">☯</div>
          <p className="text-gray-400">載入中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* 導航欄 */}
      <nav className="glass-card mx-4 mt-4 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-3xl">☯</span>
          <h1 className="text-xl font-bold text-[var(--gold)]">AI 算命</h1>
        </div>

        {/* 桌面選單 */}
        <div className="hidden md:flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 text-[var(--gold)] border-b-2 border-[var(--gold)] pb-1">
            <Compass size={18} />
            <span>首頁</span>
          </Link>
          <Link href="/history" className="flex items-center gap-2 text-gray-300 hover:text-[var(--gold)] transition">
            <History size={18} />
            <span>歷史</span>
          </Link>
          <Link href="/settings" className="flex items-center gap-2 text-gray-300 hover:text-[var(--gold)] transition">
            <Settings size={18} />
            <span>設定</span>
          </Link>
          <button onClick={handleLogout} className="flex items-center gap-2 text-gray-300 hover:text-red-400 transition">
            <LogOut size={18} />
            <span>登出</span>
          </button>
        </div>

        {/* 手機選單按鈕 */}
        <button className="md:hidden text-gray-300" onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </nav>

      {/* 手機選單 */}
      {menuOpen && (
        <div className="md:hidden glass-card mx-4 mt-2 p-4 space-y-4">
          <Link href="/" className="flex items-center gap-2 text-[var(--gold)]">
            <Compass size={18} />
            <span>首頁</span>
          </Link>
          <Link href="/history" className="flex items-center gap-2 text-gray-300">
            <History size={18} />
            <span>歷史</span>
          </Link>
          <Link href="/settings" className="flex items-center gap-2 text-gray-300">
            <Settings size={18} />
            <span>設定</span>
          </Link>
          <button onClick={handleLogout} className="flex items-center gap-2 text-red-400">
            <LogOut size={18} />
            <span>登出</span>
          </button>
        </div>
      )}

      {/* 主內容 */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* 歡迎區 */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            歡迎回來，<span className="text-[var(--gold)]">{user?.username}</span>
          </h2>
          <p className="text-gray-400 text-lg">選擇一種算命方式，開始你的命理探索之旅</p>
        </div>

        {/* 算命類型卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {divinationTypes.map((type) => (
            <div
              key={type.id}
              className={`glass-card p-6 transition-all duration-300 ${
                type.available
                  ? 'hover:border-[var(--gold)] hover:shadow-lg hover:shadow-[var(--gold)]/20 cursor-pointer'
                  : 'opacity-60'
              }`}
              onClick={() => type.available && router.push(type.href)}
            >
              <div className="flex items-start gap-4">
                <div className="text-5xl">{type.icon}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-bold text-[var(--gold)]">{type.name}</h3>
                    {!type.available && (
                      <span className="text-xs bg-gray-700 text-gray-300 px-2 py-1 rounded">Coming Soon</span>
                    )}
                  </div>
                  <p className="text-gray-400">{type.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* 頁尾 */}
      <footer className="text-center py-8 text-gray-500 text-sm">
        <p>AI 算命 v2.0 - 結合傳統智慧與現代科技</p>
      </footer>
    </div>
  );
}
