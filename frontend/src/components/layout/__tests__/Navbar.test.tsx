import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Navbar } from '../Navbar';

// Mock next/navigation
vi.mock('next/navigation', () => ({
    useRouter: () => ({
        push: vi.fn(),
        replace: vi.fn(),
    }),
    usePathname: () => '/',
}));

// Mock AuthContext
vi.mock('@/contexts/AuthContext', () => ({
    useAuth: () => ({ logout: vi.fn(), isGuest: false }),
}));

// Mock ThemeContext
vi.mock('@/contexts/ThemeContext', () => ({
    useTheme: () => ({ theme: 'dark', setTheme: vi.fn(), resolvedTheme: 'dark' }),
}));

describe('Navbar', () => {
    it('renders with default title', () => {
        render(<Navbar />);
        expect(screen.getByText('玄覺空間')).toBeInTheDocument();
    });

    it('renders navigation items', () => {
        render(<Navbar />);
        expect(screen.getByRole('link', { name: /首頁/i })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /歷史/i })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /設定/i })).toBeInTheDocument();
    });

    it('shows logout button', () => {
        render(<Navbar />);
        expect(screen.getByTitle('登出')).toBeInTheDocument();
    });

    it('toggles mobile menu on click', async () => {
        const user = userEvent.setup();
        render(<Navbar />);

        const menuButton = screen.getByLabelText('開啟選單');
        await user.click(menuButton);

        // After clicking, the aria-label should change
        expect(screen.getByLabelText('關閉選單')).toBeInTheDocument();
    });
});
