'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { AuditCategoryGrid } from '@/components/AuditCategoryGrid';
import { AuditCtaBox } from '@/components/AuditCtaBox';
import { AuditFindingsList } from '@/components/AuditFindingsList';
import { AuditLoading } from '@/components/AuditLoading';
import { AuditScoreHeader } from '@/components/AuditScoreHeader';
import { AuditShareBar } from '@/components/AuditShareBar';
import { ImpactPreviewSection } from '@/components/ImpactPreviewSection';
import { PricingModal } from '@/components/PricingModal';
import type { AuditReport } from '@/lib/site-auditor';

function siteLabelFromUrl(raw: string): string {
	try {
		return new URL(raw).hostname.replace(/^www\./, '') || raw;
	} catch {
		return raw.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0] || raw;
	}
}

export default function AuditResultPage() {
	return (
		<Suspense fallback={null}>
			<AuditResultContent />
		</Suspense>
	);
}

function AuditResultContent() {
	const t = useTranslations('audit');
	const locale = useLocale();
	const searchParams = useSearchParams();
	const url = searchParams.get('url')?.trim() || '';

	const [report, setReport] = useState<AuditReport | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [pricingOpen, setPricingOpen] = useState(false);
	const captureRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!url) {
			setLoading(false);
			setError(t('noUrl'));
			return;
		}

		let cancelled = false;
		setLoading(true);
		setError(null);
		setReport(null);

		(async () => {
			try {
				const res = await fetch('/api/audit/scan', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ url, lang: locale }),
				});
				const data = await res.json();
				if (!res.ok) throw new Error(data.error ?? 'Audit failed.');
				if (!cancelled) setReport(data as AuditReport);
			} catch (err) {
				if (!cancelled) setError((err as Error).message);
			} finally {
				if (!cancelled) setLoading(false);
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [url, locale, t]);

	const shareUrl = typeof window !== 'undefined' ? window.location.href : '';

	return (
		<main className="flex flex-col gap-6">
			<div>
				<Link href="/" className="text-sm text-slate-400 hover:text-white">
					{t('backToHome')}
				</Link>
			</div>

			{loading && <AuditLoading url={url} />}

			{!loading && error && (
				<div className="flex flex-col gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-sm text-rose-300">
					<p className="font-semibold">{t('failedTitle')}</p>
					<p>{error}</p>
					<Link href="/" className="w-fit rounded-lg bg-accent px-4 py-2 text-sm font-bold text-white hover:bg-accent-light">
						{t('retry')}
					</Link>
				</div>
			)}

			{!loading && report && (
				<>
					<div ref={captureRef} className="flex flex-col gap-6 rounded-2xl bg-charcoal p-1">
						<AuditScoreHeader url={report.url} score={report.score} maxScore={report.maxScore} status={report.status} statusLabel={report.statusLabel} />

						<section className="flex flex-col gap-3">
							<h2 className="text-sm font-bold text-slate-200">{t('categoryGridTitle')}</h2>
							<AuditCategoryGrid categories={report.categories} />
						</section>

						<section className="flex flex-col gap-3">
							<h2 className="text-sm font-bold text-slate-200">{t('findingsTitle')}</h2>
							<AuditFindingsList findings={report.findings} />
						</section>

						<ImpactPreviewSection siteName={siteLabelFromUrl(report.url)} />

						<AuditCtaBox onOpenPricing={() => setPricingOpen(true)} />
					</div>

					<AuditShareBar captureRef={captureRef} shareUrl={shareUrl} score={report.score} statusLabel={report.statusLabel} />

					<p className="text-[11px] text-slate-600">
						{t('scannedAt', {
							time: new Date(report.fetchedAt).toLocaleString(locale === 'en' ? 'en-US' : 'ko-KR'),
							status: report.httpStatus ?? '—',
							ms: report.responseTimeMs,
						})}
					</p>
				</>
			)}

			<PricingModal open={pricingOpen} onClose={() => setPricingOpen(false)} />
		</main>
	);
}
