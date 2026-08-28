import { CARD, CARD_HOVER, CHIP, PILL } from './industry-ui';
import {
	ENTITY_GRAPHS,
	PAGE_COPY,
	QUERY_INTENTS,
	QUESTION_GRAPHS,
	SEARCH_SURFACES,
	tx,
	type IndustryPageLang,
} from './industry-page-data';
import { EntityFlow, FrameworkNote, IndustryReveal, IndustryStagger, SectionHeader, staggerStyle } from './IndustryPrimitives';

export function IndustryEntitySection({ lang }: { lang: IndustryPageLang }) {
	return (
		<section className="flex flex-col gap-6 sm:gap-8">
			<IndustryReveal>
				<SectionHeader kicker={tx(lang, PAGE_COPY.entityKicker)} title={tx(lang, PAGE_COPY.entityTitle)} />
			</IndustryReveal>

			<div className="grid gap-4 md:grid-cols-2">
				{ENTITY_GRAPHS.map((graph) => (
					<IndustryStagger key={graph.code} className={`${CARD} ${CARD_HOVER} flex min-w-0 flex-col gap-4 p-5 sm:p-6`}>
						<div className="industry-stagger-item flex items-center justify-between gap-2" style={staggerStyle(0)}>
							<h3 className={PILL}>{graph.code}</h3>
							<span className="text-xs font-semibold text-slate-500">{tx(lang, graph.label)}</span>
						</div>
						<EntityFlow nodes={graph.nodes.map((node) => tx(lang, node))} startIndex={1} />
					</IndustryStagger>
				))}
			</div>
		</section>
	);
}

export function IndustryIntentSection({ lang }: { lang: IndustryPageLang }) {
	return (
		<section className="flex flex-col gap-6 sm:gap-8">
			<IndustryReveal>
				<SectionHeader
					kicker={tx(lang, PAGE_COPY.intentKicker)}
					title={tx(lang, PAGE_COPY.intentTitle)}
					title2={tx(lang, PAGE_COPY.intentTitle2)}
				/>
			</IndustryReveal>

			<IndustryStagger className={`${CARD} overflow-hidden`}>
				<div className="industry-stagger-item border-b border-slate-200 px-4 py-4 dark:border-[#1f3a5a] sm:px-6" style={staggerStyle(0)}>
					<p className="text-[11px] font-bold uppercase tracking-[0.18em] text-cyan-700 dark:text-[#4fd1d9]">
						{tx(lang, PAGE_COPY.intentLabel)}
					</p>
				</div>
				<ol className="divide-y divide-slate-100 dark:divide-[#1f3a5a]/80">
					{QUERY_INTENTS.map((item, index) => (
						<li
							key={item.no}
							className="industry-stagger-item grid gap-1 px-4 py-3.5 sm:grid-cols-[3.25rem_7.5rem_minmax(0,1fr)] sm:items-center sm:gap-2 sm:px-6 sm:py-4"
							style={staggerStyle(index + 1)}
						>
							<span className="font-mono text-xs font-extrabold text-cyan-700 dark:text-[#5fdbe3]">{item.no}</span>
							<span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{tx(lang, item.type)}</span>
							<p className="min-w-0 break-keep text-sm font-semibold text-slate-800 dark:text-slate-100">{tx(lang, item.query)}</p>
						</li>
					))}
				</ol>
			</IndustryStagger>
		</section>
	);
}

export function IndustryQuestionSection({ lang }: { lang: IndustryPageLang }) {
	return (
		<section className="flex flex-col gap-6 sm:gap-8">
			<IndustryReveal>
				<SectionHeader kicker={tx(lang, PAGE_COPY.questionKicker)} title={tx(lang, PAGE_COPY.questionTitle)} />
			</IndustryReveal>

			<div className="grid gap-5 md:grid-cols-3">
				{QUESTION_GRAPHS.map((graph) => (
					<IndustryStagger key={graph.code} className={`${CARD} ${CARD_HOVER} flex min-w-0 flex-col gap-4 p-5 sm:p-6`}>
						<h3 className={`industry-stagger-item ${PILL} w-fit`} style={staggerStyle(0)}>
							{graph.code}
						</h3>
						<ol className="flex flex-col">
							{graph.nodes.map((node, index) => (
								<li key={node.ko} className="industry-stagger-item flex flex-col items-center" style={staggerStyle(index + 1)}>
									<span className={`${CHIP} w-full justify-center`}>{tx(lang, node)}</span>
									{index < graph.nodes.length - 1 ? (
										<span className="py-1 text-[10px] font-bold text-cyan-600 dark:text-[#4fd1d9]" aria-hidden>
											↓
										</span>
									) : null}
								</li>
							))}
						</ol>
					</IndustryStagger>
				))}
			</div>
		</section>
	);
}

export function IndustrySurfaceSection({ lang }: { lang: IndustryPageLang }) {
	return (
		<section className="flex flex-col gap-6 sm:gap-8">
			<IndustryReveal>
				<SectionHeader kicker={tx(lang, PAGE_COPY.surfaceKicker)} title={tx(lang, PAGE_COPY.surfaceTitle)} />
			</IndustryReveal>

			<IndustryStagger className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
				{SEARCH_SURFACES.map((surface, index) => (
					<article
						key={surface}
						className={`industry-stagger-item ${CARD} ${CARD_HOVER} flex min-h-[72px] min-w-0 items-center justify-center px-2 py-4 text-center sm:min-h-[88px] sm:px-3 sm:py-5`}
						style={staggerStyle(index)}
					>
						<p className="break-all text-[11px] font-extrabold tracking-[0.1em] text-slate-800 sm:text-sm sm:tracking-[0.14em] dark:text-white">
							{surface}
						</p>
					</article>
				))}
			</IndustryStagger>

			<IndustryReveal delayMs={80}>
				<FrameworkNote>{tx(lang, PAGE_COPY.surfaceNote)}</FrameworkNote>
			</IndustryReveal>
		</section>
	);
}
