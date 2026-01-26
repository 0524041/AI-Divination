/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: {
          primary: 'var(--bg-primary)',
          secondary: 'var(--bg-secondary)',
          card: 'var(--bg-card)',
          'card-hover': 'var(--bg-card-hover)',
        },
        foreground: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
          accent: 'var(--text-accent)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          hover: 'var(--accent-hover)',
          light: 'var(--accent-light)',
          secondary: 'var(--accent-secondary)',
        },
        border: {
          DEFAULT: 'var(--border)',
          accent: 'var(--border-accent)',
        },
        // Legacy support
        gold: '#d4af37',
        primary: {
          50: '#fef7ee',
          100: '#fcecd8',
          200: '#f8d5b0',
          300: '#f3b87d',
          400: '#ed9249',
          500: '#e87425',
          600: '#d95a1b',
          700: '#b44318',
          800: '#90361b',
          900: '#742f19',
        },
      },
      fontFamily: {
        serif: ['Cinzel', 'Playfair Display', 'Noto Serif TC', 'serif'],
        sans: ['Outfit', 'Inter', 'sans-serif'],
        heading: ['Cinzel', 'serif'],
        body: ['Outfit', 'sans-serif'],
        // Legacy support
        chinese: ['Noto Serif TC', 'serif'],
      },
      animation: {
        'spin-slow': 'spin 3s linear infinite',
        'float': 'float 6s ease-in-out infinite',
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        }
      }
    },
  },
  plugins: [],
};
