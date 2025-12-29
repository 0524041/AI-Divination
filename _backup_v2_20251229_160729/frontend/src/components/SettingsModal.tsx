'use client';

import { useEffect, useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { api } from '@/lib/api';
import { Settings } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { User, Bot, Save, Key, AlertCircle } from 'lucide-react';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const { settings, updateSettings, geminiApiKey, setGeminiApiKey } = useApp();
  const [localSettings, setLocalSettings] = useState<Partial<Settings>>({});
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localGeminiKey, setLocalGeminiKey] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (settings) {
      setLocalSettings(settings);
    }
  }, [settings]);

  // 載入已儲存的 Gemini Key (顯示遮蔽版本)
  useEffect(() => {
    if (geminiApiKey) {
      // 顯示遮蔽的 key
      setLocalGeminiKey('••••••••••••' + geminiApiKey.slice(-4));
    }
  }, [geminiApiKey]);

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      await updateSettings(localSettings);
      
      // 如果使用者輸入了新的 Gemini API Key (非遮蔽版本)
      if (localGeminiKey && !localGeminiKey.startsWith('••••')) {
        setGeminiApiKey(localGeminiKey);
      }
      
      toast.success('設定已儲存');
    } catch (error) {
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
    } catch (error) {
      toast.error('密碼更新失敗');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="glass-panel max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[var(--gold)]">系統設定</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Account Settings */}
          <section>
            <h3 className="flex items-center gap-2 font-semibold text-[var(--gold)] mb-4">
              <User className="w-4 h-4" />
              帳戶設定
            </h3>
            <div className="space-y-3">
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
                size="sm"
                onClick={handleChangePassword}
                disabled={!newPassword || !confirmPassword}
              >
                更新密碼
              </Button>
            </div>
          </section>

          <Separator />

          {/* AI Settings */}
          <section>
            <h3 className="flex items-center gap-2 font-semibold text-[var(--gold)] mb-4">
              <Bot className="w-4 h-4" />
              AI 設定
            </h3>
            <div className="space-y-4">
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
                        // 清除遮蔽版本，讓用戶可以輸入新 key
                        if (localGeminiKey.startsWith('••••')) {
                          setLocalGeminiKey('');
                        }
                      }}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      API Key 僅儲存於您的瀏覽器 (localStorage)，不會上傳到伺服器
                    </p>
                  </div>
                </div>
              )}

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
            </div>
          </section>

          {/* Save Button */}
          <div className="pt-4 flex justify-end">
            <Button className="btn-gold" onClick={handleSaveSettings} disabled={isSaving}>
              <Save className="w-4 h-4 mr-2" />
              {isSaving ? '儲存中...' : '儲存設定'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
