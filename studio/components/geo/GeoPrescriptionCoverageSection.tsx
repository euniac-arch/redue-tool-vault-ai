'use client';

import { Target } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { PrescriptionAppliedBadge } from '@/components/geo/PrescriptionAppliedBadge';
import type { ExpandedQueryCombo, ExpandedQueryCoverage, KeywordWeight } from '@/types/geo-prescription';

export interface GeoPrescriptionCoverageSectionProps {
	brandName?: string;
	coverage?: ExpandedQueryCoverage | null;
	keywordWeights?: readonly KeywordWeight[] | null;
	headingId?: string;
}

interface Level3Card {
	id: string;
	tokens: string[];
	rank: 1 | 2 | 3;
	theme: 'emerald' | 'cyan';
}

const DEMO_BRAND = '한국중입자 암치료연구소';

const DEMO_TO_BE_KEYWORDS = [
	'서울 서초구 해외 중입자 치료 상담',
	'서초구 해외 중입자 치료 상담',
	'서초구 암치료 추천',
	'서울 중입자 연구소',
	'서울 해외 중입자 치료 상담',
	'중입자 암치료 추천',
	'국내 일본 중입자치료 연계 상담',
];

const DEMO_LEVEL3: Level3Card[] = [
	{
		id: 'demo-l3-1',
		tokens: ['서울 서초구', '상담', '해외 중입자 치료 상담'],
		rank: 1,
		theme: 'emerald',
	},
	{
		id: 'demo-l3-2',
		tokens: ['서울 서초구', '중입자치료', '잘하는 곳'],
		rank: 1,
		theme: 'emerald',
	},
	{
		id: 'demo-l3-3',
		tokens: ['서울 서초구', '암치료', '잘하는 곳'],
		rank: 2,
		theme: 'cyan',
	},
];

function uniqueLevel3Cards(combos: readonly ExpandedQueryCombo[]): Level3Card[] {
	const seen = new Set<string>();
	const cards: Level3Card[] = [];

	for (const row of combos) {
		if (row.rank > 2) continue;
		const key = (row.display || row.tokens.join(' + ')).trim();
		if (!key || seen.has(key)) continue;
		seen.add(key);
		cards.push({
			id: row.id,
			tokens: row.tokens,
			rank: row.rank,
			theme: row.rank === 1 ? 'emerald' : 'cyan',
		});
		if (cards.length >= 3) break;
	}

	return cards;
}

function highlightInsight(text: string) {
	const targets = ['1순위 추천 답변으로 인용', 'top-ranked recommendation'];
	for (const target of targets) {
		const idx = text.indexOf(target);
		if (idx >= 0) {
			return (
				<>
					{text.slice(0, idx)}
					<span className="text-white font-black underline decoration-emerald-400">{target}</span>
					{text.slice(idx + target.length)}
				</>
			);
		}
	}
	return text;
}

