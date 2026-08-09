'use client';

import { useTranslations } from 'next-intl';

interface ImpactPreviewSectionProps {
	siteName?: string;
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

export function ImpactPreviewSection({ siteName = 'your-site.com' }: ImpactPreviewSectionProps) {
	const t = useTranslations('audit.impact');

	const beforeItems = [
		{ label: t('before.google'), detail: t('before.googleDetail') },
		{ label: t('before.ai'), detail: t('before.aiDetail') },
		{ label: t('before.discover'), detail: t('before.discoverDetail') },
	] as const;

	const afterItems = [
		{ label: t('after.google'), detail: t('after.googleDetail') },
		{ label: t('after.ai'), detail: t('after.aiDetail', { site: siteName }) },
		{ label: t('after.discover'), detail: t('after.discoverDetail') },
	] as const;

	const benefits = [
		{ icon: '🤖', title: t('benefits.ai.title'), body: t('benefits.ai.body'), accent: 'emerald' as const },
		{ icon: '📈', title: t('benefits.ctr.title'), body: t('benefits.ctr.body'), accent: 'accent' as const },
		{ icon: '🛡️', title: t('benefits.eeat.title'), body: t('benefits.eeat.body'), accent: 'cyan' as const },
	] as const;

	return (
		<section className="flex flex-col gap-5" aria-labelledby="impact-preview-heading">
			<div>
				<h2 id="impact-preview-heading" className="text-base font-bold text-white sm:text-lg">
					{t('title')}
				</h2>
				<p className="mt-1.5 text-sm leading-relaxed text-slate-400">{t('subtitle')}</p>
			</div>

			{/* Before / After visual comparison */}
			<div className="grid gap-4 md:grid-cols-2">
				{/* BEFORE */}
				<div className="flex flex-col overflow-hidden rounded-2xl border border-rose-500/25 bg-white/[0.02]">
					<div className="flex items-center justify-between gap-2 border-b border-rose-500/20 bg-rose-500/[0.08] px-4 py-3">
						<div className="flex items-center gap-2">
							<span className="inline-flex items-center gap-1 rounded-md bg-rose-500/20 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-rose-300">
								<CrossIcon />
								{t('before.badge')}
							</span>
							<span className="text-xs font-semibold text-slate-300">{t('before.label')}</span>
						</div>
						<span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-medium text-rose-300/80">
							{t('before.scoreHint')}
						</span>
					</div>

					<div className="flex flex-1 flex-col gap-3 p-4">
						{/* Mock plain SERP */}
						<div className="rounded-xl border border-white/[0.06] bg-black/30 p-3">
							<p className="truncate text-[11px] text-slate-500">{siteName}</p>
							<p className="mt-1 text-sm font-medium text-blue-400/70">{t('mock.beforeTitle')}</p>
							<p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-slate-500">{t('mock.beforeDesc')}</p>
						</div>

						<ul className="flex flex-col gap-2">
							{beforeItems.map((item) => (
								<li
									key={item.label}
									className="flex gap-2.5 rounded-lg border border-rose-500/15 bg-rose-500/[0.04] px-3 py-2.5"
								>
									<span className="mt-0.5 text-rose-400">
										<CrossIcon />
									</span>
									<div>
										<p className="text-xs font-semibold text-slate-200">{item.label}</p>
										<p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">{item.detail}</p>
									</div>
								</li>
							))}
						</ul>
					</div>
				</div>

				{/* AFTER */}
				<div className="flex flex-col overflow-hidden rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.03] shadow-[0_0_24px_-8px_rgba(16,185,129,0.25)]">
					<div className="flex items-center justify-between gap-2 border-b border-emerald-500/25 bg-emerald-500/[0.1] px-4 py-3">
						<div className="flex items-center gap-2">
							<span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/25 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-emerald-300">
								<CheckIcon />
								{t('after.badge')}
							</span>
							<span className="text-xs font-semibold text-slate-200">{t('after.label')}</span>
						</div>
						<span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
							{t('after.scoreHint')}
						</span>
					</div>

					<div className="flex flex-1 flex-col gap-3 p-4">
						{/* Mock rich SERP card */}
						<div className="rounded-xl border border-emerald-500/20 bg-black/40 p-3">
							<div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-400">
								<span className="text-emerald-400/90">{siteName}</span>
								<span className="text-slate-600">›</span>
								<span>{t('mock.breadcrumb')}</span>
							</div>
							<p className="mt-1.5 text-sm font-semibold text-blue-400">{t('mock.afterTitle')}</p>
							<div className="mt-1.5 flex flex-wrap items-center gap-1.5">
								<span className="rounded bg-accent/20 px-1.5 py-0.5 text-[10px] font-semibold text-accent-light">
									{t('mock.richBadge')}
								</span>
								<span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-slate-400">
									{t('mock.author')}
								</span>
								<span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-slate-400">
									{t('mock.date')}
								</span>
							</div>
							<p className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-slate-400">{t('mock.afterDesc')}</p>
						</div>

						<ul className="flex flex-col gap-2">
							{afterItems.map((item) => (
								<li
									key={item.label}
									className="flex gap-2.5 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.06] px-3 py-2.5"
								>
									<span className="mt-0.5 text-emerald-400">
										<CheckIcon />
									</span>
									<div>
										<p className="text-xs font-semibold text-white">{item.label}</p>
										<p className="mt-0.5 text-[11px] leading-relaxed text-slate-400">{item.detail}</p>
									</div>
								</li>
							))}
						</ul>
					</div>
				</div>
			</div>

			{/* 3 key benefits */}
			<div className="grid grid-cols-1 gap-3 md:grid-cols-3">
				{benefits.map((benefit) => {
					const border =
						benefit.accent === 'emerald'
							? 'border-emerald-500/25 hover:border-emerald-500/45'
							: benefit.accent === 'cyan'
								? 'border-cyan-500/25 hover:border-cyan-500/45'
								: 'border-accent/25 hover:border-accent/45';
					const iconBg =
						benefit.accent === 'emerald'
							? 'bg-emerald-500/15 text-emerald-300'
							: benefit.accent === 'cyan'
								? 'bg-cyan-500/15 text-cyan-300'
								: 'bg-accent/15 text-accent-light';

					return (
						<article
							key={benefit.title}
							className={`flex flex-col gap-3 rounded-2xl border bg-white/[0.03] p-4 transition ${border}`}
						>
							<div className={`flex h-9 w-9 items-center justify-center rounded-xl text-lg ${iconBg}`}>{benefit.icon}</div>
							<div>
								<h3 className="text-sm font-bold leading-snug text-white">{benefit.title}</h3>
								<p className="mt-1.5 text-[12px] leading-relaxed text-slate-400">{benefit.body}</p>
							</div>
						</article>
					);
				})}
			</div>
		</section>
	);
}
