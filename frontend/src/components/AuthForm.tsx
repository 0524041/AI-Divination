'use client';

import { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { LogIn, UserPlus } from 'lucide-react';

export function AuthForm() {
  const { login, register } = useApp();
  const [isLoading, setIsLoading] = useState(false);
  
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [registerForm, setRegisterForm] = useState({ username: '', password: '', confirmPassword: '' });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await login(loginForm.username, loginForm.password);
      toast.success('登入成功！');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '登入失敗');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (registerForm.password.length < 6) {
      toast.error('密碼至少需要 6 個字元');
      return;
    }
    if (registerForm.password !== registerForm.confirmPassword) {
      toast.error('兩次輸入的密碼不一致');
      return;
    }
    setIsLoading(true);
    try {
      await register(registerForm.username, registerForm.password);
      toast.success('註冊成功！');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '註冊失敗');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      {/* Background orbs */}
      <div className="bg-orb orb-1" />
      <div className="bg-orb orb-2" />

      <Card className="w-full max-w-md glass-panel border-[var(--gold)]/20">
        <CardHeader className="text-center pb-2">
          <div className="text-4xl mb-4 animate-spin" style={{ animationDuration: '10s' }}>
            ☯
          </div>
          <CardTitle className="text-2xl text-[var(--gold)]">靈機一動</CardTitle>
          <p className="text-muted-foreground text-sm mt-2">易經占卜 · 洞察天機</p>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-muted/50">
              <TabsTrigger value="login">登入</TabsTrigger>
              <TabsTrigger value="register">註冊</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="login-username">帳號</Label>
                  <Input
                    id="login-username"
                    type="text"
                    value={loginForm.username}
                    onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                    className="input-mystical"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">密碼</Label>
                  <Input
                    id="login-password"
                    type="password"
                    value={loginForm.password}
                    onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                    className="input-mystical"
                    required
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full btn-gold"
                  disabled={isLoading}
                >
                  <LogIn className="w-4 h-4 mr-2" />
                  {isLoading ? '登入中...' : '登入'}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="register">
              <form onSubmit={handleRegister} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="register-username">用戶名</Label>
                  <Input
                    id="register-username"
                    type="text"
                    value={registerForm.username}
                    onChange={(e) => setRegisterForm({ ...registerForm, username: e.target.value })}
                    className="input-mystical"
                    required
                    minLength={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-password">密碼 (至少 6 字)</Label>
                  <Input
                    id="register-password"
                    type="password"
                    value={registerForm.password}
                    onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                    className="input-mystical"
                    required
                    minLength={6}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-confirm-password">確認密碼</Label>
                  <Input
                    id="register-confirm-password"
                    type="password"
                    value={registerForm.confirmPassword}
                    onChange={(e) => setRegisterForm({ ...registerForm, confirmPassword: e.target.value })}
                    className="input-mystical"
                    required
                    minLength={6}
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full btn-gold"
                  disabled={isLoading}
                >
                  <UserPlus className="w-4 h-4 mr-2" />
                  {isLoading ? '註冊中...' : '註冊並登入'}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
