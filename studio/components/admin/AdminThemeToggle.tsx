'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/components/theme/ThemeProvider';

export function AdminThemeToggle() {
	const [mounted, setMounted] = useState(false);
	const { theme, toggleTheme } = useTheme();
	const isDark = theme === 'dark';

	useEffect(() => {
		setMounted(true);
	}, []);

	if (!mounted) {
		return (
			<button
				type="button"
				className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-transparent opacity-0 pointer-events-none"
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
			aria-label={isDark ? '라이트 모드로 전환' : '다크 모드로 전환'}
			title={isDark ? '라이트 모드' : '다크 모드'}
			className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 dark:hover:text-slate-100"
		>
			<span className="sr-only">{isDark ? '라이트 모드로 전환' : '다크 모드로 전환'}</span>
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
