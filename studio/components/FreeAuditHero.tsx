'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useTranslations } from 'next-intl';

/**
 * Persuasive B2B hero: outcome-led headline → URL scan CTA.
 * Value cards sit outside this box on the landing page.
 */
export function FreeAuditHero() {
	const t = useTranslations('hero');
	const router = useRouter();
	const [url, setUrl] = useState('');
	const [submitting, setSubmitting] = useState(false);

	function handleSubmit(event: React.FormEvent) {
		event.preventDefault();
		const trimmed = url.trim();
		if (!trimmed) return;
		setSubmitting(true);
		const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
		router.push(`/audit/result?url=${encodeURIComponent(normalized)}`);
	}

	return (
		<section className="flex flex-col items-center rounded-3xl border border-white/[0.08] bg-gradient-to-br from-accent/20 via-[#0B1220] to-indigo-950/40 px-5 py-12 text-center sm:px-8 sm:py-14">
			<span className="rounded-full border border-accent/40 bg-accent/15 px-3 py-1 text-xs font-bold text-accent-light">
				{t('badge')}
			</span>

			<h1 className="mt-5 max-w-4xl text-2xl font-extrabold leading-snug tracking-tight text-white sm:text-3xl md:text-4xl md:leading-tight">
				<span className="block">{t('titleLine1')}</span>
				<span className="mt-1 block font-black text-white">{t('titleLine2')}</span>
			</h1>

			<p className="mt-4 max-w-2xl break-keep text-sm leading-relaxed text-slate-300 sm:text-base">
				{t('description')}
			</p>

			<form
				onSubmit={handleSubmit}
				className="mt-8 grid w-full max-w-3xl grid-cols-1 gap-2.5 sm:grid-cols-[1fr_auto]"
			>
				<input
					type="text"
					required
					value={url}
					onChange={(event) => setUrl(event.target.value)}
					placeholder={t('placeholder')}
					className="w-full rounded-xl border border-white/[0.1] bg-black/50 px-4 py-3.5 text-sm text-slate-100 outline-none ring-accent/0 transition focus:border-accent focus:ring-2 focus:ring-accent/30"
				/>
				<button
					type="submit"
					disabled={submitting}
					className="w-full whitespace-nowrap rounded-xl bg-accent px-7 py-3.5 text-sm font-bold text-white shadow-lg shadow-accent/35 transition hover:bg-accent-light disabled:opacity-50 sm:w-auto"
				>
					{submitting ? t('buttonLoading') : t('button')}
				</button>
			</form>

			<p className="mt-3 text-[11px] text-slate-500">{t('formHint')}</p>
		</section>
	);
}
