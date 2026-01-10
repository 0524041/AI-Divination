'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Compass, History, Settings, LogOut, Menu, X, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface NavbarProps {
    /** 頁面標題 (覆蓋預設的 "玄覺空間") */
    pageTitle?: string;
    /** 頁面圖示 (覆蓋預設的 ☯) */
    pageIcon?: React.ReactNode;
    /** 是否顯示返回按鈕 */
    showBackButton?: boolean;
    /** 返回連結 (預設為 /) */
    backHref?: string;
    /** 登出回調 */
    onLogout?: () => void;
    /** 額外 CSS 類別 */
    className?: string;
}

interface NavItem {
    href: string;
    label: string;
    icon: React.ReactNode;
}

const navItems: NavItem[] = [
    { href: '/', label: '首頁', icon: <Compass size={18} /> },
    { href: '/history', label: '歷史', icon: <History size={18} /> },
    { href: '/settings', label: '設定', icon: <Settings size={18} /> },
];

/**
 * 統一的導航列組件
 * 支援子頁面標題、返回按鈕、桌面與手機佈局
 */
export function Navbar({
    pageTitle = '玄覺空間',
    pageIcon = <span className="text-3xl">☯</span>,
    showBackButton = false,
    backHref = '/',
    onLogout,
    className,
}: NavbarProps) {
    const [menuOpen, setMenuOpen] = useState(false);
    const pathname = usePathname();
    const router = useRouter();

    const isActive = (href: string) => {
        if (href === '/') return pathname === '/';
        return pathname.startsWith(href);
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        router.push('/login');
        onLogout?.();
    };

    return (
        <>
            {/* Main Navbar */}
            <nav
                className={cn(
                    'bg-[rgba(22,33,62,0.8)] backdrop-blur-[10px] border border-[rgba(212,175,55,0.2)] rounded-2xl mx-4 mt-4 px-4 sm:px-6 py-4 flex items-center justify-between relative z-50',
                    className
                )}
            >
                {/* Left: Back + Logo/Title */}
                <div className="flex items-center gap-3">
                    {/* 返回按鈕 */}
                    {showBackButton && (
                        <Link
                            href={backHref}
                            className="text-gray-400 hover:text-[var(--gold)] transition-colors p-1 -ml-1"
                            aria-label="返回"
                        >
                            <ArrowLeft size={24} />
                        </Link>
                    )}

                    {/* Logo/Title */}
                    <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                        {pageIcon}
                        <h1 className="text-lg sm:text-xl font-bold text-[var(--gold)] truncate max-w-[140px] sm:max-w-none">
                            {pageTitle}
                        </h1>
                    </Link>
                </div>

                {/* Desktop Navigation */}
                <div className="hidden md:flex items-center gap-4 lg:gap-6">
                    {navItems.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                'flex items-center gap-2 transition-colors text-sm lg:text-base',
                                isActive(item.href)
                                    ? 'text-[var(--gold)] border-b-2 border-[var(--gold)] pb-1'
                                    : 'text-gray-300 hover:text-[var(--gold)]'
                            )}
                        >
                            {item.icon}
                            <span>{item.label}</span>
                        </Link>
                    ))}

                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-2 text-gray-300 hover:text-red-400 transition-colors text-sm lg:text-base"
                    >
                        <LogOut size={18} />
                        <span>登出</span>
                    </button>
                </div>

                {/* Mobile Menu Button */}
                <button
                    className="md:hidden text-gray-300 hover:text-[var(--gold)] transition-colors p-1"
                    onClick={() => setMenuOpen(!menuOpen)}
                    aria-label={menuOpen ? '關閉選單' : '開啟選單'}
                >
                    {menuOpen ? <X size={24} /> : <Menu size={24} />}
                </button>
            </nav>

            {/* Mobile Menu */}
            {menuOpen && (
                <div className="md:hidden bg-[rgba(22,33,62,0.95)] backdrop-blur-xl border border-[rgba(212,175,55,0.2)] rounded-2xl mx-4 mt-2 p-4 space-y-4 animate-in fade-in slide-in-from-top-2 relative z-40">
                    {navItems.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setMenuOpen(false)}
                            className={cn(
                                'flex items-center gap-3 py-2',
                                isActive(item.href) ? 'text-[var(--gold)]' : 'text-gray-300'
                            )}
                        >
                            {item.icon}
                            <span>{item.label}</span>
                        </Link>
                    ))}

                    <button
                        onClick={() => {
                            setMenuOpen(false);
                            handleLogout();
                        }}
                        className="flex items-center gap-3 py-2 text-red-400 w-full"
                    >
                        <LogOut size={18} />
                        <span>登出</span>
                    </button>
                </div>
            )}
        </>
    );
}
