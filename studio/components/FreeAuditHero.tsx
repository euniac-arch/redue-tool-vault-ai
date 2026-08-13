'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { AUDIT_HERO_ID, AUDIT_URL_INPUT_ID } from '@/components/landing/scroll-to-audit';

function normalizeAuditUrl(raw: string): string {
	const trimmed = raw.trim();
	if (!trimmed) return '';
	if (/^https?:\/\//i.test(trimmed)) return trimmed;
	return `https://${trimmed.replace(/^\/+/, '')}`;
}

function buildResultHref(url: string, extraQuery?: Record<string, string>): string {
	const params = new URLSearchParams();
	params.set('url', url);
	if (extraQuery) {
		for (const [key, value] of Object.entries(extraQuery)) {
			if (value) params.set(key, value);
		}
	}
	return `/audit/result?${params.toString()}`;
}

function isOnAuditResult(): boolean {
	return typeof window !== 'undefined' && window.location.pathname.startsWith('/audit/result');
}

/**
 * Persuasive B2B hero: outcome-led headline → URL scan CTA.
 * Value cards sit outside this box on the landing page.
 *
 * `initialUrl` + `autoSubmit` power `/diagnose?domain=&target_id=` from the admin list.
 */
export function FreeAuditHero({
	initialUrl = '',
	extraQuery,
	autoSubmit = false,
}: {
	initialUrl?: string;
	extraQuery?: Record<string, string>;
	autoSubmit?: boolean;
} = {}) {
	const t = useTranslations('hero');
	const router = useRouter();
	const [url, setUrl] = useState(() => normalizeAuditUrl(initialUrl));
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const extraQueryRef = useRef(extraQuery);
	extraQueryRef.current = extraQuery;
	const watchdogRef = useRef<number | null>(null);
	const inFlightRef = useRef(false);

	useEffect(() => {
		const normalized = normalizeAuditUrl(initialUrl);
		if (normalized) setUrl(normalized);
	}, [initialUrl]);

	useEffect(() => {
		return () => {
			if (watchdogRef.current != null) {
				window.clearTimeout(watchdogRef.current);
				watchdogRef.current = null;
			}
		};
	}, []);

	const handleDiagnose = useCallback(
		(raw: string) => {
			const normalized = normalizeAuditUrl(raw);
			if (!normalized) {
				inFlightRef.current = false;
				setError(t('invalidUrl'));
				setSubmitting(false);
				return;
			}
			if (inFlightRef.current) return;
			inFlightRef.current = true;

			setUrl(normalized);
			setError(null);
			setSubmitting(true);

			const href = buildResultHref(normalized, extraQueryRef.current);
			let navigated = false;

			try {
				router.replace(href);
				navigated = true;
			} catch (err) {
				setError(err instanceof Error && err.message ? err.message : t('launchError'));
			} finally {
				if (!navigated) {
					inFlightRef.current = false;
					setSubmitting(false);
				}
			}

			if (!navigated) return;

			if (watchdogRef.current != null) window.clearTimeout(watchdogRef.current);
			watchdogRef.current = window.setTimeout(() => {
				watchdogRef.current = null;
				if (isOnAuditResult()) return;
				try {
					window.location.assign(href);
				} catch {
					inFlightRef.current = false;
					setError(t('launchError'));
					setSubmitting(false);
				}
			}, 1200);
		},
		[router, t],
	);

	useEffect(() => {
		if (!autoSubmit) return;
		const normalized = normalizeAuditUrl(initialUrl);
		if (!normalized) return;

		let cancelled = false;
		const timer = window.setTimeout(() => {
			if (cancelled) return;
			handleDiagnose(normalized);
		}, 0);

		return () => {
			cancelled = true;
			window.clearTimeout(timer);
		};
	}, [autoSubmit, initialUrl, handleDiagnose]);

	function handleSubmit(event: React.FormEvent) {
		event.preventDefault();
		handleDiagnose(url);
	}

	return (
		<section
			id={AUDIT_HERO_ID}
			className="scroll-mt-24 flex flex-col items-center rounded-3xl border border-white/[0.08] bg-gradient-to-br from-accent/20 via-[#0B1220] to-indigo-950/40 px-5 py-12 text-center sm:px-8 sm:py-14"
		>
			<span className="rounded-full border border-accent/40 bg-accent/15 px-3 py-1 text-xs font-bold text-accent-light">
				{t('badge')}
			</span>

			<h1 className="mt-5 max-w-4xl text-2xl font-extrabold leading-snug tracking-tight text-white sm:text-3xl md:text-4xl md:leading-tight">
				<span className="block">{t('titleLine1')}</span>
				<span className="mt-1 block font-black text-white">{t('titleLine2')}</span>
			</h1>

			<p className="mt-4 max-w-2xl break-keep text-sm leading-relaxed text-slate-300 sm:text-base">
				<span className="block">{t('descriptionLine1')}</span>
				<span className="mt-2 block">{t('descriptionLine2')}</span>
			</p>

			<form
				onSubmit={handleSubmit}
				className="mt-8 grid w-full max-w-3xl grid-cols-1 gap-2.5 sm:grid-cols-[1fr_auto]"
			>
				<input
					id={AUDIT_URL_INPUT_ID}
					type="text"
					required
					value={url}
					aria-label={t('placeholder')}
					onChange={(event) => {
						setUrl(event.target.value);
						if (error) setError(null);
					}}
					placeholder={t('placeholder')}
					readOnly={autoSubmit && submitting}
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

			{error ? (
				<p
					role="alert"
					className="mt-3 max-w-3xl rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200"
				>
					{error}
				</p>
			) : (
				<p className="mt-3 text-[11px] text-slate-500">{t('formHint')}</p>
			)}
		</section>
	);
}
