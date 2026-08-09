'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useTranslations } from 'next-intl';

/**
 * The Step 7 lead-magnet: a large, no-login-required URL input that any
 * visitor (병원장, 대표, 마케터...) can use to trigger a real live scan of
 * their own site. Submitting routes straight to `/audit/result`, which
 * performs the scan and renders the shareable report.
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
		<section className="flex flex-col items-center gap-5 rounded-3xl border border-white/[0.08] bg-gradient-to-br from-accent/15 via-white/[0.02] to-cyan-400/10 px-6 py-14 text-center">
			<span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-bold text-cyan-300">
				{t('badge')}
			</span>
			<h1 className="whitespace-nowrap text-xl font-extrabold text-white sm:text-3xl md:text-4xl">
				{t('title1')} <span className="text-accent-light">{t('titleHighlight')}</span> {t('title2')}
			</h1>
			<p className="max-w-xl text-sm text-slate-400">{t('description')}</p>
			<form onSubmit={handleSubmit} className="grid w-full max-w-3xl grid-cols-1 gap-2.5 sm:grid-cols-2">
				<input
					type="text"
					required
					value={url}
					onChange={(event) => setUrl(event.target.value)}
					placeholder={t('placeholder')}
					className="w-full rounded-xl border border-white/[0.08] bg-black/40 px-4 py-3.5 text-sm text-slate-100 outline-none focus:border-accent"
				/>
				<button
					type="submit"
					disabled={submitting}
					className="w-full whitespace-nowrap rounded-xl bg-accent px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-accent/30 transition hover:bg-accent-light disabled:opacity-50"
				>
					{submitting ? t('buttonLoading') : t('button')}
				</button>
			</form>
		</section>
	);
}
