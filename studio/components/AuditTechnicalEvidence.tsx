'use client';

import { useTranslations } from 'next-intl';
import type { AuditReport } from '@/lib/site-auditor';

interface AuditTechnicalEvidenceProps {
	report: AuditReport;
}

export function AuditTechnicalEvidence({ report }: AuditTechnicalEvidenceProps) {
	const t = useTranslations('audit.b2b');
	const m = report.metrics;

	const missingBlocks = [
		{ label: 'Organization', fields: m?.organizationMissing ?? [] },
		{ label: 'Article / NewsArticle', fields: m?.articleMissing ?? [] },
		{ label: 'Person (E-E-A-T)', fields: m?.personMissing ?? [] },
	].filter((block) => block.fields.length > 0);

	return (
		<section
			id="sec-evidence"
			className="audit-report-section scroll-mt-24 flex flex-col gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 sm:p-6"
		>
			<div>
				<p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#D4AF37]">{t('techBadge')}</p>
				<h2 className="mt-1 text-lg font-extrabold text-white">{t('techTitle')}</h2>
				<p className="mt-1 text-xs text-slate-500">{t('techSubtitle')}</p>
			</div>

			<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
				<div className="rounded-xl border border-white/[0.08] bg-black/30 p-3">
					<p className="text-[10px] uppercase text-slate-500">{t('statH1')}</p>
					<p className="mt-1 text-xl font-bold text-white">{m?.h1Count ?? '—'}</p>
					{m?.h1Texts?.length ? (
						<p className="mt-1 font-mono text-[10px] text-slate-500">{m.h1Texts.map((x) => `"${x}"`).join(' · ')}</p>
					) : null}
				</div>
				<div className="rounded-xl border border-white/[0.08] bg-black/30 p-3">
					<p className="text-[10px] uppercase text-slate-500">{t('statAlt')}</p>
					<p className="mt-1 text-xl font-bold text-white">
						{m ? `${m.imagesMissingAlt}/${m.imagesTotal}` : '—'}
					</p>
					<p className="mt-1 text-[10px] text-slate-500">{t('statAltHint', { pct: m?.imageAltCoveragePct ?? 0 })}</p>
				</div>
				<div className="rounded-xl border border-white/[0.08] bg-black/30 p-3">
					<p className="text-[10px] uppercase text-slate-500">{t('statJsonLd')}</p>
					<p className="mt-1 text-xl font-bold text-white">{m?.jsonLdBlockCount ?? 0}</p>
					<p className="mt-1 text-[10px] text-slate-500">{t('statTypes', { count: m?.schemaTypes?.length ?? 0 })}</p>
				</div>
				<div className="rounded-xl border border-white/[0.08] bg-black/30 p-3">
					<p className="text-[10px] uppercase text-slate-500">{t('statHeading')}</p>
					<p className="mt-1 text-xl font-bold text-white">{m?.headingSkipDetected ? t('statSkipYes') : t('statSkipNo')}</p>
					{m?.headingSkipExamples?.length ? (
						<p className="mt-1 font-mono text-[10px] text-amber-300/80">{m.headingSkipExamples.join(', ')}</p>
					) : null}
				</div>
				<div className="rounded-xl border border-white/[0.08] bg-black/30 p-3">
					<p className="text-[10px] uppercase text-slate-500">{t('statRenderBlocking')}</p>
					<p
						className={`mt-1 text-xl font-bold ${
							(m?.renderBlockingScripts ?? 0) <= 5 ? 'text-white' : 'text-amber-300'
						}`}
					>
						{m?.renderBlockingScripts ?? '—'}
					</p>
					<p className="mt-1 text-[10px] text-slate-500">{t('statRenderBlockingHint')}</p>
				</div>
			</div>

			{missingBlocks.length > 0 && (
				<div className="rounded-xl border border-rose-500/20 bg-rose-500/[0.05] p-4">
					<p className="text-sm font-bold text-rose-300">{t('missingTitle')}</p>
					<ul className="mt-3 space-y-2">
						{missingBlocks.map((block) => (
							<li key={block.label} className="text-xs text-slate-300">
								<span className="font-bold text-white">{block.label}</span>
								<span className="text-slate-500"> — {t('missingFields')}: </span>
								<span className="font-mono text-rose-200">{block.fields.join(', ')}</span>
							</li>
						))}
					</ul>
				</div>
			)}

			<div>
				<p className="mb-2 text-sm font-bold text-slate-200">{t('snippetTitle')}</p>
				{m?.jsonLdSnippets?.length ? (
					<div className="space-y-3">
						{m.jsonLdSnippets.map((snippet, index) => (
							<pre
								key={index}
								className="max-h-64 overflow-auto rounded-xl border border-cyan-500/20 bg-[#070b12] p-3 font-mono text-[11px] leading-relaxed text-cyan-100/90"
							>
								{snippet}
							</pre>
						))}
					</div>
				) : (
					<div className="rounded-xl border border-dashed border-rose-500/30 bg-rose-500/5 px-4 py-6 text-center text-sm text-rose-300">
						{t('snippetEmpty')}
					</div>
				)}
			</div>
		</section>
	);
}
