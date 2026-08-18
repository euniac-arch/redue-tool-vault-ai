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
			className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition-all duration-300 hover:border-slate-300 hover:bg-slate-50 hover:text-amber-500 dark:border-white/[0.08] dark:bg-white/5 dark:text-slate-300 dark:shadow-none dark:hover:bg-white/10 dark:hover:text-indigo-200"
		>
			<span className="sr-only dark:hidden">{t('themeToDark')}</span>
			<span className="sr-only hidden dark:inline">{t('themeToLight')}</span>
			<Sun
				className="absolute h-[18px] w-[18px] -rotate-90 scale-50 opacity-0 transition-all duration-300 dark:rotate-0 dark:scale-100 dark:opacity-100"
				strokeWidth={1.75}
				aria-hidden
			/>
			<Moon
				className="absolute h-[18px] w-[18px] rotate-0 scale-100 opacity-100 transition-all duration-300 dark:-rotate-90 dark:scale-50 dark:opacity-0"
				strokeWidth={1.75}
				aria-hidden
			/>
		</button>
	);
}
