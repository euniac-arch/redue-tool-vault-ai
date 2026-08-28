import Link from 'next/link';
import { buildAuditEngineHref, industryCodeToSlug } from '@/lib/audit/industry-preset';
import { CARD, CARD_HOVER, CHIP, GRADIENT_TEXT, PILL } from './industry-ui';
import {
	COMMON_ENGINE_LAYERS,
	CORE_FRAMEWORK,
	ENGINE_INDUSTRIES,
	LOCAL_QUERY_EXAMPLES,
	PAGE_COPY,
	WEIGHT_PROFILES,
	WHY_INDUSTRY_CARDS,
	tx,
	type IndustryPageLang,
} from './industry-page-data';
import { FlowArrow, IndustryReveal, IndustryStagger, SectionHeader, StarRating, staggerStyle } from './IndustryPrimitives';

export function IndustryWhySection({ lang }: { lang: IndustryPageLang }) {
	return (
		<section className="flex flex-col gap-6 sm:gap-8">
			<IndustryReveal>
				<SectionHeader
					kicker={tx(lang, PAGE_COPY.whyKicker)}
					title={tx(lang, PAGE_COPY.whyTitle)}
					subtitle={tx(lang, PAGE_COPY.whySubtitle)}
				/>
			</IndustryReveal>

			<IndustryStagger className="flex flex-wrap items-center justify-center gap-2">
				{LOCAL_QUERY_EXAMPLES.map((query, index) => (
					<span key={query.ko} className={`industry-stagger-item ${CHIP} sm:text-xs`} style={staggerStyle(index)}>
						{tx(lang, query)}
					</span>
				))}
			</IndustryStagger>

			<IndustryStagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{WHY_INDUSTRY_CARDS.map((card, index) => (
					<article
						key={card.code}
						className={`industry-stagger-item ${CARD} ${CARD_HOVER} flex min-w-0 flex-col gap-4 p-5 sm:p-6`}
						style={staggerStyle(index)}
					>
						<div className="flex items-center justify-between gap-3">
							<h3 className={`${PILL}`}>{card.code}</h3>
							<span className="text-xs font-semibold text-slate-500">{tx(lang, card.label)}</span>
						</div>
						<div className="industry-card-signals flex flex-wrap gap-1.5">
							{card.signals.map((signal) => (
								<span key={signal.ko} className={CHIP}>
									{tx(lang, signal)}
								</span>
							))}
						</div>
						<Link
							href={buildAuditEngineHref({ industry: industryCodeToSlug(card.code) })}
							className="mt-auto inline-flex w-fit items-center gap-1.5 rounded-lg bg-cyan-600 px-3 py-2 text-xs font-bold text-white transition-all hover:-translate-y-0.5 hover:bg-cyan-500"
						>
							{tx(lang, PAGE_COPY.startDiagnose)}
							<span aria-hidden>➔</span>
						</Link>
					</article>
				))}
			</IndustryStagger>
		</section>
	);
}

