import Link from 'next/link';
import { buildAuditEngineHref, industryCodeToSlug } from '@/lib/audit/industry-preset';
import { CARD, CARD_HOVER, CHIP, CTA_CLASS, CTA_SECONDARY, GRADIENT_TEXT, PILL } from './industry-ui';
import {
	MEDICAL_AEO_QUESTIONS,
	MEDICAL_ENTITIES,
	MEDICAL_FORMULA,
	MEDICAL_REGIONS,
	MEDICAL_SERVICES,
	PAGE_COPY,
	PLAYBOOK_STEPS,
	FUTURE_PIPELINE,
	RELATED_MODULES,
	ROADMAP_VERTICALS,
	tx,
	type IndustryPageLang,
} from './industry-page-data';
import { IndustryReveal, IndustryStagger, SectionHeader, staggerStyle } from './IndustryPrimitives';

function ExampleGroup({ title, items }: { title: string; items: string[] }) {
	return (
		<div className="flex min-w-0 flex-col gap-3">
			<p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">{title}</p>
			<div className="flex flex-wrap gap-1.5">
				{items.map((item) => (
					<span key={item} className={CHIP}>
						{item}
					</span>
				))}
			</div>
		</div>
	);
}

export function IndustryRoadmapSection({ lang }: { lang: IndustryPageLang }) {
	return (
		<section className="flex flex-col gap-6 sm:gap-8">
			<IndustryReveal>
				<SectionHeader kicker={tx(lang, PAGE_COPY.roadmapKicker)} title={tx(lang, PAGE_COPY.roadmapTitle)} />
			</IndustryReveal>

			<IndustryStagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{ROADMAP_VERTICALS.map((vertical, index) => (
					<article
						key={vertical.code}
						className={`industry-stagger-item ${CARD} ${CARD_HOVER} flex min-w-0 flex-col gap-3 p-5`}
						style={staggerStyle(index)}
					>
						<span className={`${PILL} w-fit`}>{vertical.code}</span>
						<p className="break-keep text-sm leading-relaxed text-slate-600 dark:text-slate-300">{tx(lang, vertical.items)}</p>
						<Link
							href={buildAuditEngineHref({ industry: industryCodeToSlug(vertical.code) })}
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

export function IndustryMedicalExample({ lang }: { lang: IndustryPageLang }) {
	return (
		<section className="flex flex-col gap-6 sm:gap-8">
			<IndustryReveal>
				<SectionHeader
					kicker={tx(lang, PAGE_COPY.exampleKicker)}
					title={tx(lang, PAGE_COPY.exampleTitle)}
					subtitle={tx(lang, PAGE_COPY.exampleNote)}
				/>
			</IndustryReveal>

			<IndustryReveal className={`${CARD} flex min-w-0 flex-col gap-6 p-5 sm:p-8`}>
				<div className="grid gap-6 md:grid-cols-2">
					<ExampleGroup title={tx(lang, PAGE_COPY.exampleRegion)} items={MEDICAL_REGIONS.map((item) => tx(lang, item))} />
					<ExampleGroup title={tx(lang, PAGE_COPY.exampleService)} items={MEDICAL_SERVICES.map((item) => tx(lang, item))} />
					<ExampleGroup title={tx(lang, PAGE_COPY.exampleEntity)} items={MEDICAL_ENTITIES.map((item) => tx(lang, item))} />
					<div className="flex min-w-0 flex-col gap-3">
						<p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">{tx(lang, PAGE_COPY.exampleAeo)}</p>
						<ul className="flex flex-col gap-2">
							{MEDICAL_AEO_QUESTIONS.map((item) => (
								<li
									key={item.ko}
									className="break-keep rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 dark:border-[#1f3a5a] dark:bg-[#04101b]/70 dark:text-slate-200"
								>
									{tx(lang, item)}
								</li>
							))}
						</ul>
					</div>
				</div>

				<div className="flex flex-col items-center gap-3 border-t border-slate-200 pt-6 dark:border-[#1f3a5a]">
					<div className="flex flex-wrap items-center justify-center gap-2">
						{MEDICAL_FORMULA.map((item, index) => (
							<div key={item.ko} className="flex items-center gap-2">
								<span className={PILL}>{tx(lang, item)}</span>
								{index < MEDICAL_FORMULA.length - 1 ? (
									<span className="text-xs font-bold text-slate-400" aria-hidden>
										+
									</span>
								) : null}
							</div>
						))}
					</div>
					<p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">=</p>
					<p className={`text-lg font-extrabold ${GRADIENT_TEXT}`}>{tx(lang, PAGE_COPY.exampleResult)}</p>
				</div>
			</IndustryReveal>
		</section>
	);
}

export function IndustryPlaybookSection({ lang }: { lang: IndustryPageLang }) {
	return (
		<section className="flex flex-col gap-6 sm:gap-8">
			<IndustryReveal>
				<SectionHeader kicker={tx(lang, PAGE_COPY.playbookKicker)} title={tx(lang, PAGE_COPY.playbookTitle)} />
			</IndustryReveal>

			<div className={`${CARD} overflow-hidden`}>
				<IndustryReveal className="flex flex-col gap-2 border-b border-slate-200 px-4 py-5 sm:px-6 dark:border-[#1f3a5a]">
					<span className={`${PILL} w-fit`}>{tx(lang, PAGE_COPY.playbookBadge)}</span>
					<h3 className="break-keep text-lg font-extrabold text-slate-900 sm:text-xl dark:text-white">
						{tx(lang, PAGE_COPY.playbookName)}
					</h3>
					<p className="break-keep text-sm font-semibold text-cyan-700 dark:text-[#5fdbe3]">
						{tx(lang, PAGE_COPY.playbookContext)}
					</p>
					<Link
						href={buildAuditEngineHref({ industry: 'medical' })}
						className="mt-2 inline-flex w-fit items-center gap-1.5 rounded-lg bg-cyan-600 px-3 py-2 text-xs font-bold text-white transition-all hover:-translate-y-0.5 hover:bg-cyan-500"
					>
						{tx(lang, PAGE_COPY.startDiagnose)}
						<span aria-hidden>➔</span>
					</Link>
				</IndustryReveal>
				<IndustryStagger>
					<ol className="grid gap-px bg-slate-100 sm:grid-cols-2 dark:bg-[#1f3a5a]">
						{PLAYBOOK_STEPS.map((step, index) => (
							<li
								key={step.no}
								className="industry-stagger-item flex flex-col gap-2 bg-white p-5 dark:bg-[#0b1726]"
								style={staggerStyle(index)}
							>
								<div className="flex items-center gap-2">
									<span className="font-mono text-xs font-extrabold text-cyan-700 dark:text-[#5fdbe3]">{step.no}</span>
									<span className={PILL}>{step.code}</span>
								</div>
								<p className="break-keep text-sm leading-relaxed text-slate-600 dark:text-slate-300">{tx(lang, step.body)}</p>
							</li>
						))}
					</ol>
				</IndustryStagger>
			</div>
		</section>
	);
}

export function IndustryFutureSection({ lang }: { lang: IndustryPageLang }) {
	return (
		<section className="flex flex-col gap-6 sm:gap-8">
			<IndustryReveal>
				<SectionHeader
					kicker={tx(lang, PAGE_COPY.futureKicker)}
					title={tx(lang, PAGE_COPY.futureTitle)}
					title2={tx(lang, PAGE_COPY.futureTitle2)}
				/>
			</IndustryReveal>

			<IndustryReveal>
				<p className={`${CARD} px-4 py-4 text-center text-sm font-bold text-slate-800 sm:px-5 sm:text-base dark:text-slate-100`}>
					{tx(lang, PAGE_COPY.futureEmphasis)}
				</p>
			</IndustryReveal>

			<IndustryStagger className={`${CARD} flex w-full flex-wrap items-center justify-center gap-2 px-4 py-6 sm:px-6`}>
				{FUTURE_PIPELINE.map((step, index) => (
					<div key={step.ko} className="industry-stagger-item flex items-center gap-2" style={staggerStyle(index)}>
						<span className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-extrabold tracking-[0.08em] text-slate-700 dark:border-[#1f3a5a] dark:bg-[#04101b] dark:text-slate-200 sm:text-xs">
							{tx(lang, step)}
						</span>
						{index < FUTURE_PIPELINE.length - 1 ? (
							<span className="text-xs font-bold text-cyan-600 dark:text-[#4fd1d9]" aria-hidden>
								→
							</span>
						) : null}
					</div>
				))}
			</IndustryStagger>
		</section>
	);
}

export function IndustryCtaSection({ lang }: { lang: IndustryPageLang }) {
	return (
		<IndustryReveal>
			<section className={`${CARD} flex flex-col items-center gap-5 rounded-3xl px-4 py-12 text-center sm:px-10 sm:py-14`}>
				<span className={PILL}>{tx(lang, PAGE_COPY.ctaKicker)}</span>
				<h2 className="max-w-xl break-keep text-balance text-[1.45rem] font-extrabold leading-snug text-slate-900 sm:text-3xl dark:text-white">
					<span className="block">{tx(lang, PAGE_COPY.ctaTitle)}</span>
					<span className="mt-1 block">{tx(lang, PAGE_COPY.ctaTitle2)}</span>
				</h2>
				<div className="industry-cta-row flex w-full max-w-md flex-col items-center justify-center gap-3 sm:max-w-none sm:flex-row">
					<Link href="/audit" className={CTA_CLASS}>
						{tx(lang, PAGE_COPY.ctaAudit)}
						<span aria-hidden className="transition-transform duration-300 [@media(hover:hover)_and_(pointer:fine)]:group-hover:translate-x-1">
							➔
						</span>
					</Link>
					<Link href="/contact" className={CTA_SECONDARY}>
						{tx(lang, PAGE_COPY.ctaContact)}
					</Link>
				</div>
				<nav className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs font-semibold text-cyan-700 dark:text-cyan-400" aria-label={tx(lang, PAGE_COPY.relatedTitle)}>
					{RELATED_MODULES.map((item) => (
						<Link key={item.href} href={item.href} className="underline-offset-2 hover:underline">
							{tx(lang, item.label)}
						</Link>
					))}
				</nav>
				<div className="mt-2 w-full max-w-2xl space-y-1 border-t border-slate-200 px-1 pt-4 text-center dark:border-[#1f3a5a] sm:px-3">
					<p className="break-keep text-pretty text-[11px] leading-relaxed text-slate-500 dark:text-slate-500">
						{tx(lang, PAGE_COPY.disclaimer)}
					</p>
				</div>
			</section>
		</IndustryReveal>
	);
}
