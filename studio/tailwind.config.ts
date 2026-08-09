import type { Config } from 'tailwindcss';

const config: Config = {
	darkMode: 'media',
	content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
	theme: {
		extend: {
			colors: {
				accent: {
					DEFAULT: '#635bff',
					light: '#8b85ff',
				},
				charcoal: '#0C0D0E',
			},
			fontFamily: {
				mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
			},
		},
	},
	plugins: [],
};

export default config;
