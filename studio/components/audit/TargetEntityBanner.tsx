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

function MetaSubBadge({ children, tone = 'slate' }: MetaSubBadgeProps) {
	const toneStyles: Record<MetaBadgeTone, string> = {
		slate: 'bg-slate-800/80 text-slate-300 border-slate-700/60',
		emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
		amber: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
		red: 'bg-red-500/10 text-red-400 border-red-500/30',
		sky: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
	};

	return (
		<span
			className={`inline-flex shrink-0 items-center whitespace-nowrap rounded border px-1 py-px text-[11px] font-normal leading-tight ${toneStyles[tone]}`}
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
		<div className="flex min-w-0 flex-wrap items-center gap-1.5 text-sm font-semibold">
			<span className={`min-w-0 break-words ${valueClassName}`}>{value}</span>
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
		<div className="flex h-full min-h-[4.5rem] min-w-0 flex-col gap-1 rounded-xl border border-white/[0.06] bg-black/25 px-3.5 py-2.5 transition-all">
			<div className="flex h-5 shrink-0 items-center justify-between gap-2">
				<p className="min-w-0 truncate text-[10px] font-bold uppercase tracking-wide text-slate-500">
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
								? 'border-amber-500/40 bg-amber-500/20 text-amber-400'
								: 'border-transparent bg-slate-800/60 text-slate-400 hover:bg-amber-500/10 hover:text-amber-300'
						}`}
					>
						<Lightbulb className="h-3 w-3" aria-hidden />
					</button>
				) : (
					<span className="h-5 w-5 shrink-0" aria-hidden />
				)}
			</div>
			<div className="min-h-[1.25rem] min-w-0 flex-1 break-words text-sm font-semibold leading-snug">
				{value}
			</div>
			{showTip && tipContent ? (
				<div className="mt-1 rounded border border-slate-700 bg-slate-800/90 px-1.5 py-1 text-[10px] leading-snug text-slate-300">
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
	const category = formatTargetCategory(report.siteMeta, lang, reportData?.industry);
	const resolvedCms = cmsType || latest?.cmsType || null;
	const cms =
		resolvedCms && resolvedCms !== 'UNKNOWN'
			? resolvedCms
			: inferCmsFromAuditReport(report, lang);
	const scannedAt = formatTargetScanStamp(report.fetchedAt, lang);
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
			? 'tabular-nums text-emerald-300'
			: ttfb.tone === 'warn'
				? 'tabular-nums text-amber-300'
				: 'tabular-nums text-rose-300';
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
		? 'text-amber-300'
		: viewport.present
			? 'text-emerald-300'
			: 'text-rose-300';

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
			value: <span className="text-slate-100">{category}</span>,
		},
		{
			id: 'cms',
			icon: '⚙️',
			label: t('cms'),
			value: <span className="text-slate-100">{cms}</span>,
		},
		{
			id: 'security',
			icon: '🛡️',
			label: t('security'),
			tipContent: t('securityTip'),
			value: (
				<MetaValueItem
					value={https ? t('httpsOn') : t('httpsOff')}
					valueClassName={https ? 'text-emerald-300' : 'text-rose-300'}
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
					valueClassName={indexStatus.allowed ? 'text-emerald-300' : 'text-rose-300'}
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
		<section
			className="audit-report-section relative overflow-hidden rounded-2xl border border-cyan-400/25 bg-gradient-to-br from-[#07101F] via-[#0B1630] to-[#0A1224] ring-1 ring-cyan-400/15"
			aria-label={t('ariaLabel')}
		>
			<div
				className="pointer-events-none absolute inset-0 opacity-40 print:hidden"
				style={{
					background:
						'radial-gradient(circle at 12% 18%, rgba(34,211,238,0.16), transparent 42%), radial-gradient(circle at 88% 12%, rgba(56,189,248,0.12), transparent 40%)',
				}}
			/>
			<div className="relative border-b border-cyan-400/15 px-5 py-4 sm:px-6">
				<div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
					<p className="text-[11px] font-bold uppercase tracking-[0.2em] text-cyan-300/90">
						🌐 {t('badge')}
					</p>
					<div className="flex min-w-0 flex-col items-start gap-1 sm:items-end">
						<p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
							<span className="mr-1" aria-hidden>
								🕒
							</span>
							{t('scannedAt')}
						</p>
						<div className="flex flex-wrap items-center gap-1.5">
							<span className="text-sm font-semibold tabular-nums text-slate-200">
								{scannedAt.dateTime ?? '—'}
							</span>
							<span className="inline-flex shrink-0 items-center rounded border border-sky-500/30 bg-sky-500/10 px-1.5 py-px text-[10px] font-semibold leading-tight text-sky-300">
								{t('liveBadge')}
							</span>
						</div>
					</div>
				</div>
				<h2 className="mt-2 break-words text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
					{brandName}
				</h2>
				<a
					href={report.url}
					target="_blank"
					rel="noopener noreferrer"
					className="mt-1.5 block break-all text-sm font-medium leading-relaxed text-slate-400 underline-offset-2 transition hover:text-slate-300 hover:underline"
				>
					{urlLabel}
				</a>
			</div>

			<div className="relative px-5 py-4 sm:px-6">
				<div className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2">
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
	);
}
