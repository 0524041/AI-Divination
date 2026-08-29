'use client';

/**
 * 設定頁（spec: ai-model-selection）
 *
 * - AI 服務：連線管理（preset 新增流程、連線測試）＋模型清單維護
 *   （顯示/隱藏、手動新增、per-model 呼叫參數）＋「我的預設模型」
 * - 用戶設定：修改密碼＋登出
 * （用戶管理已遷至 /admin）
 */

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Eye,
  EyeOff,
  Key,
  ListChecks,
  LogOut,
  Plus,
  RefreshCw,
  Server,
  Trash2,
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
import { useAIModels, modelDisplayName, type ModelSelection } from '@/hooks/useAIModels';

// ========== 型別 ==========

interface ModelEntryItem {
  id: string;
  label?: string | null;
  enabled: boolean;
  params?: Record<string, unknown> | null;
}

interface Connection {
  id: number;
  name: string | null;
  base_url: string | null;
  preset_id: string | null;
  has_api_key: boolean;
  models: ModelEntryItem[];
}

interface Preset {
  id: string;
  name: string;
  base_url: string;
  requires_api_key: boolean;
  models: { id: string; label?: string; params?: Record<string, unknown> }[];
}

/** per-model 呼叫參數的表單狀態（空字串＝未指定） */
interface ParamsForm {
  noReasoning: boolean;
  reasoningValue: string;
  temperature: string;
  maxTokens: string;
}

const EMPTY_PARAMS: ParamsForm = {
  noReasoning: false,
  reasoningValue: '',
  temperature: '',
  maxTokens: '',
};

function paramsToForm(params: Record<string, unknown> | null | undefined): ParamsForm {
  if (!params) return { ...EMPTY_PARAMS };
  return {
    noReasoning: params.reasoning_param === null,
    reasoningValue:
      typeof params.reasoning_param === 'string' ? String(params.reasoning_value ?? '') : '',
    temperature: params.temperature != null ? String(params.temperature) : '',
    maxTokens: params.max_tokens != null ? String(params.max_tokens) : '',
  };
}

function formToParams(form: ParamsForm): Record<string, unknown> | null {
  const params: Record<string, unknown> = {};
  if (form.noReasoning) {
    params.reasoning_param = null;
  } else if (form.reasoningValue.trim()) {
    params.reasoning_param = 'reasoning_effort';
    params.reasoning_value = form.reasoningValue.trim();
  }
  if (form.temperature.trim()) params.temperature = Number(form.temperature);
  if (form.maxTokens.trim()) params.max_tokens = Number(form.maxTokens);
  return Object.keys(params).length > 0 ? params : null;
}

// ========== 頁面 ==========

