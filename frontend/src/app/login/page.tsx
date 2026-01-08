'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, User, Lock } from 'lucide-react';
import { initializeApiClient } from '@/lib/api-init';
import { apiGet, apiPost } from '@/lib/api-client';

export default function LoginPage() {
  const router = useRouter();
  const [isInit, setIsInit] = useState<boolean | null>(null);
  const [mode, setMode] = useState<'login' | 'register' | 'init'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // 初始化 API 客戶端
    initializeApiClient().then(() => {
      checkInit();
    });
  }, []);

  const checkInit = async () => {
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
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      let endpoint = '';
      let body: Record<string, string> = {};

      // Common Validation
      const validateLength = (str: string, min: number, max: number, name: string) => {
        if (str.length < min || str.length > max) return `${name}長度需為 ${min}-${max} 字`;
        return null;
      };

      const validateUsername = (name: string) => {
        if (!/^[a-zA-Z0-9_-]+$/.test(name)) return "用戶名只能包含英數字、底線或連字號";
        return validateLength(name, 3, 20, "用戶名");
      }

      const validatePassword = (pwd: string) => validateLength(pwd, 6, 20, "密碼");

      if (mode === 'init') {
        const pwdError = validatePassword(password);
        if (pwdError) { setError(pwdError); setLoading(false); return; }
        if (password !== confirmPassword) {
          setError('密碼不一致');
          setLoading(false);
          return;
        }
        endpoint = '/api/auth/init';
        body = { password };
      } else if (mode === 'register') {
        const userError = validateUsername(username);
        if (userError) { setError(userError); setLoading(false); return; }
        const pwdError = validatePassword(password);
        if (pwdError) { setError(pwdError); setLoading(false); return; }

        if (password !== confirmPassword) {
          setError('密碼不一致');
          setLoading(false);
          return;
        }
        endpoint = '/api/auth/register';
        body = { username, password };
      } else {
        // Login usually doesn't need strict validation, but length check is fine
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
    } catch {
      setError('無法連接伺服器');
    } finally {
      setLoading(false);
    }
  };

  if (isInit === null) {
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
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-7xl mb-4">☯</div>
          <h1 className="text-3xl font-bold text-[var(--gold)]">AI 算命</h1>
          <p className="text-gray-400 mt-2">結合傳統智慧與現代科技</p>
        </div>

        {/* 表單卡片 */}
        <div className="glass-card p-8">
          <h2 className="text-xl font-bold text-center mb-6">
            {mode === 'init' && '初始化系統'}
            {mode === 'login' && '登入'}
            {mode === 'register' && '註冊帳號'}
          </h2>

          {mode === 'init' && (
            <p className="text-gray-400 text-center mb-6 text-sm">
              首次使用，請設定管理員密碼
            </p>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 用戶名 (登入和註冊時顯示) */}
            {mode !== 'init' && (
              <div>
                <label className="block text-sm text-gray-400 mb-2">用戶名</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" size={18} />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="input-dark w-full"
                    style={{ paddingLeft: '2.5rem', paddingRight: '1rem' }}
                    placeholder="請輸入用戶名"
                    required
                  />
                </div>
              </div>
            )}

            {/* 密碼 */}
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                {mode === 'init' ? '設定管理員密碼' : '密碼'}
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" size={18} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-dark w-full"
                  style={{ paddingLeft: '2.5rem', paddingRight: '3rem' }}
                  placeholder="請輸入密碼"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* 確認密碼 (初始化和註冊時) */}
            {(mode === 'init' || mode === 'register') && (
              <div>
                <label className="block text-sm text-gray-400 mb-2">確認密碼</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" size={18} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="input-dark w-full"
                    style={{ paddingLeft: '2.5rem', paddingRight: '1rem' }}
                    placeholder="再次輸入密碼"
                    required
                    minLength={6}
                  />
                </div>
              </div>
            )}

            {/* 錯誤訊息 */}
            {error && (
              <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* 提交按鈕 */}
            <button type="submit" className="btn-gold w-full" disabled={loading}>
              {loading ? '處理中...' : mode === 'init' ? '建立管理員帳號' : mode === 'login' ? '登入' : '註冊'}
            </button>
          </form>

          {/* 切換模式 */}
          {isInit && mode !== 'init' && (
            <div className="mt-6 text-center text-sm">
              {mode === 'login' ? (
                <p className="text-gray-400">
                  還沒有帳號？{' '}
                  <button
                    type="button"
                    className="text-[var(--gold)] hover:underline"
                    onClick={() => {
                      setMode('register');
                      setError('');
                    }}
                  >
                    註冊
                  </button>
                </p>
              ) : (
                <p className="text-gray-400">
                  已有帳號？{' '}
                  <button
                    type="button"
                    className="text-[var(--gold)] hover:underline"
                    onClick={() => {
                      setMode('login');
                      setError('');
                    }}
                  >
                    登入
                  </button>
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
