'use client';

/**
 * EndpointCard — 單一系統 AI 端點卡片（Ticket 13）
 */

import { useState } from 'react';
import { Check, List, Loader2, Plug, Server, Star } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

export interface AdminEndpointModel {
  id: string;
  label?: string | null;
  enabled: boolean;
}

export interface AdminEndpoint {
  id: number;
  name: string;
  base_url: string;
  model: string;
  models: AdminEndpointModel[];
  default_model: string | null;
  is_default: boolean;
  is_active: boolean;
  key_preview: string;
}

export interface TestResult {
  ok: boolean;
  latency_ms?: number;
  kind?: string;
  message?: string;
}

const KIND_LABELS: Record<string, string> = {
  auth: '金鑰驗證失敗',
  quota: '額度不足',
  timeout: '連線逾時',
  upstream: '上游服務錯誤',
};

interface EndpointCardProps {
  endpoint: AdminEndpoint;
  onEdit: (endpoint: AdminEndpoint) => void;
  onDelete: (endpoint: AdminEndpoint) => void;
  onSetDefault: (endpoint: AdminEndpoint) => Promise<void>;
  onTest: (endpoint: AdminEndpoint) => Promise<TestResult>;
  onManageModels: (endpoint: AdminEndpoint) => void;
}

export function EndpointCard({ endpoint, onEdit, onDelete, onSetDefault, onTest, onManageModels }: EndpointCardProps) {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await onTest(endpoint);
      setTestResult(result);
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card variant="outline" padding="sm" className={endpoint.is_active ? '' : 'opacity-60'}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-3 min-w-0">
          <div className={`p-2.5 rounded-lg shrink-0 ${endpoint.is_default ? 'bg-accent/15 text-accent' : 'bg-foreground-muted/10 text-foreground-secondary'}`}>
            <Server size={20} aria-hidden />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-medium text-foreground-primary truncate">{endpoint.name}</h3>
              {endpoint.is_default && <Badge variant="accent" size="sm">系統預設</Badge>}
              {!endpoint.is_active && <Badge variant="default" size="sm">已停用</Badge>}
            </div>
            <p className="text-sm text-foreground-muted mt-1 truncate">
              {endpoint.base_url}
            </p>
            <p className="text-xs text-foreground-muted mt-0.5">
              模型：<span className="text-foreground-secondary">{endpoint.model}</span>
              ・開放 {endpoint.models.filter((m) => m.enabled).length}/{endpoint.models.length}
              ・金鑰：<span className="text-foreground-secondary font-mono">{endpoint.key_preview}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleTest}
            disabled={testing}
            leftIcon={testing ? undefined : <Plug size={14} />}
            loading={testing}
          >
            測試
          </Button>
          {!endpoint.is_default && endpoint.is_active && (
            <Button type="button" variant="ghost" size="sm" leftIcon={<Star size={14} />} onClick={() => onSetDefault(endpoint)}>
              設為預設
            </Button>
          )}
          <Button type="button" variant="ghost" size="sm" leftIcon={<List size={14} />} onClick={() => onManageModels(endpoint)}>
            模型
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => onEdit(endpoint)}>
            編輯
          </Button>
          <Button type="button" variant="danger" size="sm" onClick={() => onDelete(endpoint)} disabled={endpoint.is_default}>
            停用
          </Button>
        </div>
      </div>

      {/* 測試結果 */}
      {(testing || testResult) && (
        <div className="mt-3 pt-3 border-t border-border/60">
          {testing ? (
            <p className="text-xs text-foreground-muted inline-flex items-center gap-2">
              <Loader2 size={12} className="animate-spin" aria-hidden /> 測試連線中…
            </p>
          ) : testResult?.ok ? (
            <p className="text-xs text-[var(--jade)] inline-flex items-center gap-1">
              <Check size={12} aria-hidden /> 連線正常（{testResult.latency_ms} ms）
            </p>
          ) : (
            <p className="text-xs text-[var(--cinnabar)]">
              {KIND_LABELS[testResult?.kind ?? ''] ?? '連線失敗'}
              {testResult?.message ? `：${testResult.message}` : ''}
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
