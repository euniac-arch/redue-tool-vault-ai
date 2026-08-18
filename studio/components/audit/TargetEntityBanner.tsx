'use client';

import { useState, type ReactNode } from 'react';
import { Lightbulb } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useAuditPayload } from '@/components/audit/AuditPayloadProvider';
import type { GeoNarrativeReport } from '@/lib/audit/geo-narrative';
import type { PsiViewportAudit } from '@/lib/audit/pagespeed';
import {
	displayTargetUrl,
	formatTargetCategory,
	formatTargetIndexStatus,
	formatTargetScanStamp,
	formatTargetTtfb,
	formatTargetViewportStatus,
	inferCmsFromAuditReport,
	isHttpsUrl,
	resolveTargetBrandName,
} from '@/lib/audit/target-entity';
import type { AuditReport } from '@/lib/site-auditor';

interface TargetEntityBannerProps {
	report: AuditReport;
	reportData?: GeoNarrativeReport | null;
	/** Optional override from solve / project archive payload. */
	cmsType?: string | null;
	/** PageSpeed Lighthouse viewport audit for cross-validation. */
	viewportAudit?: PsiViewportAudit | null;
}

type MetaBadgeTone = 'slate' | 'emerald' | 'amber' | 'red' | 'sky';

interface MetaSubBadgeProps {
	children: ReactNode;
	tone?: MetaBadgeTone;
}

function LiveCertifiedBanner({
	body,
}: {
	body: string;
}) {
	return (
		<div
			className="live-cert-banner mb-3.5 flex max-w-full items-start gap-2.5 rounded-xl border border-emerald-200/70 bg-emerald-50/75 px-3.5 py-2.5 sm:items-center sm:px-4 dark:border-[rgba(16,185,129,0.2)]"
			role="status"
			aria-label={body}
		>
			<span className="live-cert-dot mt-1.5 shrink-0 print:shadow-none sm:mt-0" aria-hidden />
			<p className="min-w-0 flex-1 text-[12px] font-normal leading-relaxed text-slate-600 dark:text-slate-400 sm:text-[13px]">
				{body}
			</p>
		</div>
	);
}

function MetaSubBadge({ children, tone = 'slate' }: MetaSubBadgeProps) {
	const toneStyles: Record<MetaBadgeTone, string> = {
		slate: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/80 dark:text-slate-300 dark:border-slate-700/60',
		emerald: 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30',
		amber: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/30',
		red: 'bg-red-50 text-red-600 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/30',
		sky: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/10 dark:text-sky-400 dark:border-sky-500/30',
	};

	return (
		<span
			className={`inline-flex max-w-full min-w-0 items-center whitespace-normal break-keep rounded border px-1 py-px text-[11px] font-normal leading-tight ${toneStyles[tone]}`}
		>
			{children}
		</span>
	);
}

interface MetaValueItemProps {
	value: ReactNode;
	badge?: ReactNode;
	tone?: MetaBadgeTone;
	valueClassName?: string;
}

function MetaValueItem({
	value,
	badge,
	tone = 'slate',
	valueClassName = '',
}: MetaValueItemProps) {
	return (
		<div className="flex min-w-0 max-w-full flex-wrap items-center gap-1.5 text-sm font-semibold">
			<span className={`min-w-0 max-w-full whitespace-normal break-keep ${valueClassName}`}>{value}</span>
			{badge ? <MetaSubBadge tone={tone}>{badge}</MetaSubBadge> : null}
		</div>
	);
}

interface MetaInfoCardProps {
	icon: string;
	label: string;
	value: ReactNode;
	tipContent?: string;
	tipLabel: string;
}

