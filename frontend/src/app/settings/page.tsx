'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/contexts/AppContext';
import { api } from '@/lib/api';
import { Settings } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Home, User, Bot, Save, Key, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function SettingsPage() {
  const router = useRouter();
  const { user, isLoading, settings, updateSettings, geminiApiKey, setGeminiApiKey } = useApp();
  const [localSettings, setLocalSettings] = useState<Partial<Settings>>({});
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localGeminiKey, setLocalGeminiKey] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/');
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    if (settings) {
      setLocalSettings(settings);
    }
  }, [settings]);

  useEffect(() => {
    if (geminiApiKey) {
      setLocalGeminiKey('••••••••••••' + geminiApiKey.slice(-4));
    }
  }, [geminiApiKey]);

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      await updateSettings(localSettings);
      if (localGeminiKey && !localGeminiKey.startsWith('••••')) {
        setGeminiApiKey(localGeminiKey);
      }
      toast.success('設定已儲存');
    } catch {
      toast.error('儲存失敗');
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error('兩次密碼不一致');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('密碼至少需要 6 個字元');
      return;
    }
    try {
      await api.updatePassword(newPassword);
      toast.success('密碼已更新');
      setNewPassword('');
      setConfirmPassword('');
    } catch {
      toast.error('密碼更新失敗');
    }
  };

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-4xl animate-spin">☯</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="bg-orb orb-1" />
      <div className="bg-orb orb-2" />

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-40 glass-panel border-b border-border/50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.back()}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-bold text-[var(--gold)]">系統設定</h1>
          </div>
          <Button variant="ghost" size="icon" onClick={() => router.push('/')}>
            <Home className="w-5 h-5" />
          </Button>
        </div>
      </header>

      {/* Content */}
      <main className="pt-20 pb-12 px-4">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Account Settings */}
          <Card className="glass-panel">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[var(--gold)]">
                <User className="w-5 h-5" />
                帳戶設定
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>新密碼</Label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="輸入新密碼 (至少 6 字)"
                  className="input-mystical mt-1"
                />
              </div>
              <div>
                <Label>確認密碼</Label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="再次輸入新密碼"
                  className="input-mystical mt-1"
                />
              </div>
              <Button
                variant="secondary"
                onClick={handleChangePassword}
                disabled={!newPassword || !confirmPassword}
              >
                更新密碼
              </Button>
            </CardContent>
          </Card>

          {/* AI Settings */}
          <Card className="glass-panel">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[var(--gold)]">
                <Bot className="w-5 h-5" />
                AI 設定
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>AI 模型來源</Label>
                <Select
                  value={localSettings.ai_provider}
                  onValueChange={(v) => setLocalSettings({ ...localSettings, ai_provider: v as 'local' | 'gemini' })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="local">Local AI (本地) - 預設</SelectItem>
                    <SelectItem value="gemini">Google Gemini (雲端)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {localSettings.ai_provider === 'local' && (
                <>
                  <div>
                    <Label>Local API URL</Label>
                    <Input
                      value={localSettings.local_api_url || ''}
                      onChange={(e) => setLocalSettings({ ...localSettings, local_api_url: e.target.value })}
                      placeholder="http://localhost:1234/v1"
                      className="input-mystical mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      支援 LM Studio、Ollama 等 OpenAI 相容 API
                    </p>
                  </div>
                  <div>
                    <Label>Model Name</Label>
                    <Input
                      value={localSettings.local_model_name || ''}
                      onChange={(e) => setLocalSettings({ ...localSettings, local_model_name: e.target.value })}
                      placeholder="qwen/qwen3-8b"
                      className="input-mystical mt-1"
                    />
                  </div>
                </>
              )}

              {localSettings.ai_provider === 'gemini' && (
                <div className="space-y-3">
                  <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                    <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-amber-200">
                      使用 Gemini 需要提供您自己的 API Key。
                      請前往 <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-[var(--gold)] underline">Google AI Studio</a> 免費取得。
                    </p>
                  </div>
                  <div>
                    <Label className="flex items-center gap-2">
                      <Key className="w-4 h-4" />
                      Gemini API Key
                    </Label>
                    <Input
                      type="password"
                      value={localGeminiKey}
                      onChange={(e) => setLocalGeminiKey(e.target.value)}
                      placeholder="AIza..."
                      className="input-mystical mt-1"
                      onFocus={() => {
                        if (localGeminiKey.startsWith('••••')) {
                          setLocalGeminiKey('');
                        }
                      }}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      API Key 僅儲存於您的瀏覽器，不會上傳到伺服器
                    </p>
                  </div>
                </div>
              )}

              <Separator />

              <div>
                <Label>每日卦數限制</Label>
                <Select
                  value={localSettings.daily_limit}
                  onValueChange={(v) => setLocalSettings({ ...localSettings, daily_limit: v })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">每日 3 卦</SelectItem>
                    <SelectItem value="5">每日 5 卦</SelectItem>
                    <SelectItem value="10">每日 10 卦</SelectItem>
                    <SelectItem value="unlimited">無限制</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button className="btn-gold" onClick={handleSaveSettings} disabled={isSaving}>
              <Save className="w-4 h-4 mr-2" />
              {isSaving ? '儲存中...' : '儲存設定'}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
