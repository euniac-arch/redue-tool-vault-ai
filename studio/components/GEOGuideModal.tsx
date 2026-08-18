'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { AlertTriangle, Bot, CheckCircle2, FileCode2, Gauge, Lightbulb, Sparkles, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface GEOGuideModalProps {
	open: boolean;
	onClose: () => void;
	onStartDiagnose: () => void;
}

const POINT_KEYS = ['0', '1', '2'] as const;
const SCORE_RANGE_KEYS = ['safe', 'warning', 'danger'] as const;
const SCORE_PILLAR_KEYS = ['geo', 'schema'] as const;
const SCORE_FAQ_KEYS = ['highScore', 'brandSearch'] as const;

type ScoreRangeKey = (typeof SCORE_RANGE_KEYS)[number];
type ScorePillarKey = (typeof SCORE_PILLAR_KEYS)[number];

const SCORE_RANGE_STYLES = {
	safe: {
		card: 'border-emerald-300/60 bg-emerald-50 dark:border-emerald-400/25 dark:bg-emerald-500/10',
		badge: 'text-emerald-800 dark:text-emerald-300',
		label: 'text-emerald-700 dark:text-emerald-400',
		body: 'text-emerald-950 dark:text-emerald-50/90',
		muted: 'text-emerald-900/75 dark:text-emerald-100/70',
	},
	warning: {
		card: 'border-amber-300/70 bg-amber-50 dark:border-amber-400/25 dark:bg-amber-500/10',
		badge: 'text-amber-800 dark:text-amber-300',
		label: 'text-amber-700 dark:text-amber-400',
		body: 'text-amber-950 dark:text-amber-50/90',
		muted: 'text-amber-900/75 dark:text-amber-100/70',
	},
	danger: {
		card: 'border-rose-300/70 bg-rose-50 dark:border-rose-400/25 dark:bg-rose-500/10',
		badge: 'text-rose-800 dark:text-rose-300',
		label: 'text-rose-700 dark:text-rose-400',
		body: 'text-rose-950 dark:text-rose-50/90',
		muted: 'text-rose-900/75 dark:text-rose-100/70',
	},
} as const;

const SCORE_PILLAR_CHROME = {
	geo: {
		card: 'border-indigo-200 bg-gradient-to-br from-indigo-50 via-violet-50 to-white dark:border-indigo-400/20 dark:from-[#0E1140] dark:via-[#1B1150] dark:to-[#0A0C2E]',
		kicker: 'text-indigo-700 dark:text-indigo-200/85',
		iconWrap: 'border-indigo-400/30 bg-indigo-500/15 text-indigo-700 dark:text-indigo-300',
		tabActive:
			'border-cyan-400 bg-gradient-to-r from-cyan-500/25 via-indigo-500/25 to-fuchsia-500/25 text-slate-900 dark:text-white shadow-[0_0_0_1px_rgba(34,211,238,0.5)]',
		Icon: Bot,
	},
	schema: {
		card: 'border-slate-200 bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:border-white/[0.08] dark:from-slate-950 dark:via-[#0B1220] dark:to-slate-900',
		kicker: 'text-slate-600 dark:text-slate-400',
		iconWrap: 'border-slate-300 bg-slate-100 text-slate-700 dark:border-white/15 dark:bg-white/10 dark:text-slate-300',
		tabActive:
			'border-cyan-400 bg-gradient-to-r from-cyan-500/25 via-indigo-500/25 to-fuchsia-500/25 text-slate-900 dark:text-white shadow-[0_0_0_1px_rgba(34,211,238,0.5)]',
		Icon: FileCode2,
	},
} as const;

function highlightScore(chunks: ReactNode) {
	return <span className="text-emerald-500 font-bold">{chunks}</span>;
}

function headTag() {
	return (
		<code className="rounded bg-black/5 px-1 py-0.5 font-mono text-[12px] font-semibold text-slate-800 dark:bg-white/10 dark:text-slate-100">
			{'<head>'}
		</code>
	);
}

