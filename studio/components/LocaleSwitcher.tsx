'use client';

import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

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
		if (code === locale) return;
		await fetch('/api/locale', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ locale: code }),
		});
		startTransition(() => {
			router.refresh();
		});
	}

	return (
		<div
			className={`flex items-center rounded-full p-0.5 text-xs font-bold ${
				forceLight
					? 'border border-zinc-200 bg-zinc-50'
					: 'border border-slate-200 bg-slate-50 dark:border-white/[0.08] dark:bg-white/5'
			}`}
		>
			{OPTIONS.map((option) => (
				<button
					key={option.code}
					onClick={() => switchTo(option.code)}
					disabled={pending}
					className={`rounded-full px-2.5 py-1 transition-colors duration-200 ${
						locale === option.code
							? forceLight
								? 'bg-zinc-900 text-white'
								: 'bg-slate-900 text-white dark:bg-accent'
							: forceLight
								? 'text-zinc-500 hover:text-zinc-900'
								: 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
					}`}
				>
					{option.label}
				</button>
			))}
		</div>
	);
}
