import { beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
});

async function load() {
  return import('@/lib/api-client');
}

describe('resolveApiUrl', () => {
  it('未設 NEXT_PUBLIC_API_URL 時維持相對路徑（本地 rewrite）', async () => {
    const m = await load();
    expect(m.resolveApiUrl('/api/history')).toBe('/api/history');
  });

  it('有設時拼接後端域名並去掉尾端斜線', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://be-example.vercel.app/');
    const m = await load();
    expect(m.resolveApiUrl('/api/history')).toBe(
      'https://be-example.vercel.app/api/history'
    );
  });

  it('絕對 URL 原樣回傳', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://be-example.vercel.app');
    const m = await load();
    expect(m.resolveApiUrl('https://other.example/api/x')).toBe(
      'https://other.example/api/x'
    );
  });
});
