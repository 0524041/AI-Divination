/**
 * 簡化版 API 客戶端
 * 移除複雜的簽名驗證，僅保留 Bearer token 認證
 */

// API 配置 - 使用相對路徑通過 Next.js 代理
const API_CONFIG = {
  baseUrl: '',  // 使用相對路徑，讓 Next.js 代理處理
};

/**
 * 安全的 API 請求選項
 */
interface SecureRequestOptions extends RequestInit {
  skipAuth?: boolean;
  skipSignature?: boolean;  // 保留向後相容（目前為 no-op，已移除簽名驗證）
}

/**
 * 發送 API 請求
 */
export async function secureApiRequest(
  endpoint: string,
  options: SecureRequestOptions = {}
): Promise<Response> {
  const { skipAuth = false, skipSignature = false, ...fetchOptions } = options;

  // 構建 URL - 使用相對路徑
  const url = endpoint.startsWith('http')
    ? endpoint
    : endpoint;  // 保持相對路徑

  // 準備請求頭
  const headers = new Headers(fetchOptions.headers);

  // 添加 token（如果需要認證）
  if (!skipAuth) {
    const token = localStorage.getItem('token');
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  // 發送請求
  const response = await fetch(url, {
    ...fetchOptions,
    headers,
  });

  return response;
}

/**
 * GET 請求
 */
export async function apiGet(endpoint: string, options: SecureRequestOptions = {}) {
  return secureApiRequest(endpoint, {
    ...options,
    method: 'GET',
  });
}

/**
 * POST 請求
 */
export async function apiPost(
  endpoint: string,
  data?: any,
  options: SecureRequestOptions = {}
) {
  return secureApiRequest(endpoint, {
    ...options,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    body: data ? JSON.stringify(data) : undefined,
  });
}

/**
 * PUT 請求
 */
export async function apiPut(
  endpoint: string,
  data?: any,
  options: SecureRequestOptions = {}
) {
  return secureApiRequest(endpoint, {
    ...options,
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    body: data ? JSON.stringify(data) : undefined,
  });
}

/**
 * DELETE 請求
 */
export async function apiDelete(endpoint: string, options: SecureRequestOptions = {}) {
  return secureApiRequest(endpoint, {
    ...options,
    method: 'DELETE',
  });
}

/**
 * 導出 API 配置
 */
export async function getApiConfig(): Promise<typeof API_CONFIG> {
  return API_CONFIG;
}
