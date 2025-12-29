'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Settings as SettingsIcon,
  Compass,
  History,
  Key,
  Server,
  User,
  Users,
  LogOut,
  X,
  Trash2,
  Plus,
  Eye,
  EyeOff,
  RefreshCw,
  Shield,
  Edit2,
} from 'lucide-react';

interface AIConfig {
  id: number;
  provider: string;
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
  const [newAIProvider, setNewAIProvider] = useState<'gemini' | 'local'>('gemini');
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

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (currentUser) {
      fetchAIConfigs();
      if (currentUser.role === 'admin') {
        fetchUsers();
      }
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
        if (data.models?.length > 0 && !newLocalModel) {
          setNewLocalModel(data.models[0]);
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

    if (newAIProvider === 'gemini') {
      if (!newAPIKey) {
        alert('請輸入 API Key');
        return;
      }
      body.api_key = newAPIKey;
    } else {
      if (!newLocalURL || !newLocalModel) {
        alert('請填寫 URL 和選擇模型');
        return;
      }
      body.local_url = newLocalURL;
      body.local_model = newLocalModel;
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
    setNewAIProvider(config.provider as 'gemini' | 'local');
    setNewAPIKey('');
    setNewLocalURL(config.local_url || '');
    setNewLocalModel(config.local_model || '');
    if (config.local_url) {
      // 自動測試連線以取得可用模型
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

    if (newAIProvider === 'gemini') {
      if (newAPIKey) {
        body.api_key = newAPIKey;
      }
    } else {
      if (!newLocalURL || !newLocalModel) {
        alert('請填寫 URL 和選擇模型');
        return;
      }
      body.local_url = newLocalURL;
      body.local_model = newLocalModel;
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
    setNewAPIKey('');
    setNewLocalURL('');
    setNewLocalModel('');
    setAvailableModels([]);
    setShowAPIKey(false);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess(false);

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
          <p className="text-gray-400">載入中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* 導航欄 */}
      <nav className="glass-card mx-4 mt-4 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-gray-400 hover:text-[var(--gold)]">
            <ArrowLeft size={24} />
          </Link>
          <div className="flex items-center gap-3">
            <SettingsIcon className="text-[var(--gold)]" size={24} />
            <h1 className="text-xl font-bold text-[var(--gold)]">設定</h1>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-4">
          <Link href="/" className="text-gray-300 hover:text-[var(--gold)]">
            <Compass size={20} />
          </Link>
          <Link href="/history" className="text-gray-300 hover:text-[var(--gold)]">
            <History size={20} />
          </Link>
        </div>
      </nav>

      {/* 主內容 */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* 分頁選項 */}
        <div className="flex gap-2 border-b border-gray-700 pb-2 mb-6 overflow-x-auto">
          <button
            className={`px-4 py-2 rounded-t-lg transition whitespace-nowrap ${activeTab === 'ai' ? 'bg-[var(--gold)]/20 text-[var(--gold)]' : 'text-gray-400 hover:text-gray-200'
              }`}
            onClick={() => setActiveTab('ai')}
          >
            <Server size={18} className="inline mr-2" />
            AI 設定
          </button>
          <button
            className={`px-4 py-2 rounded-t-lg transition whitespace-nowrap ${activeTab === 'user' ? 'bg-[var(--gold)]/20 text-[var(--gold)]' : 'text-gray-400 hover:text-gray-200'
              }`}
            onClick={() => setActiveTab('user')}
          >
            <User size={18} className="inline mr-2" />
            用戶設定
          </button>
          {currentUser?.role === 'admin' && (
            <button
              className={`px-4 py-2 rounded-t-lg transition whitespace-nowrap ${activeTab === 'admin' ? 'bg-[var(--gold)]/20 text-[var(--gold)]' : 'text-gray-400 hover:text-gray-200'
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
            <div className="glass-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold">AI 服務設定</h2>
                <button
                  onClick={() => { setShowAddAI(true); setEditingConfig(null); resetAIForm(); }}
                  className="btn-gold text-sm flex items-center gap-1"
                >
                  <Plus size={16} />
                  新增
                </button>
              </div>

              {aiConfigs.length === 0 ? (
                <p className="text-gray-500 text-center py-8">尚未設定任何 AI 服務</p>
              ) : (
                <div className="space-y-3">
                  {aiConfigs.map((config) => (
                    <div
                      key={config.id}
                      className={`p-4 rounded-lg border transition ${config.is_active
                          ? 'border-[var(--gold)] bg-[var(--gold)]/10'
                          : 'border-gray-700 bg-gray-800/50'
                        }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {config.provider === 'gemini' ? (
                            <Key className="text-blue-400" size={20} />
                          ) : (
                            <Server className="text-green-400" size={20} />
                          )}
                          <div>
                            <p className="font-medium">
                              {config.provider === 'gemini' ? 'Google Gemini' : 'Local AI'}
                            </p>
                            {config.provider === 'local' && (
                              <p className="text-sm text-gray-500">
                                {config.local_url} - {config.local_model}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {config.is_active ? (
                            <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded">
                              使用中
                            </span>
                          ) : (
                            <button
                              onClick={() => handleActivateAI(config.id)}
                              className="text-xs text-gray-400 hover:text-[var(--gold)]"
                            >
                              啟用
                            </button>
                          )}
                          <button
                            onClick={() => handleEditAIConfig(config)}
                            className="text-gray-500 hover:text-[var(--gold)]"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteAI(config.id)}
                            className="text-gray-500 hover:text-red-400"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 新增 / 編輯 AI 設定表單 */}
            {(showAddAI || editingConfig) && (
              <div className="glass-card p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold">
                    {editingConfig ? '編輯 AI 設定' : '新增 AI 設定'}
                  </h2>
                  <button
                    onClick={() => { setShowAddAI(false); setEditingConfig(null); resetAIForm(); }}
                    className="text-gray-400"
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Provider 選擇 */}
                <div className="mb-4">
                  <label className="block text-sm text-gray-400 mb-2">類型</label>
                  <div className="flex gap-4">
                    <button
                      className={`flex-1 py-3 rounded-lg border transition ${newAIProvider === 'gemini'
                          ? 'border-[var(--gold)] bg-[var(--gold)]/20'
                          : 'border-gray-600 text-gray-400'
                        }`}
                      onClick={() => setNewAIProvider('gemini')}
                      disabled={!!editingConfig}
                    >
                      <Key className="inline mr-2" size={18} />
                      Gemini
                    </button>
                    <button
                      className={`flex-1 py-3 rounded-lg border transition ${newAIProvider === 'local'
                          ? 'border-[var(--gold)] bg-[var(--gold)]/20'
                          : 'border-gray-600 text-gray-400'
                        }`}
                      onClick={() => setNewAIProvider('local')}
                      disabled={!!editingConfig}
                    >
                      <Server className="inline mr-2" size={18} />
                      Local AI
                    </button>
                  </div>
                </div>

                {newAIProvider === 'gemini' ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm text-gray-400 mb-2">
                        API Key {editingConfig && '(留空保持原設定)'}
                      </label>
                      <div className="relative">
                        <input
                          type={showAPIKey ? 'text' : 'password'}
                          value={newAPIKey}
                          onChange={(e) => setNewAPIKey(e.target.value)}
                          className="input-dark w-full pr-10"
                          placeholder={editingConfig ? '輸入新 API Key 或留空' : '輸入 Gemini API Key'}
                        />
                        <button
                          type="button"
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                          onClick={() => setShowAPIKey(!showAPIKey)}
                        >
                          {showAPIKey ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm text-gray-400 mb-2">API URL</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newLocalURL}
                          onChange={(e) => setNewLocalURL(e.target.value)}
                          className="input-dark flex-1"
                          placeholder="http://localhost:1234"
                        />
                        <button
                          onClick={handleTestConnection}
                          disabled={testingConnection || !newLocalURL}
                          className="btn-gold flex items-center gap-1"
                        >
                          {testingConnection ? (
                            <RefreshCw className="animate-spin" size={16} />
                          ) : (
                            <RefreshCw size={16} />
                          )}
                          測試
                        </button>
                      </div>
                    </div>

                    {availableModels.length > 0 && (
                      <div>
                        <label className="block text-sm text-gray-400 mb-2">模型</label>
                        <select
                          value={newLocalModel}
                          onChange={(e) => setNewLocalModel(e.target.value)}
                          className="input-dark w-full"
                        >
                          {availableModels.map((model) => (
                            <option key={model} value={model}>
                              {model}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                )}

                <button
                  onClick={editingConfig ? handleUpdateAIConfig : handleAddAIConfig}
                  className="btn-gold w-full mt-4"
                >
                  {editingConfig ? '更新設定' : '儲存設定'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* 用戶設定頁面 */}
        {activeTab === 'user' && (
          <div className="space-y-6">
            {/* 修改密碼 */}
            <div className="glass-card p-6">
              <h2 className="text-lg font-bold mb-4">修改密碼</h2>
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">舊密碼</label>
                  <input
                    type="password"
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    className="input-dark w-full"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">新密碼</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="input-dark w-full"
                    required
                    minLength={6}
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">確認新密碼</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="input-dark w-full"
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

                <button type="submit" className="btn-gold w-full">
                  更新密碼
                </button>
              </form>
            </div>

            {/* 登出 */}
            <div className="glass-card p-6">
              <h2 className="text-lg font-bold mb-4">登出</h2>
              <button onClick={handleLogout} className="w-full py-3 rounded-lg border border-red-500/50 text-red-400 hover:bg-red-500/10 transition flex items-center justify-center gap-2">
                <LogOut size={18} />
                登出帳號
              </button>
            </div>
          </div>
        )}

        {/* 用戶管理頁面 (Admin) */}
        {activeTab === 'admin' && currentUser?.role === 'admin' && (
          <div className="space-y-6">
            <div className="glass-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold">用戶管理</h2>
                <button onClick={() => setShowAddUser(true)} className="btn-gold text-sm flex items-center gap-1">
                  <Plus size={16} />
                  新增用戶
                </button>
              </div>

              <div className="space-y-3">
                {users.map((user) => (
                  <div key={user.id} className="p-4 rounded-lg border border-gray-700 bg-gray-800/50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${user.role === 'admin' ? 'bg-[var(--gold)]/20' : 'bg-gray-700'
                          }`}>
                          {user.role === 'admin' ? <Shield size={18} className="text-[var(--gold)]" /> : <User size={18} />}
                        </div>
                        <div>
                          <p className="font-medium">{user.username}</p>
                          <p className="text-sm text-gray-500">
                            {user.role === 'admin' ? '管理員' : '一般用戶'}
                          </p>
                        </div>
                      </div>
                      {user.id !== currentUser.id && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleToggleUserActive(user.id)}
                            className={`text-xs px-2 py-1 rounded ${user.is_active
                                ? 'bg-green-500/20 text-green-400'
                                : 'bg-red-500/20 text-red-400'
                              }`}
                          >
                            {user.is_active ? '啟用' : '停用'}
                          </button>
                          <button onClick={() => handleDeleteUser(user.id)} className="text-gray-500 hover:text-red-400">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 新增用戶表單 */}
            {showAddUser && (
              <div className="glass-card p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold">新增用戶</h2>
                  <button onClick={() => setShowAddUser(false)} className="text-gray-400">
                    <X size={20} />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">用戶名</label>
                    <input
                      type="text"
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      className="input-dark w-full"
                      placeholder="輸入用戶名"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">密碼</label>
                    <input
                      type="password"
                      value={newUserPassword}
                      onChange={(e) => setNewUserPassword(e.target.value)}
                      className="input-dark w-full"
                      placeholder="輸入密碼"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">角色</label>
                    <div className="flex gap-4">
                      <button
                        className={`flex-1 py-2 rounded-lg border transition ${newUserRole === 'user'
                            ? 'border-[var(--gold)] bg-[var(--gold)]/20'
                            : 'border-gray-600 text-gray-400'
                          }`}
                        onClick={() => setNewUserRole('user')}
                      >
                        一般用戶
                      </button>
                      <button
                        className={`flex-1 py-2 rounded-lg border transition ${newUserRole === 'admin'
                            ? 'border-[var(--gold)] bg-[var(--gold)]/20'
                            : 'border-gray-600 text-gray-400'
                          }`}
                        onClick={() => setNewUserRole('admin')}
                      >
                        管理員
                      </button>
                    </div>
                  </div>

                  <button onClick={handleAddUser} className="btn-gold w-full">
                    建立用戶
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