export function GeoPrescriptionCoverageSection({
	brandName = DEMO_BRAND,
	coverage = null,
	keywordWeights = null,
	headingId,
}: GeoPrescriptionCoverageSectionProps) {
	const t = useTranslations('audit.geoQueryCoverage');

	const resolvedBrand = coverage?.brandName?.trim() || brandName;
	const toBeKeywords = coverage?.toBeKeywords?.length ? coverage.toBeKeywords : DEMO_TO_BE_KEYWORDS;
	const level3Combinations = coverage ? uniqueLevel3Cards(coverage.afterCombos) : DEMO_LEVEL3;
	const weights = keywordWeights?.length ? keywordWeights : null;
	const primaryWeight = weights?.[0] ?? null;
	const extraWeights = weights && weights.length > 1 ? weights.slice(1) : [];
	const contributionLabel =
		primaryWeight?.label ||
		(coverage
			? [coverage.location, coverage.category].filter(Boolean).join(' + ')
			: '서울 서초구 + 암치료');
	const contributionPct = primaryWeight?.weight ?? (coverage ? null : 92);
	const level1 = coverage?.spectrum.level1 || resolvedBrand;
	const level2 = coverage?.spectrum.level2 || '서울 서초구 해외 중입자 치료 상담';
	const level3 = coverage?.spectrum.level3 || '서울 서초구에서 해외 중입자 치료 상담 잘하는 곳 추천해줘';
	const beforeSummary =
		coverage?.beforeSummary ||
		`단어 제한: 현재 노출 가능한 쿼리는 브랜드명(Level 1)뿐입니다 ("${resolvedBrand}"). 카테고리 질의는 추천에서 제외되어 있습니다.`;
	const insight =
		coverage?.insight ||
		"스키마 및 FAQ 패치로 AI가 '상담', '중입자치료', '암치료' 속성까지 확신을 갖고 1순위 추천 답변으로 인용하기 시작했습니다.";
	const showBrandOnlyWarning = coverage ? coverage.brandOnlyAsIs !== false : true;

	return (
		<div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-5">
			{/* 1. 단일 통합 헤더 — WHY THIS COMBO WINS와 동일 구조·타이포 */}
			<div className="flex items-start gap-3 border-b border-slate-800 pb-4">
				<span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-700 dark:text-violet-300">
					<Target className="h-5 w-5" aria-hidden />
				</span>
				<div className="min-w-0">
					<p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#D4AF37]">{t('kicker')}</p>
					<div className="mt-1 flex flex-wrap items-center gap-2">
						<h3 id={headingId} className="text-lg font-extrabold text-slate-900 dark:text-white sm:text-xl">
							{t('title')}
						</h3>
						<PrescriptionAppliedBadge />
					</div>
					<p className="mt-0.5 text-xs leading-relaxed text-slate-400">{t('subtitle')}</p>
				</div>
			</div>

			{/* 2. AI 분류 키워드 기여도 비중 & 3단계 레벨 게이지 */}
			<div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-3.5">
				<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
					<div>
						<div className="text-xs font-bold text-slate-200">{t('weightsTitle')}</div>
						<p className="text-[11px] text-slate-400 mt-0.5">{t('weightsHint')}</p>
					</div>
					{contributionLabel ? (
						<div className="flex items-center gap-2 self-start sm:self-auto">
							<span className="text-xs font-bold text-slate-300">{contributionLabel}</span>
							{contributionPct != null ? (
								<span className="text-sm font-mono font-black text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-lg border border-emerald-500/25">
									{contributionPct}%
								</span>
							) : null}
						</div>
					) : null}
				</div>

				{extraWeights.length > 0 ? (
					<ul className="flex flex-col gap-1.5">
						{extraWeights.map((row) => (
							<li key={row.id} className="flex items-center justify-between gap-2">
								<span className="min-w-0 truncate text-[11px] font-semibold text-slate-400">{row.label}</span>
								<span className="shrink-0 font-mono text-[11px] font-bold text-slate-300">{row.weight}%</span>
							</li>
						))}
					</ul>
				) : null}

				{/* 3단계 질의 레벨 안내 바 */}
				<div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
					<div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 space-y-1">
						<span className="text-[10px] font-bold text-indigo-300 block">{t('level1')}</span>
						<span className="text-xs font-bold text-slate-200 truncate block" title={level1}>
							{level1}
						</span>
					</div>
					<div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 space-y-1">
						<span className="text-[10px] font-bold text-indigo-300 block">{t('level2')}</span>
						<span className="text-xs font-bold text-slate-200 truncate block" title={level2}>
							{level2}
						</span>
					</div>
					<div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 space-y-1">
						<span className="text-[10px] font-bold text-indigo-300 block">{t('level3')}</span>
						<span className="text-xs font-bold text-slate-200 truncate block" title={level3}>
							{level3}
						</span>
					</div>
				</div>
			</div>

			{/* 3. As-Is (적용 전 제한) vs To-Be (처방 후 확장 키워드) 비교 그리드 */}
			<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
				{/* As-Is: 적용 전 단어 제한 */}
				<div className="p-4 rounded-xl bg-rose-950/20 border border-rose-500/30 space-y-2.5 flex flex-col justify-between">
					<div className="space-y-1">
						<div className="text-xs font-bold text-rose-300 flex items-center gap-1.5">
							<span>🔴</span>
							<span>{t('beforeTitle')}</span>
						</div>
						<p className="text-xs text-slate-300 leading-relaxed break-keep pt-1">
							<strong>{t('wordLimitPrefix')}</strong> {beforeSummary.replace(/^단어 제한:\s*|^Word limit:\s*/i, '')}
						</p>
					</div>
					{showBrandOnlyWarning ? (
						<div className="p-2.5 rounded-lg bg-slate-900/60 border border-rose-500/20 text-[11px] text-rose-300 font-mono">
							⚠️ {t('beforeZero')}
						</div>
					) : null}
				</div>

				{/* To-Be: 처방전 적용 후 확장 키워드 */}
				<div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/30 space-y-2.5">
					<div className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
						<span>🟢</span>
						<span>{t('toBeKeywordsTitle', { count: toBeKeywords.length })}</span>
					</div>
					<div className="flex flex-wrap gap-1.5 pt-0.5">
						{toBeKeywords.map((kw) => (
							<span
								key={kw}
								className="px-2.5 py-1 rounded-lg bg-slate-900/80 border border-emerald-500/30 text-emerald-200 text-xs font-medium"
							>
								✓ {kw}
							</span>
						))}
					</div>
				</div>
			</div>

			{/* 4. 처방전 적용 후 새로 커버되는 세부 단어 조합 (중복 제거된 3개 카드) */}
			<div className="space-y-2.5 pt-1">
				<div className="flex items-center justify-between">
					<div className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
						<span>✨</span>
						<span>{t('afterTitle')}</span>
					</div>
					<span className="text-[10px] font-mono text-emerald-400 font-bold">{t('badgeTitle')}</span>
				</div>

				<div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
					{level3Combinations.map((item) => (
						<div
							key={item.id}
							className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2.5 flex flex-col justify-between"
						>
							<div className="space-y-1.5">
								<span
									className={`inline-flex text-[10px] font-extrabold px-2 py-0.5 rounded border ${
										item.theme === 'emerald'
											? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
											: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
									}`}
								>
									{t('rank', { rank: item.rank })}
								</span>
								<span className="block text-xs font-bold text-slate-200 break-keep leading-relaxed">
									“{item.tokens.join(' + ')}”
								</span>
							</div>

							{/* 토큰 칩 — 카드 내부 1회만 렌더 */}
							<div className="flex flex-wrap gap-1">
								{item.tokens.map((token) => (
									<span
										key={`${item.id}-${token}`}
										className="px-1.5 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-800 text-[10px] font-mono"
									>
										{token}
									</span>
								))}
							</div>
						</div>
					))}
				</div>
			</div>

			{/* 5. 하단 핵심 인사이트 바 */}
			<div className="p-4 rounded-xl bg-indigo-950/30 border border-indigo-500/30 flex items-start gap-2.5 text-xs text-slate-300">
				<span className="text-sm shrink-0 mt-0.5">💡</span>
				<div className="leading-relaxed break-keep">
					<strong className="font-bold text-indigo-200">{t('insightTitle')}:</strong>{' '}
					{highlightInsight(insight)}
				</div>
			</div>
		</div>
	);
}
