'use client';

import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

const OPTIONS: { code: 'ko' | 'en'; label: string }[] = [
	{ code: 'ko', label: 'KR' },
	{ code: 'en', label: 'EN' },
];

interface LocaleSwitcherProps {
	variant?: 'dark' | 'light';
}

export function LocaleSwitcher({ variant = 'dark' }: LocaleSwitcherProps) {
	const locale = useLocale();
	const router = useRouter();
	const [pending, startTransition] = useTransition();
	const isLight = variant === 'light';

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
				isLight ? 'border border-zinc-200 bg-zinc-50' : 'border border-white/[0.08] bg-white/5'
			}`}
		>
			{OPTIONS.map((option) => (
				<button
					key={option.code}
					onClick={() => switchTo(option.code)}
					disabled={pending}
					className={`rounded-full px-2.5 py-1 transition-colors duration-200 ${
						locale === option.code
							? isLight
								? 'bg-zinc-900 text-white'
								: 'bg-accent text-white'
							: isLight
								? 'text-zinc-500 hover:text-zinc-900'
								: 'text-slate-400 hover:text-white'
					}`}
				>
					{option.label}
				</button>
			))}
		</div>
	);
}
