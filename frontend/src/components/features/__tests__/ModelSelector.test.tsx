import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import {
    ModelSelector,
    DEFAULT_MODEL_DISPLAY_NAME,
    getAIProviderDisplayName,
} from '../ModelSelector';
import type { ModelSelection } from '@/hooks/useAIModels';

const authMock = vi.hoisted(() => ({ isGuest: false }));

vi.mock('@/contexts/AuthContext', () => ({
    useAuth: () => ({ isGuest: authMock.isGuest }),
}));

const MODELS_RESPONSE = {
    models: [
        {
            connection_id: null,
            connection_name: 'Agnes 預設',
            model_id: 'agnes-2.0-flash',
            label: null,
            source: 'system',
            params: null,
        },
        {
            connection_id: 7,
            connection_name: '我的 OpenRouter',
            model_id: 'qwen-2.5',
            label: null,
            source: 'user',
            params: null,
        },
    ],
    default: { connection_id: null, model_id: 'agnes-2.0-flash' },
};

function mockModelsApi(data: unknown = MODELS_RESPONSE) {
    return vi.spyOn(global, 'fetch').mockImplementation((input: unknown) => {
        const url = String(input);
        if (url.includes('/api/settings/ai/models')) {
            return Promise.resolve({ ok: true, json: async () => data } as Response);
        }
        return Promise.resolve({ ok: true, json: async () => ({}) } as Response);
    });
}

/** 受控包裝：模擬頁面持有選擇狀態 */
function Harness(props: { initial?: ModelSelection | null }) {
    const [value, setValue] = useState<ModelSelection | null>(props.initial ?? null);
    return <ModelSelector variant="card" value={value} onChange={setValue} />;
}

describe('ModelSelector（連線×模型選擇器）', () => {
    beforeEach(() => {
        authMock.isGuest = false;
        vi.restoreAllMocks();
    });

    it('下拉依「系統免費模型／我的服務」分組列出模型', async () => {
        mockModelsApi();
        const user = userEvent.setup();

        render(<Harness />);
        await waitFor(() => expect(screen.getByRole('button', { name: /AI 解盤模型/ })).toBeTruthy());

        await user.click(screen.getByRole('button', { name: /AI 解盤模型/ }));
        expect(screen.getByRole('listbox')).toBeTruthy();
        expect(screen.getByText('系統免費模型')).toBeTruthy();
        expect(screen.getByRole('option', { name: /agnes-2\.0-flash/ })).toBeTruthy();
        expect(screen.getByRole('option', { name: /我的 OpenRouter · qwen-2\.5/ })).toBeTruthy();
    });

    it('點選模型 → onChange 回傳 (connection_id, model_id)', async () => {
        mockModelsApi();
        const user = userEvent.setup();
        const onChange = vi.fn();

        render(<ModelSelector variant="card" value={null} onChange={onChange} />);
        await waitFor(() => screen.getByRole('button', { name: /AI 解盤模型/ }));
        await user.click(screen.getByRole('button', { name: /AI 解盤模型/ }));
        await user.click(screen.getByRole('option', { name: /我的 OpenRouter · qwen-2\.5/ }));

        expect(onChange).toHaveBeenCalledWith({ connectionId: 7, modelId: 'qwen-2.5' });
    });

    it('選擇系統免費模型 → connectionId 為 null', async () => {
        mockModelsApi();
        const user = userEvent.setup();
        const onChange = vi.fn();

        render(<ModelSelector variant="card" value={null} onChange={onChange} />);
        await waitFor(() => screen.getByRole('button', { name: /AI 解盤模型/ }));
        await user.click(screen.getByRole('button', { name: /AI 解盤模型/ }));
        await user.click(screen.getByRole('option', { name: /agnes-2\.0-flash/ }));

        expect(onChange).toHaveBeenCalledWith({ connectionId: null, modelId: 'agnes-2.0-flash' });
    });

    it('value 有值時顯示當前模型名稱', async () => {
        mockModelsApi();
        render(
            <ModelSelector
                variant="card"
                value={{ connectionId: 7, modelId: 'qwen-2.5' }}
                onChange={() => {}}
            />
        );
        await waitFor(() => expect(screen.getAllByText(/我的 OpenRouter · qwen-2\.5/).length).toBeGreaterThan(0));
    });

    it('value 為 null 時顯示「我的預設模型」（後端 default）', async () => {
        mockModelsApi();
        render(<Harness />);
        await waitFor(() =>
            expect(screen.getAllByText(/agnes-2\.0-flash/).length).toBeGreaterThan(0)
        );
    });

    it('訪客唯讀：固定系統免費模型、不可開啟清單', async () => {
        authMock.isGuest = true;
        mockModelsApi();

        render(<Harness />);
        await waitFor(() => screen.getByRole('button', { name: /AI 解盤模型/ }));
        expect(screen.getByRole('button', { name: /AI 解盤模型/ }).hasAttribute('disabled')).toBe(true);
        expect(screen.getByText(/訪客固定使用系統免費模型/)).toBeTruthy();
    });

    it('分享頁相容：getAIProviderDisplayName 保留舊語意', () => {
        expect(getAIProviderDisplayName('default', 'agnes-2.0-flash')).toBe(DEFAULT_MODEL_DISPLAY_NAME);
        expect(getAIProviderDisplayName(null, null)).toBe(DEFAULT_MODEL_DISPLAY_NAME);
        expect(getAIProviderDisplayName('opencode', 'x')).toBe(DEFAULT_MODEL_DISPLAY_NAME);
        expect(getAIProviderDisplayName('openai', 'gpt-5.1')).toContain('gpt-5.1');
    });

    it('compact 變體：對話窗內可開啟同一份清單', async () => {
        mockModelsApi();
        const user = userEvent.setup();

        render(<ModelSelector variant="compact" value={null} onChange={() => {}} />);
        await waitFor(() => screen.getAllByRole('button', { name: /agnes-2\.0-flash/ }).length > 0);
        await user.click(screen.getAllByRole('button', { name: /agnes-2\.0-flash/ })[0]);
        expect(screen.getByRole('listbox')).toBeTruthy();
    });
});
