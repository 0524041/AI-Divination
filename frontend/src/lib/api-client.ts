/**
 * 簡化版 API 客戶端
 * 移除複雜的簽名驗證，僅保留 Bearer token 認證
 */

// API 配置 - 使用相對路徑通過 Next.js 代理
// Vercel 部署時設 NEXT_PUBLIC_API_URL（後端專案域名），瀏覽器直連後端；
// 未設則維持相對路徑（本地經 next.config.js rewrite 到 localhost:8000）
const BACKEND_URL = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/$/, '');

/**
 * 把 /api/... 路徑解析為實際請求位址。
 * 已是絕對 URL 則原樣回傳；測試與本地維持相對路徑不變。
 */
export function resolveApiUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return BACKEND_URL ? `${BACKEND_URL}${path}` : path;
}

/**
 * 安全的 API 請求選項
 */
interface SecureRequestOptions extends RequestInit {
  skipAuth?: boolean;
}

/**
 * 發送 API 請求
 */
export async function secureApiRequest(
  endpoint: string,
  options: SecureRequestOptions = {}
): Promise<Response> {
  const { skipAuth = false, ...fetchOptions } = options;

  // 構建 URL - 未設後端位址時維持相對路徑（Next.js rewrite 處理）
  const url = resolveApiUrl(endpoint);

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
 * 導出 API 配置（後端位址，未設即同源相對路徑）
 */
export async function getApiConfig(): Promise<{ baseUrl: string }> {
  return { baseUrl: BACKEND_URL };
}
