import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // CSS variable-based semantic colors (matching apps/web)
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        // Brand colors for marketing pages (used in existing content)
        iron: {
          50: '#f7f7f6',
          100: '#e3e3e1',
          200: '#c7c7c3',
          300: '#a4a49d',
          400: '#818177',
          500: '#666660',
          600: '#51514c',
          700: '#43433f',
          800: '#383835',
          900: '#31312e',
          950: '#1a1a18',
        },
        brass: {
          50: '#fdfbea',
          100: '#faf5c7',
          200: '#f6ea91',
          300: '#f0d952',
          400: '#e9c523',
          500: '#d9ad16',
          600: '#bb8710',
          700: '#956210',
          800: '#7b4e15',
          900: '#694017',
          950: '#3d2109',
        },
        gunmetal: {
          50: '#f4f6f7',
          100: '#e3e7ea',
          200: '#c9d2d7',
          300: '#a4b2bb',
          400: '#778a97',
          500: '#5c6f7c',
          600: '#4f5d69',
          700: '#444f58',
          800: '#3c444c',
          900: '#353b42',
          950: '#21262b',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        body: ['var(--font-body)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
        sans: ['system-ui', '-apple-system', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.6s ease-out forwards',
        'slide-up': 'slideUp 0.6s ease-out forwards',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
