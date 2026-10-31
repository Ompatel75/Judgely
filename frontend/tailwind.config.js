/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#0B0D10',
        surface: {
          DEFAULT: '#111418',
          subtle: '#171B21',
          elevated: '#1E232B',
          hover: '#252B35',
        },
        border: {
          DEFAULT: 'rgba(255, 255, 255, 0.08)',
          subtle: 'rgba(255, 255, 255, 0.05)',
          strong: 'rgba(255, 255, 255, 0.16)',
        },
        primary: {
          DEFAULT: '#10B981', // Restrained emerald
          hover: '#059669',
          subtle: 'rgba(16, 185, 129, 0.12)',
          border: 'rgba(16, 185, 129, 0.28)',
          foreground: '#FFFFFF',
        },
        text: {
          primary: '#E6E8EB',
          secondary: '#A0A7B1',
          muted: '#656D76',
        },
        verdict: {
          ac: '#22C55E',
          wa: '#EF4444',
          tle: '#F59E0B',
          mle: '#D97706',
          re: '#F97316',
          ce: '#A855F7',
          pending: '#94A3B8',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
        mono: [
          'JetBrains Mono',
          'Fira Code',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Monaco',
          'monospace',
        ],
      },
      boxShadow: {
        subtle: '0 1px 2px 0 rgba(0, 0, 0, 0.4)',
        elevation: '0 4px 12px 0 rgba(0, 0, 0, 0.5)',
        'emerald-focus': '0 0 0 2px #0B0D10, 0 0 0 4px rgba(16, 185, 129, 0.4)',
      },
      animation: {
        'pulse-subtle': 'pulseSubtle 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 200ms ease-out',
        'slide-up': 'slideUp 200ms ease-out',
      },
      keyframes: {
        pulseSubtle: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}

