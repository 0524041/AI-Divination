import { useState, useEffect, useRef } from 'react';

export function useOnlineCount() {
  const [count, setCount] = useState<number | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const connect = () => {
      // 判斷是否為 HTTPS 以決定使用 wss 或 ws
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.hostname;
      
      // 開發環境下，前端在 3000，後端在 8000
      // 生產環境如果沒有反向代理，通常也是分開端口
      // 這裡做一個簡單判斷：如果是 localhost:3000，就連 8000
      // 否則嘗試連接 /ws/online (假設有 Nginx 轉發或同源)
      
      let wsUrl = '';
      // 使用 /api/ws/online 路徑，以便 Next.js rewrite 可以嘗試代理
      // 或者如果 Cloudflare Ingress 設定了 /api/* -> localhost:8000 也能生效
      
      if (window.location.port === '3000') {
        // 開發環境：直接連後端 (因為 Next.js rewrite 對 WS 支援不穩定，開發時分開連較穩)
        wsUrl = `${protocol}//${host}:8000/api/ws/online`;
      } else {
        // 生產環境 (Cloudflare Tunnel)：
        // 嘗試透過同源路徑 /api/ws/online 連接
        // 這樣請求會發送到 Next.js (3000) -> Rewrite 規則 -> Backend (8000)
        // 或是 Cloudflare Ingress 直接將 /api/* 導向 Backend
        wsUrl = `${protocol}//${window.location.host}/api/ws/online`;
        
        // 特殊情況：如果是在 localhost:8000 直接開
        if (window.location.port === '8000') {
             wsUrl = `${protocol}//${host}:8000/api/ws/online`;
        }
      }

      console.log('Connecting to WebSocket:', wsUrl);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        // console.log('WS Connected');
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'online_count') {
            setCount(data.count);
          }
        } catch (e) {
          console.error(e);
        }
      };

      ws.onclose = () => {
        // console.log('WS Disconnected, retrying...');
        reconnectTimeoutRef.current = setTimeout(connect, 5000);
      };
      
      ws.onerror = (e) => {
        // console.error('WS Error', e);
        ws.close();
      };
    };

    connect();

    return () => {
      if (wsRef.current) {
        wsRef.current.onclose = null; // Prevent reconnect loop on unmount
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };
  }, []);

  return count;
}
