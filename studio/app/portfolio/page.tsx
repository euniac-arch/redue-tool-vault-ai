'use client';

import { useEffect, useMemo, useState } from 'react';
import { PortfolioCard } from '@/components/PortfolioCard';
import { CaseStudyCard } from '@/components/portfolio/CaseStudyCard';
import { SchemaValidationModal, type ModalMode } from '@/components/SchemaValidationModal';
import { CASE_STUDIES } from '@/lib/case-studies';
import type { PortfolioItem } from '@/lib/portfolio-types';

export default function PortfolioPage() {
	const [items, setItems] = useState<PortfolioItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [activeCategory, setActiveCategory] = useState('전체');
	const [modalState, setModalState] = useState<{ item: PortfolioItem; mode: ModalMode } | null>(null);

	useEffect(() => {
		fetch('/api/portfolio')
			.then((res) => res.json())
			.then((data) => setItems(data.items as PortfolioItem[]))
			.finally(() => setLoading(false));
	}, []);

	const categories = useMemo(() => {
		const set = new Set([
			...CASE_STUDIES.map((item) => item.siteInfo.category),
			...items.map((item) => item.category),
		]);
		return ['전체', ...Array.from(set)];
	}, [items]);
	const filteredCaseStudies = useMemo(
		() =>
			activeCategory === '전체'
				? CASE_STUDIES
				: CASE_STUDIES.filter((item) => item.siteInfo.category === activeCategory),
		[activeCategory]
	);
	const filteredItems = useMemo(
		() => (activeCategory === '전체' ? items : items.filter((item) => item.category === activeCategory)),
		[items, activeCategory]
	);

	return (
		<main className="flex flex-col gap-8">
			<section>
				<h1 className="text-2xl font-bold text-slate-900 dark:text-white">REDUE AI SEO & GEO 포트폴리오</h1>
				<p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
					로컬 및 실제 호스팅 환경에서 스키마 주입 검증이 완료된 프로젝트를 정식 등록·관리합니다.
				</p>
			</section>

			<nav className="flex flex-wrap gap-2 border-b border-slate-200 pb-4 dark:border-white/10">
				{categories.map((category) => (
					<button
						key={category}
						onClick={() => setActiveCategory(category)}
						className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition ${
							activeCategory === category
								? 'border-accent bg-accent text-white'
								: 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10'
						}`}
					>
						{category}
					</button>
				))}
			</nav>

			{!loading && filteredCaseStudies.length === 0 && filteredItems.length === 0 ? (
				<p className="text-sm text-slate-500 dark:text-slate-500">등록된 프로젝트가 없습니다.</p>
			) : (
				<div className="flex flex-col gap-5">
					{filteredCaseStudies.map((item) => (
						<CaseStudyCard key={item.id} data={item} />
					))}
					{filteredItems.map((item) => (
						<PortfolioCard key={item.id} item={item} onVerify={(target, mode) => setModalState({ item: target, mode })} />
					))}
				</div>
			)}

			<SchemaValidationModal
				item={modalState?.item ?? null}
				mode={modalState?.mode ?? null}
				onClose={() => setModalState(null)}
			/>
		</main>
	);
}
