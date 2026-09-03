import type { LatestAuditPayload } from '@/lib/audit/latest-audit-payload';
import { applyAsiInfluence, extractAsiAuditBridge, toAsiAuditBind } from '@/lib/ai-search-intelligence/audit-bridge';
import { citationDomain, sourceClassFromKind } from '@/lib/ai-search-intelligence/citations/classify';
import { mockCitationReport } from '@/lib/ai-search-intelligence/citations/overlay';
import { resolveAsiMockSite } from '@/lib/ai-search-intelligence/mock/resolve-site';
import { hashSeed, mockScore } from '@/lib/ai-search-intelligence/mock/seed';
import type {
	AsiCitationKind,
	AsiEvidenceCitation,
	AsiEvidenceSnapshot,
	AsiMonitorPoint,
	AsiMonitorRange,
	AsiQuestionInput,
} from '@/lib/ai-search-intelligence/types';
import {
	generateUniversalQueries,
	questionInputsFromContext,
	toQueryGeneration,
	universalQueriesToQuestions,
} from '@/lib/ai-search-intelligence/query-intelligence/generate';
import { emptyAsiQueryProbeReport } from '@/lib/ai-search-intelligence/probe/store';
import { resolveAsiTargetContext } from '@/lib/ai-search-intelligence/target/context';
import { syncAsiQueryPool } from '@/lib/ai-search-intelligence/target/query-pool';

function phraseContext(location: string, category: string, brand: string): string {
	return [location, category].filter(Boolean).join(' ') || brand;
}

const KIND_META: Array<{
	kind: AsiCitationKind;
	ownership: AsiEvidenceCitation['ownership'];
	host: (brand: string, url: string) => { source: string; href: string };
}> = [
	{ kind: 'official', ownership: 'owned', host: (brand, url) => ({ source: `${brand} 공식 홈`, href: url }) },
	{
		kind: 'blog',
		ownership: 'unbranded_third_party',
		host: (brand) => ({ source: `${brand} 후기 블로그`, href: 'https://blog.naver.com/example-review' }),
	},
	{
		kind: 'news',
		ownership: 'brand_earned',
		host: (brand) => ({ source: `${brand} 소개 기사`, href: 'https://example.com/brand-feature' }),
	},
	{
		kind: 'map',
		ownership: 'unbranded_third_party',
		host: (brand) => ({ source: `${brand} 지도 프로필`, href: 'https://map.naver.com/example' }),
	},
	{
		kind: 'review',
		ownership: 'brand_earned',
		host: (brand) => ({ source: `${brand} 리뷰 모음`, href: 'https://place.example.com/reviews' }),
	},
	{
		kind: 'youtube',
		ownership: 'unbranded_third_party',
		host: (brand) => ({ source: `${brand} 후기 영상`, href: 'https://www.youtube.com/watch?v=example' }),
	},
	{
		kind: 'sns',
		ownership: 'brand_earned',
		host: (brand) => ({ source: `${brand} 인스타 게시`, href: 'https://www.instagram.com/example' }),
	},
	{
		kind: 'third_party',
		ownership: 'unbranded_third_party',
		host: () => ({ source: '로컬 디렉터리 리스트', href: 'https://directory.example.com/list' }),
	},
	{
		kind: 'schema',
		ownership: 'owned',
		host: (brand, url) => ({ source: `${brand} JSON-LD`, href: `${url}#schema` }),
	},
];

function buildRange(seed: number, range: AsiMonitorRange, latest: AsiEvidenceSnapshot['monitorLatest']): AsiMonitorPoint[] {
	const count = range === 'today' ? 4 : range === '7d' ? 7 : range === '14d' ? 14 : 10;
	return Array.from({ length: count }, (_, index) => {
		const t = index / Math.max(1, count - 1);
		const wobble = (salt: number, span: number) => mockScore(seed, salt + index, -span, span);
		return {
			label:
				range === 'today'
					? `${String(index * 6).padStart(2, '0')}:00`
					: range === '30d'
						? `D-${(count - 1 - index) * 3}`
						: `D-${count - 1 - index}`,
			mention: Math.max(8, Math.min(100, Math.round(latest.mention - 10 + t * 10 + wobble(110, 4)))),
			recommendationRate: Math.max(8, Math.min(100, Math.round(latest.recommendationRate - 8 + t * 8 + wobble(120, 3)))),
			shareOfVoice: Math.max(4, Math.min(80, Math.round(latest.shareOfVoice - 6 + t * 6 + wobble(130, 3)))),
			citationCount: Math.max(2, Math.round(latest.citationCount - 2 + t * 2 + (wobble(140, 1) > 0 ? 1 : 0))),
			visibilityScore: Math.max(8, Math.min(100, Math.round(latest.visibilityScore - 9 + t * 9 + wobble(150, 3)))),
		};
	});
}

