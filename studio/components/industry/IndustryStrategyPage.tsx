import './industry-motion.css';
import type { IndustryPageLang } from './industry-page-data';
import { IndustryHero } from './IndustryHero';
import { IndustryMotionRoot } from './IndustryMotion';
import {
	IndustryEngineSection,
	IndustryFrameworkSection,
	IndustryWeightsSection,
	IndustryWhySection,
} from './IndustrySectionsA';
import {
	IndustryEntitySection,
	IndustryIntentSection,
	IndustryQuestionSection,
	IndustrySurfaceSection,
} from './IndustrySectionsB';
import {
	IndustryCtaSection,
	IndustryFutureSection,
	IndustryMedicalExample,
	IndustryPlaybookSection,
	IndustryRoadmapSection,
} from './IndustrySectionsC';
import { IndustryBreadcrumb, IndustryFaqSection, IndustryPageJsonLd } from './IndustrySeoBlocks';

export function IndustryStrategyPage({ lang }: { lang: IndustryPageLang }) {
	return (
		<div
			id="industry"
			className="relative left-1/2 w-[100vw] max-w-[100vw] -translate-x-1/2 overflow-x-hidden bg-slate-50 text-slate-900 transition-colors duration-300 -mt-10 -mb-10 pb-20 dark:bg-[#04101b] dark:text-slate-100"
		>
			<div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
				<div className="industry-glow absolute -top-32 left-1/2 h-[280px] w-[min(640px,130vw)] -translate-x-1/2 rounded-full bg-gradient-to-r from-[#5565C7]/10 to-[#0C9AA7]/10 blur-[72px] dark:from-[#5565C7]/15 dark:to-[#0C9AA7]/15 sm:h-[400px] sm:blur-[96px]" />
			</div>

			<IndustryMotionRoot>
				<main className="relative z-[1] mx-auto flex w-full max-w-5xl flex-col gap-16 px-4 pt-12 sm:gap-20 sm:px-6 sm:pt-16 lg:gap-24">
					<IndustryPageJsonLd lang={lang} />
					<IndustryBreadcrumb lang={lang} />
					<IndustryHero lang={lang} />
					<IndustryWhySection lang={lang} />
					<IndustryEngineSection lang={lang} />
					<IndustryFrameworkSection lang={lang} />
					<IndustryWeightsSection lang={lang} />
					<IndustryEntitySection lang={lang} />
					<IndustryIntentSection lang={lang} />
					<IndustryQuestionSection lang={lang} />
					<IndustrySurfaceSection lang={lang} />
					<IndustryRoadmapSection lang={lang} />
					<IndustryMedicalExample lang={lang} />
					<IndustryPlaybookSection lang={lang} />
					<IndustryFutureSection lang={lang} />
					<IndustryFaqSection lang={lang} />
					<IndustryCtaSection lang={lang} />
				</main>
			</IndustryMotionRoot>
		</div>
	);
}
