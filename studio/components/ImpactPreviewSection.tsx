'use client';

import { useTranslations } from 'next-intl';
import type { GeoNarrativeReport } from '@/lib/audit/geo-narrative';

interface ImpactPreviewSectionProps {
	siteName?: string;
	reportData?: GeoNarrativeReport | null;
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

function ImpactIcon() {
	return (
		<svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 16 16" fill="none" aria-hidden>
			<path
				d="M3 11.5l3.2-3.2 2.3 2.3L13 5.5M13 5.5H9.5M13 5.5V9"
				stroke="currentColor"
				strokeWidth="1.75"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	);
}

const BENEFIT_RINGS = [
	'border-emerald-500/30 bg-emerald-500/[0.06]',
	'border-indigo-500/30 bg-indigo-500/[0.08]',
	'border-cyan-500/30 bg-cyan-500/[0.06]',
] as const;

const BENEFIT_ICONS = ['🤖', '📈', '🛡️'] as const;

export function ImpactPreviewSection({ siteName = 'your-site.com', reportData }: ImpactPreviewSectionProps) {
	const t = useTranslations('audit.impact');

	const beforeItems = [
		{ label: t('before.google'), detail: t('before.googleDetail') },
		{
			label: t('before.ai'),
			detail: reportData?.beforeImpact || t('before.aiDetail'),
		},
		{ label: t('before.discover'), detail: t('before.discoverDetail') },
	] as const;

	const afterItems = [
		{ label: t('after.google'), detail: t('after.googleDetail') },
		{ label: t('after.ai'), detail: t('after.aiDetail', { site: siteName }) },
		{ label: t('after.discover'), detail: t('after.discoverDetail') },
	] as const;

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
		<section className="flex flex-col gap-6" aria-labelledby="impact-preview-heading">
			<div className="flex items-start gap-2.5">
				<span className="mt-0.5 inline-flex shrink-0 items-center justify-center rounded-md border border-indigo-500/30 bg-indigo-500/15 p-1.5 text-indigo-300">
					<ImpactIcon />
				</span>
				<div>
					<h2 id="impact-preview-heading" className="text-base font-bold text-white sm:text-lg">
						{t('title')}
					</h2>
					<p className="mt-1.5 text-sm leading-relaxed text-slate-400">
						{t.rich('subtitle', {
							hl: (chunks) => (
								<span className="text-indigo-300">{chunks}</span>
							),
						})}
					</p>
					{reportData?.industry ? (
						<p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-indigo-300/80">
							{reportData.brandName ? `${reportData.brandName} · ` : ''}
							{reportData.industry}
						</p>
					) : null}
				</div>
			</div>

			{reportData?.technicalFails && reportData.technicalFails.length > 0 ? (
				<div className="flex flex-wrap items-center gap-1.5">
					<span className="mr-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
						Evidence fails
					</span>
					{reportData.technicalFails.slice(0, 6).map((fail) => (
						<span
							key={fail}
							className="rounded-md border border-rose-500/25 bg-rose-500/10 px-2 py-0.5 font-mono text-[10px] text-rose-300/90"
						>
							{fail}
						</span>
					))}
				</div>
			) : null}

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
				<div className="flex flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60">
					<div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-slate-950/50 px-4 py-3 sm:px-5">
						<span className="inline-flex items-center gap-1.5 rounded-md border border-rose-500/25 bg-rose-500/10 px-2.5 py-1 text-[11px] font-bold text-rose-300/90">
							<CrossIcon />
							{t('before.label')}
						</span>
						<span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-[10px] font-medium text-slate-500">
							{t('before.scoreHint')}
						</span>
					</div>

					<div className="flex flex-col gap-4 p-4 sm:p-5">
						{reportData?.beforeImpact ? (
							<div className="rounded-xl border border-rose-500/20 bg-rose-500/[0.06] px-3.5 py-3 text-[12px] leading-relaxed text-rose-100/85">
								{reportData.beforeImpact}
							</div>
						) : null}

						<div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 grayscale-[0.35]">
							<p className="truncate font-mono text-[11px] text-slate-600">{siteName}</p>
							<p className="mt-1.5 text-sm font-medium text-slate-500">{t('mock.beforeTitle')}</p>
							<p className="mt-1.5 line-clamp-2 text-[12px] leading-relaxed text-slate-600">{t('mock.beforeDesc')}</p>
						</div>

						<ul className="flex flex-col gap-2">
							{beforeItems.map((item) => (
								<li
									key={item.label}
									className="flex gap-2.5 rounded-xl border border-slate-800 bg-slate-950/40 px-3.5 py-3"
								>
									<span className="mt-0.5 text-rose-400/80">
										<CrossIcon />
									</span>
									<div>
										<p className="text-xs font-semibold text-slate-400">{item.label}</p>
										<p className="mt-0.5 text-[11px] leading-relaxed text-slate-600">{item.detail}</p>
									</div>
								</li>
							))}
						</ul>
					</div>
				</div>

				<div className="flex justify-center" aria-hidden>
					<div className="flex h-9 w-9 items-center justify-center rounded-full border border-indigo-500/40 bg-indigo-500/15 text-indigo-300 shadow-[0_0_20px_rgba(99,102,241,0.25)]">
						↓
					</div>
				</div>

				<div className="flex flex-col overflow-hidden rounded-2xl border border-indigo-500/50 bg-gradient-to-b from-indigo-950/40 via-slate-900 to-slate-950 shadow-[0_0_30px_rgba(99,102,241,0.15)] ring-1 ring-indigo-400/20">
					<div className="flex flex-wrap items-center justify-between gap-2 border-b border-indigo-500/30 bg-indigo-500/10 px-4 py-3.5 sm:px-5">
						<div className="flex flex-wrap items-center gap-2">
							<span className="inline-flex items-center gap-1 rounded-md bg-indigo-500 px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide text-white shadow-lg shadow-indigo-500/30">
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
								{reportData?.aiSimulator.afterAnswer || t('after.aiDetail', { site: siteName })}
							</p>
						</div>

						<ul className="flex flex-col gap-2">
							{afterItems.map((item) => (
								<li
									key={item.label}
									className="flex gap-2.5 rounded-xl border border-indigo-500/20 bg-indigo-500/[0.07] px-3.5 py-3"
								>
									<span className="mt-0.5 text-indigo-300">
										<CheckIcon />
									</span>
									<div>
										<p className="text-sm font-bold text-white">{item.label}</p>
										<p className="mt-0.5 text-[12px] leading-relaxed text-slate-300">{item.detail}</p>
									</div>
								</li>
							))}
						</ul>

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
