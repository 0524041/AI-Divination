import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '../Button';

describe('Button', () => {
    it('renders with children', () => {
        render(<Button>Click me</Button>);
        expect(screen.getByRole('button')).toHaveTextContent('Click me');
    });

    it('applies gold variant by default', () => {
        render(<Button>Test</Button>);
        const button = screen.getByRole('button');
        // Gold variant uses gradient background
        expect(button.className).toContain('bg-gradient-to-r');
    });

    it('applies outline variant when specified', () => {
        render(<Button variant="outline">Test</Button>);
        const button = screen.getByRole('button');
        // Outline variant has bg-transparent class
        expect(button.className).toContain('bg-transparent');
    });

    it('shows loading state', () => {
        render(<Button loading>Submit</Button>);
        const button = screen.getByRole('button');
        expect(button).toBeDisabled();
        // Loading spinner should be present
        expect(button.querySelector('.animate-spin')).toBeInTheDocument();
    });

    it('handles click events', async () => {
        const user = userEvent.setup();
        let clicked = false;
        render(<Button onClick={() => { clicked = true; }}>Click</Button>);

        await user.click(screen.getByRole('button'));
        expect(clicked).toBe(true);
    });

    it('is disabled when disabled prop is true', () => {
        render(<Button disabled>Disabled</Button>);
        expect(screen.getByRole('button')).toBeDisabled();
    });

    it('renders with icon', () => {
        render(<Button icon={<span data-testid="icon">★</span>}>With Icon</Button>);
        expect(screen.getByTestId('icon')).toBeInTheDocument();
    });
});
