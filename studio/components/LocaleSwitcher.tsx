'use client';

import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

const OPTIONS: { code: 'ko' | 'en'; label: string }[] = [
	{ code: 'ko', label: 'KR' },
	{ code: 'en', label: 'EN' },
];

export function LocaleSwitcher() {
	const locale = useLocale();
	const router = useRouter();
	const [pending, startTransition] = useTransition();

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
		<div className="flex items-center rounded-full border border-white/[0.08] bg-white/5 p-0.5 text-xs font-bold">
			{OPTIONS.map((option) => (
				<button
					key={option.code}
					onClick={() => switchTo(option.code)}
					disabled={pending}
					className={`rounded-full px-2.5 py-1 transition ${
						locale === option.code ? 'bg-accent text-white' : 'text-slate-400 hover:text-white'
					}`}
				>
					{option.label}
				</button>
			))}
		</div>
	);
}
