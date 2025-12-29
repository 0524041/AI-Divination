'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/contexts/AppContext';
import { api } from '@/lib/api';
import { User } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { ArrowLeft, Home, Users, Plus, Trash2, Shield, UserIcon } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminPage() {
  const router = useRouter();
  const { user, isLoading } = useApp();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newConfirmPassword, setNewConfirmPassword] = useState('');
  const [newRole, setNewRole] = useState<'user' | 'admin'>('user');

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.push('/');
      } else if (user.role !== 'admin') {
        toast.error('無權訪問此頁面');
        router.push('/');
      }
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    if (user?.role === 'admin') {
      loadUsers();
    }
  }, [user]);

  const loadUsers = async () => {
    try {
      const data = await api.getAllUsers();
      setUsers(data);
    } catch (error) {
      toast.error('載入用戶列表失敗');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async () => {
    if (!newUsername || !newPassword) {
      toast.error('請填寫完整資訊');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('密碼至少需要 6 個字元');
      return;
    }
    if (newPassword !== newConfirmPassword) {
      toast.error('兩次輸入的密碼不一致');
      return;
    }
    try {
      await api.createUser(newUsername, newPassword, newRole);
      toast.success('用戶已創建');
      setShowCreateDialog(false);
      setNewUsername('');
      setNewPassword('');
      setNewConfirmPassword('');
      setNewRole('user');
      loadUsers();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '創建失敗');
    }
  };

  const handleDeleteUser = async (userId: number, username: string) => {
    if (userId === 1) {
      toast.error('無法刪除預設管理員');
      return;
    }
    if (!confirm(`確定要刪除用戶 "${username}" 嗎？`)) return;
    try {
      await api.deleteUser(userId);
      toast.success('用戶已刪除');
      loadUsers();
    } catch (error) {
      toast.error('刪除失敗');
    }
  };

  if (isLoading || !user || user.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-4xl animate-spin">☯</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="bg-orb orb-1" />
      <div className="bg-orb orb-2" />

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-40 glass-panel border-b border-border/50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.back()}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-bold text-[var(--gold)]">用戶管理</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => setShowCreateDialog(true)}>
              <Plus className="w-4 h-4 mr-2" />
              新增用戶
            </Button>
            <Button variant="ghost" size="icon" onClick={() => router.push('/')}>
              <Home className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="pt-20 pb-12 px-4">
        <div className="max-w-4xl mx-auto">
          <Card className="glass-panel">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[var(--gold)]">
                <Users className="w-5 h-5" />
                所有用戶 ({users.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">
                  <div className="text-4xl animate-spin inline-block">☯</div>
                </div>
              ) : (
                <div className="space-y-3">
                  {users.map((u) => (
                    <div
                      key={u.id}
                      className="flex items-center justify-between p-4 rounded-lg bg-muted/20 hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[var(--gold)]/20 flex items-center justify-center">
                          {u.role === 'admin' ? (
                            <Shield className="w-5 h-5 text-[var(--gold)]" />
                          ) : (
                            <UserIcon className="w-5 h-5 text-muted-foreground" />
                          )}
                        </div>
                        <div>
                          <div className="font-medium">{u.username}</div>
                          <div className="text-xs text-muted-foreground">
                            ID: {u.id} • 創建於 {u.created_at ? new Date(u.created_at).toLocaleDateString('zh-TW') : '未知'}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant={u.role === 'admin' ? 'default' : 'secondary'}>
                          {u.role === 'admin' ? '管理員' : '一般用戶'}
                        </Badge>
                        {u.id !== 1 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteUser(u.id, u.username)}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Create User Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="glass-panel">
          <DialogHeader>
            <DialogTitle className="text-[var(--gold)]">新增用戶</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>用戶名稱</Label>
              <Input
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="輸入用戶名稱"
                className="input-mystical mt-1"
              />
            </div>
            <div>
              <Label>密碼</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="輸入密碼 (至少 6 字)"
                className="input-mystical mt-1"
              />
            </div>
            <div>
              <Label>確認密碼</Label>
              <Input
                type="password"
                value={newConfirmPassword}
                onChange={(e) => setNewConfirmPassword(e.target.value)}
                placeholder="再次輸入密碼"
                className="input-mystical mt-1"
              />
            </div>
            <div>
              <Label>角色</Label>
              <Select value={newRole} onValueChange={(v) => setNewRole(v as 'user' | 'admin')}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">一般用戶</SelectItem>
                  <SelectItem value="admin">管理員</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowCreateDialog(false)}>
              取消
            </Button>
            <Button className="btn-gold" onClick={handleCreateUser}>
              創建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
