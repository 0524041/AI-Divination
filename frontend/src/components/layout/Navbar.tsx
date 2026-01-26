'use client';

import Link from 'next/link';
import { Compass, History, Settings } from 'lucide-react';
import { NavbarClient } from './NavbarClient';
import type { NavItem } from './NavbarClient';

const navItems: NavItem[] = [
  { href: '/', label: '首頁', icon: Compass },
  { href: '/history', label: '歷史', icon: History },
  { href: '/settings', label: '設定', icon: Settings },
];

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 transition-all duration-300">
      {/* Glassmorphism Background with subtle flow */}
      <div className="absolute inset-0 bg-background-primary/80 dark:bg-background-primary/80 backdrop-blur-md border-b border-white/10 dark:border-white/5 shadow-sm overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-accent/5 to-transparent w-[200%] h-full animate-[flow-shine_8s_linear_infinite] pointer-events-none" />
      </div>

      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="flex items-center justify-between h-20">
          <Link
            href="/"
            className="group flex items-center gap-3 text-foreground-primary hover:opacity-80 transition-all duration-300"
          >
            <div className="relative flex items-center justify-center w-10 h-10 rounded-full bg-accent/10 group-hover:bg-accent/20 transition-colors">
              <span className="text-2xl group-hover:scale-110 transition-transform duration-300">☯</span>
            </div>
            <h1 className="text-xl font-heading font-medium tracking-wide hidden sm:block">
              玄覺空間 <span className="text-xs font-sans text-foreground-secondary ml-1 opacity-70">AI Divination</span>
            </h1>
          </Link>

          <NavbarClient items={navItems} />
        </div>
      </nav>
    </header>
  );
}
