/**
 * API 客戶端 React Hook
 */

import { useEffect, useState } from 'react';
import { initializeApiClient, isInitialized } from './api-init';
import { apiGet, apiPost, apiPut, apiDelete, SecureSSEConnection } from './api-client';

export function useApiClient() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isInitialized()) {
      initializeApiClient().then(() => {
        setReady(true);
      });
    } else {
      setReady(true);
    }
  }, []);

  return {
    ready,
    get: apiGet,
    post: apiPost,
    put: apiPut,
    delete: apiDelete,
    createSSE: () => new SecureSSEConnection(),
  };
}
