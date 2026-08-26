'use client';

/**
 * 設定頁（Ticket 14）
 *
 * - AI 設定（BYOK）：/api/settings/ai CRUD＋連線測試，行為與原版完全一致
 * - 用戶設定：修改密碼＋登出
 * （用戶管理已遷至 /admin）
 */

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Eye,
  EyeOff,
  Key,
  LogOut,
  Plus,
  RefreshCw,
  Server,
  Trash2,
  X,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { Dialog, DialogClose, DialogContent } from '@/components/ui/Dialog';
import { useToast } from '@/components/ui/Toast';
import { apiDelete, apiGet, apiPost, apiPut } from '@/lib/api-client';

interface AIConfig {
  id: number;
  provider: string;
  name: string | null;
  model: string | null;
  has_api_key: boolean;
  local_url: string | null;
  local_model: string | null;
  is_active: boolean;
}

type Provider = 'gemini' | 'openai' | 'local';

const PROVIDER_OPTIONS = [
  { value: 'gemini', label: 'Gemini' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'local', label: '其他 AI（自訂 URL）' },
];

/** Gemini 官方 model codes（可下拉選擇，亦可自填其他 id） */
const GEMINI_MODEL_OPTIONS = [
  'gemini-3-flash-preview',
  'gemini-3.5-flash',
  'gemini-3.6-flash',
];
const GEMINI_DEFAULT_MODEL = 'gemini-3.6-flash';

const EMPTY_FORM = {
  provider: 'gemini' as Provider,
  name: '',
  apiKey: '',
  localUrl: '',
  localModel: '',
  model: GEMINI_DEFAULT_MODEL,
};

