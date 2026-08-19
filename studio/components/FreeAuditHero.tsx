'use client';

import { useTranslations } from 'next-intl';
import { AUDIT_HERO_ID, AUDIT_START_AREA_ID } from '@/components/landing/scroll-to-audit';
import { UrlAuditForm } from '@/components/landing/UrlAuditForm';

const HERO_POINTS = [
	{ key: 'speed', emoji: '⚡', tone: 'cyan' },
	{ key: 'unified', emoji: '📊', tone: 'slate' },
	{ key: 'actionable', emoji: '💡', tone: 'emerald' },
] as const;

const POINT_TONE_CLASS = {
	cyan: 'border-cyan-500/20 font-semibold text-cyan-300 shadow-sm',
	slate: 'border-slate-800 font-medium text-slate-300',
	emerald: 'border-emerald-500/20 font-semibold text-emerald-300 shadow-sm',
} as const;

/**
 * Landing hero: glassmorphism box → H1 → subcopy → 3 proof chips → URL scan CTA.
 *
 * `initialUrl` + `autoSubmit` power `/diagnose?domain=&target_id=` from the admin list.
 */
export function FreeAuditHero({
	initialUrl = '',
	extraQuery,
	autoSubmit = false,
}: {
	initialUrl?: string;
	extraQuery?: Record<string, string>;
	autoSubmit?: boolean;
} = {}) {
	const t = useTranslations('hero');

	return (
		<section
			id={AUDIT_HERO_ID}
			className="relative isolate flex min-h-[640px] w-full scroll-mt-24 items-center justify-center overflow-hidden bg-[#050714] py-16 font-['Pretendard',sans-serif] tracking-tight sm:py-24"
		>
			<div className="pointer-events-none absolute inset-0 select-none overflow-hidden" aria-hidden>
				<img
					src="/images/hero-bg.png"
					alt=""
					className="absolute inset-0 h-full w-full object-cover object-center opacity-85"
				/>
				<div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-[#050714] via-[#050714]/40 to-transparent" />
				<div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#050714] via-[#050714]/40 to-transparent" />
				<div className="absolute inset-0 bg-[#050714]/30" />
			</div>

			<div className="relative z-10 mx-auto w-full max-w-[960px] px-4 sm:px-6">
				<div className="relative overflow-hidden rounded-3xl border border-cyan-500/30 bg-gradient-to-b from-slate-900/90 via-slate-900/60 to-[#0B1120]/95 p-6 text-center shadow-[0_0_60px_rgba(6,182,212,0.12)] backdrop-blur-xl sm:p-12">
					<div
						className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-500/15 via-transparent to-transparent"
						aria-hidden
					/>
					<div
						className="pointer-events-none absolute -top-24 left-1/2 h-48 w-96 -translate-x-1/2 rounded-full bg-cyan-500/20 blur-[80px]"
						aria-hidden
					/>

					<div className="relative z-10 mb-6 inline-flex max-w-full flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-2xl border border-slate-800 bg-slate-950/80 px-3 py-1.5 text-[11px] text-slate-300 sm:rounded-full sm:text-xs">
						<span className="relative flex h-2 w-2 shrink-0">
							<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75" />
							<span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-500" />
						</span>
						<span className="font-medium text-cyan-300">{t('enginesLive')}</span>
						<span className="text-slate-600" aria-hidden>
							|
						</span>
						<span className="text-slate-400">{t('enginesProxy')}</span>
					</div>

					<div className="relative z-10 mx-auto max-w-[760px] space-y-2">
						<h1 className="text-3xl font-black leading-tight tracking-tight text-white sm:text-5xl sm:leading-tight">
							<span className="block break-keep">{t('titleLine1')}</span>
							<span className="block break-keep bg-gradient-to-r from-cyan-300 via-teal-200 to-emerald-400 bg-clip-text text-transparent">
								{t('titleLine2')}
							</span>
						</h1>
						<p className="mx-auto max-w-[620px] break-keep pt-2 text-sm font-normal leading-relaxed text-slate-400 sm:text-lg">
							{t('descriptionLine1')} {t('descriptionLine2')}
						</p>
					</div>

					<div className="relative z-10 my-8 flex flex-wrap items-center justify-center gap-2.5">
						{HERO_POINTS.map(({ key, emoji, tone }) => (
							<span
								key={key}
								className={`inline-flex items-center gap-1.5 rounded-xl border bg-slate-950/70 px-3.5 py-1.5 text-xs sm:text-sm ${POINT_TONE_CLASS[tone]}`}
							>
								<span aria-hidden>{emoji}</span>
								{t(`points.${key}`)}
							</span>
						))}
					</div>

					<div id={AUDIT_START_AREA_ID} className="relative z-10">
						<UrlAuditForm
							initialUrl={initialUrl}
							extraQuery={extraQuery}
							autoSubmit={autoSubmit}
							variant="hero"
						/>
						<p className="mt-3.5 break-keep text-[11px] text-slate-500 sm:text-xs">{t('formHint')}</p>
						<p className="mx-auto mt-2 max-w-[620px] break-keep text-[10px] leading-relaxed text-slate-600 sm:text-[11px]">
							{t('formDisclaimer')}
						</p>
					</div>
				</div>
			</div>
		</section>
	);
}
