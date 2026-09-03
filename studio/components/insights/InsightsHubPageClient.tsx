'use client';

import dynamic from 'next/dynamic';
import { usePathname, useSearchParams } from 'next/navigation';
import { InsightsHubTabs, resolveInsightsHubTab } from '@/components/insights/InsightsHubTabs';
import { PageListLoader } from '@/components/ui/PageListLoader';

const InsightsDashboard = dynamic(
	() => import('@/components/insights/InsightsDashboard').then((mod) => mod.InsightsDashboard),
	{ ssr: false, loading: () => <PageListLoader label="인사이트 뉴스를 불러오는 중" /> },
);

const AiHubDashboard = dynamic(
	() => import('@/components/ai-hub/AiHubDashboard').then((mod) => mod.AiHubDashboard),
	{ ssr: false, loading: () => <PageListLoader label="AI 도구 허브" /> },
);

const PromptHubDashboard = dynamic(
	() => import('@/components/prompt-hub/PromptHubDashboard').then((mod) => mod.PromptHubDashboard),
	{ ssr: false, loading: () => <PageListLoader label="AI 프롬프트 허브" /> },
);

const AeoGeoGuideContent = dynamic(
	() => import('@/components/aeo-geo/AeoGeoGuideContent').then((mod) => mod.AeoGeoGuideContent),
	{ ssr: false, loading: () => <PageListLoader label="AEO · GEO" /> },
);

const KICKER =
	'inline-flex w-fit items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-cyan-700 dark:border-[#1f3a5a] dark:bg-[#0b1726] dark:text-[#4fd1d9]';
const GRADIENT_TEXT = 'bg-gradient-to-r from-[#5565C7] to-[#0C9AA7] bg-clip-text text-transparent';

function InsightsColumn() {
	return (
		<main className="flex flex-col gap-6">
			<section className="flex flex-col gap-3">
				<span className={KICKER}>
					<span className="h-1.5 w-1.5 rounded-full bg-gradient-to-r from-[#5565C7] to-[#0C9AA7]" />
					Insights &amp; Research
				</span>
				<h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-3xl">
					AI GEO &amp; <span className={GRADIENT_TEXT}>Schema 글로벌 뉴스</span>
				</h1>
				<p className="max-w-2xl text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
					국내·글로벌 AI 검색 최적화, GEO, 스키마 마크업 관련 최신 피드를 실시간 모니터링합니다.
				</p>
			</section>
			<InsightsDashboard />
		</main>
	);
}

export function InsightsHubPageClient() {
	const pathname = usePathname() ?? '/insights';
	const searchParams = useSearchParams();
	const tab = resolveInsightsHubTab(pathname, searchParams.get('tab'));

	return (
		<div className="flex min-h-full flex-col bg-transparent">
			<InsightsHubTabs />
			<div className="flex flex-1 flex-col bg-transparent pt-8">
				{tab === 'aeo-geo' ? <AeoGeoGuideContent /> : null}
				{tab === 'ai-hub' ? (
					<main className="flex flex-col gap-6">
						<AiHubDashboard />
					</main>
				) : null}
				{tab === 'prompts' ? (
					<main className="flex flex-col gap-6">
						<PromptHubDashboard />
					</main>
				) : null}
				{tab === 'insights' ? <InsightsColumn /> : null}
			</div>
		</div>
	);
}
