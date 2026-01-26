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
    <header className="sticky top-0 z-50 bg-background-secondary/80 backdrop-blur-md border-b border-border">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link
            href="/"
            className="flex items-center gap-2.5 text-foreground-primary hover:opacity-80 transition-opacity"
          >
            <span className="text-2xl">☯</span>
            <h1 className="text-lg font-semibold tracking-tight hidden sm:block">
              玄覺空間
            </h1>
          </Link>

          <NavbarClient items={navItems} />
        </div>
      </nav>
    </header>
  );
}
