import type { PortfolioItem } from './portfolio-types';

/**
 * REDUE AI SEO & GEO 포트폴리오 메인 데이터베이스.
 *
 * Step 3에서 로컬 및 Cafe24 호스팅 환경 모두에서 스키마 주입 검증이 완료된
 * 프로젝트를 정식 등록하는 곳입니다. 실제 서비스에서는 이 배열이 DB 테이블을
 * 대체하며, `/api/portfolio`가 이를 그대로 노출합니다.
 */
export const PORTFOLIO_ITEMS: PortfolioItem[] = [
	{
		id: 'redue-ai-tool-vault',
		category: 'AI/웹솔루션',
		projectName: 'Redue AI Tool Vault (전 세계 AI 툴 큐레이션)',
		domainUrl: 'https://euniac.mycafe24.com/tool-vault',
		cmsType: 'WordPress (워드프레스)',
		overallScore: 98.0,
		maxScore: 100,
		statusLabel: '최적화 완료',
		subScores: {
			seo: 100,
			performance: 95,
			schema: 100,
			accessibility: 98,
			geo: 92,
		},
		injectionTags: ['[SoftwareApplication]', '[WP Header Injection]', '[Auto Schema]'],
		verifiedAt: '2026-08-09',
		sampleToolSlug: 'redue-seo-studio',
	},
];

export function getPortfolioItems(category?: string | null): PortfolioItem[] {
	if (!category || category === '전체') {
		return PORTFOLIO_ITEMS;
	}
	return PORTFOLIO_ITEMS.filter((item) => item.category === category);
}

export function getPortfolioCategories(): string[] {
	const categories = new Set(PORTFOLIO_ITEMS.map((item) => item.category));
	return ['전체', ...Array.from(categories)];
}

export function getPortfolioItemById(id: string): PortfolioItem | undefined {
	return PORTFOLIO_ITEMS.find((item) => item.id === id);
}
