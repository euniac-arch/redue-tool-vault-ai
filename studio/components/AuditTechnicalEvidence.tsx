'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useAuditPayload } from '@/components/audit/AuditPayloadProvider';
import { schemaMappingFromReport } from '@/lib/audit/live-criteria';
import { isNewsMediaVertical, resolveRecommendedSchemas } from '@/lib/audit/recommended-schemas';
import { resolveIndustryConfigFromSite } from '@/lib/registry/universalIndustryRegistry';
import {
	formatTargetIndexStatus,
	formatTargetTtfb,
	inferCmsFromAuditReport,
	isHttpsUrl,
} from '@/lib/audit/target-entity';
import type { AuditReport } from '@/lib/site-auditor';

interface AuditTechnicalEvidenceProps {
	report: AuditReport;
}

export function AuditTechnicalEvidence({ report }: AuditTechnicalEvidenceProps) {
	const t = useTranslations('audit.b2b');
	const tEntity = useTranslations('audit.targetEntity');
	const locale = useLocale();
	const lang = locale === 'en' ? 'en' : 'ko';
	const { latest } = useAuditPayload();
	const m = report.metrics;
	const resolvedCms =
		report.cmsType && report.cmsType !== 'UNKNOWN'
			? report.cmsType
			: latest?.cmsType && latest.cmsType !== 'UNKNOWN'
				? latest.cmsType
				: inferCmsFromAuditReport(report, lang);
	const https = isHttpsUrl(report.url);
	const ttfb = formatTargetTtfb(report.responseTimeMs, lang);
	const indexStatus = formatTargetIndexStatus(report, lang);
	const botAllowed =
		m?.aiBotAccess &&
		Object.values(m.aiBotAccess).some((allowed) => allowed === true);
	const botKnown = Boolean(m?.aiBotAccess && Object.keys(m.aiBotAccess).length);

	const mapping = schemaMappingFromReport(report);
	const newsVertical = isNewsMediaVertical(mapping);
	const recommended = resolveRecommendedSchemas(mapping);
	const industry = resolveIndustryConfigFromSite({
		lang,
		brandName: report.siteMeta?.brandName,
		location: report.siteMeta?.location || report.siteMeta?.broadLocation,
		primaryKeyword: report.siteMeta?.primaryKeyword,
		category: report.siteMeta?.category,
		services: report.siteMeta?.coreSpecialties,
		domain: report.siteMeta?.domain,
		url: report.url,
		legacyIndustry: report.siteMeta?.industryType,
		title: report.siteMeta?.title,
		description: report.siteMeta?.metaDescription || report.siteMeta?.ogDescription,
		keywords: [report.siteMeta?.metaKeywords, report.siteMeta?.primaryKeyword, report.siteMeta?.category]
			.filter(Boolean)
			.join(' '),
		schemaTypes: m?.schemaTypes ?? report.siteMeta?.schemaEntityTypes,
		navMenuTexts: report.siteMeta?.navMenuTexts,
	});
	const hasArticleLike = (m?.schemaTypes ?? []).some((t) => /^(Article|NewsArticle|BlogPosting)$/i.test(t));
	const missingBlocks = [
		{ label: 'Organization', fields: m?.organizationMissing ?? [] },
		...(newsVertical || hasArticleLike
			? [{ label: 'Article / NewsArticle', fields: m?.articleMissing ?? [] }]
			: []),
		{ label: 'Person (E-E-A-T)', fields: m?.personMissing ?? [] },
	].filter((block) => block.fields.length > 0);

	return (
		<section
			id="technical-evidence-jsonld"
			className="pdf-page-item audit-report-section scroll-mt-24 flex flex-col gap-4 rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.03] p-5 sm:p-6"
		>
			<div>
				<p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#D4AF37]">{t('techBadge')}</p>
				<h2 className="mt-1 text-lg font-extrabold text-slate-900 dark:text-white">{t('techTitle')}</h2>
				<p className="mt-1 text-xs text-slate-500">{t('techSubtitle')}</p>
				<div className="mt-2 flex flex-wrap items-center gap-1.5">
					<span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{t('recommendedSchema')}</span>
					{recommended.map((type) => (
						<span
							key={type}
							className="rounded-md border border-indigo-200 bg-indigo-50 px-2 py-0.5 font-mono text-[11px] font-bold text-indigo-800 dark:border-indigo-400/25 dark:bg-indigo-500/15 dark:text-indigo-300"
						>
							{type}
						</span>
					))}
					<span className="text-[11px] text-slate-500">
						{industry.defaultCategory} · {industry.personJobTitle}
					</span>
				</div>
			</div>

			<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
				<div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-white/[0.08] dark:bg-black/25">
					<p className="text-[10px] uppercase text-slate-500">{tEntity('cms')}</p>
					<p className="mt-0.5 text-sm font-bold text-slate-900 dark:text-white">{resolvedCms}</p>
				</div>
				<div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-white/[0.08] dark:bg-black/25">
					<p className="text-[10px] uppercase text-slate-500">{tEntity('security')}</p>
					<p className={`mt-0.5 text-sm font-bold ${https ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}`}>
						{https ? tEntity('httpsOn') : tEntity('httpsOff')}
					</p>
				</div>
				<div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-white/[0.08] dark:bg-black/25">
					<p className="text-[10px] uppercase text-slate-500">{tEntity('ttfb')}</p>
					<p className="mt-0.5 text-sm font-bold tabular-nums text-slate-900 dark:text-white">{ttfb.valueLabel}</p>
				</div>
				<div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-white/[0.08] dark:bg-black/25">
					<p className="text-[10px] uppercase text-slate-500">{tEntity('indexStatus')}</p>
					<p className="mt-0.5 text-sm font-bold text-slate-900 dark:text-white">{indexStatus.label}</p>
				</div>
				<div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-white/[0.08] dark:bg-black/25">
					<p className="text-[10px] uppercase text-slate-500">{tEntity('botsLabel')}</p>
					<p className="mt-0.5 text-sm font-bold text-slate-900 dark:text-white">
						{!botKnown
							? '—'
							: botAllowed
								? tEntity('botAllowed', { label: 'AI' })
								: tEntity('botBlocked', { label: 'AI' })}
					</p>
				</div>
			</div>

			<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
				<div className="rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-black/30 p-3">
					<p className="text-[10px] uppercase text-slate-500">{t('statH1')}</p>
					<p className="mt-1 text-xl font-bold text-slate-900 dark:text-white">{m?.h1Count ?? '—'}</p>
					{m?.h1Texts?.length ? (
						<p className="mt-1 font-mono text-[10px] text-slate-500">{m.h1Texts.map((x) => `"${x}"`).join(' · ')}</p>
					) : null}
				</div>
				<div className="rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-black/30 p-3">
					<p className="text-[10px] uppercase text-slate-500">{t('statAlt')}</p>
					<p className="mt-1 text-xl font-bold text-slate-900 dark:text-white">
						{m ? `${m.imagesMissingAlt}/${m.imagesTotal}` : '—'}
					</p>
					<p className="mt-1 text-[10px] text-slate-500">{t('statAltHint', { pct: m?.imageAltCoveragePct ?? 0 })}</p>
				</div>
				<div className="rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-black/30 p-3">
					<p className="text-[10px] uppercase text-slate-500">{t('statJsonLd')}</p>
					<p className="mt-1 text-xl font-bold text-slate-900 dark:text-white">{m?.jsonLdBlockCount ?? 0}</p>
					<p className="mt-1 text-[10px] text-slate-500">{t('statTypes', { count: m?.schemaTypes?.length ?? 0 })}</p>
				</div>
				<div className="rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-black/30 p-3">
					<p className="text-[10px] uppercase text-slate-500">{t('statHeading')}</p>
					<p className="mt-1 text-xl font-bold text-slate-900 dark:text-white">{m?.headingSkipDetected ? t('statSkipYes') : t('statSkipNo')}</p>
					{m?.headingSkipExamples?.length ? (
						<p className="mt-1 font-mono text-[10px] text-amber-700 dark:text-amber-300/80">{m.headingSkipExamples.join(', ')}</p>
					) : null}
				</div>
				<div className="rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-black/30 p-3">
					<p className="text-[10px] uppercase text-slate-500">{t('statRenderBlocking')}</p>
					<p
						className={`mt-1 text-xl font-bold ${
							(m?.renderBlockingScripts ?? 0) <= 5 ? 'text-slate-900 dark:text-white' : 'text-amber-700 dark:text-amber-300'
						}`}
					>
						{m?.renderBlockingScripts ?? '—'}
					</p>
					<p className="mt-1 text-[10px] text-slate-500">{t('statRenderBlockingHint')}</p>
				</div>
			</div>

			{missingBlocks.length > 0 && (
				<div className="rounded-xl border border-rose-200 dark:border-rose-500/20 bg-rose-50 dark:bg-rose-500/[0.05] p-4">
					<p className="text-sm font-bold text-rose-700 dark:text-rose-300">{t('missingTitle')}</p>
					<ul className="mt-3 space-y-2">
						{missingBlocks.map((block) => (
							<li key={block.label} className="text-xs text-slate-700 dark:text-slate-300">
								<span className="font-bold text-slate-900 dark:text-white">{block.label}</span>
								<span className="text-slate-500"> — {t('missingFields')}: </span>
								<span className="font-mono text-rose-700 dark:text-rose-200">{block.fields.join(', ')}</span>
							</li>
						))}
					</ul>
				</div>
			)}

			<div>
				<p className="mb-2 text-sm font-bold text-slate-800 dark:text-slate-200">{t('snippetTitle')}</p>
				{m?.jsonLdSnippets?.length ? (
					<div className="space-y-3">
						{m.jsonLdSnippets.map((snippet, index) => (
							<pre
								key={index}
								className="max-h-64 overflow-auto rounded-xl border border-cyan-200 dark:border-cyan-500/20 bg-slate-50 dark:bg-[#070b12] p-3 font-mono text-[11px] leading-relaxed text-cyan-800 dark:text-cyan-100/90"
							>
								{snippet}
							</pre>
						))}
					</div>
				) : (
					<div className="rounded-xl border border-dashed border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/5 px-4 py-6 text-center text-sm text-rose-700 dark:text-rose-300">
						{t('snippetEmpty')}
					</div>
				)}
			</div>
		</section>
	);
}
