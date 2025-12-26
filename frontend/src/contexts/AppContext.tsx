'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, Settings, HistoryItem } from '@/types';
import { api } from '@/lib/api';

interface AppState {
  user: User | null;
  isLoading: boolean;
  settings: Settings | null;
  history: HistoryItem[];
  geminiApiKey: string | null;  // 儲存在 localStorage
}

interface AppContextType extends AppState {
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  refreshUser: () => Promise<void>;
  refreshSettings: () => Promise<void>;
  refreshHistory: (userId?: number | 'all') => Promise<void>;
  updateSettings: (settings: Partial<Settings>) => Promise<void>;
  setGeminiApiKey: (key: string | null) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>({
    user: null,
    isLoading: true,
    settings: null,
    history: [],
    geminiApiKey: null,
  });

  // 從 localStorage 讀取 Gemini API Key
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedKey = localStorage.getItem('gemini_api_key');
      if (savedKey) {
        setState((prev) => ({ ...prev, geminiApiKey: savedKey }));
      }
    }
  }, []);

  const setGeminiApiKey = useCallback((key: string | null) => {
    if (typeof window !== 'undefined') {
      if (key) {
        localStorage.setItem('gemini_api_key', key);
      } else {
        localStorage.removeItem('gemini_api_key');
      }
    }
    setState((prev) => ({ ...prev, geminiApiKey: key }));
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const user = await api.getCurrentUser();
      setState((prev) => ({ ...prev, user, isLoading: false }));
    } catch {
      setState((prev) => ({ ...prev, user: null, isLoading: false }));
    }
  }, []);

  const refreshSettings = useCallback(async () => {
    try {
      const settings = await api.getSettings();
      setState((prev) => ({ ...prev, settings }));
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    }
  }, []);

  const refreshHistory = useCallback(async (userId?: number | 'all') => {
    try {
      const history = await api.getHistory(userId);
      setState((prev) => ({ ...prev, history }));
    } catch (error) {
      console.error('Failed to fetch history:', error);
    }
  }, []);

  const login = async (username: string, password: string) => {
    const result = await api.login({ username, password });
    setState((prev) => ({ ...prev, user: result.user }));
  };

  const logout = async () => {
    await api.logout();
    setState((prev) => ({ ...prev, user: null, history: [] }));
  };

  const register = async (username: string, password: string) => {
    const result = await api.register({ username, password });
    setState((prev) => ({ ...prev, user: result.user }));
  };

  const updateSettings = async (newSettings: Partial<Settings>) => {
    await api.saveSettings(newSettings);
    await refreshSettings();
  };

  useEffect(() => {
    refreshUser();
    refreshSettings();
  }, [refreshUser, refreshSettings]);

  return (
    <AppContext.Provider
      value={{
        ...state,
        login,
        logout,
        register,
        refreshUser,
        refreshSettings,
        refreshHistory,
        updateSettings,
        setGeminiApiKey,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
