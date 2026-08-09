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
	darkMode: 'media',
	content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
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
		},
	},
	plugins: [],
};

export default config;
