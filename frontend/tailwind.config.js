/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
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
        gold: '#d4af37',
      },
      fontFamily: {
        chinese: ['Noto Serif TC', 'serif'],
      },
    },
  },
  plugins: [],
};
