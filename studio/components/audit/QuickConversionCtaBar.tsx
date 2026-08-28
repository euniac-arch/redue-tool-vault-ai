'use client';

import { useLocale, useTranslations } from 'next-intl';
import { RoiEstimateTooltip } from '@/components/audit/RoiEstimateTooltip';
import type { BusinessConversionModel } from '@/lib/audit/business-conversion';
import { getFinancialImpact, isOpportunityCost, type FinancialImpactType } from '@/lib/audit/financial-impact';
import { scrollToSolutionPackages } from '@/lib/audit/solution-packages';

interface QuickConversionCtaBarProps {
	score: number;
	model?: BusinessConversionModel | null;
	urgent?: boolean;
}

interface ToneConfig {
	/** Outer panel border color. */
	container: string;
	/** Faint top-tint gradient, rendered on a clipped decorative layer (kept off the interactive container so popovers aren't clipped). */
	glow: string;
	/** Top-right pill (urgency / disclosure label). */
	badge: string;
	/** Headline currency figure — color + soft glow. */
	amount: string;
	/** CTA button gradient + resting shadow tint. */
	cta: string;
}

const TONE: Record<FinancialImpactType, ToneConfig> = {
	LOSS: {
		container: 'border-rose-500/20',
		glow: 'bg-gradient-to-b from-rose-950/20 via-slate-900/80 to-slate-900/90',
		badge: 'bg-rose-500/10 text-rose-300 border-rose-500/20',
		amount: 'text-rose-400 drop-shadow-[0_0_12px_rgba(251,113,133,0.3)]',
		cta: 'from-rose-500 to-orange-500 hover:from-rose-400 hover:to-orange-400 shadow-rose-950/50',
	},
	RECOVERABLE_LOSS: {
		container: 'border-amber-500/20',
		glow: 'bg-gradient-to-b from-amber-950/20 via-slate-900/80 to-slate-900/90',
		badge: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
		amount: 'text-amber-400 drop-shadow-[0_0_12px_rgba(251,191,36,0.3)]',
		cta: 'from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 shadow-amber-950/50',
	},
	UPSIDE: {
		container: 'border-emerald-500/20',
		glow: 'bg-gradient-to-b from-emerald-950/20 via-slate-900/80 to-slate-900/90',
		badge: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
		amount: 'text-emerald-400 drop-shadow-[0_0_12px_rgba(52,211,153,0.3)]',
		cta: 'from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 shadow-emerald-950/50',
	},
	PROTECTED: {
		container: 'border-indigo-500/20',
		glow: 'bg-gradient-to-b from-indigo-950/20 via-slate-900/80 to-slate-900/90',
		badge: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20',
		amount: 'text-indigo-400 drop-shadow-[0_0_12px_rgba(129,140,248,0.3)]',
		cta: 'from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 shadow-indigo-950/50',
	},
};

const TRIGGER_CLASS =
	'text-xs text-slate-400 underline underline-offset-2 transition-colors hover:text-slate-200';

/**
 * Splits the pre-composed `mainText` copy around its formatted currency token so the
 * amount can carry its own color/glow independent of locale phrasing.
 */
function splitAmountHighlight(mainText: string, amount: number, lang: 'ko' | 'en') {
	const formatted = amount.toLocaleString(lang === 'en' ? 'en-US' : 'ko-KR');
	const token = lang === 'en' ? `₩${formatted}` : `${formatted}원`;
	const index = mainText.indexOf(token);
	if (index === -1) return { before: mainText, token: '', after: '' };
	return { before: mainText.slice(0, index), token, after: mainText.slice(index + token.length) };
}

/** Pulls the trailing `*(...)` disclaimer note (e.g. "*(시뮬레이션 추정치)") out so it can render smaller/lighter than the headline. */
function splitDisclaimer(text: string) {
	const match = text.match(/^(.*?)(\s*\*\([^)]*\)\s*)$/);
	if (!match) return { main: text, disclaimer: '' };
	return { main: match[1], disclaimer: match[2].trim() };
}

export function QuickConversionCtaBar({ score, model = null, urgent = true }: QuickConversionCtaBarProps) {
	const t = useTranslations('audit.b2b');
	const locale = useLocale();
	const lang = locale === 'en' ? 'en' : 'ko';
	const impact = getFinancialImpact(score, lang);
	const loss = isOpportunityCost(impact.type);
	const tone = TONE[impact.type];
	const { before, token, after } = splitAmountHighlight(impact.mainText, impact.amount, lang);
	const { main: afterMain, disclaimer } = splitDisclaimer(after);

	return (
		<div
			className={`relative isolate z-10 overflow-visible rounded-2xl border p-5 shadow-xl backdrop-blur-md sm:p-6 print:hidden ${tone.container}`}
		>
			{/* Decorative gradient only — kept on its own clipped layer so the "산출근거" popover below isn't clipped by the card's rounded corners. */}
			<div className={`pointer-events-none absolute inset-0 overflow-hidden rounded-2xl ${tone.glow}`} />
			<div className="relative flex flex-col gap-4">
				<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
					<div className="flex flex-wrap items-center gap-2">
						<span className="flex items-center gap-2 text-sm font-semibold text-slate-300">
							<span aria-hidden>{impact.icon}</span>
							{loss ? t('quickCtaLossKicker') : t('quickCtaValueKicker')}
						</span>
						<span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${tone.badge}`}>
							{loss ? (urgent ? `🚨 ${t('quickCtaUrgent')}` : t('quickCtaPriority')) : t('quickCtaSimEstimate')}
						</span>
					</div>
					<RoiEstimateTooltip reasoning={impact.reasoning} model={model} triggerClassName={TRIGGER_CLASS} />
				</div>

				<div>
					<p className="font-sans text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
						{before}
						{token ? <span className={tone.amount}>{token}</span> : null}
						{afterMain}
						{disclaimer ? <span className="ml-1 text-xs font-medium sm:text-sm">{disclaimer}</span> : null}
					</p>
					<p className="mt-1 text-xs text-slate-400">{impact.subText}</p>
				</div>

				<div className="space-y-2 rounded-xl border border-slate-800/80 bg-slate-950/50 p-4 text-xs text-slate-300 sm:text-sm">
					<p className="flex gap-1.5">
						<span aria-hidden className="text-slate-500">
							•
						</span>
						<span>
							{model ? t('quickCtaTitle', { count: model.monthlySearchVolume }) : impact.reasoning}
						</span>
					</p>
					<p className="flex gap-1.5 text-slate-400">
						<span aria-hidden className="text-slate-600">
							•
						</span>
						<span>{t('quickCtaHint')}</span>
					</p>
				</div>

				<button
					type="button"
					onClick={scrollToSolutionPackages}
					className={`inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition-all duration-200 sm:w-auto ${tone.cta}`}
				>
					<span className="max-w-full whitespace-normal break-keep text-balance">{t('quickCtaButton')}</span>
				</button>
			</div>
		</div>
	);
}
