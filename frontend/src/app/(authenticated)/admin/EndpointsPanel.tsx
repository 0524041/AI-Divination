'use client';

/**
 * EndpointsPanel — 系統 AI 端點管理（Ticket 13）
 *
 * GET/POST/PUT/DELETE /api/admin/endpoints
 * POST /api/admin/endpoints/{id}/default、/{id}/test
 */

import { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { Dialog, DialogClose, DialogContent } from '@/components/ui/Dialog';
import { useToast } from '@/components/ui/Toast';
import { apiDelete, apiGet, apiPost, apiPut } from '@/lib/api-client';
import { EndpointCard, TestResult } from './EndpointCard';
import type { AdminEndpoint, AdminEndpointModel } from './EndpointCard';

interface FormState {
  name: string;
  base_url: string;
  api_key: string;
  model: string;
}

const EMPTY_FORM: FormState = { name: '', base_url: '', api_key: '', model: '' };

export function EndpointsPanel() {
  const { toast } = useToast();
  const [endpoints, setEndpoints] = useState<AdminEndpoint[]>([]);
  const [loading, setLoading] = useState(true);

  // 新增 / 編輯表單（Dialog）
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // 停用確認（Dialog）
  const [deleteTarget, setDeleteTarget] = useState<AdminEndpoint | null>(null);
  const [deleting, setDeleting] = useState(false);

  // 模型清單編輯（Dialog）
  const [modelsTarget, setModelsTarget] = useState<AdminEndpoint | null>(null);
  const [modelsDraft, setModelsDraft] = useState<AdminEndpointModel[]>([]);
  const [defaultModel, setDefaultModel] = useState('');
  const [probing, setProbing] = useState(false);
  const [savingModels, setSavingModels] = useState(false);

  const fetchEndpoints = useCallback(async () => {
    try {
      const res = await apiGet('/api/admin/endpoints');
      if (res.ok) {
        setEndpoints(await res.json());
      }
    } catch (err) {
      console.error('Fetch endpoints error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEndpoints();
  }, [fetchEndpoints]);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setFormOpen(true);
  };

  const openEdit = (endpoint: AdminEndpoint) => {
    setEditingId(endpoint.id);
    setForm({
      name: endpoint.name,
      base_url: endpoint.base_url,
      api_key: '',
      model: endpoint.model,
    });
    setFormError('');
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.base_url.trim() || !form.model.trim() || !form.api_key.trim()) {
      setFormError('所有欄位皆為必填（後端合約要求完整欄位）');
      return;
    }

    setSaving(true);
    setFormError('');
    try {
      const payload = {
        name: form.name.trim(),
        base_url: form.base_url.trim(),
        api_key: form.api_key.trim(),
        model: form.model.trim(),
      };
      const res = editingId === null
        ? await apiPost('/api/admin/endpoints', payload)
        : await apiPut(`/api/admin/endpoints/${editingId}`, payload);
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.detail || '儲存失敗');
      }
      toast(editingId === null ? '端點已新增' : '端點已更新', { kind: 'success' });
      setFormOpen(false);
      fetchEndpoints();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : '儲存失敗');
    } finally {
      setSaving(false);
    }
  };

  const handleSetDefault = async (endpoint: AdminEndpoint) => {
    try {
      const res = await apiPost(`/api/admin/endpoints/${endpoint.id}/default`);
      if (res.ok) {
        toast(`已將「${endpoint.name}」設為系統預設`, { kind: 'success' });
        fetchEndpoints();
      } else {
        const data = await res.json().catch(() => null);
        toast(data?.detail || '設定失敗', { kind: 'error' });
      }
    } catch {
      toast('設定失敗', { kind: 'error' });
    }
  };

  const handleTest = async (endpoint: AdminEndpoint): Promise<TestResult> => {
    try {
      const res = await apiPost(`/api/admin/endpoints/${endpoint.id}/test`);
      const data = await res.json();
      return data as TestResult;
    } catch {
      return { ok: false, kind: 'upstream', message: '無法連線到後端服務' };
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await apiDelete(`/api/admin/endpoints/${deleteTarget.id}`);
      if (res.ok) {
        toast(`「${deleteTarget.name}」已停用`, { kind: 'success' });
        setDeleteTarget(null);
        fetchEndpoints();
      } else {
        const data = await res.json().catch(() => null);
        toast(data?.detail || '停用失敗', { kind: 'error' });
      }
    } catch {
      toast('停用失敗', { kind: 'error' });
    } finally {
      setDeleting(false);
    }
  };

  // ===== 模型清單編輯 =====

  /** 開啟編輯器：載入既有清單，並即時探測 /models 併入候選（預設不啟用） */
  const openModelsEditor = async (endpoint: AdminEndpoint) => {
    setModelsTarget(endpoint);
    setModelsDraft(endpoint.models.map((m) => ({ ...m })));
    setDefaultModel(endpoint.default_model ?? endpoint.model);
    setProbing(false);
    try {
      setProbing(true);
      const res = await apiGet(`/api/admin/endpoints/${endpoint.id}/probe-models`);
      if (res.ok) {
        const data = await res.json();
        const probed: string[] = data.models ?? [];
        setModelsDraft((draft) => {
          const ids = new Set(draft.map((m) => m.id));
          return [
            ...draft,
            ...probed.filter((id) => id && !ids.has(id)).map((id) => ({ id, enabled: false })),
          ];
        });
      }
    } catch {
      // 探測失敗不阻擋編輯（可手動輸入模型 id）
    } finally {
      setProbing(false);
    }
  };

  const toggleModel = (id: string) => {
    setModelsDraft((draft) =>
      draft.map((m) => (m.id === id ? { ...m, enabled: !m.enabled } : m))
    );
  };

  const saveModels = async () => {
    if (!modelsTarget) return;
    if (defaultModel && !modelsDraft.some((m) => m.id === defaultModel && m.enabled)) {
      toast('預設模型必須是已啟用的模型', { kind: 'error' });
      return;
    }
    setSavingModels(true);
    try {
      const res = await apiPut(`/api/admin/endpoints/${modelsTarget.id}`, {
        name: modelsTarget.name,
        base_url: modelsTarget.base_url,
        api_key: '', // 留空＝沿用原金鑰
        model: modelsTarget.model,
        models: modelsDraft,
        default_model: defaultModel || null,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.detail || '儲存失敗');
      }
      toast('模型清單已更新', { kind: 'success' });
      setModelsTarget(null);
      fetchEndpoints();
    } catch (err) {
      toast(err instanceof Error ? err.message : '儲存失敗', { kind: 'error' });
    } finally {
      setSavingModels(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>系統 AI 端點</CardTitle>
          <p className="text-sm text-foreground-muted mt-1">
            未自帶金鑰的用戶（含訪客）改由這些端點服務；金鑰僅顯示尾四碼
          </p>
        </div>
        <Button type="button" variant="gold" size="sm" leftIcon={<Plus size={16} />} onClick={openCreate}>
          新增端點
        </Button>
      </CardHeader>

      <CardContent className="space-y-3">
        {loading ? (
          <div className="space-y-3 py-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : endpoints.length === 0 ? (
          <p className="text-center text-foreground-muted py-8">尚未設定任何系統端點</p>
        ) : (
          endpoints.map((endpoint) => (
            <EndpointCard
              key={endpoint.id}
              endpoint={endpoint}
              onEdit={openEdit}
              onDelete={setDeleteTarget}
              onSetDefault={handleSetDefault}
              onTest={handleTest}
              onManageModels={openModelsEditor}
            />
          ))
        )}
      </CardContent>

      {/* 新增 / 編輯 Dialog */}
      <Dialog open={formOpen} onOpenChange={(open) => !open && setFormOpen(false)}>
        <DialogContent title={editingId === null ? '新增系統端點' : `編輯：${form.name}`}>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              handleSave();
            }}
          >
            <Input
              label="名稱"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="例如：Agnes 主力"
              maxLength={50}
              required
            />
            <Input
              label="Base URL"
              type="url"
              value={form.base_url}
              onChange={(e) => setForm((f) => ({ ...f, base_url: e.target.value }))}
              placeholder="https://api.deepseek.com/v1"
              required
            />
            <Input
              label={`API Key${editingId !== null ? '（需重新輸入）' : ''}`}
              type="password"
              value={form.api_key}
              onChange={(e) => setForm((f) => ({ ...f, api_key: e.target.value }))}
              placeholder="sk-…"
              autoComplete="new-password"
              required
            />
            <Input
              label="模型"
              value={form.model}
              onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
              placeholder="deepseek-chat"
              required
            />

            {formError && (
              <p className="rounded-lg border border-[var(--cinnabar)]/40 bg-[var(--cinnabar)]/10 px-3 py-2 text-sm text-[var(--cinnabar)]">
                {formError}
              </p>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <DialogClose asChild>
                <Button type="button" variant="secondary">取消</Button>
              </DialogClose>
              <Button type="submit" variant="gold" loading={saving}>
                {editingId === null ? '新增' : '更新'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* 停用確認 Dialog */}
      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent title="停用端點" className="w-[min(92vw,420px)]">
          <p className="text-sm text-foreground-secondary mb-6">
            確定要停用「{deleteTarget?.name}」嗎？停用後將不再服務任何請求。
          </p>
          <div className="flex justify-end gap-3">
            <DialogClose asChild>
              <Button type="button" variant="secondary">取消</Button>
            </DialogClose>
            <Button type="button" variant="danger" loading={deleting} onClick={handleDelete}>
              確定停用
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 模型清單編輯 Dialog */}
      <Dialog open={modelsTarget !== null} onOpenChange={(open) => !open && setModelsTarget(null)}>
        <DialogContent title={`模型清單：${modelsTarget?.name ?? ''}`} className="w-[min(94vw,560px)]">
          <p className="text-sm text-foreground-muted mb-3">
            只有勾選的模型會出現在使用者的「系統免費模型」清單；預設模型為使用者未選擇時使用的模型。
          </p>
          <div className="max-h-[50vh] overflow-y-auto divide-y divide-border/60 rounded-lg border border-border">
            {probing && (
              <p className="px-3 py-2 text-xs text-foreground-muted">探測模型清單中…</p>
            )}
            {modelsDraft.map((model) => (
              <label
                key={model.id}
                className="flex items-center gap-3 px-3 py-2.5 hover:bg-background-secondary cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={model.enabled}
                  onChange={() => toggleModel(model.id)}
                  className="accent-[var(--gold)]"
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm text-foreground-primary truncate">
                    {model.label || model.id}
                  </span>
                  {model.label && (
                    <span className="block text-xs text-foreground-muted truncate font-mono">
                      {model.id}
                    </span>
                  )}
                </span>
                <label className="flex items-center gap-1 text-xs text-foreground-muted cursor-pointer">
                  <input
                    type="radio"
                    name="admin-default-model"
                    checked={defaultModel === model.id}
                    onChange={() => setDefaultModel(model.id)}
                    disabled={!model.enabled}
                    className="accent-[var(--gold)]"
                  />
                  預設
                </label>
              </label>
            ))}
            {modelsDraft.length === 0 && !probing && (
              <p className="px-3 py-6 text-center text-sm text-foreground-muted">
                尚無模型（探測失敗時可於編輯中手動輸入）
              </p>
            )}
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <DialogClose asChild>
              <Button type="button" variant="secondary">取消</Button>
            </DialogClose>
            <Button type="button" variant="gold" loading={savingModels} onClick={saveModels}>
              儲存
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
