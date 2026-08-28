import Link from 'next/link';
import { CARD, CTA_CLASS, CTA_SECONDARY, GRADIENT_TEXT, PILL } from './industry-ui';
import { HERO_CHIPS, PAGE_COPY, tx, type IndustryPageLang } from './industry-page-data';
import { PRODUCT_CONTRAST } from './industry-strategy-model';
import { SectionKicker, staggerStyle } from './IndustryPrimitives';

export function IndustryHero({ lang }: { lang: IndustryPageLang }) {
	return (
		<section className="flex flex-col items-center gap-5 text-center sm:gap-6">
			<div className="industry-hero-item" style={staggerStyle(0)}>
				<SectionKicker>{tx(lang, PAGE_COPY.heroKicker)}</SectionKicker>
			</div>

			<h1 className="max-w-4xl break-keep text-balance text-[1.7rem] font-extrabold leading-[1.35] tracking-tight text-slate-900 sm:text-4xl lg:text-5xl lg:leading-[1.3] dark:text-white">
				<span className="industry-hero-item block" style={staggerStyle(1)}>
					{tx(lang, PAGE_COPY.heroH1Line1)}
				</span>
				<span className={`industry-hero-item mt-1 block ${GRADIENT_TEXT}`} style={staggerStyle(2)}>
					{tx(lang, PAGE_COPY.heroH1Line2)}
				</span>
			</h1>

			<p
				className={`industry-hero-item ${CARD} max-w-2xl break-keep px-4 py-3 text-pretty text-sm font-semibold leading-relaxed text-slate-700 sm:px-5 sm:text-base dark:text-slate-200`}
				style={staggerStyle(3)}
			>
				{tx(lang, PAGE_COPY.heroEmphasis)}
			</p>

			<div className={`industry-hero-item w-full max-w-2xl ${CARD} overflow-hidden`} style={staggerStyle(4)}>
				<div className="grid grid-cols-2 border-b border-slate-200 text-[10px] font-bold uppercase tracking-[0.14em] dark:border-[#1f3a5a] sm:text-[11px]">
					<p className="bg-slate-50 px-3 py-2 text-slate-500 dark:bg-[#04101b] dark:text-slate-500">{tx(lang, PAGE_COPY.contrastLegacy)}</p>
					<p className="bg-cyan-50 px-3 py-2 text-cyan-700 dark:bg-[#0C9AA7]/10 dark:text-[#5fdbe3]">{tx(lang, PAGE_COPY.contrastRedue)}</p>
				</div>
				<ul>
					{PRODUCT_CONTRAST.map((row) => (
						<li key={row.legacy} className="grid grid-cols-2 border-b border-slate-100 last:border-0 dark:border-[#1f3a5a]/70">
							<p className="px-3 py-2.5 text-left text-xs text-slate-500 sm:text-sm">{row.legacy}</p>
							<p className="px-3 py-2.5 text-left text-xs font-semibold text-slate-800 dark:text-slate-100 sm:text-sm">{row.redue}</p>
						</li>
					))}
				</ul>
			</div>

			<div className="industry-hero-item max-w-2xl space-y-2 px-1" style={staggerStyle(5)}>
				<p className="break-keep text-pretty text-sm leading-relaxed text-slate-600 sm:text-base dark:text-slate-400">
					{tx(lang, PAGE_COPY.heroBody1)}
				</p>
				<p className={`break-keep text-pretty text-sm font-bold ${GRADIENT_TEXT}`}>{tx(lang, PAGE_COPY.engineFormula)}</p>
				<p className="break-keep text-pretty text-xs font-semibold text-slate-500">{tx(lang, PAGE_COPY.contrastNote)}</p>
			</div>

			<div className="industry-hero-item industry-cta-row flex w-full max-w-md flex-col items-center justify-center gap-3 pt-1 sm:max-w-none sm:flex-row" style={staggerStyle(6)}>
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

			<div className="flex max-w-3xl flex-wrap items-center justify-center gap-2 pt-1">
				{HERO_CHIPS.map((chip, index) => (
					<span key={chip} className={`industry-hero-item ${PILL}`} style={staggerStyle(7 + index)}>
						{chip}
					</span>
				))}
			</div>
		</section>
	);
}
