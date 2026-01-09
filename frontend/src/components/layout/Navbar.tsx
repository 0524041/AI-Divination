'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Compass, History, Settings, LogOut, Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface NavbarProps {
    username?: string;
    onLogout?: () => void;
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
 * Shared navigation bar component
 * Handles both desktop and mobile layouts
 */
export function Navbar({ username, onLogout, className }: NavbarProps) {
    const [menuOpen, setMenuOpen] = useState(false);
    const pathname = usePathname();

    const isActive = (href: string) => {
        if (href === '/') return pathname === '/';
        return pathname.startsWith(href);
    };

    return (
        <>
            {/* Main Navbar */}
            <nav className={cn(
                'bg-[rgba(22,33,62,0.8)] backdrop-blur-[10px] border border-[rgba(212,175,55,0.2)] rounded-2xl mx-4 mt-4 px-6 py-4 flex items-center justify-between',
                className
            )}>
                {/* Logo */}
                <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                    <span className="text-3xl">☯</span>
                    <h1 className="text-xl font-bold text-[var(--gold)]">玄覺空間</h1>
                </Link>

                {/* Desktop Navigation */}
                <div className="hidden md:flex items-center gap-6">
                    {navItems.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                'flex items-center gap-2 transition-colors',
                                isActive(item.href)
                                    ? 'text-[var(--gold)] border-b-2 border-[var(--gold)] pb-1'
                                    : 'text-gray-300 hover:text-[var(--gold)]'
                            )}
                        >
                            {item.icon}
                            <span>{item.label}</span>
                        </Link>
                    ))}

                    {onLogout && (
                        <button
                            onClick={onLogout}
                            className="flex items-center gap-2 text-gray-300 hover:text-red-400 transition-colors"
                        >
                            <LogOut size={18} />
                            <span>登出</span>
                        </button>
                    )}
                </div>

                {/* Mobile Menu Button */}
                <button
                    className="md:hidden text-gray-300 hover:text-[var(--gold)] transition-colors"
                    onClick={() => setMenuOpen(!menuOpen)}
                >
                    {menuOpen ? <X size={24} /> : <Menu size={24} />}
                </button>
            </nav>

            {/* Mobile Menu */}
            {menuOpen && (
                <div className="md:hidden bg-[rgba(22,33,62,0.95)] backdrop-blur-xl border border-[rgba(212,175,55,0.2)] rounded-2xl mx-4 mt-2 p-4 space-y-4 animate-in fade-in slide-in-from-top-2">
                    {navItems.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setMenuOpen(false)}
                            className={cn(
                                'flex items-center gap-2',
                                isActive(item.href) ? 'text-[var(--gold)]' : 'text-gray-300'
                            )}
                        >
                            {item.icon}
                            <span>{item.label}</span>
                        </Link>
                    ))}

                    {onLogout && (
                        <button
                            onClick={() => { setMenuOpen(false); onLogout(); }}
                            className="flex items-center gap-2 text-red-400"
                        >
                            <LogOut size={18} />
                            <span>登出</span>
                        </button>
                    )}
                </div>
            )}
        </>
    );
}
