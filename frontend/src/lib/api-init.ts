/**
 * API 客戶端初始化
 * 在應用啟動時調用，獲取配置
 */

import { getApiConfig } from './api-client';

let initialized = false;

export async function initializeApiClient() {
  if (initialized) {
    return;
  }
  
  try {
    await getApiConfig();
    initialized = true;
    console.log('API client initialized');
  } catch (error) {
    console.error('Failed to initialize API client:', error);
    // 不阻止應用啟動
  }
}

export function isInitialized() {
  return initialized;
}
