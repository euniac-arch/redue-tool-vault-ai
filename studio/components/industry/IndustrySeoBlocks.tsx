import Link from 'next/link';
import Script from 'next/script';
import { CARD } from './industry-ui';
import { INDUSTRY_FAQS, PAGE_COPY, tx, type IndustryPageLang } from './industry-page-data';
import { buildIndustryPageJsonLd } from './industry-page-schema';
import { IndustryReveal, IndustryStagger, SectionHeader, staggerStyle } from './IndustryPrimitives';

export function IndustryPageJsonLd({ lang }: { lang: IndustryPageLang }) {
	return (
		<Script
			id="industry-page-jsonld"
			type="application/ld+json"
			dangerouslySetInnerHTML={{ __html: JSON.stringify(buildIndustryPageJsonLd(lang)) }}
		/>
	);
}

export function IndustryBreadcrumb({ lang }: { lang: IndustryPageLang }) {
	return (
		<nav aria-label="Breadcrumb" className="text-xs font-semibold text-slate-500">
			<ol className="flex flex-wrap items-center gap-1.5">
				<li>
					<Link href="/" className="transition-colors hover:text-cyan-700 dark:hover:text-cyan-400">
						{tx(lang, PAGE_COPY.breadcrumbHome)}
					</Link>
				</li>
				<li aria-hidden className="text-slate-300 dark:text-slate-600">
					/
				</li>
				<li className="text-slate-700 dark:text-slate-200" aria-current="page">
					{tx(lang, PAGE_COPY.breadcrumbCurrent)}
				</li>
			</ol>
		</nav>
	);
}

export function IndustryFaqSection({ lang }: { lang: IndustryPageLang }) {
	return (
		<section id="industry-faq" className="flex flex-col gap-5 sm:gap-6">
			<IndustryReveal>
				<SectionHeader kicker={tx(lang, PAGE_COPY.faqKicker)} title={tx(lang, PAGE_COPY.faqTitle)} />
			</IndustryReveal>
			<IndustryStagger className="grid gap-3 sm:grid-cols-2">
				{INDUSTRY_FAQS.map((item, index) => (
					<article
						key={item.id}
						id={item.id}
						className={`industry-stagger-item ${CARD} min-w-0 p-4 sm:p-5`}
						style={staggerStyle(index)}
					>
						<h3 className="break-keep text-sm font-extrabold text-slate-900 dark:text-white">{tx(lang, item.q)}</h3>
						<p className="mt-1.5 break-keep text-pretty text-xs leading-relaxed text-slate-600 sm:text-sm dark:text-slate-300">
							{tx(lang, item.a)}
						</p>
					</article>
				))}
			</IndustryStagger>
		</section>
	);
}
