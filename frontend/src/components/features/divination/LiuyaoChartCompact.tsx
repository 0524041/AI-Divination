'use client';

/**
 * LiuyaoChartCompact — 六爻盤面緊湊表格（Ticket 09）
 *
 * 直接由 chart_data 結構化欄位渲染：
 * 本卦/變卦（大字 serif）＋逐爻列（六神｜六親地支(五行)｜世應｜動｜變爻｜伏神）＋空亡/神煞 chips。
 */

import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';

export interface LiuyaoYaoOrigin {
  relative: string;
  zhi: string;
  wuxing: string;
  line?: string;
  is_subject?: boolean;
  is_object?: boolean;
  is_changed?: boolean;
  fushen?: { relative: string; zhi: string; wuxing: string };
}

export interface LiuyaoYaoData {
  liushen: string;
  origin: LiuyaoYaoOrigin;
  variant?: { relative: string; zhi: string; wuxing: string };
}

export interface LiuyaoChartData {
  yaogua?: number[];
  time?: string;
  bazi?: string;
  kongwang?: string;
  guashen?: string;
  benguaming?: string;
  bianguaming?: string;
  gua_type?: string;
  shensha?: { name: string; zhi: string[] }[];
  formatted?: string;
  yao_1?: LiuyaoYaoData;
  yao_2?: LiuyaoYaoData;
  yao_3?: LiuyaoYaoData;
  yao_4?: LiuyaoYaoData;
  yao_5?: LiuyaoYaoData;
  yao_6?: LiuyaoYaoData;
}

const YAO_LABELS: [string, keyof LiuyaoChartData][] = [
  ['上爻', 'yao_6'],
  ['五爻', 'yao_5'],
  ['四爻', 'yao_4'],
  ['三爻', 'yao_3'],
  ['二爻', 'yao_2'],
  ['初爻', 'yao_1'],
];

interface LiuyaoChartCompactProps {
  chartData: LiuyaoChartData;
  className?: string;
}

export function LiuyaoChartCompact({ chartData, className }: LiuyaoChartCompactProps) {
  const shensha = chartData.shensha ?? [];

  return (
    <div className={cn('rounded-xl border border-border bg-background-card overflow-hidden', className)}>
      {/* 卦名頭部 */}
      <div className="px-5 py-5 border-b border-border bg-accent-light text-center">
        <p className="text-xs text-foreground-muted tracking-[0.3em] mb-2">
          {chartData.guashen ? `${chartData.guashen}宮` : ''}
          {chartData.gua_type ? ` · ${chartData.gua_type}` : ''}
        </p>
        <div className="flex items-baseline justify-center gap-3 flex-wrap">
          <span className="font-heading text-3xl md:text-4xl font-semibold text-accent">
            {chartData.benguaming || '—'}
          </span>
          <span aria-hidden className="text-foreground-muted">→</span>
          <span className="font-heading text-xl md:text-2xl font-medium text-foreground-primary">
            {chartData.bianguaming || '無變卦'}
          </span>
        </div>
        {(chartData.time || chartData.bazi) && (
          <p className="mt-2 text-xs text-foreground-secondary">
            {chartData.bazi ? `干支：${chartData.bazi}` : ''}
            {chartData.kongwang ? `　日空：${chartData.kongwang}` : ''}
          </p>
        )}
      </div>

      {/* 逐爻表 */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="text-left text-xs text-foreground-muted border-b border-border">
              <th scope="col" className="px-3 py-2 font-medium">爻位</th>
              <th scope="col" className="px-3 py-2 font-medium">六神</th>
              <th scope="col" className="px-3 py-2 font-medium">本卦</th>
              <th scope="col" className="px-3 py-2 font-medium">世應</th>
              <th scope="col" className="px-3 py-2 font-medium">變卦</th>
              <th scope="col" className="px-3 py-2 font-medium">伏神</th>
            </tr>
          </thead>
          <tbody>
            {YAO_LABELS.map(([label, key]) => {
              const yao = chartData[key] as LiuyaoYaoData | undefined;
              if (!yao?.origin) {
                return (
                  <tr key={`row-${label}`} className="border-b border-border last:border-b-0">
                    <td className="px-3 py-2.5 text-foreground-secondary">{label}</td>
                    <td colSpan={5} className="px-3 py-2.5 text-foreground-muted">—</td>
                  </tr>
                );
              }
              const { origin, variant } = yao;
              return (
                <tr key={`row-${label}`} className="border-b border-border last:border-b-0 hover:bg-accent-light transition-colors">
                  <td className="px-3 py-2.5 text-foreground-secondary whitespace-nowrap">{label}</td>
                  <td className="px-3 py-2.5 text-foreground-primary whitespace-nowrap">{yao.liushen}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <span className={cn('font-medium', origin.is_changed ? 'text-[var(--cinnabar)]' : 'text-foreground-primary')}>
                      {origin.relative}
                      {origin.zhi}
                      {origin.wuxing}
                    </span>
                    {origin.is_changed && (
                      <Badge variant="error" size="sm" className="ml-1.5 align-middle">動</Badge>
                    )}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {origin.is_subject && <Badge variant="accent" size="sm">世</Badge>}
                    {origin.is_object && <Badge variant="outline" size="sm">應</Badge>}
                    {!origin.is_subject && !origin.is_object && <span className="text-foreground-muted">—</span>}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-foreground-secondary">
                    {variant ? `${variant.relative}${variant.zhi}(${variant.wuxing})` : '—'}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-[var(--jade)]">
                    {origin.fushen
                      ? `${origin.fushen.relative}${origin.fushen.zhi}(${origin.fushen.wuxing})`
                      : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 空亡／神煞 chips */}
      {(chartData.kongwang || shensha.length > 0) && (
        <div className="px-4 py-3 border-t border-border flex flex-wrap items-center gap-1.5">
          {chartData.kongwang && (
            <Badge variant="warning" size="sm">空亡：{chartData.kongwang}</Badge>
          )}
          {shensha.map((s) => (
            <Badge key={`shensha-${s.name}`} variant="default" size="sm">
              {s.name}：{s.zhi.join('、')}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
