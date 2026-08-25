'use client';

/**
 * UsageCharts — 用量統計（Ticket 13）
 *
 * 純 CSS 長條圖，不引入圖表庫。
 * GET /api/admin/usage/stats?days=30
 */

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { apiGet } from '@/lib/api-client';

interface UsageStats {
  total_requests: number;
  ok_requests: number;
  total_tokens: number;
  per_user: Array<{ username: string; count: number }>;
  daily_trend: Array<{ date: string; count: number }>;
  per_model: Array<{ model: string; count: number }>;
}

function BarRow({
  label,
  value,
  max,
  formatValue,
}: {
  label: string;
  value: number;
  max: number;
  formatValue?: (v: number) => string;
}) {
  const pct = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 shrink-0 truncate text-xs text-foreground-secondary" title={label}>
        {label}
      </span>
      <div
        className="h-4 flex-1 rounded bg-foreground-muted/10 overflow-hidden"
        role="img"
        aria-label={`${label}：${formatValue ? formatValue(value) : value}`}
      >
        <div className="h-full rounded bg-accent/70" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-14 shrink-0 text-right text-xs text-foreground-muted tabular-nums">
        {formatValue ? formatValue(value) : value}
      </span>
    </div>
  );
}

function BarList({ title, data }: { title: string; data: UsageStats['per_user'] | UsageStats['per_model'] }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div>
      <h3 className="mb-3 font-heading text-sm font-semibold text-foreground-primary">{title}</h3>
      {data.length === 0 ? (
        <p className="text-sm text-foreground-muted">期間內無資料</p>
      ) : (
        <div className="space-y-2.5">
          {'username' in (data[0] ?? {}) ? (
            (data as UsageStats['per_user']).map((d) => (
              <BarRow key={d.username} label={d.username} value={d.count} max={max} />
            ))
          ) : (
            (data as UsageStats['per_model']).map((d) => (
              <BarRow key={d.model} label={d.model} value={d.count} max={max} />
            ))
          )}
        </div>
      )}
    </div>
  );
}

export function UsageCharts() {
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    apiGet('/api/admin/usage/stats?days=30')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('載入失敗'))))
      .then((data: UsageStats) => {
        if (!cancelled) setStats(data);
      })
      .catch((err) => console.error('Fetch usage stats error:', err))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 space-y-4">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!stats) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-foreground-muted">
          無法載入用量統計
        </CardContent>
      </Card>
    );
  }

  const okRate = stats.total_requests > 0
    ? Math.round((stats.ok_requests / stats.total_requests) * 100)
    : 100;

  const trendMax = Math.max(...stats.daily_trend.map((d) => d.count), 1);

  return (
    <div className="space-y-6">
      {/* 總覽 */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: '總請求數（30 天）', value: String(stats.total_requests) },
          { label: '成功率', value: `${okRate}%` },
          { label: '輸出 Token 總量', value: stats.total_tokens.toLocaleString('zh-TW') },
        ].map((item) => (
          <Card key={item.label} variant="glass" className="p-4 text-center">
            <div className="text-xs text-foreground-muted mb-1">{item.label}</div>
            <div className="font-heading text-xl font-bold text-accent tabular-nums">{item.value}</div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardContent>
            <BarList title="用戶請求排行" data={stats.per_user} />
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <BarList title="模型使用分佈" data={stats.per_model} />
          </CardContent>
        </Card>
      </div>

      {/* 每日趨勢 */}
      <Card>
        <CardHeader>
          <CardTitle>每日請求趨勢（成功）</CardTitle>
        </CardHeader>
        <CardContent>
          {stats.daily_trend.length === 0 ? (
            <p className="text-sm text-foreground-muted py-4 text-center">期間內無資料</p>
          ) : (
            <div className="flex items-end gap-1.5 h-32 overflow-x-auto pb-1" role="img" aria-label="每日請求趨勢長條圖">
              {stats.daily_trend.map((d) => (
                <div key={d.date} className="flex flex-col items-center justify-end min-w-[22px] flex-1 h-full group">
                  <span className="text-[10px] text-foreground-muted opacity-0 group-hover:opacity-100 transition-opacity mb-1 tabular-nums">
                    {d.count}
                  </span>
                  <div
                    className="w-full rounded-t bg-gold/60 hover:bg-gold transition-colors"
                    style={{ height: `${Math.max(4, (d.count / trendMax) * 88)}%` }}
                    title={`${d.date}：${d.count} 次`}
                  />
                  <span className="text-[9px] text-foreground-muted mt-1 whitespace-nowrap">
                    {d.date.slice(5)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
