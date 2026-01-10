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

describe('Navbar', () => {
    it('renders with default title', () => {
        render(<Navbar />);
        expect(screen.getByText('玄覺空間')).toBeInTheDocument();
    });

    it('renders custom page title', () => {
        render(<Navbar pageTitle="六爻占卜" />);
        expect(screen.getByText('六爻占卜')).toBeInTheDocument();
    });

    it('shows back button when showBackButton is true', () => {
        render(<Navbar showBackButton />);
        expect(screen.getByLabelText('返回')).toBeInTheDocument();
    });

    it('hides back button by default', () => {
        render(<Navbar />);
        expect(screen.queryByLabelText('返回')).not.toBeInTheDocument();
    });

    it('renders navigation items', () => {
        render(<Navbar />);
        expect(screen.getByRole('link', { name: /首頁/i })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /歷史/i })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /設定/i })).toBeInTheDocument();
    });

    it('shows logout button', () => {
        render(<Navbar />);
        expect(screen.getByRole('button', { name: /登出/i })).toBeInTheDocument();
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
