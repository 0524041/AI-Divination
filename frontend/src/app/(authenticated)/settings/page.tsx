'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  Settings as SettingsIcon,
  Key,
  Server,
  User,
  Users,
  X,
  Trash2,
  Plus,
  Eye,
  EyeOff,
  RefreshCw,
  Shield,
  Edit2,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface AIConfig {
  id: number;
  provider: string;
  name: string | null;
  has_api_key: boolean;
  local_url: string | null;
  local_model: string | null;
  is_active: boolean;
}

interface UserItem {
  id: number;
  username: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

type SettingsTab = 'ai' | 'user' | 'admin';

export default function SettingsPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<{ id: number; username: string; role: string } | null>(null);
  const [activeTab, setActiveTab] = useState<SettingsTab>('ai');
  const [loading, setLoading] = useState(true);

  // AI 設定
  const [aiConfigs, setAiConfigs] = useState<AIConfig[]>([]);
  const [showAddAI, setShowAddAI] = useState(false);
  const [editingConfig, setEditingConfig] = useState<AIConfig | null>(null);
  const [newAIProvider, setNewAIProvider] = useState<'gemini' | 'openai' | 'local'>('gemini');
  const [newAIName, setNewAIName] = useState('');
  const [newAPIKey, setNewAPIKey] = useState('');
  const [newLocalURL, setNewLocalURL] = useState('');
  const [newLocalModel, setNewLocalModel] = useState('');
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [testingConnection, setTestingConnection] = useState(false);
  const [showAPIKey, setShowAPIKey] = useState(false);

  // 用戶設定
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  // 用戶管理 (Admin)
  const [users, setUsers] = useState<UserItem[]>([]);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<'user' | 'admin'>('user');

