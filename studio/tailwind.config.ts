import type { Config } from 'tailwindcss';

const pretendardStack = [
	'Pretendard',
	'-apple-system',
	'BlinkMacSystemFont',
	'system-ui',
	'Roboto',
	'Helvetica Neue',
	'Segoe UI',
	'Apple SD Gothic Neo',
	'Noto Sans KR',
	'Malgun Gothic',
	'sans-serif',
];

const config: Config = {
	darkMode: 'class',
	content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
	safelist: [
		'border-indigo-500/30',
		'border-blue-500/30',
		'border-emerald-500/30',
		'border-amber-500/30',
		'border-rose-500/30',
		'dark:border-indigo-500/30',
		'dark:border-blue-500/30',
		'dark:border-emerald-500/30',
		'dark:border-amber-500/30',
		'dark:border-rose-500/30',
		'dark:!border-indigo-500/30',
		'dark:!border-emerald-500/30',
		'dark:!border-amber-500/30',
		'dark:!border-rose-500/30',
		'bg-indigo-500/10',
		'bg-blue-500/10',
		'bg-emerald-500/10',
		'bg-amber-500/10',
		'bg-rose-500/10',
		'ring-2',
		'ring-rose-500',
		'ring-offset-2',
		'animate-pulse',
	],
	theme: {
		// Replace (not only extend) so Tailwind Preflight + font-sans use Pretendard site-wide.
		fontFamily: {
			sans: pretendardStack,
			mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
		},
		extend: {
			colors: {
				accent: {
					DEFAULT: '#635bff',
					light: '#8b85ff',
				},
				charcoal: '#0C0D0E',
				background: 'hsl(var(--background) / <alpha-value>)',
				foreground: 'hsl(var(--foreground) / <alpha-value>)',
				card: {
					DEFAULT: 'hsl(var(--card) / <alpha-value>)',
					foreground: 'hsl(var(--card-foreground) / <alpha-value>)',
				},
				primary: {
					DEFAULT: 'hsl(var(--primary) / <alpha-value>)',
					foreground: 'hsl(var(--primary-foreground) / <alpha-value>)',
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary) / <alpha-value>)',
					foreground: 'hsl(var(--secondary-foreground) / <alpha-value>)',
				},
				muted: {
					DEFAULT: 'hsl(var(--muted) / <alpha-value>)',
					foreground: 'hsl(var(--muted-foreground) / <alpha-value>)',
				},
				border: 'hsl(var(--border) / <alpha-value>)',
				ring: 'hsl(var(--ring) / <alpha-value>)',
			},
			keyframes: {
				'radar-hover-in': {
					'0%': { opacity: '0', transform: 'scale(0.95)' },
					'100%': { opacity: '1', transform: 'scale(1)' },
				},
				'strategy-fade-in': {
					'0%': { opacity: '0', transform: 'translateY(8px)' },
					'100%': { opacity: '1', transform: 'translateY(0)' },
				},
				'strategy-cta-glow': {
					'0%, 100%': { boxShadow: '0 4px 14px 0 rgba(14, 165, 233, 0.28)' },
					'50%': { boxShadow: '0 4px 22px 2px rgba(14, 165, 233, 0.08)' },
				},
				'strategy-progress': {
					'0%': { transform: 'translateX(-120%)' },
					'100%': { transform: 'translateX(280%)' },
				},
				'strategy-shimmer': {
					'0%': { transform: 'translateX(-120%)' },
					'100%': { transform: 'translateX(220%)' },
				},
			},
			animation: {
				'radar-hover-in': 'radar-hover-in 200ms ease-out',
				'strategy-fade-in': 'strategy-fade-in 420ms ease-out both',
				'strategy-cta-glow': 'strategy-cta-glow 1.6s ease-in-out infinite',
				'strategy-progress': 'strategy-progress 1.35s ease-in-out infinite',
				'strategy-shimmer': 'strategy-shimmer 1.6s ease-in-out infinite',
			},
		},
	},
	plugins: [],
};

export default config;
