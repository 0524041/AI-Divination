import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AISelector } from '../AISelector';

const authMock = vi.hoisted(() => ({ isGuest: false }));

vi.mock('@/contexts/AuthContext', () => ({
    useAuth: () => ({ isGuest: authMock.isGuest }),
}));

describe('AISelector', () => {
    beforeEach(() => {
        authMock.isGuest = false;
        vi.restoreAllMocks();
    });

    it('shows default AI name when user has no AI config', async () => {
        vi.spyOn(global, 'fetch').mockResolvedValue({
            ok: true,
            json: async () => [],
        } as Response);

        render(<AISelector variant="card" />);
        await waitFor(() => {
            expect(screen.getByText('DeepSeek V4 Flash（預設）')).toBeInTheDocument();
        });
    });

    it('shows configured AI name when user has active config', async () => {
        vi.spyOn(global, 'fetch').mockResolvedValue({
            ok: true,
            json: async () => [
                {
                    id: 1,
                    provider: 'local',
                    name: '我的本地模型',
                    has_api_key: false,
                    local_url: 'http://localhost:1234',
                    local_model: 'qwen',
                    is_active: true,
                },
            ],
        } as Response);

        render(<AISelector variant="card" />);
        await waitFor(() => {
            expect(screen.getByText('我的本地模型')).toBeInTheDocument();
        });
    });

    it('shows default AI name for guests', async () => {
        authMock.isGuest = true;

        render(<AISelector variant="card" />);
        expect(screen.getByText('DeepSeek V4 Flash（預設）')).toBeInTheDocument();
    });

    it('offers default option in dropdown even when user has configs', async () => {
        vi.spyOn(global, 'fetch').mockResolvedValue({
            ok: true,
            json: async () => [
                {
                    id: 1,
                    provider: 'local',
                    name: '我的本地模型',
                    has_api_key: false,
                    local_url: 'http://localhost:1234',
                    local_model: 'qwen',
                    is_active: true,
                },
            ],
        } as Response);

        const user = userEvent.setup();
        render(<AISelector variant="card" />);
        await waitFor(() => {
            expect(screen.getByText('我的本地模型')).toBeInTheDocument();
        });

        // 開啟下拉選單
        await user.click(screen.getByRole('button'));
        // 預設選項應出現
        expect(screen.getByText('DeepSeek V4 Flash（預設）')).toBeInTheDocument();
    });

    it('notifies null when user picks default option', async () => {
        vi.spyOn(global, 'fetch').mockResolvedValue({
            ok: true,
            json: async () => [
                {
                    id: 1,
                    provider: 'local',
                    name: '我的本地模型',
                    has_api_key: false,
                    local_url: 'http://localhost:1234',
                    local_model: 'qwen',
                    is_active: true,
                },
            ],
        } as Response);

        const onConfigChange = vi.fn();
        const user = userEvent.setup();
        render(<AISelector variant="card" onConfigChange={onConfigChange} />);
        await waitFor(() => {
            expect(screen.getByText('我的本地模型')).toBeInTheDocument();
        });

        await user.click(screen.getByRole('button'));
        await user.click(screen.getByText('DeepSeek V4 Flash（預設）'));

        expect(onConfigChange).toHaveBeenCalledWith(null);
    });
});
