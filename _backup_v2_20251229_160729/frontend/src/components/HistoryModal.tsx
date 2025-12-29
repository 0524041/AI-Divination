'use client';

import { useEffect, useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { api } from '@/lib/api';
import { HistoryItem, User } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Heart, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface HistoryModalProps {
  open: boolean;
  onClose: () => void;
  onSelectHistory: (item: HistoryItem) => void;
}

export function HistoryModal({ open, onClose, onSelectHistory }: HistoryModalProps) {
  const { user, history, refreshHistory } = useApp();
  const [users, setUsers] = useState<User[]>([]);
  const [filterUserId, setFilterUserId] = useState<string>('all');

  useEffect(() => {
    if (open) {
      refreshHistory(filterUserId === 'all' ? 'all' : parseInt(filterUserId));
      if (user?.role === 'admin') {
        api.getAllUsers().then(setUsers).catch(console.error);
      }
    }
  }, [open, filterUserId, refreshHistory, user?.role]);

  const handleToggleFavorite = async (item: HistoryItem, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.toggleFavorite(item.id, !item.is_favorite);
      refreshHistory(filterUserId === 'all' ? 'all' : parseInt(filterUserId));
    } catch (error) {
      toast.error('操作失敗');
    }
  };

  const handleDelete = async (item: HistoryItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('確定要刪除此記錄嗎？')) return;
    try {
      await api.deleteHistory(item.id);
      refreshHistory(filterUserId === 'all' ? 'all' : parseInt(filterUserId));
      toast.success('已刪除');
    } catch (error) {
      toast.error('刪除失敗');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="glass-panel max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-[var(--gold)]">歷史紀錄</DialogTitle>
        </DialogHeader>

        {/* Admin filter */}
        {user?.role === 'admin' && (
          <div className="flex items-center gap-2 pb-4 border-b border-border/50">
            <span className="text-sm text-muted-foreground">查看使用者：</span>
            <Select value={filterUserId} onValueChange={setFilterUserId}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部使用者</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id.toString()}>
                    {u.username}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* History list */}
        <div className="flex-1 overflow-y-auto space-y-2">
          {history.length === 0 ? (
            <p className="text-center text-muted-foreground py-10">暫無歷史紀錄</p>
          ) : (
            history.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-4 p-4 rounded-lg bg-muted/20 hover:bg-muted/30 cursor-pointer transition-colors"
                onClick={() => onSelectHistory(item)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{item.question || '(無題)'}</span>
                    {item.username && (
                      <Badge variant="outline" className="text-xs">
                        {item.username}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{item.created_at}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => handleToggleFavorite(item, e)}
                  >
                    <Heart
                      className={`w-4 h-4 ${item.is_favorite ? 'fill-red-500 text-red-500' : 'text-muted-foreground'}`}
                    />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => handleDelete(item, e)}
                  >
                    <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
