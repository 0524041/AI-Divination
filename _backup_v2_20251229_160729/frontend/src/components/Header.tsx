'use client';

import { useRouter } from 'next/navigation';
import { useApp } from '@/contexts/AppContext';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { User, History, BookOpen, Settings, LogOut, Users } from 'lucide-react';

interface HeaderProps {
  onOpenTutorial: () => void;
}

export function Header({ onOpenTutorial }: HeaderProps) {
  const router = useRouter();
  const { user, logout } = useApp();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass-panel rounded-none border-t-0 border-x-0">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity">
          <span className="text-2xl animate-spin" style={{ animationDuration: '10s' }}>
            ☯
          </span>
          <span className="text-xl font-bold text-[var(--gold)]">靈機一動</span>
        </div>

        {/* Navigation */}
        <nav className="flex items-center gap-2">
          {user && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-[var(--gold)] hover:bg-[var(--gold)]/10"
                onClick={() => router.push('/history')}
              >
                <History className="w-4 h-4 mr-2" />
                歷史
              </Button>

              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-[var(--gold)] hover:bg-[var(--gold)]/10"
                onClick={onOpenTutorial}
              >
                <BookOpen className="w-4 h-4 mr-2" />
                教學
              </Button>

              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-[var(--gold)] hover:bg-[var(--gold)]/10"
                onClick={() => router.push('/settings')}
              >
                <Settings className="w-4 h-4 mr-2" />
                設定
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-[var(--gold)] hover:bg-[var(--gold)]/10"
                  >
                    <User className="w-4 h-4 mr-2" />
                    {user.username}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  {user.role === 'admin' && (
                    <>
                      <DropdownMenuItem onClick={() => router.push('/admin')}>
                        <Users className="w-4 h-4 mr-2" />
                        用戶管理
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  <DropdownMenuItem onClick={handleLogout}>
                    <LogOut className="w-4 h-4 mr-2" />
                    登出
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
