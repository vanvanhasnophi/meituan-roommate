/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#FAF7F3',
        surface: '#FFFFFF',
        line: '#EDE6DC',
        ink: {
          DEFAULT: '#241F1A',
          soft: '#5C534A',
          mute: '#8B8078',
        },
        brand: {
          50: '#FDF4EF',
          100: '#FAE4D9',
          200: '#F4C7B0',
          300: '#EDA382',
          400: '#E37F58',
          500: '#D4613A',
          600: '#B94C29',
          700: '#963C21',
          800: '#7A331F',
          900: '#642D1D',
        },
        accent: {
          50: '#EEF7F5',
          100: '#D5EBE6',
          300: '#8FC9C0',
          500: '#2E8C81',
          600: '#1F7168',
          700: '#1A5C55',
        },
        warn: {
          50: '#FEF7EC',
          300: '#F3C77A',
          500: '#D99423',
          700: '#9A6712',
        },
        danger: {
          50: '#FDF0EF',
          300: '#EFA9A2',
          500: '#C9483C',
          700: '#9A352C',
        },
      },
      fontFamily: {
        sans: [
          'ui-sans-serif',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          '"PingFang SC"',
          '"Hiragino Sans GB"',
          '"Microsoft YaHei"',
          '"Noto Sans SC"',
          'sans-serif',
        ],
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.125rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        card: '0 1px 2px rgba(36,31,26,0.04), 0 8px 24px -12px rgba(36,31,26,0.12)',
        pop: '0 12px 40px -12px rgba(36,31,26,0.28)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.97)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.28s ease-out both',
        'scale-in': 'scale-in 0.18s ease-out both',
      },
    },
  },
  plugins: [],
};