export default function SettingsPage() {
  const router = useRouter();
  const { toast } = useToast();

  // AI 設定
  const [aiConfigs, setAiConfigs] = useState<AIConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<AIConfig | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [testingConnection, setTestingConnection] = useState(false);
  const [showAPIKey, setShowAPIKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AIConfig | null>(null);

  // 修改密碼
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const fetchAIConfigs = useCallback(async () => {
    try {
      const res = await apiGet('/api/settings/ai');
      if (res.ok) setAiConfigs(await res.json());
    } catch (err) {
      console.error('Fetch AI configs error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAIConfigs();
  }, [fetchAIConfigs]);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setAvailableModels([]);
    setShowAPIKey(false);
    setEditingConfig(null);
  };

  /** 測試自訂服務連線並取得模型列表（新增與編輯共用） */
  const testConnection = async (url: string): Promise<{ success: boolean; models?: string[]; error?: string }> => {
    if (!url) return { success: false };
    setTestingConnection(true);
    try {
      const res = await apiPost('/api/settings/ai/test', { url });
      return await res.json();
    } catch {
      return { success: false, error: '連線測試失敗' };
    } finally {
      setTestingConnection(false);
    }
  };

  const handleTestConnection = async () => {
    const result = await testConnection(form.localUrl);
    if (result.success) {
      setAvailableModels(result.models || []);
      if ((result.models?.length ?? 0) > 0 && !result.models?.includes(form.localModel)) {
        setForm((f) => ({ ...f, localModel: result.models![0] }));
      }
      toast(`連線成功，取得 ${result.models?.length ?? 0} 個模型`, { kind: 'success' });
    } else {
      toast(`連線失敗：${result.error || '未知錯誤'}`, { kind: 'error' });
    }
  };

  const openCreate = () => {
    resetForm();
    setFormOpen(true);
  };

  const openEdit = async (config: AIConfig) => {
    resetForm();
    setEditingConfig(config);
    setForm({
      provider: config.provider as Provider,
      name: config.name || '',
      apiKey: '',
      localUrl: config.local_url || '',
      localModel: config.local_model || '',
      model: config.model || GEMINI_DEFAULT_MODEL,
    });
    setFormOpen(true);
    if (config.provider === 'local' && config.local_url) {
      // 編輯自訂服務時自動取得可用模型列表
      const result = await testConnection(config.local_url);
      if (result.success) setAvailableModels(result.models || []);
    }
  };

  const handleSave = async () => {
    const body: Record<string, string> = { provider: form.provider };
    if (form.name.trim()) body.name = form.name.trim();

    if (form.provider === 'gemini' || form.provider === 'openai') {
      if (!editingConfig && !form.apiKey) {
        toast('請輸入 API Key', { kind: 'error' });
        return;
      }
      if (form.apiKey) body.api_key = form.apiKey;
      // Gemini／OpenAI 皆可自選或自填模型 id（後端有各自的預設值）
      const modelId = form.provider === 'gemini' ? form.model : form.localModel;
      if (modelId) body.model = modelId;
    } else {
      if (!form.localUrl || !form.localModel) {
        toast('請填寫 URL 和模型名稱', { kind: 'error' });
        return;
      }
      body.local_url = form.localUrl;
      body.local_model = form.localModel;
      if (form.apiKey) body.api_key = form.apiKey;
    }

    setSaving(true);
    try {
      const res = editingConfig
        ? await apiPut(`/api/settings/ai/${editingConfig.id}`, body)
        : await apiPost('/api/settings/ai', body);

      if (res.ok) {
        await fetchAIConfigs();
        setFormOpen(false);
        resetForm();
        toast(editingConfig ? '設定已更新' : '設定已新增', { kind: 'success' });
      } else {
        const data = await res.json().catch(() => null);
        toast(data?.detail || '儲存失敗', { kind: 'error' });
      }
    } catch {
      toast('儲存失敗', { kind: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await apiDelete(`/api/settings/ai/${deleteTarget.id}`);
      if (res.ok) {
        await fetchAIConfigs();
        toast('設定已刪除', { kind: 'success' });
        setDeleteTarget(null);
      } else {
        toast('刪除失敗', { kind: 'error' });
      }
    } catch (err) {
      console.error('Delete error:', err);
      toast('刪除失敗', { kind: 'error' });
    }
  };

  // ===== 修改密碼 =====
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');

    if (newPassword.length < 6 || newPassword.length > 20) {
      setPasswordError('密碼長度需為 6-20 字');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('新密碼與確認密碼不符');
      return;
    }

    try {
      const res = await apiPut('/api/auth/password', {
        old_password: oldPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });
      if (res.ok) {
        toast('密碼已更新', { kind: 'success' });
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        const data = await res.json().catch(() => null);
        setPasswordError(data?.detail || '修改失敗');
      }
    } catch {
      setPasswordError('修改失敗');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    router.push('/login');
  };

  const isLocal = form.provider === 'local';

  return (
    <main className="w-full max-w-3xl mx-auto px-4 py-6">
      <header className="mb-6">
        <h1 className="font-heading text-2xl font-semibold text-foreground-primary">設定</h1>
        <p className="text-sm text-foreground-muted mt-1">管理您的 AI 金鑰與帳戶</p>
      </header>

      <Tabs defaultValue="ai">
        <TabsList>
          <TabsTrigger value="ai">AI 設定</TabsTrigger>
          <TabsTrigger value="user">用戶設定</TabsTrigger>
        </TabsList>

        {/* ===== AI 設定（BYOK）===== */}
        <TabsContent value="ai">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>我的 AI 服務</CardTitle>
                <p className="text-sm text-foreground-muted mt-1">
                  加入的模型會出現在占卜流程與對話窗的 AI 清單，於該處點選即切換
                </p>
              </div>
              <Button type="button" variant="gold" size="sm" leftIcon={<Plus size={16} />} onClick={openCreate}>
                新增
              </Button>
            </CardHeader>

            <CardContent className="space-y-3">
              {loading ? (
                <p className="text-center text-foreground-muted py-8">載入中…</p>
              ) : aiConfigs.length === 0 ? (
                <p className="text-center text-foreground-muted py-8">尚未設定任何 AI 服務</p>
              ) : (
                aiConfigs.map((config) => (
                  <div
                    key={config.id}
                    className={`flex items-center justify-between gap-3 rounded-xl border p-4 flex-wrap ${
                      config.is_active ? 'border-accent bg-accent-light' : 'border-border bg-background-secondary/50'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`p-2.5 rounded-lg shrink-0 ${config.is_active ? 'bg-accent/15 text-accent' : 'bg-foreground-muted/10 text-foreground-secondary'}`}>
                        {config.provider === 'gemini' ? <Key size={18} aria-hidden /> : <Server size={18} aria-hidden />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-foreground-primary truncate">
                            {config.name ||
                              (config.provider === 'gemini'
                                ? 'Google Gemini'
                                : config.provider === 'openai'
                                  ? 'OpenAI'
                                  : '其他 AI 服務')}
                          </p>
                          {config.is_active && <Badge variant="accent" size="sm">使用中</Badge>}
                        </div>
                        {config.provider === 'gemini' ? (
                          <p className="text-sm text-foreground-muted truncate">
                            {config.model || '\u00A0'}
                          </p>
                        ) : (config.provider === 'local' || config.provider === 'openai') && (
                          <p className="text-sm text-foreground-muted truncate">
                            {[config.local_url, config.local_model].filter(Boolean).join(' ・ ') || '\u00A0'}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(config)}
                        aria-label={`編輯 ${config.name || config.provider}`}
                      >
                        編輯
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteTarget(config)}
                        aria-label={`刪除 ${config.name || config.provider}`}
                      >
                        <Trash2 size={15} />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== 用戶設定 ===== */}
        <TabsContent value="user">
          <Card>
            <CardHeader>
              <CardTitle>修改密碼</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
                <Input
                  label="舊密碼"
                  type="password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <Input
                  label="新密碼"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  minLength={6}
                  maxLength={20}
                  required
                />
                <Input
                  label="確認新密碼"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  minLength={6}
                  required
                />

                {passwordError && (
                  <p className="rounded-lg border border-[var(--cinnabar)]/40 bg-[var(--cinnabar)]/10 px-3 py-2 text-sm text-[var(--cinnabar)]">
                    {passwordError}
                  </p>
                )}

                <Button type="submit" variant="gold" fullWidth>更新密碼</Button>
              </form>
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>登出</CardTitle>
            </CardHeader>
            <CardContent>
              <Button type="button" variant="danger" fullWidth leftIcon={<LogOut size={18} />} onClick={handleLogout}>
                登出帳號
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 新增 / 編輯 AI 設定 Dialog */}
      <Dialog open={formOpen} onOpenChange={(open) => { if (!open) { setFormOpen(false); resetForm(); } }}>
        <DialogContent title={editingConfig ? '編輯 AI 設定' : '新增 AI 設定'}>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              handleSave();
            }}
          >
            <Select
              label="類型"
              options={PROVIDER_OPTIONS}
              value={form.provider}
              onChange={(e) => setForm((f) => ({ ...f, provider: e.target.value as Provider }))}
              disabled={!!editingConfig}
            />

            <Input
              label="服務名稱（選填）"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder={`例如：我的${isLocal ? '本地 AI' : form.provider === 'gemini' ? 'Gemini' : 'OpenAI'}`}
              maxLength={50}
            />

            {isLocal ? (
              <>
                <div>
                  <label htmlFor="byok-url" className="mb-2 block text-sm font-medium text-foreground-secondary">
                    API URL
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="byok-url"
                      type="text"
                      value={form.localUrl}
                      onChange={(e) => setForm((f) => ({ ...f, localUrl: e.target.value }))}
                      placeholder="例如：http://localhost:11434/v1"
                      className="flex-1 rounded-xl border border-border/50 bg-white/80 px-4 py-3 text-foreground-primary placeholder:text-foreground-muted/50 focus:outline-none focus:ring-2 focus:ring-accent/50 dark:bg-black/40"
                    />
                    <Button
                      type="button"
                      variant="gold"
                      onClick={handleTestConnection}
                      disabled={testingConnection || !form.localUrl}
                      loading={testingConnection}
                      leftIcon={!testingConnection ? <RefreshCw size={16} /> : undefined}
                    >
                      測試
                    </Button>
                  </div>
                </div>

                <div>
                  <label htmlFor="byok-key" className="mb-2 block text-sm font-medium text-foreground-secondary">
                    API Key（選填）
                  </label>
                  <div className="relative">
                    <input
                      id="byok-key"
                      type={showAPIKey ? 'text' : 'password'}
                      value={form.apiKey}
                      onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
                      placeholder="若服務需要驗證請填寫"
                      autoComplete="new-password"
                      className="w-full rounded-xl border border-border/50 bg-white/80 px-4 py-3 pr-12 text-foreground-primary placeholder:text-foreground-muted/50 focus:outline-none focus:ring-2 focus:ring-accent/50 dark:bg-black/40"
                    />
                    <button
                      type="button"
                      aria-label={showAPIKey ? '隱藏 API Key' : '顯示 API Key'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-muted hover:text-foreground-primary"
                      onClick={() => setShowAPIKey(!showAPIKey)}
                    >
                      {showAPIKey ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label htmlFor="byok-model" className="mb-2 block text-sm font-medium text-foreground-secondary">
                    模型名稱
                  </label>
                  {availableModels.length > 0 ? (
                    <Select
                      id="byok-model"
                      value={form.localModel}
                      onChange={(e) => setForm((f) => ({ ...f, localModel: e.target.value }))}
                      options={[
                        { value: '', label: '請選擇模型' },
                        ...availableModels.map((model) => ({ value: model, label: model })),
                      ]}
                    />
                  ) : (
                    <input
                      id="byok-model"
                      type="text"
                      value={form.localModel}
                      onChange={(e) => setForm((f) => ({ ...f, localModel: e.target.value }))}
                      placeholder="例如：llama3、qwen2.5:14b"
                      className="w-full rounded-xl border border-border/50 bg-white/80 px-4 py-3 text-foreground-primary placeholder:text-foreground-muted/50 focus:outline-none focus:ring-2 focus:ring-accent/50 dark:bg-black/40"
                    />
                  )}
                  <p className="mt-1 text-xs text-foreground-muted">
                    可點擊「測試」自動取得模型列表，或直接手動輸入。
                  </p>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label htmlFor="byok-cloud-key" className="mb-2 block text-sm font-medium text-foreground-secondary">
                    API Key{editingConfig ? '（留空保持原設定）' : ''}
                  </label>
                  <div className="relative">
                    <input
                      id="byok-cloud-key"
                      type={showAPIKey ? 'text' : 'password'}
                      value={form.apiKey}
                      onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
                      placeholder={
                        editingConfig
                          ? '輸入新 API Key 或留空'
                          : `輸入 ${form.provider === 'gemini' ? 'Gemini' : 'OpenAI'} API Key`
                      }
                      autoComplete="new-password"
                      className="w-full rounded-xl border border-border/50 bg-white/80 px-4 py-3 pr-12 text-foreground-primary placeholder:text-foreground-muted/50 focus:outline-none focus:ring-2 focus:ring-accent/50 dark:bg-black/40"
                    />
                    <button
                      type="button"
                      aria-label={showAPIKey ? '隱藏 API Key' : '顯示 API Key'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-muted hover:text-foreground-primary"
                      onClick={() => setShowAPIKey(!showAPIKey)}
                    >
                      {showAPIKey ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                {form.provider === 'openai' && (
                  <p className="rounded-lg border border-gold/40 bg-gold/10 px-3 py-2 text-sm text-foreground-secondary">
                    ⚠️ OpenAI 沒有提供免費 AI Token 次數，請謹慎使用，使用需付費。
                  </p>
                )}

                {form.provider === 'gemini' && (
                  <div>
                    <label htmlFor="byok-gemini-model" className="mb-2 block text-sm font-medium text-foreground-secondary">
                      模型
                    </label>
                    <input
                      id="byok-gemini-model"
                      type="text"
                      list="gemini-model-options"
                      value={form.model}
                      onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
                      placeholder={GEMINI_DEFAULT_MODEL}
                      className="w-full rounded-xl border border-border/50 bg-white/80 px-4 py-3 text-foreground-primary placeholder:text-foreground-muted/50 focus:outline-none focus:ring-2 focus:ring-accent/50 dark:bg-black/40"
                    />
                    <datalist id="gemini-model-options">
                      {GEMINI_MODEL_OPTIONS.map((model) => (
                        <option key={model} value={model} />
                      ))}
                    </datalist>
                    <p className="mt-1 text-xs text-foreground-muted">
                      可從選單選擇，或直接輸入其他 Gemini 模型 id。
                    </p>
                  </div>
                )}

                {form.provider === 'openai' && (
                  <Input
                    label="模型（預設 gpt-5.1）"
                    value={form.localModel}
                    onChange={(e) => setForm((f) => ({ ...f, localModel: e.target.value }))}
                    placeholder="gpt-5.1"
                  />
                )}
              </>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <DialogClose asChild>
                <Button type="button" variant="secondary">取消</Button>
              </DialogClose>
              <Button type="submit" variant="gold" loading={saving}>
                {editingConfig ? '更新設定' : '儲存設定'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* 刪除確認 Dialog */}
      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent title="刪除 AI 設定" className="w-[min(92vw,420px)]">
          <p className="text-sm text-foreground-secondary mb-6">
            確定要刪除「{deleteTarget?.name || deleteTarget?.provider}」這組設定嗎？
          </p>
          <div className="flex justify-end gap-3">
            <DialogClose asChild>
              <Button type="button" variant="secondary">取消</Button>
            </DialogClose>
            <Button type="button" variant="danger" onClick={handleDelete}>確定刪除</Button>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
