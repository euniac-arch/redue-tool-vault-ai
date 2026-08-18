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
			},
			keyframes: {
				'radar-hover-in': {
					'0%': { opacity: '0', transform: 'scale(0.95)' },
					'100%': { opacity: '1', transform: 'scale(1)' },
				},
			},
			animation: {
				'radar-hover-in': 'radar-hover-in 200ms ease-out',
			},
		},
	},
	plugins: [],
};

export default config;
