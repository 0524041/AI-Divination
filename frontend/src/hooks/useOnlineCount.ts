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
      if (window.location.port === '3000') {
        wsUrl = `${protocol}//${host}:8000/ws/online`;
      } else {
        // 生產環境嘗試連線到相對路徑 (依賴 Nginx /ws 轉發) 
        // 或是如果沒有 Nginx，這裡可能需要配置環境變數
        // 暫時假設生產環境同源或透過 Nginx 轉發 /ws
        wsUrl = `${protocol}//${window.location.host}/ws/online`;
        
        // 如果是直接用 port 8000 訪問後端 API 測試
        if (window.location.port === '8000') {
             wsUrl = `${protocol}//${host}:8000/ws/online`;
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