function MetaInfoCard({ icon, label, value, tipContent, tipLabel }: MetaInfoCardProps) {
	const [showTip, setShowTip] = useState(false);

	return (
		<div className="flex h-full min-h-[4.5rem] min-w-0 flex-col gap-1 overflow-visible rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 shadow-sm transition-all dark:border-white/[0.06] dark:bg-black/25 dark:shadow-none">
			<div className="flex h-5 shrink-0 items-center justify-between gap-2">
				<p className="min-w-0 truncate text-[10px] font-bold uppercase tracking-wide text-slate-700 dark:text-slate-500">
					<span className="mr-1" aria-hidden>
						{icon}
					</span>
					{label}
				</p>
				{tipContent ? (
					<button
						type="button"
						onClick={() => setShowTip((open) => !open)}
						aria-expanded={showTip}
						aria-label={tipLabel}
						title={tipLabel}
						className={`inline-flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50 ${
							showTip
								? 'border-amber-300 bg-amber-50 text-amber-600 dark:border-amber-500/40 dark:bg-amber-500/20 dark:text-amber-400'
								: 'border-transparent bg-slate-100 text-slate-500 hover:bg-amber-50 hover:text-amber-600 dark:bg-slate-800/60 dark:text-slate-400 dark:hover:bg-amber-500/10 dark:hover:text-amber-300'
						}`}
					>
						<Lightbulb className="h-3 w-3" aria-hidden />
					</button>
				) : (
					<span className="h-5 w-5 shrink-0" aria-hidden />
				)}
			</div>
			<div className="min-h-[1.25rem] min-w-0 max-w-full flex-1 whitespace-normal break-words text-sm font-semibold leading-snug">
				{value}
			</div>
			{showTip && tipContent ? (
				<div className="mt-1 rounded border border-slate-200 bg-slate-50 px-1.5 py-1 text-[10px] leading-snug text-slate-600 dark:border-slate-700 dark:bg-slate-800/90 dark:text-slate-300">
					{tipContent}
				</div>
			) : null}
		</div>
	);
}

