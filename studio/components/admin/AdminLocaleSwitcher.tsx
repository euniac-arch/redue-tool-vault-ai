'use client';

import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

const OPTIONS: { code: 'ko' | 'en'; label: string; flag: string }[] = [
	{ code: 'ko', label: 'KR', flag: '🇰🇷' },
	{ code: 'en', label: 'EN', flag: '🇺🇸' },
];

export function AdminLocaleSwitcher() {
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
		<div className="flex items-center rounded-lg border border-slate-200 bg-white p-0.5 text-xs font-bold">
			{OPTIONS.map((option) => (
				<button
					key={option.code}
					type="button"
					onClick={() => switchTo(option.code)}
					disabled={pending}
					className={`inline-flex items-center gap-1 rounded-md px-2 py-1.5 transition-colors ${
						locale === option.code
							? 'bg-slate-900 text-white'
							: 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
					}`}
					aria-pressed={locale === option.code}
				>
					<span aria-hidden>{option.flag}</span>
					<span>{option.label}</span>
				</button>
			))}
		</div>
	);
}
