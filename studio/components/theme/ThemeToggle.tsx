'use client';

import { Moon, Sun } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTheme } from './ThemeProvider';

export function ThemeToggle() {
	const t = useTranslations('nav');
	const { theme, toggleTheme } = useTheme();
	const isDark = theme === 'dark';

	return (
		<button
			type="button"
			onClick={toggleTheme}
			aria-pressed={isDark}
			aria-label={isDark ? t('themeToLight') : t('themeToDark')}
			className={`relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg transition-all duration-300 ${
				isDark
					? 'border border-slate-800 bg-slate-900 text-slate-300 hover:border-cyan-500/40 hover:bg-[#0E162B] hover:text-cyan-300'
					: 'border border-slate-200 bg-white text-slate-600 shadow-sm hover:border-slate-300 hover:bg-slate-50 hover:text-amber-500'
			}`}
		>
			<span className="sr-only">{isDark ? t('themeToLight') : t('themeToDark')}</span>
			<Sun
				className={`absolute h-[18px] w-[18px] transition-all duration-300 ${
					isDark ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-50 opacity-0'
				}`}
				strokeWidth={1.75}
				aria-hidden
			/>
			<Moon
				className={`absolute h-[18px] w-[18px] transition-all duration-300 ${
					isDark ? '-rotate-90 scale-50 opacity-0' : 'rotate-0 scale-100 opacity-100'
				}`}
				strokeWidth={1.75}
				aria-hidden
			/>
		</button>
	);
}
