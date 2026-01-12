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
        },
        foreground: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
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
        serif: ['Noto Serif TC', 'serif'],
        sans: ['Inter', 'sans-serif'],
        // Legacy support
        chinese: ['Noto Serif TC', 'serif'],
      },
    },
  },
  plugins: [],
};
