'use client';

/**
 * BirthDataPanel — 已儲存生辰資料選擇＋刪除確認（Ticket 11，自紫微頁抽出）
 */

import { Trash2 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Dialog, DialogClose, DialogContent, DialogTrigger } from '@/components/ui/Dialog';

export interface BirthProfile {
  id?: number;
  name: string;
  gender: 'male' | 'female';
}

interface BirthDataPanelProps {
  profiles: BirthProfile[];
  selectedId: number | null;
  /** 目前表單中的姓名（用於刪除確認文字） */
  currentName: string;
  onSelect: (id: number | null) => void;
  onDelete: (id: number) => void;
}

export function BirthDataPanel({ profiles, selectedId, currentName, onSelect, onDelete }: BirthDataPanelProps) {
  if (profiles.length === 0) return null;

  return (
    <Card variant="glass" className="p-4">
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Select
            label="選擇已儲存的生辰資料"
            value={selectedId?.toString() || ''}
            onChange={(e) => {
              const id = parseInt(e.target.value);
              onSelect(id || null);
            }}
            options={[
              { value: '', label: '--- 手動輸入 ---' },
              ...profiles.map((d) => ({
                value: String(d.id),
                label: `${d.name} (${d.gender === 'male' ? '男' : '女'})`,
              })),
            ]}
          />
        </div>
        {selectedId && (
          <Dialog>
            <DialogTrigger asChild>
              <Button type="button" variant="ghost" size="sm" aria-label="刪除此生辰資料">
                <Trash2 size={16} />
              </Button>
            </DialogTrigger>
            <DialogContent title="刪除生辰資料">
              <p className="text-sm text-foreground-secondary mb-5">
                確定要刪除「{currentName}」的生辰資料？此操作無法復原。
              </p>
              <div className="flex justify-end gap-2">
                <DialogClose asChild>
                  <Button type="button" variant="secondary">取消</Button>
                </DialogClose>
                <DialogClose asChild>
                  <Button type="button" variant="danger" onClick={() => onDelete(selectedId)}>確認刪除</Button>
                </DialogClose>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </Card>
  );
}