export function buildMockEvidenceSnapshot(input: {
	url: string;
	audit?: LatestAuditPayload | null;
	questions?: Partial<AsiQuestionInput>;
}): AsiEvidenceSnapshot | null {
	const resolved = resolveAsiMockSite(input);
	if (!resolved) return null;
	const { site, boundFromAudit } = resolved;
	const seed = hashSeed(site.domain);
	const target = resolveAsiTargetContext(input) ?? {
		siteUrl: site.url,
		brandName: site.brandName,
		domain: site.domain,
		location: site.location,
		category: site.category,
		industry: site.category,
		services: site.category ? [site.category] : [],
		keywords: [],
		aliases: [],
		boundFromAudit,
	};
	const hasQuestionOverrides = Boolean(
		input.questions?.industry || input.questions?.location || input.questions?.service || input.questions?.target,
	);
	const generated = generateUniversalQueries(target, { limit: 16, hasQuestionOverrides });
	syncAsiQueryPool(target, { limit: 16, hasQuestionOverrides });
	const location = target.location || site.location || '';
	const category = target.category || site.category || '';
	const brand = site.brandName;

	const citations: AsiEvidenceCitation[] = KIND_META.map((meta, index) => {
		const { source, href } = meta.host(brand, site.url);
		return {
			id: meta.kind,
			source,
			url: href,
			kind: meta.kind,
			sourceType: sourceClassFromKind(meta.kind, href, site.url),
			domain: citationDomain(href),
			title: source,
			relevance: mockScore(seed, 200 + index, 42, 94),
			authority: mockScore(seed, 220 + index, 36, 90),
			relation:
				meta.kind === 'official'
					? '엔진이 브랜드 엔티티를 확인할 때 쓰는 1차 근거로 추정됩니다.'
					: meta.kind === 'schema'
						? '구조화 데이터가 답변 슬롯을 채우는 신호로 읽히는 것으로 추정됩니다.'
						: `${phraseContext(location, category, brand)} 맥락에서 보조 근거로 인용될 수 있는 웹 신호입니다.`,
			ownership: meta.ownership,
		};
	});

	const questionInputs: AsiQuestionInput = questionInputsFromContext(target);

	const bridge = extractAsiAuditBridge(input.audit, site.url);
	const citationPenalty = bridge?.influence.citation ?? 0;
	if (citationPenalty) {
		for (const item of citations) {
			if (item.kind === 'official' || item.kind === 'schema' || item.kind === 'news') {
				item.authority = applyAsiInfluence(item.authority, citationPenalty);
				item.relevance = applyAsiInfluence(item.relevance, Math.round(citationPenalty / 2));
				item.relation = `${item.relation} 진단 Citation 신호가 약해 근거 가중치를 낮춘 추정입니다.`;
			}
		}
	}

	const engines = [0, 1, 2, 3].map((index) => mockScore(seed, 10 + index, 28, 86));
	const visibilityScore = Math.round(engines.reduce((sum, value) => sum + value, 0) / engines.length);
	const recommendationRate = applyAsiInfluence(mockScore(seed, 21, 18, 64), bridge?.influence.recommendation ?? 0);
	const shareOfVoice = mockScore(seed, 22, 8, 34);
	const mention = engines.filter((value) => value >= 48).length * 25;
	const monitorLatest = {
		mention,
		recommendationRate,
		shareOfVoice,
		citationCount: citations.length,
		visibilityScore,
	};

	const monitor = {
		today: buildRange(seed, 'today', monitorLatest),
		'7d': buildRange(seed, '7d', monitorLatest),
		'14d': buildRange(seed, '14d', monitorLatest),
		'30d': buildRange(seed, '30d', monitorLatest),
	} satisfies Record<AsiMonitorRange, AsiMonitorPoint[]>;

	return {
		source: bridge ? 'derived' : 'mock',
		analyzedAt: new Date().toISOString(),
		boundFromAudit,
		auditBind: toAsiAuditBind(bridge),
		site,
		citations,
		citationReport: mockCitationReport(citations, site.url),
		questions: universalQueriesToQuestions(generated.items),
		questionInputs,
		queryGeneration: toQueryGeneration(generated),
		queryProbe: emptyAsiQueryProbeReport(),
		monitor,
		monitorLatest,
	};
}
