/**
 * 簡化版 API 客戶端
 * 移除複雜的簽名驗證，僅保留 Bearer token 認證
 */

// API 配置 - 使用相對路徑通過 Next.js 代理
const API_CONFIG = {
  baseUrl: '',  // 使用相對路徑，讓 Next.js 代理處理
};

/**
 * 生成隨機 nonce（用於 SSE 連接 ID）
 */
function generateNonce(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
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
 * SSE 連接 - 用於長時間運行的請求
 */
export class SecureSSEConnection {
  private eventSource: EventSource | null = null;
  private connectionId: string;

  constructor() {
    this.connectionId = generateNonce();
  }

  /**
   * 連接到 SSE 端點
   */
  async connect(
    endpoint: string,
    onMessage: (event: MessageEvent) => void,
    onError?: (error: Event) => void
  ): Promise<void> {
    // 構建 URL - 使用相對路徑通過 Next.js 代理
    let sseUrl: string;

    if (endpoint.startsWith('http')) {
      sseUrl = endpoint;
    } else {
      // 使用當前頁面的 origin 構建完整 URL
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      sseUrl = `${origin}${endpoint}`;
    }

    const urlObj = new URL(sseUrl);

    // 添加認證 token 到 URL
    const token = localStorage.getItem('token');
    if (token) {
      urlObj.searchParams.set('token', token);
    }

    // 添加連接 ID
    urlObj.searchParams.set('connection_id', this.connectionId);

    // 創建 EventSource
    this.eventSource = new EventSource(urlObj.toString());

    // 設置事件處理器
    this.eventSource.onmessage = onMessage;

    this.eventSource.onerror = (error) => {
      console.error('SSE connection error:', error);
      if (onError) {
        onError(error);
      }
      this.close();
    };

    // 監聽特定事件
    this.eventSource.addEventListener('connected', (e) => {
      console.debug('SSE connected:', e.data);
    });

    this.eventSource.addEventListener('done', () => {
      console.debug('SSE stream completed');
      this.close();
    });

    this.eventSource.addEventListener('cancelled', () => {
      console.debug('SSE stream cancelled');
      this.close();
    });
  }

  /**
   * 關閉連接
   */
  close(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }

  /**
   * 取消 SSE 連接（通知服務器）
   */
  async cancel(): Promise<void> {
    try {
      await apiPost(`/api/cancel-stream/${this.connectionId}`);
    } catch (error) {
      console.error('Failed to cancel SSE connection:', error);
    } finally {
      this.close();
    }
  }

  /**
   * 獲取連接 ID
   */
  getConnectionId(): string {
    return this.connectionId;
  }
}

/**
 * 導出 API 配置
 */
export async function getApiConfig(): Promise<typeof API_CONFIG> {
  return API_CONFIG;
}
