'use client';

import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { isSupportedLocale, persistLocaleCookie } from '@/i18n/locales';

const OPTIONS: { code: 'ko' | 'en'; label: string }[] = [
	{ code: 'ko', label: 'KR' },
	{ code: 'en', label: 'EN' },
];

interface LocaleSwitcherProps {
	/** @deprecated Prefer Tailwind `dark:` classes. `light` forces the admin-style chrome. */
	variant?: 'dark' | 'light';
}

export function LocaleSwitcher({ variant = 'dark' }: LocaleSwitcherProps) {
	const locale = useLocale();
	const router = useRouter();
	const [pending, startTransition] = useTransition();
	const forceLight = variant === 'light';

	async function switchTo(code: string) {
		if (code === locale || !isSupportedLocale(code)) return;
		persistLocaleCookie(code);
		try {
			const res = await fetch('/api/locale', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'same-origin',
				body: JSON.stringify({ locale: code }),
			});
			if (!res.ok) {
				console.warn('[LocaleSwitcher] locale API responded', res.status);
			}
		} catch (error) {
			console.warn('[LocaleSwitcher] locale API failed; using client cookie', error);
		}
		startTransition(() => {
			router.refresh();
		});
	}

	return (
		<div
			className={`flex h-9 shrink-0 items-center gap-0.5 rounded-full border p-1 text-[11px] font-bold tracking-wide ${
				forceLight
					? 'border-zinc-200 bg-zinc-50'
					: 'border-slate-200 bg-slate-100/80 dark:border-slate-700/60 dark:bg-slate-800/60'
			}`}
		>
			{OPTIONS.map((option) => (
				<button
					key={option.code}
					onClick={() => void switchTo(option.code)}
					disabled={pending}
					aria-pressed={locale === option.code}
					className={`flex h-7 min-w-[30px] items-center justify-center rounded-full px-2 transition-all duration-200 ${
						locale === option.code
							? forceLight
								? 'bg-white font-semibold text-zinc-900 shadow-sm'
								: 'bg-white font-semibold text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white'
							: forceLight
								? 'text-zinc-400 hover:text-zinc-700'
								: 'text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-200'
					}`}
				>
					{option.label}
				</button>
			))}
		</div>
	);
}
