'use client';

/**
 * useAIModels — 可選模型清單與「我的預設模型」（spec: ai-model-selection）
 *
 * 單一資料來源：GET /api/settings/ai/models（系統免費模型＋使用者的；訪客僅系統）。
 * 模型選擇語意：選擇綁定在「該次占卜紀錄」（首解請求時送出），
 * 另有「我的預設模型」作為每次占卜的初始值。
 */

import { useCallback, useEffect, useState } from 'react';
import { apiGet, apiPut } from '@/lib/api-client';

/** 一次模型選擇：connectionId 為 null 代表系統免費模型 */
export interface ModelSelection {
  connectionId: number | null;
  modelId: string;
}

export interface ModelEntry {
  connection_id: number | null;
  connection_name: string;
  model_id: string;
  label: string | null;
  source: 'system' | 'user';
  params: Record<string, unknown> | null;
}

export interface ModelsResponse {
  models: ModelEntry[];
  default: { connection_id: number | null; model_id: string | null };
}

/** 將選擇序列化為 stream/followup 的查詢參數 */
export function modelSelectionToQuery(selection: ModelSelection): string {
  const connection = selection.connectionId ?? 'system';
  return `connection_id=${connection}&model_id=${encodeURIComponent(selection.modelId)}`;
}

/** 選擇項的顯示名稱（使用者的模型帶連線名稱前綴） */
export function modelDisplayName(entry: ModelEntry): string {
  const name = entry.label || entry.model_id;
  return entry.source === 'user' ? `${entry.connection_name} · ${name}` : name;
}

export function useAIModels() {
  const [entries, setEntries] = useState<ModelEntry[]>([]);
  const [defaultSelection, setDefaultSelection] = useState<ModelSelection | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await apiGet('/api/settings/ai/models');
      if (res.ok) {
        const data: ModelsResponse = await res.json();
        setEntries(data.models ?? []);
        setDefaultSelection(
          data.default?.model_id
            ? { connectionId: data.default.connection_id, modelId: data.default.model_id }
            : null
        );
      }
    } catch (err) {
      console.error('Fetch AI models error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /** 設定「我的預設模型」（PUT /api/settings/ai/default-model） */
  const saveDefault = useCallback(async (selection: ModelSelection) => {
    await apiPut('/api/settings/ai/default-model', {
      connection_id: selection.connectionId,
      model_id: selection.modelId,
    });
    setDefaultSelection(selection);
  }, []);

  return { entries, defaultSelection, loading, refresh, saveDefault };
}

/**
 * useModelSelection — 占卜/對話頁的當前選擇狀態
 *
 * 初始值為「我的預設模型」；載入前為 null（由 ModelSelector 顯示載入中）。
 */
export function useModelSelection() {
  const { entries, defaultSelection, loading, refresh, saveDefault } = useAIModels();
  const [selection, setSelection] = useState<ModelSelection | null>(null);

  useEffect(() => {
    if (!selection && defaultSelection) setSelection(defaultSelection);
  }, [defaultSelection, selection]);

  return { entries, selection, setSelection, defaultSelection, loading, refresh, saveDefault };
}