export function IndustryEngineSection({ lang }: { lang: IndustryPageLang }) {
	return (
		<section className="flex flex-col gap-6 sm:gap-8">
			<IndustryReveal>
				<SectionHeader kicker={tx(lang, PAGE_COPY.engineKicker)} title={tx(lang, PAGE_COPY.engineTitle)} />
			</IndustryReveal>

			<IndustryStagger className={`industry-engine ${CARD} mx-auto w-full max-w-3xl overflow-hidden p-5 text-center sm:p-8`}>
				<div className="industry-stagger-item" style={staggerStyle(0)}>
					<p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">{tx(lang, PAGE_COPY.engineCommon)}</p>
					<div className="mt-4 flex flex-wrap items-center justify-center gap-2">
						{COMMON_ENGINE_LAYERS.map((layer) => (
							<span key={layer} className={PILL}>
								{layer}
							</span>
						))}
					</div>
				</div>

				<div className="industry-stagger-item" style={staggerStyle(1)}>
					<FlowArrow index={1} />
				</div>

				<p className={`industry-stagger-item text-sm font-extrabold ${GRADIENT_TEXT}`} style={staggerStyle(2)}>
					{tx(lang, PAGE_COPY.engineProfile)}
				</p>

				<div className="industry-stagger-item" style={staggerStyle(3)}>
					<FlowArrow index={3} />
				</div>

				<div className="industry-stagger-item flex flex-wrap items-center justify-center gap-2" style={staggerStyle(4)}>
					{ENGINE_INDUSTRIES.map((industry) => (
						<span key={industry} className={CHIP}>
							{industry}
						</span>
					))}
				</div>

				<div className="industry-stagger-item" style={staggerStyle(5)}>
					<FlowArrow index={5} />
				</div>

				<p className="industry-stagger-item text-sm font-extrabold text-slate-900 dark:text-white" style={staggerStyle(6)}>
					{tx(lang, PAGE_COPY.engineResult)}
				</p>
			</IndustryStagger>

			<IndustryReveal delayMs={80}>
				<p className="px-2 text-center text-base font-bold text-slate-800 sm:text-lg dark:text-slate-100">
					<span className={GRADIENT_TEXT}>{tx(lang, PAGE_COPY.engineFormula)}</span>
				</p>
			</IndustryReveal>
		</section>
	);
}

export function IndustryFrameworkSection({ lang }: { lang: IndustryPageLang }) {
	return (
		<section className="flex flex-col gap-6 sm:gap-8">
			<IndustryReveal>
				<SectionHeader
					kicker={tx(lang, PAGE_COPY.frameworkKicker)}
					title={tx(lang, PAGE_COPY.frameworkTitle)}
					subtitle={tx(lang, PAGE_COPY.frameworkNote)}
				/>
			</IndustryReveal>

			<IndustryStagger className="grid gap-3 sm:grid-cols-2">
				{CORE_FRAMEWORK.map((item, index) => (
					<article
						key={item.no}
						className={`industry-stagger-item ${CARD} ${CARD_HOVER} flex min-w-0 items-center gap-3 p-4 sm:gap-4 sm:px-5`}
						style={staggerStyle(index)}
					>
						<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-cyan-200 bg-cyan-50 font-mono text-sm font-extrabold text-cyan-700 dark:border-[#0C9AA7]/30 dark:bg-[#0C9AA7]/10 dark:text-[#5fdbe3]">
							{item.no}
						</span>
						<h3 className="min-w-0 break-keep text-sm font-bold text-slate-900 sm:text-[15px] dark:text-white">
							{tx(lang, item.title)}
						</h3>
					</article>
				))}
			</IndustryStagger>
		</section>
	);
}

export function IndustryWeightsSection({ lang }: { lang: IndustryPageLang }) {
	return (
		<section className="flex flex-col gap-6 sm:gap-8">
			<IndustryReveal>
				<SectionHeader kicker={tx(lang, PAGE_COPY.weightsKicker)} title={tx(lang, PAGE_COPY.weightsTitle)} />
			</IndustryReveal>

			<IndustryStagger className="grid gap-5 md:grid-cols-3">
				{WEIGHT_PROFILES.map((profile, index) => (
					<article
						key={profile.code}
						className={`industry-stagger-item ${CARD} ${CARD_HOVER} flex min-w-0 flex-col gap-4 p-5 sm:p-6`}
						style={staggerStyle(index)}
					>
						<div className="flex items-center justify-between gap-2">
							<h3 className={PILL}>{profile.code}</h3>
							<span className="text-xs font-semibold text-slate-500">{tx(lang, profile.label)}</span>
						</div>
						<ul className="flex flex-col gap-3">
							{profile.rows.map((row) => (
								<li key={row.label.ko} className="flex items-center justify-between gap-3">
									<span className="min-w-0 break-keep text-xs font-semibold text-slate-600 sm:text-sm dark:text-slate-300">
										{tx(lang, row.label)}
									</span>
									<span className="shrink-0">
										<StarRating value={row.stars} />
									</span>
								</li>
							))}
						</ul>
					</article>
				))}
			</IndustryStagger>
		</section>
	);
}
