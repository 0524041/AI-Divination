'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/contexts/AppContext';
import { api } from '@/lib/api';
import { Settings, User } from '@/types';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  User as UserIcon,
  Bot,
  Save,
  Key,
  AlertCircle,
  Shield,
  Users,
  Settings2,
  Trash2,
  Edit,
  UserPlus,
  LogOut,
} from 'lucide-react';
import { toast } from 'sonner';

export default function SettingsPage() {
  const router = useRouter();
  const { user, isLoading, settings, updateSettings, geminiApiKey, setGeminiApiKey, logout } = useApp();
  const [localSettings, setLocalSettings] = useState<Partial<Settings>>({});
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localGeminiKey, setLocalGeminiKey] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  // Admin state
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [editUserPassword, setEditUserPassword] = useState('');
  const [editUserRole, setEditUserRole] = useState<'user' | 'admin'>('user');
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<'user' | 'admin'>('user');

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/');
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    if (settings) {
      setLocalSettings(settings);
    }
  }, [settings]);

  useEffect(() => {
    if (geminiApiKey) {
      setLocalGeminiKey('••••••••••••' + geminiApiKey.slice(-4));
    }
  }, [geminiApiKey]);

  // Load users for admin
  useEffect(() => {
    if (user && isAdmin) {
      loadUsers();
    }
  }, [user, isAdmin]);

  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      const data = await api.getAllUsers();
      setUsers(data);
    } catch {
      toast.error('載入用戶列表失敗');
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      await updateSettings(localSettings);
      if (localGeminiKey && !localGeminiKey.startsWith('••••')) {
        setGeminiApiKey(localGeminiKey);
      }
      toast.success('設定已儲存');
    } catch {
      toast.error('儲存失敗');
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error('兩次密碼不一致');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('密碼至少需要 6 個字元');
      return;
    }
    try {
      await api.updatePassword(newPassword);
      toast.success('密碼已更新');
      setNewPassword('');
      setConfirmPassword('');
    } catch {
      toast.error('密碼更新失敗');
    }
  };

  const handleEditUser = async () => {
    if (!editUser) return;
    try {
      await api.updateUser(editUser.id, {
        role: editUserRole,
        password: editUserPassword || undefined,
      });
      toast.success('用戶已更新');
      setEditUser(null);
      setEditUserPassword('');
      loadUsers();
    } catch {
      toast.error('更新失敗');
    }
  };

  const handleDeleteUser = async (userId: number) => {
    if (!confirm('確定要刪除此用戶嗎？此操作無法復原。')) return;
    try {
      await api.deleteUser(userId);
      toast.success('用戶已刪除');
      loadUsers();
    } catch {
      toast.error('刪除失敗');
    }
  };

  const handleCreateUser = async () => {
    if (!newUsername || !newUserPassword) {
      toast.error('請填寫用戶名和密碼');
      return;
    }
    if (newUserPassword.length < 6) {
      toast.error('密碼至少需要 6 個字元');
      return;
    }
    try {
      await api.createUser(newUsername, newUserPassword, newUserRole);
      toast.success('用戶已建立');
      setShowCreateUser(false);
      setNewUsername('');
      setNewUserPassword('');
      setNewUserRole('user');
      loadUsers();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '建立失敗');
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/');
    } catch {
      toast.error('登出失敗');
    }
  };

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-5xl animate-spin" style={{ animationDuration: '2s' }}>☯</div>
      </div>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Page Title */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-[var(--gold)]">設定</h1>
            <p className="text-muted-foreground mt-1">
              管理您的帳戶和系統設定
            </p>
          </div>
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" />
            登出
          </Button>
        </div>

        <Tabs defaultValue="account" className="space-y-6">
          <TabsList className="glass-panel">
            <TabsTrigger value="account" className="data-[state=active]:text-[var(--gold)]">
              <UserIcon className="w-4 h-4 mr-2" />
              帳戶
            </TabsTrigger>
            <TabsTrigger value="ai" className="data-[state=active]:text-[var(--gold)]">
              <Bot className="w-4 h-4 mr-2" />
              AI 設定
            </TabsTrigger>
            {isAdmin && (
              <>
                <TabsTrigger value="system" className="data-[state=active]:text-[var(--gold)]">
                  <Settings2 className="w-4 h-4 mr-2" />
                  系統
                </TabsTrigger>
                <TabsTrigger value="users" className="data-[state=active]:text-[var(--gold)]">
                  <Users className="w-4 h-4 mr-2" />
                  用戶管理
                </TabsTrigger>
              </>
            )}
          </TabsList>

          {/* Account Tab */}
          <TabsContent value="account" className="space-y-6">
            <Card className="glass-panel">
              <CardHeader>
                <CardTitle className="text-[var(--gold)]">帳戶資訊</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">用戶名</Label>
                    <p className="text-lg font-medium">{user.username}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">角色</Label>
                    <p className="text-lg font-medium flex items-center gap-2">
                      {user.role === 'admin' && <Shield className="w-4 h-4 text-[var(--gold)]" />}
                      {user.role === 'admin' ? '管理員' : '一般用戶'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="glass-panel">
              <CardHeader>
                <CardTitle className="text-[var(--gold)]">變更密碼</CardTitle>
                <CardDescription>更新您的登入密碼</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label>新密碼</Label>
                    <Input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="輸入新密碼 (至少 6 字)"
                      className="mt-1 bg-transparent border-border"
                    />
                  </div>
                  <div>
                    <Label>確認密碼</Label>
                    <Input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="再次輸入新密碼"
                      className="mt-1 bg-transparent border-border"
                    />
                  </div>
                </div>
                <Button
                  onClick={handleChangePassword}
                  disabled={!newPassword || !confirmPassword}
                >
                  更新密碼
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* AI Tab */}
          <TabsContent value="ai" className="space-y-6">
            <Card className="glass-panel">
              <CardHeader>
                <CardTitle className="text-[var(--gold)]">AI 模型設定</CardTitle>
                <CardDescription>選擇占卜解讀使用的 AI 模型</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>AI 模型來源</Label>
                  <Select
                    value={localSettings.ai_provider}
                    onValueChange={(v) => setLocalSettings({ ...localSettings, ai_provider: v as 'local' | 'gemini' })}
                  >
                    <SelectTrigger className="mt-1 bg-transparent border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="local">Local AI (本地) - 預設</SelectItem>
                      <SelectItem value="gemini">Google Gemini (雲端)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {localSettings.ai_provider === 'local' && (
                  <>
                    <Separator />
                    <div>
                      <Label>Local API URL</Label>
                      <Input
                        value={localSettings.local_api_url || ''}
                        onChange={(e) => setLocalSettings({ ...localSettings, local_api_url: e.target.value })}
                        placeholder="http://localhost:1234/v1"
                        className="mt-1 bg-transparent border-border"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        支援 LM Studio、Ollama 等 OpenAI 相容 API
                      </p>
                    </div>
                    <div>
                      <Label>Model Name</Label>
                      <Input
                        value={localSettings.local_model_name || ''}
                        onChange={(e) => setLocalSettings({ ...localSettings, local_model_name: e.target.value })}
                        placeholder="qwen/qwen3-8b"
                        className="mt-1 bg-transparent border-border"
                      />
                    </div>
                  </>
                )}

                {localSettings.ai_provider === 'gemini' && (
                  <div className="space-y-4">
                    <Separator />
                    <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                      <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-amber-200">
                        使用 Gemini 需要提供您自己的 API Key。
                        請前往 <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-[var(--gold)] underline">Google AI Studio</a> 免費取得。
                      </p>
                    </div>
                    <div>
                      <Label className="flex items-center gap-2">
                        <Key className="w-4 h-4" />
                        Gemini API Key
                      </Label>
                      <Input
                        type="password"
                        value={localGeminiKey}
                        onChange={(e) => setLocalGeminiKey(e.target.value)}
                        placeholder="AIza..."
                        className="mt-1 bg-transparent border-border"
                        onFocus={() => {
                          if (localGeminiKey.startsWith('••••')) {
                            setLocalGeminiKey('');
                          }
                        }}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        API Key 僅儲存於您的瀏覽器，不會上傳到伺服器
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button className="btn-gold" onClick={handleSaveSettings} disabled={isSaving}>
                <Save className="w-4 h-4 mr-2" />
                {isSaving ? '儲存中...' : '儲存設定'}
              </Button>
            </div>
          </TabsContent>

          {/* System Tab (Admin only) */}
          {isAdmin && (
            <TabsContent value="system" className="space-y-6">
              <Card className="glass-panel">
                <CardHeader>
                  <CardTitle className="text-[var(--gold)]">系統設定</CardTitle>
                  <CardDescription>管理全域系統參數</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>每日卦數限制</Label>
                    <Select
                      value={localSettings.daily_limit}
                      onValueChange={(v) => setLocalSettings({ ...localSettings, daily_limit: v })}
                    >
                      <SelectTrigger className="mt-1 bg-transparent border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="3">每日 3 卦</SelectItem>
                        <SelectItem value="5">每日 5 卦</SelectItem>
                        <SelectItem value="10">每日 10 卦</SelectItem>
                        <SelectItem value="unlimited">無限制</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-end">
                <Button className="btn-gold" onClick={handleSaveSettings} disabled={isSaving}>
                  <Save className="w-4 h-4 mr-2" />
                  {isSaving ? '儲存中...' : '儲存設定'}
                </Button>
              </div>
            </TabsContent>
          )}

          {/* Users Tab (Admin only) */}
          {isAdmin && (
            <TabsContent value="users" className="space-y-6">
              <Card className="glass-panel">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-[var(--gold)]">用戶管理</CardTitle>
                    <CardDescription>管理系統用戶帳戶</CardDescription>
                  </div>
                  <Button onClick={() => setShowCreateUser(true)}>
                    <UserPlus className="w-4 h-4 mr-2" />
                    新增用戶
                  </Button>
                </CardHeader>
                <CardContent>
                  {loadingUsers ? (
                    <div className="text-center py-8">
                      <div className="text-4xl animate-spin inline-block" style={{ animationDuration: '2s' }}>☯</div>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>用戶名</TableHead>
                          <TableHead>角色</TableHead>
                          <TableHead>建立時間</TableHead>
                          <TableHead>最後登入</TableHead>
                          <TableHead className="text-right">操作</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {users.map((u) => (
                          <TableRow key={u.id}>
                            <TableCell className="font-medium">{u.username}</TableCell>
                            <TableCell>
                              {u.role === 'admin' ? (
                                <span className="flex items-center gap-1 text-[var(--gold)]">
                                  <Shield className="w-4 h-4" />
                                  管理員
                                </span>
                              ) : (
                                '一般用戶'
                              )}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {u.created_at
                                ? new Date(u.created_at).toLocaleDateString('zh-TW')
                                : '-'}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {u.last_login
                                ? new Date(u.last_login).toLocaleDateString('zh-TW')
                                : '-'}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    setEditUser(u);
                                    setEditUserRole(u.role);
                                  }}
                                  disabled={u.id === user.id}
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDeleteUser(u.id)}
                                  disabled={u.id === user.id}
                                  className="hover:text-destructive"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>

      {/* Edit User Dialog */}
      <Dialog open={!!editUser} onOpenChange={() => setEditUser(null)}>
        <DialogContent className="glass-panel">
          <DialogHeader>
            <DialogTitle className="text-[var(--gold)]">
              編輯用戶：{editUser?.username}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>角色</Label>
              <Select value={editUserRole} onValueChange={(v) => setEditUserRole(v as 'user' | 'admin')}>
                <SelectTrigger className="mt-1 bg-transparent border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">一般用戶</SelectItem>
                  <SelectItem value="admin">管理員</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>新密碼（留空則不變更）</Label>
              <Input
                type="password"
                value={editUserPassword}
                onChange={(e) => setEditUserPassword(e.target.value)}
                placeholder="輸入新密碼"
                className="mt-1 bg-transparent border-border"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>
              取消
            </Button>
            <Button onClick={handleEditUser}>
              儲存變更
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create User Dialog */}
      <Dialog open={showCreateUser} onOpenChange={setShowCreateUser}>
        <DialogContent className="glass-panel">
          <DialogHeader>
            <DialogTitle className="text-[var(--gold)]">新增用戶</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>用戶名</Label>
              <Input
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="輸入用戶名"
                className="mt-1 bg-transparent border-border"
              />
            </div>
            <div>
              <Label>密碼</Label>
              <Input
                type="password"
                value={newUserPassword}
                onChange={(e) => setNewUserPassword(e.target.value)}
                placeholder="輸入密碼（至少 6 字）"
                className="mt-1 bg-transparent border-border"
              />
            </div>
            <div>
              <Label>角色</Label>
              <Select value={newUserRole} onValueChange={(v) => setNewUserRole(v as 'user' | 'admin')}>
                <SelectTrigger className="mt-1 bg-transparent border-border">
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
            <Button variant="outline" onClick={() => setShowCreateUser(false)}>
              取消
            </Button>
            <Button onClick={handleCreateUser}>
              建立用戶
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

