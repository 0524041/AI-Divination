/**
 * 安全的 API 客戶端
 * 包含請求簽名、防止重定向攻擊等安全功能
 */

// API 配置 - 使用相對路徑通過 Next.js 代理
// 這樣請求會經過 Next.js rewrites 轉發到後端
const API_CONFIG = {
  baseUrl: '',  // 使用相對路徑，讓 Next.js 代理處理
  signatureKey: process.env.NEXT_PUBLIC_API_SIGNATURE_KEY || '',
};

/**
 * 生成隨機 nonce
 */
function generateNonce(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

/**
 * 生成請求簽名
 */
async function generateSignature(
  path: string,
  timestamp: string,
  nonce: string
): Promise<string> {
  const message = `${path}:${timestamp}:${nonce}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(message);

  // 使用 Web Crypto API 生成 HMAC-SHA256 簽名
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(API_CONFIG.signatureKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, data);
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * 安全的 API 請求選項
 */
interface SecureRequestOptions extends RequestInit {
  skipSignature?: boolean;
}

/**
 * 發送安全的 API 請求
 */
export async function secureApiRequest(
  endpoint: string,
  options: SecureRequestOptions = {}
): Promise<Response> {
  const { skipSignature = false, ...fetchOptions } = options;

  // 構建 URL - 使用相對路徑
  // endpoint 應該以 /api 開頭，這樣會經過 Next.js rewrites
  const url = endpoint.startsWith('http')
    ? endpoint
    : endpoint;  // 保持相對路徑

  // 獲取 pathname（用於簽名）
  let pathname: string;
  if (endpoint.startsWith('http')) {
    pathname = new URL(endpoint).pathname;
  } else {
    // 相對路徑，直接取 path 部分
    pathname = endpoint.split('?')[0];
  }

  // 準備請求頭
  const headers = new Headers(fetchOptions.headers);

  // 添加 token
  const token = localStorage.getItem('token');
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  // 添加請求簽名（防止 CSRF 和重放攻擊）
  if (!skipSignature && API_CONFIG.signatureKey) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = generateNonce();
    const path = pathname;

    try {
      const signature = await generateSignature(path, timestamp, nonce);
      headers.set('X-Request-Signature', signature);
      headers.set('X-Request-Timestamp', timestamp);
      headers.set('X-Request-Nonce', nonce);
    } catch (error) {
      console.error('Failed to generate signature:', error);
    }
  }

  // 發送請求
  const response = await fetch(url, {
    ...fetchOptions,
    headers,
    // 不允許跟隨重定向
    redirect: 'manual',
  });

  // 檢查是否被重定向
  if (response.type === 'opaqueredirect' ||
    (response.status >= 300 && response.status < 400)) {
    throw new Error('Request was redirected - possible attack detected');
  }

  // 驗證響應簽名（確保響應來自真實的後端服務器）
  await verifyResponseSignature(response);

  return response;
}

/**
 * 驗證響應簽名
 * 防止攻擊者將請求重定向到假的 API 端點
 */
async function verifyResponseSignature(response: Response): Promise<void> {
  // 只在有簽名密鑰時驗證
  if (!API_CONFIG.signatureKey) {
    return;
  }

  const responseSignature = response.headers.get('X-Response-Signature');
  const responseTimestamp = response.headers.get('X-Response-Timestamp');
  const responseNonce = response.headers.get('X-Response-Nonce');

  // 如果沒有響應簽名，可能是舊的 API 或公開端點
  if (!responseSignature || !responseTimestamp || !responseNonce) {
    // 對於關鍵操作（有 token），記錄警告
    const hasAuth = localStorage.getItem('token');
    if (hasAuth && response.status === 200) {
      console.warn('Response missing signature - possible security risk');
    }
    return;
  }

  // 生成預期的簽名（使用 nonce，不使用 content-length 因為 CDN 會修改它）
  const message = `response:${responseTimestamp}:${responseNonce}`;

  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(API_CONFIG.signatureKey),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(message)
    );

    const expectedSignature = Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    if (responseSignature !== expectedSignature) {
      throw new Error('Response signature verification failed - possible fake API');
    }

    // 檢查時間戳是否過舊（防止重放攻擊）
    const timestamp = parseInt(responseTimestamp);
    const currentTime = Math.floor(Date.now() / 1000);
    if (Math.abs(currentTime - timestamp) > 300) {  // 5 分鐘容忍時間差
      throw new Error('Response timestamp too old - possible replay attack');
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('fake API')) {
      throw error;
    }
    console.error('Response verification failed:', error);
    throw new Error('Failed to verify response authenticity');
  }
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
    // 對於相對路徑，需要基於當前 origin 構建完整 URL
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
      console.log('SSE connected:', e.data);
    });

    this.eventSource.addEventListener('done', () => {
      console.log('SSE stream completed');
      this.close();
    });

    this.eventSource.addEventListener('cancelled', () => {
      console.log('SSE stream cancelled');
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
 * 導出 API 配置（用於獲取簽名密鑰等）
 */
export async function getApiConfig(): Promise<typeof API_CONFIG> {
  // 如果簽名密鑰未設置，從服務器獲取
  if (!API_CONFIG.signatureKey) {
    try {
      const response = await fetch(`${API_CONFIG.baseUrl}/api/auth/client-config`, {
        method: 'GET',
        credentials: 'include',
      });

      if (response.ok) {
        const config = await response.json();
        API_CONFIG.signatureKey = config.signature_key;
      }
    } catch (error) {
      console.error('Failed to fetch API config:', error);
    }
  }

  return API_CONFIG;
}