function ScoreRangeCard({ pillar, rangeKey }: { pillar: ScorePillarKey; rangeKey: ScoreRangeKey }) {
	const t = useTranslations('landing.guideModal.scoreGuide');
	const styles = SCORE_RANGE_STYLES[rangeKey];
	const rangePath = `pillars.${pillar}.ranges.${rangeKey}` as const;

	return (
		<article className={`flex min-w-0 flex-col rounded-xl border px-3.5 py-3 sm:px-4 sm:py-3.5 ${styles.card}`}>
			<div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
				<p className={`break-keep text-sm font-extrabold leading-snug ${styles.badge}`}>
					{rangeKey === 'safe'
						? t.rich(`${rangePath}.range`, { highlight: highlightScore })
						: t(`${rangePath}.range`)}
				</p>
				<p className={`break-keep text-[11px] font-bold uppercase tracking-wider ${styles.badge}`}>
					{t(`${rangePath}.badge`)}
				</p>
			</div>
			<dl className="mt-2.5 flex flex-col gap-2">
				<div>
					<dt className={`text-[11px] font-bold uppercase tracking-wider ${styles.label}`}>{t('statusLabel')}</dt>
					<dd className={`mt-1 break-keep text-sm leading-relaxed ${styles.muted}`}>
						{t(`${rangePath}.status`)}
					</dd>
				</div>
				<div>
					<dt className={`text-[11px] font-bold uppercase tracking-wider ${styles.label}`}>{t('guideLabel')}</dt>
					<dd className={`mt-1 break-keep text-sm font-bold leading-relaxed ${styles.body}`}>
						{t.rich(`${rangePath}.guide`, { highlight: highlightScore, headTag })}
					</dd>
				</div>
			</dl>
		</article>
	);
}