export function TargetEntityBanner({
	report,
	reportData,
	cmsType,
	viewportAudit,
}: TargetEntityBannerProps) {
	const t = useTranslations('audit.targetEntity');
	const locale = useLocale();
	const lang = locale === 'en' ? 'en' : 'ko';
	const { latest } = useAuditPayload();

	const brandName = resolveTargetBrandName(report, reportData);
	const urlLabel = displayTargetUrl(report.url);
	const scanStamp = formatTargetScanStamp(report.fetchedAt, lang);
	const category = formatTargetCategory(report.siteMeta, lang, reportData?.industry);
	const resolvedCms = cmsType || report.cmsType || latest?.cmsType || null;
	const cms =
		resolvedCms && resolvedCms !== 'UNKNOWN'
			? resolvedCms
			: inferCmsFromAuditReport(report, lang);
	const https = isHttpsUrl(report.url);
	const ttfb = formatTargetTtfb(report.responseTimeMs, lang);
	const indexStatus = formatTargetIndexStatus(report, lang);
	const viewport = formatTargetViewportStatus(report, {
		viewportAudit: viewportAudit
			? {
					score: viewportAudit.score,
					scoreDisplayMode: viewportAudit.scoreDisplayMode,
				}
			: null,
	});

	const ttfbClass =
		ttfb.tone === 'good'
			? 'tabular-nums text-emerald-600 dark:text-emerald-300'
			: ttfb.tone === 'warn'
				? 'tabular-nums text-amber-600 dark:text-amber-300'
				: 'tabular-nums text-rose-600 dark:text-rose-300';
	const ttfbBadge =
		ttfb.statusKey === 'good'
			? t('ttfbBadgeGood')
			: ttfb.statusKey === 'warn'
				? t('ttfbBadgeWarn')
				: ttfb.statusKey === 'bad'
					? t('ttfbBadgeBad')
					: t('ttfbBadgeUnknown');
	const ttfbBadgeTone: MetaBadgeTone =
		ttfb.statusKey === 'good'
			? 'emerald'
			: ttfb.statusKey === 'warn'
				? 'amber'
				: ttfb.statusKey === 'bad'
					? 'red'
					: 'slate';
	const ttfbEmoji = ttfb.tone === 'good' ? '🟢' : ttfb.tone === 'warn' ? '🟡' : '🔴';

	const viewportLabel = !viewport.known
		? t('viewportUnknown')
		: viewport.present
			? t('viewportOn')
			: t('viewportOff');
	const viewportBadge = !viewport.known
		? t('viewportUnknownBadge')
		: viewport.present
			? t('viewportOnBadge')
			: t('viewportOffBadge');
	const viewportTone: MetaBadgeTone = !viewport.known
		? 'amber'
		: viewport.present
			? 'emerald'
			: 'red';
	const viewportClass = !viewport.known
		? 'text-amber-600 dark:text-amber-300'
		: viewport.present
			? 'text-emerald-600 dark:text-emerald-300'
			: 'text-rose-600 dark:text-rose-300';

	const tipLabel = t('tip');
	const metaRows: Array<{
		id: string;
		icon: string;
		label: string;
		tipContent?: string;
		value: ReactNode;
	}> = [
		{
			id: 'category',
			icon: '🏷️',
			label: t('category'),
			value: (
				<span className="block w-full whitespace-normal break-words text-slate-900 dark:text-slate-100">
					{category}
				</span>
			),
		},
		{
			id: 'cms',
			icon: '⚙️',
			label: t('cms'),
			value: <span className="text-slate-900 dark:text-slate-100">{cms}</span>,
		},
		{
			id: 'security',
			icon: '🛡️',
			label: t('security'),
			tipContent: t('securityTip'),
			value: (
				<MetaValueItem
					value={https ? t('httpsOn') : t('httpsOff')}
					valueClassName={https ? 'text-emerald-600 dark:text-emerald-300' : 'text-rose-600 dark:text-rose-300'}
					badge={https ? t('httpsOnBadge') : t('httpsOffBadge')}
					tone={https ? 'emerald' : 'red'}
				/>
			),
		},
		{
			id: 'ttfb',
			icon: '⚡',
			label: t('ttfb'),
			tipContent: t('ttfbTip'),
			value: (
				<MetaValueItem
					value={ttfb.valueLabel}
					valueClassName={ttfbClass}
					badge={`${ttfbEmoji} ${ttfbBadge}`}
					tone={ttfbBadgeTone}
				/>
			),
		},
		{
			id: 'indexStatus',
			icon: '🔍',
			label: t('indexStatus'),
			tipContent: indexStatus.allowed
				? t('indexStatusAllowedHint')
				: t('indexStatusBlockedHint'),
			value: (
				<MetaValueItem
					value={indexStatus.label}
					valueClassName={indexStatus.allowed ? 'text-emerald-600 dark:text-emerald-300' : 'text-rose-600 dark:text-rose-300'}
					badge={indexStatus.badge}
					tone={indexStatus.allowed ? 'emerald' : 'red'}
				/>
			),
		},
		{
			id: 'viewport',
			icon: '📱',
			label: t('viewport'),
			tipContent: t('viewportTip'),
			value: (
				<MetaValueItem
					value={viewportLabel}
					valueClassName={viewportClass}
					badge={viewportBadge}
					tone={viewportTone}
				/>
			),
		},
	];

	return (
		<div>
			<LiveCertifiedBanner body={t('liveCertifiedBody')} />
			<section
				className="pdf-page-item audit-report-section relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ring-1 ring-slate-200/80 dark:border-cyan-400/25 dark:bg-gradient-to-br dark:from-[#07101F] dark:via-[#0B1630] dark:to-[#0A1224] dark:shadow-none dark:ring-cyan-400/15"
				aria-label={t('ariaLabel')}
			>
				<div
					className="pointer-events-none absolute inset-0 opacity-0 print:hidden dark:opacity-40"
					style={{
						background:
							'radial-gradient(circle at 12% 18%, rgba(34,211,238,0.16), transparent 42%), radial-gradient(circle at 88% 12%, rgba(56,189,248,0.12), transparent 40%)',
					}}
				/>
				<div className="relative border-b border-slate-200 px-5 py-4 sm:px-6 dark:border-cyan-400/15">
					<div className="flex flex-col gap-2.5">
						<div className="flex flex-col gap-2.5 md:flex-row md:items-center md:justify-between md:gap-4">
							<p className="order-2 min-w-0 text-[11px] font-bold uppercase tracking-[0.2em] text-cyan-700 dark:text-cyan-300/90 md:order-1">
								🌐 {t('badge')}
							</p>
							<p className="order-1 inline-flex max-w-full flex-wrap items-baseline gap-x-2 gap-y-0.5 self-start rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] leading-snug text-slate-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-400 md:order-2 md:shrink-0 md:self-auto sm:text-xs">
								<span className="font-medium text-slate-400 dark:text-slate-500">{t('lastDiagnosedLabel')}</span>
								{scanStamp.dateTime ? (
									<time
										dateTime={report.fetchedAt}
										className="font-medium tabular-nums tracking-tight text-slate-600 dark:text-slate-300"
									>
										{scanStamp.dateTime}
									</time>
								) : null}
							</p>
						</div>
						<div className="min-w-0">
							<h2 className="break-words text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
								{brandName}
							</h2>
							<a
								href={report.url}
								target="_blank"
								rel="noopener noreferrer"
								className="mt-1.5 block min-w-0 break-all text-sm font-medium leading-relaxed text-slate-600 underline-offset-2 transition hover:text-slate-900 hover:underline dark:text-slate-400 dark:hover:text-slate-300"
							>
								{urlLabel}
							</a>
						</div>
					</div>
				</div>

				<div className="relative px-5 py-4 sm:px-6">
					<div className="grid grid-cols-1 items-stretch gap-3 md:grid-cols-3">
						{metaRows.map((row) => (
							<MetaInfoCard
								key={row.id}
								icon={row.icon}
								label={row.label}
								value={row.value}
								tipContent={row.tipContent}
								tipLabel={tipLabel}
							/>
						))}
					</div>
				</div>
			</section>
		</div>
	);
}
