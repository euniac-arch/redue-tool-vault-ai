'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { CaseStudyCard } from '@/components/portfolio/CaseStudyCard';
import { CaseStudyExecutiveSummaryModal } from '@/components/portfolio/CaseStudyExecutiveSummaryModal';
import { PageListLoader } from '@/components/ui/PageListLoader';
import {
	CASE_STUDY_FILTER_TABS,
	matchesCaseStudyFilter,
	type CaseStudyFilterTabId,
} from '@/lib/case-studies/category-filter';
import type { CaseStudyData } from '@/lib/case-study-types';

export default function PortfolioPage() {
	const t = useTranslations('portfolioPage');
	const [liveCaseStudies, setLiveCaseStudies] = useState<CaseStudyData[]>([]);
	const [loading, setLoading] = useState(true);
	const [activeCategory, setActiveCategory] = useState<CaseStudyFilterTabId>('all');
	const [selectedCaseData, setSelectedCaseData] = useState<CaseStudyData | null>(null);

	useEffect(() => {
		fetch('/api/case-studies')
			.then((res) => res.json())
			.then((data) => setLiveCaseStudies((data.items as CaseStudyData[]) || []))
			.catch(() => setLiveCaseStudies([]))
			.finally(() => setLoading(false));
	}, []);

	const filtered = useMemo(
		() =>
			liveCaseStudies.filter((item) => matchesCaseStudyFilter(item.siteInfo.category, activeCategory)),
		[liveCaseStudies, activeCategory],
	);

	const verified = useMemo(() => filtered.filter((item) => item.kind === 'verified'), [filtered]);
	const simulations = useMemo(() => filtered.filter((item) => item.kind === 'simulation'), [filtered]);

	return (
		<main className="flex flex-col gap-8">
			<section>
				<p className="text-[11px] font-bold uppercase tracking-[0.18em] text-cyan-600 dark:text-cyan-400">
					Case Studies
				</p>
				<h1 className="mt-1.5 text-2xl font-bold text-slate-900 dark:text-white">
					REDUE AI SEO & GEO 도입 사례
				</h1>
				<p className="mt-1 text-sm text-slate-600 dark:text-slate-300/80">
					실제 사이트 환경에 REDUE 스키마 주입 및 GEO 최적화를 적용한 실증 리포트입니다.
				</p>
			</section>

			<nav className="flex flex-wrap gap-2 border-b border-slate-200 pb-4 dark:border-slate-800/80">
				{CASE_STUDY_FILTER_TABS.map((tab) => (
					<button
						key={tab.id}
						type="button"
						onClick={() => setActiveCategory(tab.id)}
						className={`rounded-md border px-4 py-1.5 text-sm font-semibold transition-colors ${
							activeCategory === tab.id
								? 'border-cyan-500 bg-cyan-500 text-slate-950'
								: 'border-slate-200 bg-white text-slate-600 hover:border-cyan-500/40 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-[#0E162B]'
						}`}
					>
						{tab.label}
					</button>
				))}
			</nav>

			{loading ? (
				<PageListLoader label={t('loading')} />
			) : verified.length === 0 && simulations.length === 0 ? (
				<p className="text-sm text-slate-500">등록된 실증 사례가 없습니다.</p>
			) : (
				<div className="flex flex-col gap-10">
					{verified.length > 0 ? (
						<section className="flex flex-col gap-5">
							<h2 className="text-sm font-bold text-slate-800 dark:text-slate-200">실제 실증</h2>
							{verified.map((item) => (
								<CaseStudyCard key={item.id} data={item} onViewResult={setSelectedCaseData} />
							))}
						</section>
					) : null}
					{simulations.length > 0 ? (
						<section className="flex flex-col gap-5">
							<h2 className="text-sm font-bold text-slate-800 dark:text-slate-200">업종별 시뮬레이션</h2>
							{simulations.map((item) => (
								<CaseStudyCard key={item.id} data={item} onViewResult={setSelectedCaseData} />
							))}
						</section>
					) : null}
				</div>
			)}

			<CaseStudyExecutiveSummaryModal
				isOpen={Boolean(selectedCaseData)}
				data={selectedCaseData}
				onClose={() => setSelectedCaseData(null)}
			/>
		</main>
	);
}
