'use client';

/**
 * 登入頁（Ticket 15）
 *
 * 保留四種流程：login / register / init / guest，行為與原版一致
 * （localStorage 'token'、router.push('/')、欄位驗證），僅換新裝。
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, useReducedMotion } from 'framer-motion';
import { Eye, EyeOff, User, Lock, Compass } from 'lucide-react';
import { initializeApiClient } from '@/lib/api-init';
import { apiGet, apiPost } from '@/lib/api-client';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

type Mode = 'login' | 'register' | 'init' | 'guest';

function validateLength(str: string, min: number, max: number, name: string): string | null {
  if (str.length < min || str.length > max) return `${name}長度需為 ${min}-${max} 字`;
  return null;
}

function validateUsername(name: string): string | null {
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) return '用戶名只能包含英數字、底線或連字號';
  return validateLength(name, 3, 20, '用戶名');
}

function validatePassword(pwd: string): string | null {
  return validateLength(pwd, 6, 20, '密碼');
}

export default function LoginPage() {
  const router = useRouter();
  const reducedMotion = useReducedMotion();

  const [isInit, setIsInit] = useState<boolean | null>(null);
  const [mode, setMode] = useState<Mode>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const checkInit = useCallback(async () => {
    try {
      const res = await apiGet('/api/auth/check-init', { skipSignature: true });
      const data = await res.json();
      setIsInit(data.initialized);
      if (!data.initialized) {
        setMode('init');
      }
    } catch {
      setError('無法連接伺服器');
    }
  }, []);

  useEffect(() => {
    initializeApiClient().then(() => {
      checkInit();
    });
  }, [checkInit]);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      let endpoint = '';
      let body: Record<string, string> = {};

      if (mode === 'guest') {
        endpoint = '/api/auth/guest-login';
        body = {};
      } else if (mode === 'init') {
        const pwdError = validatePassword(password);
        if (pwdError) throw new Error(pwdError);
        if (password !== confirmPassword) throw new Error('密碼不一致');
        endpoint = '/api/auth/init';
        body = { password };
      } else if (mode === 'register') {
        const userError = validateUsername(username);
        if (userError) throw new Error(userError);
        const pwdError = validatePassword(password);
        if (pwdError) throw new Error(pwdError);
        if (password !== confirmPassword) throw new Error('密碼不一致');
        endpoint = '/api/auth/register';
        body = { username, password };
      } else {
        endpoint = '/api/auth/login';
        body = { username, password };
      }

      const res = await apiPost(endpoint, body, { skipSignature: true });
      const data = await res.json();

      if (res.ok) {
        localStorage.setItem('token', data.access_token);
        router.push('/');
      } else {
        setError(data.detail || '操作失敗');
      }
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : '無法連接伺服器');
    } finally {
      setLoading(false);
    }
  };

  const inputClasses =
    'w-full rounded-xl border border-border/50 bg-white/80 py-3 pl-10 pr-12 text-foreground-primary placeholder:text-foreground-muted/50 focus:outline-none focus:ring-2 focus:ring-accent/50 dark:bg-black/40';

  if (isInit === null) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <div className="mb-4 flex justify-center">
              <Compass className="h-16 w-16 animate-pulse text-accent" aria-hidden />
            </div>
            <div className="mx-auto h-9 w-32 animate-pulse rounded bg-foreground-muted/20" />
            <p className="mt-4 text-sm text-foreground-muted">載入中…</p>
          </div>
          <Card variant="glass" padding="lg">
            <div className="space-y-4">
              <div className="h-12 animate-pulse rounded bg-foreground-muted/20" />
              <div className="h-12 animate-pulse rounded bg-foreground-muted/20" />
              <div className="h-12 animate-pulse rounded bg-foreground-muted/20" />
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <motion.div
        className="w-full max-w-md"
        initial={reducedMotion ? undefined : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={reducedMotion ? { duration: 0 } : { duration: 0.5, ease: 'easeOut' }}
      >
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="mb-4 flex justify-center">
            <Compass className="h-16 w-16 text-accent" aria-hidden />
          </div>
          <h1 className="font-heading text-3xl font-semibold text-accent">玄覺空間</h1>
          <p className="mt-2 text-foreground-secondary">結合傳統智慧與現代科技</p>
        </div>

        {/* 表單卡片 */}
        <Card variant="glass" padding="lg">
          <h2 className="font-heading mb-6 text-center text-xl font-semibold text-foreground-primary">
            {mode === 'init' && '初始化系統'}
            {mode === 'login' && '登入'}
            {mode === 'register' && '註冊帳號'}
            {mode === 'guest' && '訪客試用'}
          </h2>

          {mode === 'init' && (
            <p className="mb-6 text-center text-sm text-foreground-secondary">
              首次使用，請設定管理員密碼
            </p>
          )}

          {mode === 'guest' && (
            <div className="mb-6 rounded-lg border border-accent/30 bg-accent-light p-4 text-sm">
              <p className="mb-2 font-medium text-foreground-primary">⚡ 訪客試用規則：</p>
              <ul className="list-inside list-disc space-y-1 text-foreground-secondary">
                <li>每日限制 5 次占卜（不限類型）</li>
                <li>無法查看歷史紀錄</li>
                <li>使用系統預設 AI 服務</li>
              </ul>
              <p className="mt-3 font-medium text-accent">註冊帳號即可使用完整功能！</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode !== 'init' && mode !== 'guest' && (
              <div>
                <label htmlFor="login-username" className="mb-2 block text-sm text-foreground-secondary">
                  用戶名
                </label>
                <div className="relative">
                  <User className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted" size={18} aria-hidden />
                  <input
                    id="login-username"
                    name="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className={inputClasses}
                    placeholder="請輸入用戶名"
                    autoComplete="username"
                    required
                  />
                </div>
              </div>
            )}

            {mode !== 'guest' && (
              <>
                <div>
                  <label htmlFor="login-password" className="mb-2 block text-sm text-foreground-secondary">
                    {mode === 'init' ? '設定管理員密碼' : '密碼'}
                  </label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted" size={18} aria-hidden />
                    <input
                      id="login-password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={inputClasses}
                      placeholder="請輸入密碼"
                      autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      aria-label={showPassword ? '隱藏密碼' : '顯示密碼'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-muted hover:text-foreground-primary"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                {(mode === 'init' || mode === 'register') && (
                  <div>
                    <label htmlFor="login-confirm-password" className="mb-2 block text-sm text-foreground-secondary">
                      確認密碼
                    </label>
                    <div className="relative">
                      <Lock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted" size={18} aria-hidden />
                      <input
                        id="login-confirm-password"
                        name="confirmPassword"
                        type={showPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className={inputClasses}
                        placeholder="再次輸入密碼"
                        autoComplete="new-password"
                        required
                        minLength={6}
                      />
                    </div>
                  </div>
                )}
              </>
            )}

            {error && (
              <p
                className="rounded-lg border border-[var(--cinnabar)]/40 bg-[var(--cinnabar)]/10 px-3 py-2 text-sm text-[var(--cinnabar)]"
                role="alert"
              >
                {error}
              </p>
            )}

            <Button variant="gold" fullWidth loading={loading} type="submit">
              {mode === 'init' ? '建立管理員帳號' : mode === 'login' ? '登入' : mode === 'guest' ? '開始試用' : '註冊'}
            </Button>

            {mode === 'login' && (
              <Button
                variant="outline"
                fullWidth
                type="button"
                onClick={() => switchMode('guest')}
              >
                訪客試用
              </Button>
            )}
          </form>

          {isInit && mode !== 'init' && mode !== 'guest' && (
            <div className="mt-6 text-center text-sm">
              {mode === 'login' ? (
                <p className="text-foreground-secondary">
                  還沒有帳號？{' '}
                  <button
                    type="button"
                    className="text-accent hover:underline"
                    onClick={() => switchMode('register')}
                  >
                    註冊
                  </button>
                </p>
              ) : (
                <p className="text-foreground-secondary">
                  已有帳號？{' '}
                  <button
                    type="button"
                    className="text-accent hover:underline"
                    onClick={() => switchMode('login')}
                  >
                    登入
                  </button>
                </p>
              )}
            </div>
          )}
        </Card>
      </motion.div>
    </div>
  );
}
