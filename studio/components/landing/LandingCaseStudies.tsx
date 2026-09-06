'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CaseStudyCard } from '@/components/portfolio/CaseStudyCard';
import { CaseStudyExecutiveSummaryModal } from '@/components/portfolio/CaseStudyExecutiveSummaryModal';
import type { CaseStudyData } from '@/lib/case-study-types';

/**
 * Public 도입 사례 strip on the marketing landing page.
 * Approved (`isCaseStudy`) cards only — no login required.
 */
export function LandingCaseStudies() {
	const [items, setItems] = useState<CaseStudyData[]>([]);
	const [selected, setSelected] = useState<CaseStudyData | null>(null);

	useEffect(() => {
		fetch('/api/case-studies', { cache: 'no-store' })
			.then((res) => res.json())
			.then((data) => setItems(Array.isArray(data.items) ? data.items : []))
			.catch(() => setItems([]));
	}, []);

	if (!items.length) return null;

	return (
		<section id="case-studies" className="mt-20 scroll-mt-24 sm:mt-24">
			<div className="mx-auto w-full max-w-5xl">
				<div className="text-center">
					<p className="inline-flex rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-semibold tracking-widest text-cyan-700 dark:border-cyan-500/20 dark:bg-cyan-500/10 dark:text-cyan-400">
						CASE STUDIES
					</p>
					<h2 className="mt-3 text-2xl font-extrabold leading-snug text-slate-900 dark:text-white sm:text-3xl">
						REDUE 도입 사례
					</h2>
					<p className="mx-auto mt-2 max-w-[600px] break-keep text-sm leading-relaxed text-slate-600 dark:text-slate-400">
						승인된 실제 사이트 최적화 전후 점수입니다. 로그인 없이 누구나 열람할 수 있습니다.
					</p>
				</div>

				<div className="mt-8 flex flex-col gap-5">
					{items.slice(0, 3).map((item) => (
						<CaseStudyCard key={item.id} data={item} onViewResult={setSelected} />
					))}
				</div>

				<div className="mt-6 text-center">
					<Link
						href="/portfolio"
						className="inline-flex text-sm font-semibold text-cyan-700 hover:text-cyan-600 dark:text-cyan-300"
					>
						도입 사례 전체 보기 ➔
					</Link>
				</div>
			</div>

			<CaseStudyExecutiveSummaryModal
				isOpen={Boolean(selected)}
				data={selected}
				onClose={() => setSelected(null)}
			/>
		</section>
	);
}
