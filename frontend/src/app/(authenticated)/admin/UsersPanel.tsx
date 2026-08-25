'use client';

/**
 * UsersPanel — 用戶管理（Ticket 13，自 settings 頁遷入）
 *
 * 既有 /api/admin/users 合約：
 * GET / POST /api/admin/users、PUT /{id}/toggle-active、DELETE /{id}
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Shield, Trash2, User as UserIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { Dialog, DialogClose, DialogContent } from '@/components/ui/Dialog';
import { useToast } from '@/components/ui/Toast';
import { apiDelete, apiGet, apiPost, apiPut } from '@/lib/api-client';

interface UserItem {
  id: number;
  username: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

const USERS_PER_PAGE = 20;

function validateUsername(name: string): string | null {
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) return '用戶名只能包含英數字、底線或連字號';
  if (name.length < 3 || name.length > 20) return '用戶名長度需為 3-20 字';
  return null;
}

function validatePassword(pwd: string): string | null {
  if (pwd.length < 6 || pwd.length > 20) return '密碼長度需為 6-20 字';
  return null;
}

export function UsersPanel({ currentUserId }: { currentUserId: number }) {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  // 新增用戶（Dialog）
  const [addOpen, setAddOpen] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'user' | 'admin'>('user');
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState('');

  const [deleteTarget, setDeleteTarget] = useState<UserItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await apiGet('/api/admin/users');
      if (res.ok) setUsers(await res.json());
    } catch (err) {
      console.error('Fetch users error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const totalPageCount = Math.max(1, Math.ceil(users.length / USERS_PER_PAGE));
  const paginatedUsers = useMemo(() => {
    const start = (page - 1) * USERS_PER_PAGE;
    return users.slice(start, start + USERS_PER_PAGE);
  }, [users, page]);

  const handleCreate = async () => {
    const userError = validateUsername(newUsername);
    if (userError) {
      setFormError(userError);
      return;
    }
    const pwdError = validatePassword(newPassword);
    if (pwdError) {
      setFormError(pwdError);
      return;
    }

    setCreating(true);
    setFormError('');
    try {
      const res = await apiPost('/api/admin/users', {
        username: newUsername,
        password: newPassword,
        role: newRole,
      });
      if (res.ok) {
        toast(`已建立用戶「${newUsername}」`, { kind: 'success' });
        setAddOpen(false);
        setNewUsername('');
        setNewPassword('');
        setNewRole('user');
        fetchUsers();
      } else {
        const data = await res.json().catch(() => null);
        throw new Error(data?.detail || '新增失敗');
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : '新增失敗');
    } finally {
      setCreating(false);
    }
  };

  const handleToggleActive = async (user: UserItem) => {
    try {
      const res = await apiPut(`/api/admin/users/${user.id}/toggle-active`);
      if (res.ok) {
        fetchUsers();
      } else {
        toast('操作失敗', { kind: 'error' });
      }
    } catch {
      toast('操作失敗', { kind: 'error' });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await apiDelete(`/api/admin/users/${deleteTarget.id}`);
      if (res.ok) {
        toast(`已刪除用戶「${deleteTarget.username}」`, { kind: 'success' });
        setDeleteTarget(null);
        fetchUsers();
      } else {
        toast('刪除失敗', { kind: 'error' });
      }
    } catch {
      toast('刪除失敗', { kind: 'error' });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>用戶管理</CardTitle>
        <Button type="button" variant="gold" size="sm" leftIcon={<Plus size={16} />} onClick={() => { setAddOpen(true); setFormError(''); }}>
          新增用戶
        </Button>
      </CardHeader>

      <CardContent className="space-y-3">
        {loading ? (
          <div className="space-y-3 py-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : paginatedUsers.length === 0 ? (
          <p className="text-center text-foreground-muted py-8">沒有用戶</p>
        ) : (
          paginatedUsers.map((user) => (
            <div
              key={user.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background-secondary/50 p-4 flex-wrap"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${user.role === 'admin' ? 'bg-accent/15 text-accent' : 'bg-foreground-muted/10 text-foreground-secondary'}`}>
                  {user.role === 'admin' ? <Shield size={18} aria-hidden /> : <UserIcon size={18} aria-hidden />}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-foreground-primary truncate">{user.username}</p>
                    {user.role === 'admin' && <Badge variant="accent" size="sm">管理員</Badge>}
                    {!user.is_active && <Badge variant="default" size="sm">已停用</Badge>}
                  </div>
                  <p className="text-xs text-foreground-muted mt-0.5">
                    建立於 {new Date(user.created_at).toLocaleDateString('zh-TW')}
                  </p>
                </div>
              </div>

              {user.id !== currentUserId && (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant={user.is_active ? 'secondary' : 'outline'}
                    size="sm"
                    onClick={() => handleToggleActive(user)}
                  >
                    {user.is_active ? '停用' : '啟用'}
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    onClick={() => setDeleteTarget(user)}
                    aria-label={`刪除用戶 ${user.username}`}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              )}
            </div>
          ))
        )}

        {/* 分頁 */}
        {totalPageCount > 1 && (
          <div className="mt-2 flex items-center justify-between border-t border-border pt-4">
            <span className="text-sm text-foreground-muted">
              共 {users.length} 位用戶，第 {page} / {totalPageCount} 頁
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                aria-label="上一頁"
              >
                <ChevronLeft size={16} />
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPageCount, p + 1))}
                disabled={page === totalPageCount}
                aria-label="下一頁"
              >
                <ChevronRight size={16} />
              </Button>
            </div>
          </div>
        )}
      </CardContent>

      {/* 新增用戶 Dialog */}
      <Dialog open={addOpen} onOpenChange={(open) => !open && setAddOpen(false)}>
        <DialogContent title="新增用戶" className="w-[min(92vw,440px)]">
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              handleCreate();
            }}
          >
            <Input
              label="用戶名"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              placeholder="3-20 字，英數字、底線或連字號"
              maxLength={20}
              required
            />
            <Input
              label="密碼"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="6-20 字"
              autoComplete="new-password"
              required
            />

            <fieldset>
              <legend className="block text-sm font-medium text-foreground-secondary mb-2">角色</legend>
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant={newRole === 'user' ? 'outline' : 'secondary'}
                  className="flex-1"
                  onClick={() => setNewRole('user')}
                >
                  一般用戶
                </Button>
                <Button
                  type="button"
                  variant={newRole === 'admin' ? 'outline' : 'secondary'}
                  className="flex-1"
                  onClick={() => setNewRole('admin')}
                >
                  管理員
                </Button>
              </div>
            </fieldset>

            {formError && (
              <p className="rounded-lg border border-[var(--cinnabar)]/40 bg-[var(--cinnabar)]/10 px-3 py-2 text-sm text-[var(--cinnabar)]">
                {formError}
              </p>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <DialogClose asChild>
                <Button type="button" variant="secondary">取消</Button>
              </DialogClose>
              <Button type="submit" variant="gold" loading={creating}>建立</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* 刪除確認 Dialog */}
      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent title="刪除用戶" className="w-[min(92vw,420px)]">
          <p className="text-sm text-foreground-secondary mb-6">
            確定要刪除用戶「{deleteTarget?.username}」嗎？其占卜紀錄將一併移除。
          </p>
          <div className="flex justify-end gap-3">
            <DialogClose asChild>
              <Button type="button" variant="secondary">取消</Button>
            </DialogClose>
            <Button type="button" variant="danger" loading={deleting} onClick={handleDelete}>
              確定刪除
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