function ScorePillarCard({ pillar }: { pillar: ScorePillarKey }) {
	const t = useTranslations('landing.guideModal.scoreGuide');
	const chrome = SCORE_PILLAR_CHROME[pillar];
	const Icon = chrome.Icon;

	return (
		<article className={`flex h-full min-w-0 flex-col rounded-2xl border p-4 sm:p-5 ${chrome.card}`}>
			<div className="flex items-start gap-3">
				<span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${chrome.iconWrap}`}>
					<Icon className="h-4 w-4" aria-hidden />
				</span>
				<div className="min-w-0">
					<p className={`text-[11px] font-bold uppercase tracking-[0.14em] ${chrome.kicker}`}>
						{t(`pillars.${pillar}.kicker`)}
					</p>
					<h4 className="mt-1 break-keep text-[15px] font-extrabold leading-snug text-slate-900 dark:text-white sm:text-base">
						{t(`pillars.${pillar}.title`)}
					</h4>
				</div>
			</div>
			<p className="mt-3 break-keep text-sm leading-relaxed text-slate-600 dark:text-slate-400">
				{t(`pillars.${pillar}.concept`)}
			</p>
			<p className="mt-2 break-keep text-sm leading-relaxed text-slate-700 dark:text-slate-300">
				{t.rich(`pillars.${pillar}.safeLine`, { highlight: highlightScore })}
			</p>
			<div className="mt-4 flex flex-1 flex-col gap-2.5 sm:gap-3">
				{SCORE_RANGE_KEYS.map((rangeKey) => (
					<ScoreRangeCard key={rangeKey} pillar={pillar} rangeKey={rangeKey} />
				))}
			</div>
		</article>
	);
}

function ScoreRangeGuideSection() {
	const t = useTranslations('landing.guideModal.scoreGuide');
	const [activePillar, setActivePillar] = useState<ScorePillarKey>('geo');

	return (
		<section>
			<div className="flex items-start gap-3">
				<span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-400/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
					<Gauge className="h-4 w-4" aria-hidden />
				</span>
				<div className="min-w-0">
					<h3 className="break-keep text-base font-extrabold leading-snug text-slate-900 dark:text-white sm:text-lg">
						{t('title')}
					</h3>
					<p className="mt-1.5 break-keep text-sm leading-relaxed text-slate-600 dark:text-slate-400">
						{t('intro')}
					</p>
					<p className="mt-1.5 break-keep text-sm leading-relaxed text-slate-700 dark:text-slate-300">
						{t.rich('threshold', { highlight: highlightScore })}
					</p>
				</div>
			</div>

			<nav
				className="mt-4 grid grid-cols-1 gap-2 rounded-2xl border border-slate-200 bg-white p-2 dark:border-white/[0.08] dark:bg-white/[0.02] md:hidden"
				aria-label={t('tabsAria')}
			>
				{SCORE_PILLAR_KEYS.map((key, index) => {
					const active = activePillar === key;
					return (
						<button
							key={key}
							type="button"
							aria-pressed={active}
							onClick={() => setActivePillar(key)}
							className={`flex w-full items-center gap-2.5 rounded-xl border-2 px-3.5 py-3 text-left text-sm font-extrabold leading-snug transition ${
								active
									? SCORE_PILLAR_CHROME[key].tabActive
									: 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-400 dark:hover:border-white/20 dark:hover:bg-white/[0.07]'
							}`}
						>
							<span
								className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold ${
									active ? 'bg-cyan-400 text-[#0B1030]' : 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-400'
								}`}
							>
								{index + 1}
							</span>
							<span className="min-w-0 break-keep">{t(`pillars.${key}.tab`)}</span>
						</button>
					);
				})}
			</nav>

			<div className="mt-3 md:hidden">
				<ScorePillarCard pillar={activePillar} />
			</div>

			<div className="mt-4 hidden grid-cols-2 items-stretch gap-4 md:grid">
				{SCORE_PILLAR_KEYS.map((key) => (
					<ScorePillarCard key={key} pillar={key} />
				))}
			</div>

			<div className="mt-4 flex flex-col gap-3">
				<p className="break-keep text-sm font-extrabold text-slate-900 dark:text-white">{t('faqTitle')}</p>
				{SCORE_FAQ_KEYS.map((key) => (
					<div
						key={key}
						className="rounded-xl border border-indigo-200 bg-indigo-50/70 p-3.5 dark:border-indigo-400/20 dark:bg-indigo-500/10 sm:p-4"
					>
						<div className="flex items-start gap-2.5">
							<Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-300" aria-hidden />
							<div className="min-w-0">
								<p className="break-keep text-sm font-extrabold leading-snug text-indigo-950 dark:text-indigo-100">
									{t(`faqs.${key}.question`)}
								</p>
								<p className="mt-1.5 break-keep text-sm leading-relaxed text-slate-600 dark:text-slate-400">
									{t.rich(`faqs.${key}.answer`, { highlight: highlightScore })}
								</p>
							</div>
						</div>
					</div>
				))}
			</div>
		</section>
	);
}

/**
 * Marketing white paper overlay: why GEO/SEO matters, schema impact, and
 * the cost of inaction. CTA returns the visitor to the landing audit form.
 */
