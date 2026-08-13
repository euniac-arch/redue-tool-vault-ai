'use client';

import { useLocale, useTranslations } from 'next-intl';
import {
	buildCoreChecklistSummaryText,
	buildCoreSeoGeoChecklist,
	getCoreFailIssueLabels,
	getCoreItemsHealthy,
	getCoreItemsNeedingWork,
	type CoreChecklistId,
	type CoreChecklistItem,
} from '@/lib/audit/core-checklist';
import {
	getDefaultImpactItems,
	type GeoNarrativeImpactItem,
	type GeoNarrativeReport,
} from '@/lib/audit/geo-narrative';
import type { AuditReport } from '@/lib/site-auditor';

interface ImpactPreviewSectionProps {
	siteName?: string;
	reportData?: GeoNarrativeReport | null;
	/** Live crawled audit — drives the 6 essential checklist status badges. */
	auditReport?: AuditReport | null;
}

function CrossIcon() {
	return (
		<svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 16 16" fill="none" aria-hidden>
			<path d="M4 4l8 8M12 4L4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
		</svg>
	);
}

function CheckIcon() {
	return (
		<svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 16 16" fill="none" aria-hidden>
			<path d="M3.5 8.5l3 3 6-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
		</svg>
	);
}

const BENEFIT_RINGS = [
	'border-emerald-500/30 bg-emerald-500/[0.06]',
	'border-indigo-500/30 bg-indigo-500/[0.08]',
	'border-cyan-500/30 bg-cyan-500/[0.06]',
] as const;

const BENEFIT_ICONS = ['🤖', '📈', '🛡️'] as const;

const CORE_ORDER: CoreChecklistId[] = [
	'canonical',
	'heading-hierarchy',
	'render-blocking',
	'article-schema',
	'faq-schema',
	'image-alt',
];

type GainKey =
	| 'schemaAi'
	| 'canonicalRich'
	| 'headingParse'
	| 'speedCrawl'
	| 'imageAlt'
	| 'articleSchema'
	| 'faqSchema';

function resolveImpactItems(
	reportData: GeoNarrativeReport | null | undefined,
	lang: 'ko' | 'en',
): GeoNarrativeImpactItem[] {
	const fromApi = reportData?.impactItems?.filter(
		(item) => item?.channelTitle && item?.currentIssue && item?.improvedState,
	);
	if (fromApi && fromApi.length >= 2) {
		return fromApi.slice(0, 5);
	}
	return getDefaultImpactItems(lang);
}

/** Map failing (or all-healthy fallback) core items → After exposure-gain cards. */
function resolveAfterGains(items: CoreChecklistItem[]): GainKey[] {
	const needing = getCoreItemsNeedingWork(items);
	const source = needing.length > 0 ? needing : getCoreItemsHealthy(items);
	const keys: GainKey[] = [];
	const push = (key: GainKey) => {
		if (!keys.includes(key)) keys.push(key);
	};

	for (const item of source) {
		switch (item.id) {
			case 'canonical':
				push('canonicalRich');
				break;
			case 'heading-hierarchy':
				push('headingParse');
				break;
			case 'render-blocking':
				push('speedCrawl');
				break;
			case 'article-schema':
				push('articleSchema');
				push('schemaAi');
				break;
			case 'faq-schema':
				push('faqSchema');
				push('schemaAi');
				break;
			case 'image-alt':
				push('imageAlt');
				break;
		}
	}

	// Spec baseline: always surface schema AI + canonical/rich CTR when relevant or as fallback.
	if (keys.length === 0) {
		return ['schemaAi', 'canonicalRich'];
	}
	if (!keys.includes('schemaAi') && source.some((i) => i.id === 'article-schema' || i.id === 'faq-schema')) {
		push('schemaAi');
	}
	return keys.slice(0, 5);
}

function StatusBadge({ ok, okLabel, needsLabel }: { ok: boolean; okLabel: string; needsLabel: string }) {
	return (
		<span
			className={
				ok
					? 'inline-flex shrink-0 items-center rounded-md border border-emerald-400/40 bg-emerald-500/15 px-2 py-0.5 text-[11px] font-extrabold text-emerald-200'
					: 'inline-flex shrink-0 items-center rounded-md border border-rose-400/40 bg-rose-500/15 px-2 py-0.5 text-[11px] font-extrabold text-rose-200'
			}
		>
			{ok ? okLabel : needsLabel}
		</span>
	);
}

