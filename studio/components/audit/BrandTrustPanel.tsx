'use client';

import { useLocale, useTranslations } from 'next-intl';
import type { GeoNarrativeReport } from '@/lib/audit/geo-narrative';
import { resolveExternalReputation } from '@/lib/audit/geo-score';
import type { AuditReport } from '@/lib/site-auditor';

interface BrandTrustPanelProps {
	report: AuditReport;
	reportData?: GeoNarrativeReport | null;
}

function napTone(rate: number): string {
	if (rate >= 90) return 'bg-emerald-500';
	if (rate >= 70) return 'bg-amber-500';
	return 'bg-rose-500';
}

export function BrandTrustPanel({ report, reportData }: BrandTrustPanelProps) {
	const t = useTranslations('audit.brandTrust');
	const locale = useLocale();
	const lang = locale === 'en' ? 'en' : 'ko';
	const { brandTrust } = resolveExternalReputation(report, reportData, lang);

	return (
		<section className="audit-report-section flex flex-col gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 sm:p-6">
			<h2 className="text-lg font-extrabold text-white">{t('title')}</h2>

			<div>
				<p className="text-[11px] uppercase tracking-wide text-slate-500">{t('keywordsLabel')}</p>
				<div className="mt-2 flex flex-wrap items-center gap-1.5">
					{brandTrust.keywords.map((kw) => (
						<span
							key={kw}
							className="rounded-md border border-cyan-500/20 bg-cyan-500/10 px-2 py-0.5 text-[11px] text-cyan-300"
						>
							#{kw}
						</span>
					))}
					{brandTrust.missingKeyword && (
						<span className="rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[11px] font-semibold text-rose-300">
							{t('missingKeywordLabel')} &lsquo;{brandTrust.missingKeyword}&rsquo;
						</span>
					)}
				</div>
			</div>

			<div>
				<div className="flex items-center justify-between">
					<p className="text-[11px] uppercase tracking-wide text-slate-500">{t('napLabel')}</p>
					<p className="text-sm font-extrabold tabular-nums text-slate-100">{brandTrust.napMatchRate}%</p>
				</div>
				<div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/[0.08]">
					<div
						className={`h-full rounded-full ${napTone(brandTrust.napMatchRate)}`}
						style={{ width: `${Math.min(100, Math.max(0, brandTrust.napMatchRate))}%` }}
					/>
				</div>
				{brandTrust.napIssue && <p className="mt-2 text-xs leading-relaxed text-slate-400">{brandTrust.napIssue}</p>}
			</div>
		</section>
	);
}