export function GEOGuideModal({ open, onClose, onStartDiagnose }: GEOGuideModalProps) {
	const t = useTranslations('landing.guideModal');

	useEffect(() => {
		if (!open) return;
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') onClose();
		};
		window.addEventListener('keydown', onKeyDown);
		const prevOverflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		return () => {
			window.removeEventListener('keydown', onKeyDown);
			document.body.style.overflow = prevOverflow;
		};
	}, [open, onClose]);

	if (!open) return null;

	return (
		<div
			className="print:hidden fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
			role="dialog"
			aria-modal="true"
			aria-labelledby="geo-guide-modal-title"
			aria-describedby="geo-guide-modal-subtitle"
			onClick={onClose}
		>
			<div
				className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#0B1028] sm:max-h-[90vh] sm:rounded-2xl"
				onClick={(event) => event.stopPropagation()}
			>
				<header className="shrink-0 border-b border-slate-200 px-4 py-4 dark:border-white/10 sm:px-6 sm:py-5 md:px-8">
					<div className="flex items-start justify-between gap-3">
						<div className="min-w-0">
							<p className="text-[11px] font-bold uppercase tracking-[0.18em] text-indigo-700 dark:text-[#D4AF37]">
								{t('kicker')}
							</p>
							<h2
								id="geo-guide-modal-title"
								className="mt-1.5 break-keep text-lg font-extrabold leading-snug tracking-tight text-slate-900 dark:text-white sm:text-xl md:text-2xl"
							>
								{t('title')}
							</h2>
							<p
								id="geo-guide-modal-subtitle"
								className="mt-2 max-w-2xl break-keep text-sm leading-relaxed text-slate-600 dark:text-slate-400"
							>
								{t('subtitle')}
							</p>
							<p className="mt-2 text-[11px] font-semibold tracking-wide text-slate-400 dark:text-slate-500">
								{t('readTime')}
							</p>
						</div>
						<button
							type="button"
							onClick={onClose}
							className="shrink-0 rounded-lg border border-slate-200 p-1.5 text-slate-500 transition hover:bg-slate-50 hover:text-slate-800 dark:border-white/10 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
							aria-label={t('closeAria')}
						>
							<X className="h-4 w-4" aria-hidden />
						</button>
					</div>
				</header>

				<div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6 md:px-8">
					<article className="flex flex-col gap-7 sm:gap-8">
						<section>
							<div className="flex items-start gap-3">
								<span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-indigo-400/30 bg-indigo-500/15 text-indigo-700 dark:text-indigo-300">
									<Sparkles className="h-4 w-4" aria-hidden />
								</span>
								<h3 className="break-keep text-base font-extrabold leading-snug text-slate-900 dark:text-white sm:text-lg">
									{t('paradigm.title')}
								</h3>
							</div>
							<p className="mt-3 break-keep text-[15px] font-semibold leading-relaxed text-slate-800 dark:text-slate-200">
								{t('paradigm.lead')}
							</p>
							<p className="mt-2 break-keep text-sm leading-relaxed text-slate-600 dark:text-slate-400">
								{t('paradigm.body')}
							</p>
							<ul className="mt-4 flex flex-col gap-2">
								{POINT_KEYS.map((key) => (
									<li
										key={key}
										className="flex gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm leading-relaxed text-slate-700 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-slate-300"
									>
										<CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400" aria-hidden />
										<span className="break-keep">{t(`paradigm.points.${key}`)}</span>
									</li>
								))}
							</ul>
						</section>

						<section>
							<div className="flex items-start gap-3">
								<span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-violet-400/30 bg-violet-500/15 text-violet-700 dark:text-violet-300">
									<FileCode2 className="h-4 w-4" aria-hidden />
								</span>
								<h3 className="break-keep text-base font-extrabold leading-snug text-slate-900 dark:text-white sm:text-lg">
									{t('schema.title')}
								</h3>
							</div>
							<p className="mt-3 break-keep text-[15px] font-semibold leading-relaxed text-slate-800 dark:text-slate-200">
								{t('schema.lead')}
							</p>
							<p className="mt-2 break-keep text-sm leading-relaxed text-slate-600 dark:text-slate-400">
								{t('schema.body')}
							</p>
							<div className="mt-4 grid gap-3 sm:grid-cols-2">
								<div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-white/[0.08] dark:bg-black/20">
									<p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{t('schema.beforeTitle')}</p>
									<ul className="mt-2.5 flex flex-col gap-2">
										{POINT_KEYS.map((key) => (
											<li key={key} className="flex gap-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
												<span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" aria-hidden />
												<span className="break-keep">{t(`schema.before.${key}`)}</span>
											</li>
										))}
									</ul>
								</div>
								<div className="rounded-xl border border-emerald-300/50 bg-emerald-50 p-4 dark:border-emerald-400/25 dark:bg-emerald-500/10">
									<p className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
										{t('schema.afterTitle')}
									</p>
									<ul className="mt-2.5 flex flex-col gap-2">
										{POINT_KEYS.map((key) => (
											<li key={key} className="flex gap-2 text-sm leading-relaxed text-emerald-900 dark:text-emerald-100/90">
												<CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
												<span className="break-keep">{t(`schema.after.${key}`)}</span>
											</li>
										))}
									</ul>
								</div>
							</div>
						</section>

						<section>
							<div className="flex items-start gap-3">
								<span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-cyan-400/30 bg-cyan-500/15 text-cyan-800 dark:text-cyan-300">
									<Bot className="h-4 w-4" aria-hidden />
								</span>
								<h3 className="break-keep text-base font-extrabold leading-snug text-slate-900 dark:text-white sm:text-lg">
									{t('geo.title')}
								</h3>
							</div>
							<p className="mt-3 break-keep text-[15px] font-semibold leading-relaxed text-slate-800 dark:text-slate-200">
								{t('geo.lead')}
							</p>
							<p className="mt-2 break-keep text-sm leading-relaxed text-slate-600 dark:text-slate-400">
								{t('geo.body')}
							</p>
							<ul className="mt-4 flex flex-col gap-2">
								{POINT_KEYS.map((key) => (
									<li
										key={key}
										className="flex gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm leading-relaxed text-slate-700 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-slate-300"
									>
										<CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-700 dark:text-cyan-400" aria-hidden />
										<span className="break-keep">{t(`geo.points.${key}`)}</span>
									</li>
								))}
							</ul>
						</section>

						<ScoreRangeGuideSection />

						<section className="rounded-2xl border border-rose-300/70 bg-gradient-to-br from-rose-50 via-white to-rose-50/60 p-4 dark:border-rose-500/35 dark:from-rose-950/50 dark:via-[#140b12] dark:to-rose-950/30 sm:p-5">
							<div className="flex items-start gap-3">
								<span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-rose-400/40 bg-rose-500/15 text-rose-700 dark:text-rose-300">
									<AlertTriangle className="h-4 w-4" aria-hidden />
								</span>
								<h3 className="break-keep text-base font-extrabold leading-snug text-rose-900 dark:text-rose-100 sm:text-lg">
									{t('risks.title')}
								</h3>
							</div>
							<p className="mt-3 break-keep text-sm font-medium leading-relaxed text-rose-900/80 dark:text-rose-100/80">
								{t('risks.lead')}
							</p>
							<ol className="mt-4 flex flex-col gap-3">
								{POINT_KEYS.map((key, index) => (
									<li
										key={key}
										className="rounded-xl border border-rose-200 bg-white/80 p-3.5 dark:border-rose-500/20 dark:bg-black/25 sm:p-4"
									>
										<p className="flex items-start gap-2 text-sm font-extrabold text-rose-800 dark:text-rose-200">
											<span className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-600 text-[11px] font-black text-white dark:bg-rose-500">
												{index + 1}
											</span>
											<span className="break-keep">{t(`risks.items.${key}.title`)}</span>
										</p>
										<p className="mt-1.5 break-keep pl-7 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
											{t(`risks.items.${key}.body`)}
										</p>
									</li>
								))}
							</ol>
						</section>
					</article>
				</div>

				<footer className="shrink-0 border-t border-slate-200 bg-white px-4 py-4 dark:border-white/10 dark:bg-[#0B1028] sm:px-6 md:px-8">
					<button
						type="button"
						onClick={onStartDiagnose}
						className="w-full rounded-xl bg-accent px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-accent/30 transition hover:bg-accent-light"
					>
						{t('cta')}
					</button>
					<p className="mt-2 text-center text-[11px] leading-relaxed text-slate-500">{t('ctaNote')}</p>
				</footer>
			</div>
		</div>
	);
}