  // 用戶分頁
  const USERS_PER_PAGE = 20;
  const [userPage, setUserPage] = useState(1);
  const paginatedUsers = useMemo(() => {
    const start = (userPage - 1) * USERS_PER_PAGE;
    return users.slice(start, start + USERS_PER_PAGE);
  }, [users, userPage]);
  const totalUserPages = Math.ceil(users.length / USERS_PER_PAGE);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (currentUser) {
      // 並行請求，減少等待時間
      const loadData = async () => {
        const promises = [fetchAIConfigs()];
        if (currentUser.role === 'admin') {
          promises.push(fetchUsers());
        }
        await Promise.all(promises);
      };
      loadData();
    }
  }, [currentUser]);

  const checkAuth = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setCurrentUser(await res.json());
      } else {
        router.push('/login');
      }
    } catch {
      router.push('/login');
    } finally {
      setLoading(false);
    }
  };

  const fetchAIConfigs = async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/settings/ai', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setAiConfigs(await res.json());
      }
    } catch (err) {
      console.error('Fetch AI configs error:', err);
    }
  };

  const fetchUsers = async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/admin/users', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setUsers(await res.json());
      }
    } catch (err) {
      console.error('Fetch users error:', err);
    }
  };

  const handleTestConnection = async () => {
    if (!newLocalURL) return;
    setTestingConnection(true);
    setAvailableModels([]);

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/settings/ai/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ url: newLocalURL }),
      });

      const data = await res.json();
      if (data.success) {
        setAvailableModels(data.models || []);
        // 如果目前沒有選模型，或是選的模型不在新的列表內，就預設選第一個
        if (data.models?.length > 0) {
          if (!newLocalModel || !data.models.includes(newLocalModel)) {
            setNewLocalModel(data.models[0]);
          }
        }
      } else {
        alert(`連線失敗: ${data.error}`);
      }
    } catch (err) {
      alert('連線測試失敗');
    } finally {
      setTestingConnection(false);
    }
  };

  const handleAddAIConfig = async () => {
    const token = localStorage.getItem('token');
    const body: Record<string, string> = { provider: newAIProvider };

    // 添加用戶自訂名稱
    if (newAIName.trim()) {
      body.name = newAIName.trim();
    }

    if (newAIProvider === 'gemini' || newAIProvider === 'openai') {
      if (!newAPIKey) {
        alert('請輸入 API Key');
        return;
      }
      body.api_key = newAPIKey;
      if (newAIProvider === 'openai') {
        body.local_model = newLocalModel || "gpt-5.1";
      }
    } else {
      if (!newLocalURL || !newLocalModel) {
        alert('請填寫 URL 和模型名稱');
        return;
      }
      body.local_url = newLocalURL;
      body.local_model = newLocalModel;
      if (newAPIKey) {
        body.api_key = newAPIKey;
      }
    }

    try {
      const res = await fetch('/api/settings/ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        await fetchAIConfigs();
        setShowAddAI(false);
        resetAIForm();
      } else {
        const data = await res.json();
        alert(data.detail || '新增失敗');
      }
    } catch {
      alert('新增失敗');
    }
  };

  const handleEditAIConfig = (config: AIConfig) => {
    setEditingConfig(config);
    setNewAIProvider(config.provider as 'gemini' | 'openai' | 'local');
    setNewAIName(config.name || '');
    setNewAPIKey('');
    setNewLocalURL(config.local_url || '');
    setNewLocalModel(config.local_model || '');
    if (config.local_url && config.provider === 'local') {
      // 自動測試連線以取得可用模型 (僅限 Custom AI)
      handleTestConnectionForEdit(config.local_url);
    }
  };

  const handleTestConnectionForEdit = async (url: string) => {
    setTestingConnection(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/settings/ai/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ url }),
      });

      const data = await res.json();
      if (data.success) {
        setAvailableModels(data.models || []);
      }
    } catch (err) {
      console.error('Test connection error:', err);
    } finally {
      setTestingConnection(false);
    }
  };

  const handleUpdateAIConfig = async () => {
    if (!editingConfig) return;

    const token = localStorage.getItem('token');
    const body: Record<string, string> = { provider: newAIProvider };

    // 添加用戶自訂名稱
    if (newAIName.trim()) {
      body.name = newAIName.trim();
    }

    if (newAIProvider === 'gemini' || newAIProvider === 'openai') {
      if (newAPIKey) {
        body.api_key = newAPIKey;
      }
      if (newAIProvider === 'openai' && newLocalModel) {
        body.local_model = newLocalModel;
      }
    } else {
      if (!newLocalURL || !newLocalModel) {
        alert('請填寫 URL 和模型名稱');
        return;
      }
      body.local_url = newLocalURL;
      body.local_model = newLocalModel;
      if (newAPIKey) {
        body.api_key = newAPIKey;
      }
    }

    try {
      const res = await fetch(`/api/settings/ai/${editingConfig.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        await fetchAIConfigs();
        setEditingConfig(null);
        resetAIForm();
      } else {
        const data = await res.json();
        alert(data.detail || '更新失敗');
      }
    } catch {
      alert('更新失敗');
    }
  };

  const handleActivateAI = async (configId: number) => {
    const token = localStorage.getItem('token');
    try {
      await fetch(`/api/settings/ai/${configId}/activate`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      });
      await fetchAIConfigs();
    } catch (err) {
      console.error('Activate error:', err);
    }
  };

  const handleDeleteAI = async (configId: number) => {
    if (!confirm('確定要刪除此設定？')) return;
    const token = localStorage.getItem('token');
    try {
      await fetch(`/api/settings/ai/${configId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      await fetchAIConfigs();
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  const resetAIForm = () => {
    setNewAIProvider('gemini');
    setNewAIName('');
    setNewAPIKey('');
    setNewLocalURL('');
    setNewLocalModel('');
    setAvailableModels([]);
    setShowAPIKey(false);
  };

  // Validation Helpers
  const validateLength = (str: string, min: number, max: number, name: string) => {
    if (str.length < min || str.length > max) return `${name}長度需為 ${min}-${max} 字`;
    return null;
  };
  const validateUsername = (name: string) => {
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) return "用戶名只能包含英數字、底線或連字號";
    return validateLength(name, 3, 20, "用戶名");
  }
  const validatePassword = (pwd: string) => validateLength(pwd, 6, 20, "密碼");

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess(false);

    const pwdError = validatePassword(newPassword);
    if (pwdError) {
      setPasswordError(pwdError);
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('新密碼與確認密碼不符');
      return;
    }

    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/auth/password', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          old_password: oldPassword,
          new_password: newPassword,
          confirm_password: confirmPassword,
        }),
      });

      if (res.ok) {
        setPasswordSuccess(true);
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        const data = await res.json();
        setPasswordError(data.detail || '修改失敗');
      }
    } catch {
      setPasswordError('修改失敗');
    }
  };

  const handleAddUser = async () => {
    if (!newUsername || !newUserPassword) {
      alert('請填寫完整資訊');
      return;
    }

    const userError = validateUsername(newUsername);
    if (userError) { alert(userError); return; }

    const pwdError = validatePassword(newUserPassword);
    if (pwdError) { alert(pwdError); return; }

    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          username: newUsername,
          password: newUserPassword,
          role: newUserRole,
        }),
      });

      if (res.ok) {
        await fetchUsers();
        setShowAddUser(false);
        setNewUsername('');
        setNewUserPassword('');
        setNewUserRole('user');
      } else {
        const data = await res.json();
        alert(data.detail || '新增失敗');
      }
    } catch {
      alert('新增失敗');
    }
  };

  const handleToggleUserActive = async (userId: number) => {
    const token = localStorage.getItem('token');
    try {
      await fetch(`/api/admin/users/${userId}/toggle-active`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      });
      await fetchUsers();
    } catch (err) {
      console.error('Toggle active error:', err);
    }
  };

  const handleDeleteUser = async (userId: number) => {
    if (!confirm('確定要刪除此用戶？')) return;
    const token = localStorage.getItem('token');
    try {
      await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      await fetchUsers();
    } catch (err) {
      console.error('Delete user error:', err);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-spin-slow">☯</div>
          <p className="text-foreground-secondary">載入中...</p>
        </div>
      </div>
    );
  }

  return (
    <>

      {/* 主內容 */}
      <main className="w-full max-w-4xl mx-auto px-4 py-6">
        {/* 分頁選項 */}
        <div className="flex gap-2 border-b border-border pb-2 mb-6 overflow-x-auto">
          <button
            className={`px-4 py-2 rounded-t-lg transition whitespace-nowrap ${activeTab === 'ai' ? 'bg-accent/20 text-accent' : 'text-foreground-secondary hover:text-foreground-primary'
              }`}
            onClick={() => setActiveTab('ai')}
          >
            <Server size={18} className="inline mr-2" />
            AI 設定
          </button>
          <button
            className={`px-4 py-2 rounded-t-lg transition whitespace-nowrap ${activeTab === 'user' ? 'bg-accent/20 text-accent' : 'text-foreground-secondary hover:text-foreground-primary'
              }`}
            onClick={() => setActiveTab('user')}
          >
            <User size={18} className="inline mr-2" />
            用戶設定
          </button>
          {currentUser?.role === 'admin' && (
            <button
              className={`px-4 py-2 rounded-t-lg transition whitespace-nowrap ${activeTab === 'admin' ? 'bg-accent/20 text-accent' : 'text-foreground-secondary hover:text-foreground-primary'
                }`}
              onClick={() => setActiveTab('admin')}
            >
              <Users size={18} className="inline mr-2" />
              用戶管理
            </button>
          )}
        </div>

        {/* AI 設定頁面 */}
        {activeTab === 'ai' && (
          <div className="space-y-6">
            {/* 現有設定 */}
            <Card variant="glass" padding="md">
              <div className="flex items-center justify-between mb-4">
                <CardTitle>AI 服務設定</CardTitle>
                <Button
                  onClick={() => { setShowAddAI(true); setEditingConfig(null); resetAIForm(); }}
                  variant="gold"
                  size="sm"
                  leftIcon={<Plus size={16} />}
                >
                  新增
                </Button>
              </div>

              {aiConfigs.length === 0 ? (
                <p className="text-foreground-muted text-center py-8">尚未設定任何 AI 服務</p>
              ) : (
                <div className="space-y-3">
                  {aiConfigs.map((config) => (
                    <div
                      key={config.id}
                      className={`p-4 rounded-lg border transition ${config.is_active
                        ? 'border-accent bg-accent/10'
                        : 'border-border bg-background-card/50'
                        }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {config.provider === 'gemini' ? (
                            <Key className="text-blue-400" size={20} />
                          ) : config.provider === 'openai' ? (
                            <Server className="text-purple-400" size={20} />
                          ) : (
                            <Server className="text-green-400" size={20} />
                          )}
                          <div>
                            <p className="font-medium">
                              {config.name || (
                                config.provider === 'gemini' ? 'Google Gemini' :
                                config.provider === 'openai' ? 'OpenAI' : '其他 AI 服務'
                              )}
                            </p>
                            {config.provider === 'local' && (
                              <p className="text-sm text-foreground-muted">
                                {config.local_url} - {config.local_model}
                              </p>
                            )}
                            {config.provider === 'openai' && (
                              <p className="text-sm text-foreground-muted">
                                Model: {config.local_model}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {config.is_active ? (
                            <Badge variant="success">使用中</Badge>
                          ) : (
                            <Button
                              onClick={() => handleActivateAI(config.id)}
                              variant="ghost"
                              size="sm"
                              className="text-foreground-muted hover:text-accent"
                            >
                              啟用
                            </Button>
                          )}
                          <Button
                            onClick={() => handleEditAIConfig(config)}
                            variant="ghost"
                            size="sm"
                            className="text-foreground-muted hover:text-accent"
                          >
                            <Edit2 size={16} />
                          </Button>
                          <Button
                            onClick={() => handleDeleteAI(config.id)}
                            variant="ghost"
                            size="sm"
                            className="text-foreground-muted hover:text-red-400"
                          >
                            <Trash2 size={16} />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* 新增 / 編輯 AI 設定表單 */}
            {(showAddAI || editingConfig) && (
              <Card variant="glass" padding="md">
                <div className="flex items-center justify-between mb-4">
                  <CardTitle>
                    {editingConfig ? '編輯 AI 設定' : '新增 AI 設定'}
                  </CardTitle>
                  <Button
                    onClick={() => { setShowAddAI(false); setEditingConfig(null); resetAIForm(); }}
                    variant="ghost"
                    size="sm"
                    className="text-foreground-secondary"
                  >
                    <X size={20} />
                  </Button>
                </div>

                {/* Provider 選擇 */}
                <div className="mb-4">
                  <label className="block text-sm text-foreground-secondary mb-2">類型</label>
                  <div className="flex gap-2">
                    <Button
                      className={`flex-1 ${newAIProvider === 'gemini' ? 'bg-accent/20 border-accent text-accent' : 'text-foreground-secondary'}`}
                      variant={newAIProvider === 'gemini' ? 'outline' : 'outline'}
                      onClick={() => setNewAIProvider('gemini')}
                      disabled={!!editingConfig}
                    >
                      <Key className="inline mr-1" size={16} />
                      Gemini
                    </Button>
                    <Button
                      className={`flex-1 ${newAIProvider === 'openai' ? 'bg-accent/20 border-accent text-accent' : 'text-foreground-secondary'}`}
                      variant={newAIProvider === 'openai' ? 'outline' : 'outline'}
                      onClick={() => setNewAIProvider('openai')}
                      disabled={!!editingConfig}
                    >
                      <Server className="inline mr-1" size={16} />
                      OpenAI
                    </Button>
                    <Button
                      className={`flex-1 ${newAIProvider === 'local' ? 'bg-accent/20 border-accent text-accent' : 'text-foreground-secondary'}`}
                      variant={newAIProvider === 'local' ? 'outline' : 'outline'}
                      onClick={() => setNewAIProvider('local')}
                      disabled={!!editingConfig}
                    >
                      <Server className="inline mr-1" size={16} />
                      其他 AI
                    </Button>
                  </div>
                </div>

                {/* 自訂名稱輸入框 */}
                <div className="mb-4">
                  <label className="block text-sm text-foreground-secondary mb-2">
                    服務名稱 (選填)
                  </label>
                  <input
                    type="text"
                    value={newAIName}
                    onChange={(e) => setNewAIName(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg bg-background-card border border-border text-foreground-primary placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                    placeholder={`例如: 我的${newAIProvider === 'gemini' ? 'Gemini' : newAIProvider === 'openai' ? 'OpenAI' : '本地 AI'}`}
                    maxLength={50}
                  />
                  <p className="text-xs text-foreground-muted mt-1">
                    可自訂名稱方便識別，留空則使用預設名稱
                  </p>
                </div>

                {newAIProvider === 'gemini' || newAIProvider === 'openai' ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm text-foreground-secondary mb-2">
                        API Key {editingConfig && '(留空保持原設定)'}
                      </label>
                      <div className="relative">
                        <input
                          type={showAPIKey ? 'text' : 'password'}
                          value={newAPIKey}
                          onChange={(e) => setNewAPIKey(e.target.value)}
                          className="w-full px-4 py-3 rounded-lg bg-background-card border border-border text-foreground-primary placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent pr-10"
                          placeholder={editingConfig ? '輸入新 API Key 或留空' : `輸入 ${newAIProvider === 'gemini' ? 'Gemini' : 'OpenAI'} API Key`}
                        />
                        <button
                          type="button"
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-muted"
                          onClick={() => setShowAPIKey(!showAPIKey)}
                        >
                          {showAPIKey ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>
                    {newAIProvider === 'openai' && (
                      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-yellow-500 text-sm mb-2">
                        <p>⚠️ OpenAI 沒有提供免費AI Token 次數，請謹慎使用，使用需付費。</p>
                      </div>
                    )}
                    {newAIProvider === 'openai' && (
                      <div>
                        <label className="block text-sm text-foreground-secondary mb-2">模型 (預設 gpt-5.1)</label>
                        <input
                          type="text"
                          value={newLocalModel}
                          onChange={(e) => setNewLocalModel(e.target.value)}
                          className="w-full px-4 py-3 rounded-lg bg-background-card border border-border text-foreground-primary placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                          placeholder="gpt-5.1"
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm text-foreground-secondary mb-2">API URL</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newLocalURL}
                          onChange={(e) => setNewLocalURL(e.target.value)}
                          className="flex-1 px-4 py-3 rounded-lg bg-background-card border border-border text-foreground-primary placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                          placeholder="請填寫服務商URL"
                        />
                        <Button
                          onClick={handleTestConnection}
                          disabled={testingConnection || !newLocalURL}
                          variant="gold"
                          className="whitespace-nowrap"
                        >
                          {testingConnection ? (
                            <RefreshCw className="animate-spin" size={16} />
                          ) : (
                            <RefreshCw size={16} />
                          )}
                          測試
                        </Button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm text-foreground-secondary mb-2">
                        API Key (選填)
                      </label>
                      <div className="relative">
                        <input
                          type={showAPIKey ? 'text' : 'password'}
                          value={newAPIKey}
                          onChange={(e) => setNewAPIKey(e.target.value)}
                          className="w-full px-4 py-3 rounded-lg bg-background-card border border-border text-foreground-primary placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent pr-10"
                          placeholder="若服務需要驗證請填寫"
                        />
                        <button
                          type="button"
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-muted"
                          onClick={() => setShowAPIKey(!showAPIKey)}
                        >
                          {showAPIKey ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>

                    <div className="relative z-50">
                      <label className="block text-sm text-foreground-secondary mb-2">模型名稱</label>
                      {availableModels.length > 0 ? (
                        <select
                          value={newLocalModel}
                          onChange={(e) => setNewLocalModel(e.target.value)}
                          className="w-full px-4 py-3 rounded-lg bg-background-card border border-border text-foreground-primary placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                        >
                          <option value="">請選擇模型</option>
                          {availableModels.map((model) => (
                            <option key={model} value={model}>{model}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={newLocalModel}
                          onChange={(e) => setNewLocalModel(e.target.value)}
                          className="w-full px-4 py-3 rounded-lg bg-background-card border border-border text-foreground-primary placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                          placeholder="例如: llama3, qwen2.5:14b"
                        />
                      )}
                      <p className="text-xs text-foreground-muted mt-1">可點擊上方「測試」按鈕自動取得模型列表，或直接手動輸入。</p>
                    </div>
                  </div>
                )}

                <Button
                  onClick={editingConfig ? handleUpdateAIConfig : handleAddAIConfig}
                  variant="gold"
                  fullWidth
                  className="mt-6"
                >
                  {editingConfig ? '更新設定' : '儲存設定'}
                </Button>
              </Card>
            )}
          </div>
        )}

        {/* 用戶設定頁面 */}
        {activeTab === 'user' && (
          <div className="space-y-6">
            {/* 修改密碼 */}
            <Card variant="glass" padding="md">
              <CardTitle className="mb-4">修改密碼</CardTitle>
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div>
                  <label className="block text-sm text-foreground-secondary mb-2">舊密碼</label>
                  <input
                    type="password"
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg bg-background-card border border-border text-foreground-primary placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-foreground-secondary mb-2">新密碼</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg bg-background-card border border-border text-foreground-primary placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                    required
                    minLength={6}
                  />
                </div>
                <div>
                  <label className="block text-sm text-foreground-secondary mb-2">確認新密碼</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg bg-background-card border border-border text-foreground-primary placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                    required
                    minLength={6}
                  />
                </div>

                {passwordError && (
                  <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 text-red-400 text-sm">
                    {passwordError}
                  </div>
                )}
                {passwordSuccess && (
                  <div className="bg-green-500/20 border border-green-500/50 rounded-lg p-3 text-green-400 text-sm">
                    密碼已更新
                  </div>
                )}

                <Button type="submit" variant="gold" fullWidth>
                  更新密碼
                </Button>
              </form>
            </Card>

            {/* 登出 */}
            <Card variant="glass" padding="md">
              <CardTitle className="mb-4">登出</CardTitle>
              <Button onClick={handleLogout} variant="danger" fullWidth className="flex items-center justify-center gap-2">
                <LogOut size={18} />
                登出帳號
              </Button>
            </Card>
          </div>
        )}

        {/* 用戶管理頁面 (Admin) */}
        {activeTab === 'admin' && currentUser?.role === 'admin' && (
          <div className="space-y-6">
            <Card variant="glass" padding="md">
              <div className="flex items-center justify-between mb-4">
                <CardTitle>用戶管理</CardTitle>
                <Button onClick={() => setShowAddUser(true)} variant="gold" size="sm" leftIcon={<Plus size={16} />}>
                  新增用戶
                </Button>
              </div>

              <div className="space-y-3">
                {paginatedUsers.map((user) => (
                  <div key={user.id} className="p-4 rounded-lg border border-border bg-background-card/50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${user.role === 'admin' ? 'bg-accent/20' : 'bg-background-card'
                          }`}>
                          {user.role === 'admin' ? <Shield size={18} className="text-accent" /> : <User size={18} />}
                        </div>
                        <div>
                          <p className="font-medium">{user.username}</p>
                          <p className="text-sm text-foreground-muted">
                            {user.role === 'admin' ? '管理員' : '一般用戶'}
                          </p>
                        </div>
                      </div>
                      {user.id !== currentUser.id && (
                        <div className="flex items-center gap-2">
                          <Button
                            onClick={() => handleToggleUserActive(user.id)}
                            variant={user.is_active ? "ghost" : "danger"}
                            size="sm"
                            className={user.is_active ? "text-green-400 bg-green-500/20" : ""}
                          >
                            {user.is_active ? '啟用' : '停用'}
                          </Button>
                          <Button onClick={() => handleDeleteUser(user.id)} variant="ghost" size="sm" className="text-foreground-muted hover:text-red-400">
                            <Trash2 size={16} />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* 分頁控制 */}
              {totalUserPages > 1 && (
                <div className="mt-4 flex items-center justify-between pt-4 border-t border-border">
                  <span className="text-sm text-foreground-muted">
                    共 {users.length} 位用戶，第 {userPage} / {totalUserPages} 頁
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => setUserPage(p => Math.max(1, p - 1))}
                      disabled={userPage === 1}
                      variant="secondary"
                      size="sm"
                    >
                      <ChevronLeft size={18} />
                    </Button>
                    <Button
                      onClick={() => setUserPage(p => Math.min(totalUserPages, p + 1))}
                      disabled={userPage === totalUserPages}
                      variant="secondary"
                      size="sm"
                    >
                      <ChevronRight size={18} />
                    </Button>
                  </div>
                </div>
              )}
            </Card>

            {/* 新增用戶表單 */}
            {showAddUser && (
              <Card variant="glass" padding="md">
                <div className="flex items-center justify-between mb-4">
                  <CardTitle>新增用戶</CardTitle>
                  <Button onClick={() => setShowAddUser(false)} variant="ghost" size="sm" className="text-foreground-secondary">
                    <X size={20} />
                  </Button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-foreground-secondary mb-2">用戶名</label>
                    <input
                      type="text"
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      className="w-full px-4 py-3 rounded-lg bg-background-card border border-border text-foreground-primary placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                      placeholder="輸入用戶名"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-foreground-secondary mb-2">密碼</label>
                    <input
                      type="password"
                      value={newUserPassword}
                      onChange={(e) => setNewUserPassword(e.target.value)}
                      className="w-full px-4 py-3 rounded-lg bg-background-card border border-border text-foreground-primary placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                      placeholder="輸入密碼"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-foreground-secondary mb-2">角色</label>
                    <div className="flex gap-4">
                      <Button
                        className={`flex-1 ${newUserRole === 'user' ? 'bg-accent/20 border-accent text-accent' : 'text-foreground-secondary'}`}
                        variant={newUserRole === 'user' ? 'outline' : 'outline'}
                        onClick={() => setNewUserRole('user')}
                      >
                        一般用戶
                      </Button>
                      <Button
                        className={`flex-1 ${newUserRole === 'admin' ? 'bg-accent/20 border-accent text-accent' : 'text-foreground-secondary'}`}
                        variant={newUserRole === 'admin' ? 'outline' : 'outline'}
                        onClick={() => setNewUserRole('admin')}
                      >
                        管理員
                      </Button>
                    </div>
                  </div>

                  <Button onClick={handleAddUser} variant="gold" fullWidth>
                    建立用戶
                  </Button>
                </div>
              </Card>
            )}
          </div>
        )}
      </main>
      </>
  );
}
