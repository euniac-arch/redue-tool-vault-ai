'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { HEADER_ICON_BUTTON_CLASS } from '@/lib/ui/header-chrome';
import { useTheme } from './ThemeProvider';

export function ThemeToggle() {
	const [mounted, setMounted] = useState(false);
	const t = useTranslations('nav');
	const { theme, toggleTheme } = useTheme();
	const isDark = theme === 'dark';

	useEffect(() => {
		setMounted(true);
	}, []);

	if (!mounted) {
		return (
			<button
				type="button"
				className={`${HEADER_ICON_BUTTON_CLASS} overflow-hidden border-transparent opacity-0`}
				aria-hidden="true"
				tabIndex={-1}
			/>
		);
	}

	return (
		<button
			type="button"
			onClick={toggleTheme}
			aria-pressed={isDark}
			aria-label={isDark ? t('themeToLight') : t('themeToDark')}
			className={`relative overflow-hidden ${HEADER_ICON_BUTTON_CLASS} ${
				isDark
					? 'text-slate-300 hover:text-cyan-300'
					: 'text-slate-600 hover:text-amber-500'
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
