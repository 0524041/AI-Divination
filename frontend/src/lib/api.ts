import {
  User,
  LoginRequest,
  RegisterRequest,
  Settings,
  DivinationRequest,
  DivinationResponse,
  HistoryItem,
} from '@/types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

class ApiClient {
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${API_BASE}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Request failed');
    }

    return data;
  }

  // ========== 認證 API ==========
  async login(credentials: LoginRequest): Promise<{ success: boolean; user: User }> {
    return this.request('/api/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  }

  async logout(): Promise<{ success: boolean }> {
    return this.request('/api/logout', {
      method: 'POST',
    });
  }

  async register(data: RegisterRequest): Promise<{ success: boolean; user: User }> {
    return this.request('/api/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getCurrentUser(): Promise<User> {
    return this.request('/api/current-user');
  }

  async updatePassword(newPassword: string): Promise<{ success: boolean }> {
    return this.request('/api/user/password', {
      method: 'PUT',
      body: JSON.stringify({ new_password: newPassword }),
    });
  }

  // ========== 設定 API ==========
  async getSettings(): Promise<Settings> {
    return this.request('/api/settings');
  }

  async saveSettings(settings: Partial<Settings>): Promise<{ success: boolean }> {
    return this.request('/api/settings', {
      method: 'POST',
      body: JSON.stringify(settings),
    });
  }

  // ========== 占卜 API ==========
  async divinate(data: DivinationRequest, geminiApiKey?: string): Promise<DivinationResponse> {
    const headers: Record<string, string> = {};
    if (geminiApiKey) {
      headers['X-Gemini-Api-Key'] = geminiApiKey;
    }
    return this.request('/api/divinate', {
      method: 'POST',
      body: JSON.stringify(data),
      headers,
    });
  }

  // ========== 歷史記錄 API ==========
  async getHistory(userId?: number | 'all'): Promise<HistoryItem[]> {
    const params = userId ? `?user_id=${userId}` : '';
    return this.request(`/api/history${params}`);
  }

  async toggleFavorite(id: number, isFavorite: boolean): Promise<{ success: boolean }> {
    return this.request(`/api/history/${id}/favorite`, {
      method: 'PUT',
      body: JSON.stringify({ is_favorite: isFavorite }),
    });
  }

  async deleteHistory(id: number): Promise<{ success: boolean }> {
    return this.request(`/api/history/${id}`, {
      method: 'DELETE',
    });
  }

  // ========== 管理員 API ==========
  async getAllUsers(): Promise<User[]> {
    return this.request('/api/admin/users');
  }

  async createUser(username: string, password: string, role: string): Promise<{ success: boolean; user_id: number }> {
    return this.request('/api/admin/users', {
      method: 'POST',
      body: JSON.stringify({ username, password, role }),
    });
  }

  async deleteUser(userId: number): Promise<{ success: boolean }> {
    return this.request(`/api/admin/users/${userId}`, {
      method: 'DELETE',
    });
  }

  async updateUser(userId: number, data: { role?: string; password?: string }): Promise<{ success: boolean }> {
    return this.request(`/api/admin/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // ========== API Key 管理 ==========
  async getUserApiKeys(): Promise<Array<{ provider: string; created_at: string }>> {
    return this.request('/api/user/api-keys');
  }

  async addApiKey(provider: string, apiKey: string): Promise<{ success: boolean }> {
    return this.request('/api/user/api-keys', {
      method: 'POST',
      body: JSON.stringify({ provider, api_key: apiKey }),
    });
  }

  async deleteApiKey(provider: string): Promise<{ success: boolean }> {
    return this.request(`/api/user/api-keys/${provider}`, {
      method: 'DELETE',
    });
  }

  // ========== Local AI 測試 ==========
  async testLocalAI(apiUrl: string): Promise<{ success: boolean; models: string[]; message: string }> {
    return this.request('/api/test-local-ai', {
      method: 'POST',
      body: JSON.stringify({ api_url: apiUrl }),
    });
  }
}

export const api = new ApiClient();
