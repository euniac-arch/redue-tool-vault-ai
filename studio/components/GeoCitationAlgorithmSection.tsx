'use client';

import { useTranslations } from 'next-intl';
import type { GeoNarrativeReport } from '@/lib/audit/geo-narrative';

interface GeoCitationAlgorithmSectionProps {
	domain: string;
	reportData?: GeoNarrativeReport | null;
}

const STEPS = [
	{
		key: 'step1' as const,
		step: 1,
		ring: 'border-cyan-500/35 bg-cyan-500/[0.07]',
		badge: 'border-cyan-500/30 bg-cyan-500/15 text-cyan-300',
		dot: 'bg-cyan-400 shadow-[0_0_16px_rgba(34,211,238,0.45)]',
		num: 'bg-cyan-500 text-slate-950',
	},
	{
		key: 'step2' as const,
		step: 2,
		ring: 'border-emerald-500/35 bg-emerald-500/[0.07]',
		badge: 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300',
		dot: 'bg-emerald-400 shadow-[0_0_16px_rgba(52,211,153,0.45)]',
		num: 'bg-emerald-500 text-slate-950',
	},
	{
		key: 'step3' as const,
		step: 3,
		ring: 'border-amber-500/35 bg-amber-500/[0.07]',
		badge: 'border-amber-500/30 bg-amber-500/15 text-amber-300',
		dot: 'bg-amber-400 shadow-[0_0_16px_rgba(251,191,36,0.45)]',
		num: 'bg-amber-500 text-slate-950',
	},
] as const;

export function GeoCitationAlgorithmSection({ domain, reportData }: GeoCitationAlgorithmSectionProps) {
	const t = useTranslations('audit.geoAlgorithm');
	const schemas = reportData?.recommendedSchemas?.filter(Boolean) ?? [];

	return (
		<section
			className="flex flex-col gap-5 rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.04] to-transparent p-5 sm:p-6"
			aria-labelledby="geo-algorithm-heading"
		>
			<div>
				<p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#D4AF37]">{t('badge')}</p>
				<h2 id="geo-algorithm-heading" className="mt-1 text-lg font-extrabold leading-snug text-white sm:text-xl">
					{t('title')}
				</h2>
				<p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">{t('subtitle')}</p>
				{reportData?.industry ? (
					<p className="mt-2 text-[12px] text-slate-400">
						<span className="font-semibold text-slate-200">{reportData.industry}</span>
						{schemas.length > 0 ? <span className="text-slate-500"> · {schemas.join(' / ')}</span> : null}
					</p>
				) : null}
			</div>

			<div className="relative">
				<div
					className="pointer-events-none absolute left-[16.66%] right-[16.66%] top-[1.35rem] hidden h-px bg-gradient-to-r from-cyan-500/50 via-emerald-500/50 to-amber-500/50 lg:block"
					aria-hidden
				/>

				<ol className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-5">
					{STEPS.map((step, index) => {
						const schemaBadge = schemas[index];
						return (
							<li key={step.key} className="relative flex flex-col">
								{index < STEPS.length - 1 ? (
									<div
										className="pointer-events-none absolute left-[1.15rem] top-10 bottom-[-1rem] w-px bg-gradient-to-b from-white/20 to-white/5 lg:hidden"
										aria-hidden
									/>
								) : null}

								<div className="relative z-[1] mb-3 flex items-center gap-3 lg:justify-center">
									<span
										className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-extrabold ring-4 ring-slate-950 ${step.num}`}
									>
										{step.step}
									</span>
									<span className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500 lg:hidden">
										{t(`${step.key}.stepLabel`)}
									</span>
									<span className={`hidden h-2 w-2 rounded-full lg:block ${step.dot}`} aria-hidden />
								</div>

								<article className={`flex h-full flex-col gap-3 rounded-2xl border p-4 sm:p-5 ${step.ring}`}>
									<span
										className={`w-fit rounded-md border px-2 py-1 font-mono text-[10px] font-semibold tracking-tight sm:text-[11px] ${step.badge}`}
									>
										{schemaBadge || t(`${step.key}.badge`)}
									</span>
									<div>
										<p className="mb-1 hidden text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500 lg:block">
											{t(`${step.key}.stepLabel`)}
										</p>
										<h3 className="text-base font-extrabold leading-snug text-white">
											{t(`${step.key}.heading`)}
										</h3>
										<p className="mt-2 text-[13px] leading-relaxed text-slate-400">
											{t(`${step.key}.description`)}
										</p>
									</div>
								</article>
							</li>
						);
					})}
				</ol>
			</div>

			<aside
				className="flex gap-3 rounded-xl border border-rose-500/30 bg-rose-500/[0.08] px-4 py-3.5 sm:px-5"
				role="status"
			>
				<span
					className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-rose-500/40 bg-rose-500/20 text-xs font-extrabold text-rose-300"
					aria-hidden
				>
					!
				</span>
				<p className="text-[13px] leading-relaxed text-rose-100/90">
					{reportData?.beforeImpact ? (
						<>
							<span className="font-mono font-bold text-rose-200">{domain}</span>
							{' — '}
							{reportData.beforeImpact}
						</>
					) : (
						t.rich('callout', {
							domain: (chunks) => (
								<span className="font-mono font-bold text-rose-200">
									{domain || chunks}
								</span>
							),
						})
					)}
				</p>
			</aside>
		</section>
	);
}