export default function SettingsPage() {
  const router = useRouter();
  const { toast } = useToast();

  // AI 連線
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<Connection | null>(null);
  const [form, setForm] = useState({ presetId: 'custom', name: '', baseUrl: '', apiKey: '' });
  const [testingConnection, setTestingConnection] = useState(false);
  const [showAPIKey, setShowAPIKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Connection | null>(null);

  // 模型清單編輯
  const [modelsTarget, setModelsTarget] = useState<Connection | null>(null);
  const [modelsDraft, setModelsDraft] = useState<ModelEntryItem[]>([]);
  const [newModelId, setNewModelId] = useState('');
  const [expandedParams, setExpandedParams] = useState<string | null>(null);
  const [paramsDraft, setParamsDraft] = useState<Record<string, ParamsForm>>({});
  const [savingModels, setSavingModels] = useState(false);

  // 預設模型
  const { entries: selectableModels, defaultSelection, refresh: refreshModels, saveDefault } = useAIModels();
  const [defaultSaving, setDefaultSaving] = useState(false);

  // 修改密碼
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const fetchConnections = useCallback(async () => {
    try {
      const res = await apiGet('/api/settings/ai');
      if (res.ok) setConnections(await res.json());
    } catch (err) {
      console.error('Fetch AI connections error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchConnections();
    void (async () => {
      try {
        const res = await apiGet('/api/settings/ai/presets');
        if (res.ok) setPresets(await res.json());
      } catch {
        /* preset 清單載入失敗不影響主功能 */
      }
    })();
  }, [fetchConnections]);

  const resetForm = () => {
    setForm({ presetId: 'custom', name: '', baseUrl: '', apiKey: '' });
    setShowAPIKey(false);
    setEditingConfig(null);
  };

  /** 連線測試：探測 /models，回傳候選模型清單 */
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

  const openCreate = () => {
    resetForm();
    setFormOpen(true);
  };

  const openEdit = (config: Connection) => {
    resetForm();
    setEditingConfig(config);
    setForm({
      presetId: config.preset_id || 'custom',
      name: config.name || '',
      baseUrl: config.base_url || '',
      apiKey: '',
    });
    setFormOpen(true);
  };

  /** 選擇 preset 時自動帶出 base_url 與建議名稱 */
  const handlePresetChange = (presetId: string) => {
    const preset = presets.find((p) => p.id === presetId);
    setForm((f) => ({
      ...f,
      presetId,
      baseUrl: preset?.base_url || f.baseUrl,
      name: f.name || (preset && preset.id !== 'custom' ? `我的${preset.name}` : f.name),
    }));
  };

  const handleSave = async () => {
    if (!form.baseUrl.trim()) {
      toast('請填寫服務位址', { kind: 'error' });
      return;
    }
    const preset = presets.find((p) => p.id === form.presetId);
    const body: Record<string, string> = { base_url: form.baseUrl.trim() };
    if (form.name.trim()) body.name = form.name.trim();
    if (form.presetId && form.presetId !== 'custom') body.preset_id = form.presetId;
    if (form.apiKey) body.api_key = form.apiKey;
    if (!editingConfig && preset?.requires_api_key && !form.apiKey) {
      toast('此服務需要 API Key', { kind: 'error' });
      return;
    }

    setSaving(true);
    try {
      const res = editingConfig
        ? await apiPut(`/api/settings/ai/${editingConfig.id}`, body)
        : await apiPost('/api/settings/ai', body);

      if (res.ok) {
        const saved: Connection = await res.json();
        await fetchConnections();
        setFormOpen(false);
        resetForm();
        toast(editingConfig ? '連線已更新' : '連線已新增，接著維護模型清單', { kind: 'success' });
        if (!editingConfig) openModelsEditor(saved);
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
        await fetchConnections();
        void refreshModels();
        toast('連線已刪除', { kind: 'success' });
        setDeleteTarget(null);
      } else {
        toast('刪除失敗', { kind: 'error' });
      }
    } catch (err) {
      console.error('Delete error:', err);
      toast('刪除失敗', { kind: 'error' });
    }
  };

  // ===== 模型清單編輯 =====

  /** 合併候選：既有清單＋preset 建議＋探測結果 */
  const openModelsEditor = async (config: Connection) => {
    setModelsTarget(config);
    setModelsDraft(config.models.map((m) => ({ ...m })));
    setNewModelId('');
    setExpandedParams(null);
    setParamsDraft(
      Object.fromEntries(config.models.map((m) => [m.id, paramsToForm(m.params)]))
    );

    const preset = presets.find((p) => p.id === config.preset_id);
    const suggested = preset?.models ?? [];
    setModelsDraft((draft) => {
      const ids = new Set(draft.map((m) => m.id));
      const merged = [...draft];
      for (const s of suggested) {
        if (!ids.has(s.id)) {
          merged.push({ id: s.id, label: s.label ?? null, enabled: false, params: s.params ?? null });
          ids.add(s.id);
        }
      }
      return merged;
    });

    // 連線測試（best-effort）帶入探測到的模型
    if (config.base_url) {
      const result = await testConnection(config.base_url);
      if (result.success && result.models?.length) {
        setModelsDraft((draft) => {
          const ids = new Set(draft.map((m) => m.id));
          const merged = [...draft];
          for (const id of result.models!) {
            if (id && !ids.has(id)) {
              merged.push({ id, enabled: false, params: null });
              ids.add(id);
            }
          }
          return merged;
        });
      }
    }
  };

  const toggleModel = (id: string) => {
    setModelsDraft((draft) => draft.map((m) => (m.id === id ? { ...m, enabled: !m.enabled } : m)));
  };

  const removeModel = (id: string) => {
    setModelsDraft((draft) => draft.filter((m) => m.id !== id));
  };

  const addManualModel = () => {
    const id = newModelId.trim();
    if (!id) return;
    setModelsDraft((draft) =>
      draft.some((m) => m.id === id) ? draft : [...draft, { id, enabled: true, params: null }]
    );
    setParamsDraft((p) => ({ ...p, [id]: { ...EMPTY_PARAMS } }));
    setNewModelId('');
  };

  const handleSaveModels = async () => {
    if (!modelsTarget) return;
    const enabled = modelsDraft.filter((m) => m.enabled);
    if (enabled.length === 0) {
      toast('至少要啟用一個模型', { kind: 'error' });
      return;
    }
    setSavingModels(true);
    try {
      const res = await apiPut(`/api/settings/ai/${modelsTarget.id}/models`, {
        models: modelsDraft.map((m) => ({
          id: m.id,
          enabled: m.enabled,
          ...(m.label ? { label: m.label } : {}),
          params: formToParams(paramsDraft[m.id] ?? EMPTY_PARAMS) ?? undefined,
        })),
      });
      if (res.ok) {
        await fetchConnections();
        void refreshModels();
        toast('模型清單已更新', { kind: 'success' });
        setModelsTarget(null);
      } else {
        const data = await res.json().catch(() => null);
        toast(data?.detail || '更新失敗', { kind: 'error' });
      }
    } catch {
      toast('更新失敗', { kind: 'error' });
    } finally {
      setSavingModels(false);
    }
  };

  // ===== 我的預設模型 =====

  const handleSaveDefault = async (selection: ModelSelection) => {
    setDefaultSaving(true);
    try {
      await saveDefault(selection);
      toast('預設模型已更新', { kind: 'success' });
    } catch {
      toast('設定失敗', { kind: 'error' });
    } finally {
      setDefaultSaving(false);
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

  const formPreset = presets.find((p) => p.id === form.presetId);

  return (
    <main className="w-full max-w-3xl mx-auto px-4 py-6">
      <header className="mb-6">
        <h1 className="font-heading text-2xl font-semibold text-foreground-primary">設定</h1>
        <p className="text-sm text-foreground-muted mt-1">管理您的 AI 服務連線與帳戶</p>
      </header>

      <Tabs defaultValue="ai">
        <TabsList>
          <TabsTrigger value="ai">AI 服務</TabsTrigger>
          <TabsTrigger value="user">用戶設定</TabsTrigger>
        </TabsList>

        {/* ===== AI 服務（連線×模型） ===== */}
        <TabsContent value="ai" className="space-y-6">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>服務連線</CardTitle>
                <p className="text-sm text-foreground-muted mt-1">
                  新增連線後維護模型清單——勾選的模型會出現在占卜與對話的選擇器
                </p>
              </div>
              <Button type="button" variant="gold" size="sm" leftIcon={<Plus size={16} />} onClick={openCreate}>
                新增連線
              </Button>
            </CardHeader>

            <CardContent className="space-y-3">
              {loading ? (
                <p className="text-center text-foreground-muted py-8">載入中…</p>
              ) : connections.length === 0 ? (
                <p className="text-center text-foreground-muted py-8">
                  尚未新增任何服務連線——系統免費模型仍可用
                </p>
              ) : (
                connections.map((config) => {
                  const enabledCount = config.models.filter((m) => m.enabled).length;
                  return (
                    <div
                      key={config.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background-secondary/50 p-4 flex-wrap"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2.5 rounded-lg shrink-0 bg-foreground-muted/10 text-foreground-secondary">
                          <Server size={18} aria-hidden />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-foreground-primary truncate">
                              {config.name || '未命名連線'}
                            </p>
                            {config.has_api_key && (
                              <Badge variant="default" size="sm">
                                <Key size={10} className="inline mr-0.5" />
                                已設金鑰
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-foreground-muted truncate">
                            {[
                              config.base_url,
                              `模型 ${enabledCount}/${config.models.length}`,
                            ].filter(Boolean).join(' ・ ') || '\u00A0'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          leftIcon={<ListChecks size={15} />}
                          onClick={() => openModelsEditor(config)}
                          aria-label={`維護模型清單：${config.name || config.id}`}
                        >
                          模型清單
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(config)}
                          aria-label={`編輯 ${config.name || config.id}`}
                        >
                          編輯
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteTarget(config)}
                          aria-label={`刪除 ${config.name || config.id}`}
                        >
                          <Trash2 size={15} />
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>我的預設模型</CardTitle>
                <p className="text-sm text-foreground-muted mt-1">
                  每次占卜的初始選擇；仍可在揭盤時為單次占卜改用其他模型
                </p>
              </div>
            </CardHeader>
            <CardContent>
              {selectableModels.length === 0 ? (
                <p className="text-center text-foreground-muted py-4">目前沒有可選模型</p>
              ) : (
                <div className="flex items-center gap-3">
                  <Select
                    aria-label="我的預設模型"
                    value={
                      defaultSelection
                        ? `${defaultSelection.connectionId ?? 'system'}:${defaultSelection.modelId}`
                        : ''
                    }
                    onChange={(e) => {
                      const [conn, ...rest] = e.target.value.split(':');
                      void handleSaveDefault({
                        connectionId: conn === 'system' ? null : Number(conn),
                        modelId: rest.join(':'),
                      });
                    }}
                    disabled={defaultSaving}
                    options={selectableModels.map((m) => ({
                      value: `${m.connection_id ?? 'system'}:${m.model_id}`,
                      label: modelDisplayName(m),
                    }))}
                  />
                </div>
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

      {/* 新增 / 編輯連線 Dialog */}
      <Dialog open={formOpen} onOpenChange={(open) => { if (!open) { setFormOpen(false); resetForm(); } }}>
        <DialogContent title={editingConfig ? '編輯連線' : '新增連線'}>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              handleSave();
            }}
          >
            <Select
              label="服務"
              options={[
                ...presets.filter((p) => p.id !== 'custom').map((p) => ({ value: p.id, label: p.name })),
                { value: 'custom', label: '自訂服務' },
              ]}
              value={form.presetId}
              onChange={(e) => handlePresetChange(e.target.value)}
            />

            <Input
              label="連線名稱"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="例如：我的 OpenRouter"
              maxLength={50}
            />

            <div>
              <label htmlFor="conn-url" className="mb-2 block text-sm font-medium text-foreground-secondary">
                服務位址（OpenAI-compatible）
              </label>
              <div className="flex gap-2">
                <input
                  id="conn-url"
                  type="text"
                  value={form.baseUrl}
                  onChange={(e) => setForm((f) => ({ ...f, baseUrl: e.target.value }))}
                  placeholder="例如：https://api.openai.com/v1 或 http://localhost:11434/v1"
                  className="flex-1 rounded-xl border border-border/50 bg-white/80 px-4 py-3 text-foreground-primary placeholder:text-foreground-muted/50 focus:outline-none focus:ring-2 focus:ring-accent/50 dark:bg-black/40"
                />
                <Button
                  type="button"
                  variant="gold"
                  onClick={async () => {
                    const result = await testConnection(form.baseUrl);
                    if (result.success) {
                      toast(`連線成功，取得 ${result.models?.length ?? 0} 個候選模型`, { kind: 'success' });
                      if (editingConfig) await openModelsEditor(editingConfig);
                    } else {
                      toast(`連線失敗：${result.error || '未知錯誤'}`, { kind: 'error' });
                    }
                  }}
                  disabled={testingConnection || !form.baseUrl}
                  loading={testingConnection}
                  leftIcon={!testingConnection ? <RefreshCw size={16} /> : undefined}
                >
                  測試
                </Button>
              </div>
              <p className="mt-1 text-xs text-foreground-muted">
                {formPreset?.base_url
                  ? `${formPreset.name} 的官方位址已自動填入，可依需求修改`
                  : '可連本機服務（Ollama、LM Studio 等）'}
              </p>
            </div>

            <div>
              <label htmlFor="conn-key" className="mb-2 block text-sm font-medium text-foreground-secondary">
                API Key{formPreset?.requires_api_key ? '' : '（選填）'}
                {editingConfig ? '（留空保持原設定）' : ''}
              </label>
              <div className="relative">
                <input
                  id="conn-key"
                  type={showAPIKey ? 'text' : 'password'}
                  value={form.apiKey}
                  onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
                  placeholder={formPreset?.requires_api_key ? '此服務需要 API Key' : '若服務需要驗證請填寫'}
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

            <div className="flex justify-end gap-3 pt-2">
              <DialogClose asChild>
                <Button type="button" variant="secondary">取消</Button>
              </DialogClose>
              <Button type="submit" variant="gold" loading={saving}>
                {editingConfig ? '更新連線' : '新增連線'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* 模型清單維護 Dialog */}
      <Dialog open={modelsTarget !== null} onOpenChange={(open) => !open && setModelsTarget(null)}>
        <DialogContent title={`模型清單：${modelsTarget?.name || ''}`} className="w-[min(94vw,560px)]">
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            <p className="text-xs text-foreground-muted">
              勾選要顯示在選擇器的模型；「參數」可依模型調整思考程度等呼叫設定（預設由系統帶入）。
            </p>
            {modelsDraft.map((model) => {
              const params = paramsDraft[model.id] ?? EMPTY_PARAMS;
              const expanded = expandedParams === model.id;
              return (
                <div key={model.id} className="rounded-xl border border-border bg-background-secondary/50 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <label className="flex items-center gap-2 min-w-0">
                      <input
                        type="checkbox"
                        checked={model.enabled}
                        onChange={() => toggleModel(model.id)}
                        aria-label={`顯示模型 ${model.id}`}
                        className="h-4 w-4 accent-[var(--accent)]"
                      />
                      <span className="text-sm text-foreground-primary truncate">
                        {model.label || model.id}
                      </span>
                      {!model.enabled && <Badge variant="default" size="sm">隱藏</Badge>}
                    </label>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-label={`模型 ${model.id} 參數`}
                        aria-expanded={expanded}
                        onClick={() => setExpandedParams(expanded ? null : model.id)}
                      >
                        參數
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-label={`移除模型 ${model.id}`}
                        onClick={() => removeModel(model.id)}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>

                  {expanded && (
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 border-t border-border pt-3">
                      <label className="flex items-center gap-2 text-xs text-foreground-secondary sm:col-span-2">
                        <input
                          type="checkbox"
                          checked={params.noReasoning}
                          onChange={(e) =>
                            setParamsDraft((p) => ({
                              ...p,
                              [model.id]: { ...params, noReasoning: e.target.checked },
                            }))
                          }
                          className="h-4 w-4 accent-[var(--accent)]"
                        />
                        此模型不送思考參數（本機模型常需要）
                      </label>
                      {!params.noReasoning && (
                        <Input
                          label="思考程度值"
                          value={params.reasoningValue}
                          onChange={(e) =>
                            setParamsDraft((p) => ({
                              ...p,
                              [model.id]: { ...params, reasoningValue: e.target.value },
                            }))
                          }
                          placeholder="low / medium / high"
                          maxLength={20}
                        />
                      )}
                      <Input
                        label="溫度"
                        type="number"
                        step="0.1"
                        min="0"
                        max="2"
                        value={params.temperature}
                        onChange={(e) =>
                          setParamsDraft((p) => ({
                            ...p,
                            [model.id]: { ...params, temperature: e.target.value },
                          }))
                        }
                        placeholder="0.9"
                      />
                      <Input
                        label="最大輸出 tokens"
                        type="number"
                        min="1"
                        value={params.maxTokens}
                        onChange={(e) =>
                          setParamsDraft((p) => ({
                            ...p,
                            [model.id]: { ...params, maxTokens: e.target.value },
                          }))
                        }
                        placeholder="16384"
                      />
                    </div>
                  )}
                </div>
              );
            })}
            {modelsDraft.length === 0 && (
              <p className="text-center text-sm text-foreground-muted py-4">
                尚無模型——手動新增或先執行連線測試
              </p>
            )}

            <div className="flex gap-2">
              <input
                type="text"
                value={newModelId}
                onChange={(e) => setNewModelId(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addManualModel();
                  }
                }}
                placeholder="手動新增模型 id（例如：llama3）"
                aria-label="手動新增模型 id"
                className="flex-1 rounded-xl border border-border/50 bg-white/80 px-4 py-2.5 text-sm text-foreground-primary placeholder:text-foreground-muted/50 focus:outline-none focus:ring-2 focus:ring-accent/50 dark:bg-black/40"
              />
              <Button type="button" variant="outline" size="sm" onClick={addManualModel}>
                新增
              </Button>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <DialogClose asChild>
              <Button type="button" variant="secondary">取消</Button>
            </DialogClose>
            <Button type="button" variant="gold" loading={savingModels} onClick={handleSaveModels}>
              儲存清單
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 刪除確認 Dialog */}
      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent title="刪除服務連線" className="w-[min(92vw,420px)]">
          <p className="text-sm text-foreground-secondary mb-6">
            確定要刪除「{deleteTarget?.name || '此連線'}」嗎？綁定此連線的舊占卜追問將改用系統免費模型。
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