function CoreChecklistRow({
	item,
	label,
	why,
	whyHint,
	okLabel,
	needsLabel,
}: {
	item: CoreChecklistItem;
	label: string;
	why: string;
	whyHint: string;
	okLabel: string;
	needsLabel: string;
}) {
	const ok = item.tone === 'ok';

	return (
		<li
			className={`flex flex-col gap-2 rounded-xl border px-3.5 py-3.5 ${
				ok ? 'border-emerald-500/25 bg-emerald-500/[0.06]' : 'border-rose-500/25 bg-rose-500/[0.06]'
			}`}
		>
			<div className="flex flex-wrap items-start justify-between gap-2">
				<div className="flex min-w-0 flex-1 items-start gap-2.5">
					<span className={`mt-0.5 shrink-0 ${ok ? 'text-emerald-400' : 'text-rose-400'}`}>
						{ok ? <CheckIcon /> : <CrossIcon />}
					</span>
					<div className="min-w-0">
						<p className="text-sm font-bold text-slate-100">{label}</p>
						{item.evidence ? (
							<p className="mt-0.5 break-all font-mono text-[10px] text-slate-500">{item.evidence}</p>
						) : null}
					</div>
				</div>
				<StatusBadge ok={ok} okLabel={okLabel} needsLabel={needsLabel} />
			</div>
			{/* Always visible — no hover/accordion gate */}
			<div className="rounded-lg border border-amber-400/15 bg-black/20 px-3 py-2.5 pl-3">
				<p className="text-[11px] font-bold uppercase tracking-wide text-amber-200/90">{whyHint}</p>
				<p className="mt-1 text-[12px] leading-relaxed text-amber-50/85">{why}</p>
			</div>
		</li>
	);
}

