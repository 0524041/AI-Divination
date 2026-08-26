import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AISelector, DEFAULT_AI_DISPLAY_NAME } from '../AISelector';

const authMock = vi.hoisted(() => ({ isGuest: false }));

vi.mock('@/contexts/AuthContext', () => ({
    useAuth: () => ({ isGuest: authMock.isGuest }),
}));

const LOCAL_CONFIG = {
    id: 1,
    provider: 'local',
    name: '我的本地模型',
    model: 'qwen',
    has_api_key: false,
    local_url: 'http://localhost:1234',
    local_model: 'qwen',
    is_active: true,
};

function mockConfigsApi(configs: unknown[] = []) {
    return vi.spyOn(global, 'fetch').mockImplementation((input: unknown) => {
        const url = String(input);
        if (url.includes('/api/settings/ai')) {
            return Promise.resolve({
                ok: true,
                json: async () => configs,
            } as Response);
        }
        return Promise.resolve({ ok: true, json: async () => ({}) } as Response);
    });
}

describe('AISelector（常駐清單模型）', () => {
    beforeEach(() => {
        authMock.isGuest = false;
        vi.restoreAllMocks();
    });

    it('無任何設定時顯示系統預設 Agnes', async () => {
        mockConfigsApi([]);
        render(<AISelector variant="card" />);
        await waitFor(() => {
            expect(screen.getAllByText(DEFAULT_AI_DISPLAY_NAME).length).toBeGreaterThan(0);
        });
    });

    it('清單常駐：沒有自訂項目也能開啟選單（Agnes 永遠在）', async () => {
        const fetchSpy = mockConfigsApi([]);
        const user = userEvent.setup();

        render(<AISelector variant="card" />);
        await waitFor(() => expect(fetchSpy).toHaveBeenCalled());

        await user.click(screen.getByRole('button', { name: /AI 解盤服務/ }));
        expect(screen.getByRole('listbox')).toBeTruthy();
        expect(screen.getByRole('option', { name: /Agnes（系統預設）|Agnes/ })).toBeTruthy();
    });

    it('有設定的使用者：按鈕顯示目前使用的模型名稱', async () => {
        mockConfigsApi([LOCAL_CONFIG]);
        render(<AISelector variant="card" />);
        await waitFor(() => expect(screen.getByText('我的本地模型')).toBeTruthy());
    });

    it('訪客唯讀：固定 Agnes、不可開啟清單', () => {
        authMock.isGuest = true;
        const fetchSpy = mockConfigsApi([]);

        render(<AISelector variant="card" />);
        const trigger = screen.getByRole('button', { name: /AI 解盤服務/ });
        expect(trigger.hasAttribute('disabled')).toBe(true);
        expect(screen.getByText(/訪客固定使用系統預設/)).toBeTruthy();
        void fetchSpy;
    });

    it('點選自訂項目 → 呼叫 activate；點選 Agnes → 呼叫 use-default', async () => {
        mockConfigsApi([LOCAL_CONFIG]);
        const putSpy = vi
            .spyOn(global, 'fetch')
            .mockImplementation((input: unknown, init?: { method?: string }) => {
                const url = String(input);
                if (init?.method === 'PUT') {
                    return Promise.resolve({ ok: true, json: async () => ({}) } as Response);
                }
                return Promise.resolve({ ok: true, json: async () => [LOCAL_CONFIG] } as Response);
            });
        void putSpy;

        const user = userEvent.setup();
        render(<AISelector variant="card" />);
        await user.click(screen.getByRole('button', { name: /AI 解盤服務/ }));

        await user.click(screen.getByRole('option', { name: /我的本地模型/ }));
        const activateCall = vi
            .mocked(global.fetch)
            .mock.calls.find((c) => String(c[0]).includes('/activate'));
        expect(activateCall).toBeTruthy();

        // 再開啟，選擇 Agnes
        await user.click(screen.getByRole('button', { name: /AI 解盤服務/ }));
        await user.click(
            screen.getAllByRole('option', { name: /Agnes（系統預設）|Agnes/ })[0]
        );
        const useDefaultCall = vi
            .mocked(global.fetch)
            .mock.calls.find((c) => String(c[0]).includes('/use-default'));
        expect(useDefaultCall).toBeTruthy();
    });

    it('compact 變體：對話窗內可開啟同一份清單', async () => {
        mockConfigsApi([LOCAL_CONFIG]);
        const user = userEvent.setup();

        render(<AISelector variant="compact" className="" />);
        await waitFor(() =>
            expect(screen.getByRole('button', { name: /我的本地模型/ })).toBeTruthy()
        );
        await user.click(screen.getByRole('button', { name: /我的本地模型/ }));
        expect(screen.getByRole('listbox')).toBeTruthy();
        expect(screen.getByRole('option', { name: /我的本地模型/ })).toBeTruthy();
    });
});
