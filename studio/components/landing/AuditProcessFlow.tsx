'use client';

import { useTranslations } from 'next-intl';

const STEPS = [
	{ key: 'url', n: '①' },
	{ key: 'analyze', n: '②' },
	{ key: 'diagnose', n: '③' },
	{ key: 'extract', n: '④' },
	{ key: 'report', n: '⑤' },
] as const;

/** Horizontal 5-step audit process under the outcome cards. */
export function AuditProcessFlow() {
	const t = useTranslations('landing.process');

	return (
		<section className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-5 py-7 sm:px-8 sm:py-8">
			<h2 className="text-center text-lg font-extrabold tracking-tight text-white sm:text-xl">
				{t('title')}
			</h2>
			<ol className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-stretch">
				{STEPS.map((step, index) => (
					<li key={step.key} className="flex min-w-0 items-center lg:flex-1">
						<div className="flex w-full items-center gap-3 rounded-xl border border-white/[0.06] bg-black/25 px-3 py-3 lg:flex-col lg:gap-2 lg:px-2 lg:py-4 lg:text-center">
							<span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/20 text-sm font-black text-accent-light">
								{step.n}
							</span>
							<span className="text-sm font-semibold leading-snug text-slate-200 lg:text-xs xl:text-sm">
								{t(`steps.${step.key}`)}
							</span>
						</div>
						{index < STEPS.length - 1 ? (
							<span
								aria-hidden
								className="ml-3 hidden shrink-0 text-sm font-bold text-accent-light/70 lg:ml-2 lg:inline xl:ml-2.5"
							>
								➔
							</span>
						) : null}
					</li>
				))}
			</ol>
		</section>
	);
}
