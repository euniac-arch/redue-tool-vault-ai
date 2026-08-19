'use client';

import { useTranslations } from 'next-intl';

const BEFORE_TAGS = ['brand', 'signal'] as const;
const AFTER_TAGS = ['reach', 'rank'] as const;
const SUMMARY = [
	{ key: 'reach', className: 'font-semibold text-white' },
	{ key: 'cite', className: 'font-semibold text-cyan-400' },
	{ key: 'score', className: 'font-semibold text-emerald-400' },
] as const;

export function ContrastSimulator() {
	const t = useTranslations('landing.story.contrast');

	return (
		<section className="mt-20 border-t border-slate-800/80 bg-[#070B14] py-16 sm:mt-24 sm:py-20">
			<div className="mx-auto max-w-[960px] px-4 sm:px-6">
				<div className="mx-auto mb-10 max-w-[640px] text-center">
					<span className="inline-block rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-widest text-cyan-400">
						{t('kicker')}
					</span>
					<h2 className="mt-3 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">{t('title')}</h2>
					<p className="mt-2 text-sm leading-relaxed text-slate-400 sm:text-base">{t('subtitle')}</p>
				</div>

				<div className="grid grid-cols-1 items-stretch gap-6 md:grid-cols-2">
					<article className="relative flex flex-col justify-between overflow-hidden rounded-2xl border border-rose-500/20 bg-slate-900/50 p-6">
						<div>
							<div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
								<div className="flex items-center gap-2">
									<span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
									<span className="font-mono text-xs font-bold uppercase tracking-wider text-rose-400">
										{t('beforeLabel')}
									</span>
								</div>
								<span className="rounded border border-slate-700 bg-slate-800 px-2.5 py-0.5 text-[11px] font-bold text-slate-400">
									{t('beforeLevel')}
								</span>
							</div>

							<div className="mt-5 rounded-xl border border-slate-800 bg-slate-950/80 p-3.5">
								<span className="mb-1 block text-[11px] font-semibold text-slate-500">{t('queryLabel')}</span>
								<p className="break-keep text-xs font-medium text-slate-200 sm:text-sm">“{t('query')}”</p>
							</div>

							<div className="mt-4 space-y-2 rounded-xl border border-rose-500/20 bg-rose-950/20 p-4">
								<div className="flex items-center gap-1.5 text-xs font-bold text-rose-400">
									<span>{t('beforeResultLabel')}</span>
									<span>{t('beforeResultTitle')}</span>
								</div>
								<p className="text-xs leading-relaxed text-slate-400">{t('beforeReply')}</p>
							</div>
						</div>

						<div className="mt-6 flex flex-wrap gap-1.5 border-t border-slate-800/60 pt-4">
							{BEFORE_TAGS.map((key) => (
								<span
									key={key}
									className="rounded border border-rose-500/20 bg-rose-500/10 px-2 py-0.5 text-[11px] text-rose-300"
								>
									{t(`beforeTags.${key}`)}
								</span>
							))}
						</div>
					</article>

					<article className="relative flex flex-col justify-between overflow-hidden rounded-2xl border-2 border-cyan-500/50 bg-gradient-to-b from-slate-900 via-slate-900 to-cyan-950/30 p-6 shadow-[0_0_35px_rgba(6,182,212,0.12)]">
						<div>
							<div className="flex items-center justify-between border-b border-cyan-500/30 pb-4">
								<div className="flex items-center gap-2">
									<span className="h-2.5 w-2.5 animate-pulse rounded-full bg-cyan-400" />
									<span className="font-mono text-xs font-bold uppercase tracking-wider text-cyan-300">
										{t('afterLabel')}
									</span>
								</div>
								<span className="rounded border border-cyan-400/40 bg-cyan-500/20 px-2.5 py-0.5 text-[11px] font-bold text-cyan-200">
									{t('afterLevel')}
								</span>
							</div>

							<div className="mt-5 rounded-xl border border-cyan-500/30 bg-slate-950/90 p-3.5">
								<span className="mb-1 block text-[11px] font-semibold text-cyan-400">{t('queryLabel')}</span>
								<p className="break-keep text-xs font-medium text-white sm:text-sm">“{t('query')}”</p>
							</div>

							<div className="mt-4 space-y-2 rounded-xl border border-cyan-500/30 bg-cyan-950/40 p-4">
								<div className="flex flex-wrap items-center gap-1.5 text-xs font-bold text-cyan-300">
									<span>{t('afterResultLabel')}</span>
									<span className="break-keep font-extrabold text-white underline decoration-cyan-400">
										{t('afterBrand')}
									</span>
								</div>
								<p className="break-keep text-xs leading-relaxed text-slate-200">
									{t.rich('afterReply', {
										brand: (chunks) => <strong className="break-keep text-cyan-200">{chunks}</strong>,
									})}
								</p>
								<div className="break-keep pt-1 font-mono text-[11px] text-cyan-300/80">{t('afterSource')}</div>
							</div>
						</div>

						<div className="mt-6 flex flex-wrap gap-1.5 border-t border-cyan-500/20 pt-4">
							{AFTER_TAGS.map((key) => (
								<span
									key={key}
									className={
										key === 'rank'
											? 'rounded border border-emerald-500/30 bg-emerald-500/20 px-2 py-0.5 text-[11px] font-medium text-emerald-300'
											: 'rounded border border-cyan-400/30 bg-cyan-500/20 px-2 py-0.5 text-[11px] font-medium text-cyan-200'
									}
								>
									{t(`afterTags.${key}`)}
								</span>
							))}
						</div>
					</article>
				</div>

				<div className="mt-8 rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-center">
					<p className="text-xs text-slate-400 sm:text-sm">
						🚀{' '}
						{SUMMARY.map(({ key, className }, index) => (
							<span key={key}>
								{index > 0 ? ' · ' : null}
								<span className={className}>{t(`summary.${key}`)}</span>
							</span>
						))}
					</p>
				</div>
			</div>
		</section>
	);
}