export function ImpactPreviewSection({
	siteName = 'your-site.com',
	reportData,
	auditReport = null,
}: ImpactPreviewSectionProps) {
	const t = useTranslations('audit.impact');
	const locale = useLocale();
	const lang = locale === 'en' ? 'en' : 'ko';
	const impactItems = resolveImpactItems(reportData, lang);
	const coreItems = buildCoreSeoGeoChecklist(auditReport);
	const needingWork = getCoreItemsNeedingWork(coreItems);
	const gainKeys = resolveAfterGains(coreItems);
	const allHealthy = needingWork.length === 0 && coreItems.every((i) => i.tone === 'ok');
	const brandName =
		reportData?.brandName?.trim() ||
		auditReport?.siteMeta?.brandName?.trim() ||
		siteName;
	const industry = reportData?.industry?.trim() || auditReport?.siteMeta?.category?.trim();
	/** Always derived from live 6-core 🔴/🟢 — never trust stale LLM beforeImpact copy. */
	const beforeSummary = buildCoreChecklistSummaryText({
		items: coreItems,
		brandName,
		industry,
		lang,
	});
	const coreFailLabels = getCoreFailIssueLabels(coreItems, lang);

	const benefits = reportData?.afterBenefits?.length
		? reportData.afterBenefits.slice(0, 3).map((b, i) => ({
				icon: BENEFIT_ICONS[i] ?? '✨',
				title: b.title,
				body: b.body,
				ring: BENEFIT_RINGS[i] ?? BENEFIT_RINGS[0],
			}))
		: [
				{ icon: '🤖', title: t('benefits.ai.title'), body: t('benefits.ai.body'), ring: BENEFIT_RINGS[0] },
				{ icon: '📈', title: t('benefits.ctr.title'), body: t('benefits.ctr.body'), ring: BENEFIT_RINGS[1] },
				{ icon: '🛡️', title: t('benefits.eeat.title'), body: t('benefits.eeat.body'), ring: BENEFIT_RINGS[2] },
			];

	const schemas = reportData?.recommendedSchemas?.filter(Boolean) ?? [];

	return (
		<section
			id="sec-live-criteria"
			className="scroll-mt-24 flex flex-col gap-6 rounded-2xl border border-amber-500/20 bg-gradient-to-b from-amber-500/[0.06] via-white/[0.02] to-transparent p-5 sm:p-6"
			aria-labelledby="impact-preview-heading"
		>
			<div className="flex flex-col gap-2 border-b border-amber-500/15 pb-4">
				<p className="inline-flex w-fit items-center rounded-md border border-amber-500/35 bg-amber-500/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-amber-200">
					{t('guideBadge')}
				</p>
				<h2 id="impact-preview-heading" className="text-base font-extrabold leading-snug text-white sm:text-lg">
					{t('title')}
				</h2>
				<p className="text-sm leading-relaxed text-amber-100/70">{t('subtitle')}</p>
				{reportData?.industry ? (
					<p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-200/70">
						{reportData.brandName ? `${reportData.brandName} · ` : ''}
						{reportData.industry}
					</p>
				) : null}
			</div>

			{schemas.length > 0 ? (
				<div className="flex flex-wrap items-center gap-1.5">
					<span className="mr-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
						Recommended schemas
					</span>
					{schemas.map((type) => (
						<span
							key={type}
							className="rounded-md border border-cyan-500/25 bg-cyan-500/10 px-2 py-0.5 font-mono text-[11px] text-cyan-300"
						>
							{type}
						</span>
					))}
				</div>
			) : null}

			<div className="flex flex-col gap-6">
				{/* ── Before panel ── */}
				<div className="flex flex-col rounded-2xl border border-slate-800 bg-slate-900/60">
					<div
						className={`flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3.5 sm:px-5 ${
							allHealthy
								? 'border-emerald-500/20 bg-emerald-500/[0.07]'
								: 'border-rose-500/20 bg-rose-500/[0.07]'
						}`}
					>
						<div className="flex flex-wrap items-center gap-2">
							<span
								className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-extrabold tracking-wide text-white shadow-lg ${
									allHealthy
										? 'bg-emerald-500 shadow-emerald-500/25'
										: 'bg-rose-500 shadow-rose-500/25'
								}`}
							>
								{allHealthy ? <CheckIcon /> : <CrossIcon />}
								{t('before.badge')}
							</span>
							<span className="text-sm font-bold text-white">{t('before.label')}</span>
						</div>
						<span
							className={`rounded-full border px-2.5 py-1 text-[11px] font-extrabold ${
								allHealthy
									? 'border-emerald-400/30 bg-emerald-500/15 text-emerald-200'
									: 'border-rose-400/30 bg-rose-500/15 text-rose-200'
							}`}
						>
							{needingWork.length > 0
								? `${needingWork.length}/6 ${t('statusNeedsWork')}`
								: `6/6 ${t('statusOk')}`}
						</span>
					</div>

					<div className="flex flex-col gap-4 p-4 sm:p-5">
						{coreFailLabels.length > 0 ? (
							<div className="flex flex-col gap-2">
								<span className="inline-flex w-fit items-center rounded-md border border-rose-400/40 bg-rose-500/15 px-2.5 py-1 text-[11px] font-bold text-rose-100">
									{t('evidenceExampleBadge')}
								</span>
								<div className="flex flex-wrap items-center gap-1.5">
									<span className="mr-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
										Evidence Fails
									</span>
									{coreFailLabels.map((fail) => (
										<span
											key={fail}
											className="rounded-md border border-rose-500/25 bg-rose-500/10 px-2 py-0.5 font-mono text-[10px] text-rose-300/90"
										>
											{fail}
										</span>
									))}
								</div>
							</div>
						) : null}

						<div
							className={`rounded-xl px-3.5 py-3 text-[13px] leading-relaxed ${
								allHealthy
									? 'border border-emerald-500/25 bg-emerald-500/[0.08] text-emerald-50'
									: 'border border-rose-500/25 bg-rose-500/[0.08] text-rose-50'
							}`}
						>
							{beforeSummary}
						</div>

						{/* Always-expanded 6-core checklist — no hover/accordion */}
						<div>
							<p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-rose-200/80">
								{t('coreChecklistHeading')}
							</p>
							<ul className="flex flex-col gap-2.5">
								{CORE_ORDER.map((id) => {
									const item = coreItems.find((c) => c.id === id)!;
									return (
										<CoreChecklistRow
											key={id}
											item={item}
											label={t(`coreItems.${id}.label`)}
											why={t(`coreItems.${id}.why`)}
											whyHint={t('whyMattersHint')}
											okLabel={t('statusOk')}
											needsLabel={t('statusNeedsWork')}
										/>
									);
								})}
							</ul>
						</div>
					</div>
				</div>

				<div className="flex justify-center" aria-hidden>
					<div className="flex h-9 w-9 items-center justify-center rounded-full border border-indigo-500/40 bg-indigo-500/15 text-indigo-300 shadow-[0_0_20px_rgba(99,102,241,0.25)]">
						↓
					</div>
				</div>

				{/* ── After panel ── */}
				<div className="flex flex-col overflow-hidden rounded-2xl border border-indigo-500/50 bg-gradient-to-b from-indigo-950/40 via-slate-900 to-slate-950 shadow-[0_0_30px_rgba(99,102,241,0.15)] ring-1 ring-indigo-400/20">
					<div className="flex flex-wrap items-center justify-between gap-2 border-b border-indigo-500/30 bg-indigo-500/10 px-4 py-3.5 sm:px-5">
						<div className="flex flex-wrap items-center gap-2">
							<span className="inline-flex items-center gap-1 rounded-md bg-indigo-500 px-2.5 py-1 text-[11px] font-extrabold tracking-wide text-white shadow-lg shadow-indigo-500/30">
								<CheckIcon />
								{t('after.badge')}
							</span>
							<span className="text-sm font-bold text-white">{t('after.label')}</span>
						</div>
						<span className="animate-pulse rounded-full border border-violet-400/40 bg-violet-500/20 px-2.5 py-1 text-[11px] font-extrabold text-violet-200">
							{t('after.sparkleBadge')}
						</span>
					</div>

					<div className="flex flex-col gap-4 p-4 sm:p-6">
						<div className="relative translate-y-0 rounded-2xl border border-indigo-400/25 bg-[#0c1220] p-4 shadow-[0_12px_40px_-12px_rgba(99,102,241,0.45)] sm:p-5">
							<div className="absolute -right-1 -top-1 rounded-bl-xl rounded-tr-2xl bg-accent px-2.5 py-1 text-[10px] font-extrabold text-white shadow-md">
								{t('mock.richBadge')}
							</div>
							<div className="flex flex-wrap items-center gap-1.5 pr-16 text-[11px]">
								<span className="font-medium text-emerald-400">{siteName}</span>
								<span className="text-slate-600">›</span>
								<span className="text-slate-400">{t('mock.breadcrumb')}</span>
							</div>
							<p className="mt-2 text-base font-bold leading-snug text-[#8ab4f8] sm:text-lg">{t('mock.afterTitle')}</p>
							{schemas.length > 0 ? (
								<div className="mt-2.5 flex flex-wrap items-center gap-2">
									{schemas.map((type) => (
										<span
											key={type}
											className="rounded-md border border-accent/40 bg-accent/20 px-2 py-0.5 font-mono text-[11px] font-bold text-accent-light"
										>
											{type}
										</span>
									))}
								</div>
							) : (
								<div className="mt-2.5 flex flex-wrap items-center gap-2">
									<span className="rounded-md border border-accent/40 bg-accent/20 px-2 py-0.5 text-[11px] font-bold text-accent-light">
										{t('mock.author')}
									</span>
									<span className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-slate-300">
										{t('mock.date')}
									</span>
								</div>
							)}
							<p className="mt-3 text-[13px] leading-relaxed text-slate-300">{t('mock.afterDesc')}</p>
						</div>

						<div className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.08] px-4 py-3">
							<p className="text-xs font-semibold text-slate-200">{t('after.ai')}</p>
							<span className="mt-2 inline-flex max-w-full items-center rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-2.5 py-1.5 font-mono text-[11px] font-bold text-emerald-300 sm:text-xs">
								{t('after.citationBadge', { site: siteName })}
							</span>
							<p className="mt-2 text-[12px] leading-relaxed text-slate-400">
								{reportData?.aiSimulator?.afterAnswer || t('after.aiDetail', { site: siteName })}
							</p>
						</div>

						{/* Dynamic gains from items transitioning to 🟢 */}
						<div>
							<p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-indigo-300/90">
								{t('after.gainsHeading')}
							</p>
							{allHealthy ? (
								<p className="mb-3 text-[12px] leading-relaxed text-slate-400">{t('after.allHealthyNote')}</p>
							) : null}
							<ul className="flex flex-col gap-2">
								{gainKeys.map((key) => (
									<li
										key={key}
										className="flex gap-2.5 rounded-xl border border-indigo-500/20 bg-indigo-500/[0.07] px-3.5 py-3"
									>
										<span className="mt-0.5 text-indigo-300">
											<CheckIcon />
										</span>
										<div>
											<p className="text-sm font-bold text-white">{t(`gains.${key}.title`)}</p>
											<p className="mt-0.5 text-[12px] leading-relaxed text-slate-300">
												{t(`gains.${key}.body`)}
											</p>
										</div>
									</li>
								))}
							</ul>
						</div>

						{impactItems.length > 0 ? (
							<ul className="flex flex-col gap-2 border-t border-indigo-500/15 pt-4">
								{impactItems.map((item) => (
									<li
										key={`after-${item.id}`}
										className="flex gap-2.5 rounded-xl border border-indigo-500/15 bg-indigo-500/[0.04] px-3.5 py-3"
									>
										<span className="mt-0.5 text-indigo-300/80">
											<CheckIcon />
										</span>
										<div>
											<p className="text-sm font-bold text-slate-100">{item.channelTitle}</p>
											<p className="mt-0.5 text-[12px] leading-relaxed text-slate-400">{item.improvedState}</p>
										</div>
									</li>
								))}
							</ul>
						) : null}

						<div className="border-t border-indigo-500/20 pt-4">
							<p className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-indigo-300/90">
								{t('benefitsHeading')}
							</p>
							<div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
								{benefits.map((benefit) => (
									<article
										key={benefit.title}
										className={`flex flex-col gap-2.5 rounded-xl border p-3.5 sm:p-4 ${benefit.ring}`}
									>
										<span className="text-xl" aria-hidden>
											{benefit.icon}
										</span>
										<div>
											<h3 className="text-sm font-extrabold leading-snug text-white">{benefit.title}</h3>
											<p className="mt-1.5 text-[12px] leading-relaxed text-slate-400">{benefit.body}</p>
										</div>
									</article>
								))}
							</div>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}
