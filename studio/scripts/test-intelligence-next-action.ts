/**
 * Next Best Action — generate only from real analysis data, prioritize TOP 5.
 * Run: npx tsx scripts/test-intelligence-next-action.ts
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { mockAsiEngine } from '../lib/ai-search-intelligence/adapters/mock-engine';
import { buildNextActionSnapshot, coreActionFromNext } from '../lib/ai-search-intelligence/next-action/analyze';
import { generateNextActions } from '../lib/ai-search-intelligence/next-action/generate';
import { preferredContentPage } from '../lib/ai-search-intelligence/next-action/pages';
import { actionPriority } from '../lib/ai-search-intelligence/next-action/score';
import type { LatestAuditPayload } from '../lib/audit/latest-audit-payload';
import type {
	AsiCompetitorGapSnapshot,
	AsiEvidenceExplorerSnapshot,
	AsiOpportunityRow,
	AsiOpportunitySnapshot,
} from '../lib/ai-search-intelligence/types';

let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
	if (condition) {
		console.log(`ok  ${label}`);
		return;
	}
	failed += 1;
	console.error(`FAIL ${label}${detail ? ` — ${detail}` : ''}`);
}

const site = {
	url: 'https://sunshineclinic.kr',
	brandName: 'Sunshine',
	domain: 'sunshineclinic.kr',
	location: '대구',
	category: '흉터',
};

function missRow(query: string, intent: AsiOpportunityRow['intent'] = 'recommend'): AsiOpportunityRow {
	return {
		queryId: query,
		query,
		intent,
		category: 'natural',
		priority: 80,
		status: 'miss',
		isOpportunity: true,
		score: 72,
		reason: '브랜드가 추천되지 않음',
		missingSignals: [],
		mentionRate: 0,
		recommendationRate: 0,
		brandMentioned: false,
		brandRecommended: false,
		citations: [],
		competitors: ['덴서티'],
		engines: [],
		signals: {} as AsiOpportunityRow['signals'],
	};
}

function opportunityOf(rows: AsiOpportunityRow[]): AsiOpportunitySnapshot {
	return {
		source: 'mock',
		analyzedAt: '2026-03-01T00:00:00.000Z',
		boundFromAudit: false,
		site,
		summary: { total: rows.length, win: 0, compete: 0, miss: rows.length, opportunity: rows.length },
		rows,
		top: rows,
	};
}

function emptyEvidence(): AsiEvidenceExplorerSnapshot {
	return {
		source: 'mock',
		analyzedAt: '2026-03-01T00:00:00.000Z',
		boundFromAudit: false,
		site,
		answers: [],
		sources: [],
		brand: { name: 'Sunshine', kind: 'brand', citations: 1, relevantPages: 1, externalSources: 0 },
		competitors: [],
		summary: { answers: 0, withEvidence: 0, unavailable: 0, brandCitations: 1, competitorCitations: 0 },
	};
}

function emptyGap(): AsiCompetitorGapSnapshot {
	return {
		source: 'mock',
		analyzedAt: '2026-03-01T00:00:00.000Z',
		boundFromAudit: false,
		site,
		brand: { name: 'Sunshine', kind: 'brand', citations: 1, relevantPages: 1, externalSources: 0 },
		competitors: [],
		metrics: [],
		queries: [],
		whyTheyWin: [],
		rows: [],
		top: [],
		summary: { competitorsObserved: 0, totalGaps: 0, highImpact: 0 },
	};
}

function auditWithPages(paths: string[], collected: string[] = ['https://sunshineclinic.kr/']): LatestAuditPayload {
	return {
		auditId: 'audit-1',
		report: {
			url: site.url,
			pageMetas: paths.map((urlPath) => ({ urlPath, title: urlPath, h1: '', description: '' })),
			collectedUrls: collected,
		},
	} as LatestAuditPayload;
}

const empty = generateNextActions({
	opportunity: null,
	evidence: emptyEvidence(),
	gap: emptyGap(),
	audit: null,
	gaps: [],
	boundFromAudit: false,
	siteUrl: site.url,
});
assert('no invented actions without data', empty.length === 0);
assert('no invented youtube', empty.every((row) => row.kind !== 'youtube'));
assert('no invented internal_link', empty.every((row) => row.kind !== 'internal_link'));
assert('no invented schema', empty.every((row) => row.kind !== 'schema'));
assert('no invented faq', empty.every((row) => row.kind !== 'faq'));

const youtubeOnlyCompetitor = generateNextActions({
	opportunity: null,
	evidence: {
		...emptyEvidence(),
		sources: [
			{
				url: 'https://youtube.com/watch?v=comp',
				sourceType: 'youtube',
				citedBy: ['chatgpt'],
				query: '대구 흉터 추천',
				relatedTo: 'competitor',
				relatedPage: null,
			},
		],
	},
	gap: emptyGap(),
	audit: null,
	gaps: [],
	boundFromAudit: false,
	siteUrl: site.url,
});
assert('youtube only when competitor video observed', youtubeOnlyCompetitor.some((row) => row.kind === 'youtube'));

const youtubeBrandAlso = generateNextActions({
	opportunity: null,
	evidence: {
		...emptyEvidence(),
		sources: [
			{
				url: 'https://youtube.com/watch?v=comp',
				sourceType: 'youtube',
				citedBy: ['chatgpt'],
				query: '대구 흉터 추천',
				relatedTo: 'competitor',
				relatedPage: null,
			},
			{
				url: 'https://youtube.com/watch?v=ours',
				sourceType: 'youtube',
				citedBy: ['gemini'],
				query: 'Sunshine 후기',
				relatedTo: 'brand',
				relatedPage: null,
			},
		],
	},
	gap: emptyGap(),
	audit: null,
	gaps: [],
	boundFromAudit: false,
	siteUrl: site.url,
});
assert('no youtube action when brand video exists', youtubeBrandAlso.every((row) => row.kind !== 'youtube'));

const schemaOnly = generateNextActions({
	opportunity: opportunityOf([missRow('대구 흉터 치료 추천')]),
	evidence: emptyEvidence(),
	gap: emptyGap(),
	audit: null,
	gaps: ['schema'],
	boundFromAudit: true,
	siteUrl: site.url,
});
assert('schema only when audit signal', schemaOnly.some((row) => row.kind === 'schema'));

const noSchema = generateNextActions({
	opportunity: opportunityOf([missRow('대구 흉터 치료 추천')]),
	evidence: emptyEvidence(),
	gap: emptyGap(),
	audit: null,
	gaps: [],
	boundFromAudit: false,
	siteUrl: site.url,
});
assert('schema not invented without audit', noSchema.every((row) => row.kind !== 'schema'));
assert('miss without audit still makes content', noSchema.some((row) => row.kind === 'content'));
assert('miss without audit still makes faq schema action', noSchema.some((row) => row.kind === 'faq'));

function competeRow(query: string): AsiOpportunityRow {
	return {
		...missRow(query),
		status: 'compete',
		isOpportunity: false,
		score: 50,
		brandMentioned: true,
		brandRecommended: false,
		mentionRate: 0.5,
		recommendationRate: 0,
	};
}

const competeOnly = generateNextActions({
	opportunity: opportunityOf([competeRow('대구 동구 덴서티 추천')]),
	evidence: emptyEvidence(),
	gap: emptyGap(),
	audit: null,
	gaps: [],
	boundFromAudit: false,
	siteUrl: site.url,
	site,
});
assert('compete query makes content action', competeOnly.some((row) => row.kind === 'content'));
assert('compete query makes faq schema action', competeOnly.some((row) => row.kind === 'faq' && row.howToFix.includes('FAQPage')));
assert('compete action lists affected queries', competeOnly.some((row) => row.affectedQueries.includes('대구 동구 덴서티 추천')));
assert('audit link exists from site url', competeOnly.some((row) => row.auditHref?.includes('/audit/result')));

const citationMetric = generateNextActions({
	opportunity: opportunityOf([]),
	evidence: {
		...emptyEvidence(),
		sources: [
			{
				url: 'https://blog.naver.com/comp',
				sourceType: 'blog',
				citedBy: ['chatgpt'],
				query: '대구 흉터 추천',
				relatedTo: 'competitor',
				relatedPage: null,
			},
			{
				url: 'https://place.naver.com/comp',
				sourceType: 'directory',
				citedBy: ['gemini'],
				query: '대구 흉터 추천',
				relatedTo: 'competitor',
				relatedPage: null,
			},
		],
	},
	gap: {
		...emptyGap(),
		metrics: [
			{ kind: 'citation', brand: 1, competitor: 6, gap: 5, unit: 'count', available: true },
		],
	},
	audit: null,
	gaps: [],
	boundFromAudit: false,
	siteUrl: site.url,
	site,
});
assert('citation metric makes citation action', citationMetric.some((row) => row.kind === 'citation'));
assert(
	'citation how-to names occupied sources',
	citationMetric.some((row) => row.kind === 'citation' && row.howToFix.includes('블로그') && row.howToFix.includes('디렉터리')),
);

const entitySignal = generateNextActions({
	opportunity: opportunityOf([]),
	evidence: emptyEvidence(),
	gap: {
		...emptyGap(),
		metrics: [{ kind: 'entity', brand: 20, competitor: 55, gap: 35, unit: 'percent', available: true }],
	},
	audit: null,
	gaps: [],
	boundFromAudit: false,
	siteUrl: site.url,
	site: { ...site, location: '대구 동구', category: '덴서티' },
});
assert('entity metric makes local-business action', entitySignal.some((row) => row.kind === 'entity'));
assert(
	'entity how-to binds location and service',
	entitySignal.some((row) => row.kind === 'entity' && row.howToFix.includes('대구 동구') && row.howToFix.includes('덴서티')),
);

const readiness = generateNextActions({
	opportunity: opportunityOf([]),
	evidence: emptyEvidence(),
	gap: emptyGap(),
	audit: null,
	gaps: [],
	boundFromAudit: false,
	siteUrl: site.url,
	site,
	aeoWeak: true,
});
assert('agent readiness makes llms.txt action', readiness.some((row) => row.kind === 'schema' && row.title.includes('llms.txt')));
assert('readiness how-to mentions JSON-LD', readiness.some((row) => row.kind === 'schema' && row.howToFix.includes('JSON-LD')));

const content = generateNextActions({
	opportunity: opportunityOf([missRow('대구 흉터 치료 추천'), missRow('Sunshine 덴서티 비교', 'compare')]),
	evidence: emptyEvidence(),
	gap: emptyGap(),
	audit: auditWithPages(['/scar.php', '/']),
	gaps: ['content'],
	boundFromAudit: true,
	siteUrl: site.url,
});
assert(
	'content title uses scar.php',
	content.some((row) => row.kind === 'content' && row.title.includes('scar.php')),
);
assert(
	'content links audit result',
	content.some((row) => row.kind === 'content' && row.auditHref?.includes('/audit/result')),
);
assert('query action from MISS', content.some((row) => row.kind === 'query'));
assert('faq from recommend miss', content.some((row) => row.kind === 'faq'));

const orphans = generateNextActions({
	opportunity: opportunityOf([missRow('대구 흉터 치료 추천')]),
	evidence: emptyEvidence(),
	gap: emptyGap(),
	audit: auditWithPages(['/scar.php', '/about'], ['https://sunshineclinic.kr/about']),
	gaps: [],
	boundFromAudit: true,
	siteUrl: site.url,
});
assert('internal_link from orphan pageMetas', orphans.some((row) => row.kind === 'internal_link'));

const noOrphans = generateNextActions({
	opportunity: opportunityOf([missRow('대구 흉터 치료 추천')]),
	evidence: emptyEvidence(),
	gap: emptyGap(),
	audit: auditWithPages(['/about'], ['https://sunshineclinic.kr/about']),
	gaps: [],
	boundFromAudit: true,
	siteUrl: site.url,
});
assert('no internal_link when pages are collected', noOrphans.every((row) => row.kind !== 'internal_link'));

assert(
	'preferred page skips homepage',
	preferredContentPage([], ['https://sunshineclinic.kr/', '/scar.php']) === '/scar.php',
);

const snapshot = buildNextActionSnapshot({
	site,
	source: 'derived',
	boundFromAudit: true,
	opportunity: opportunityOf([missRow('대구 흉터 치료 추천')]),
	evidence: emptyEvidence(),
	gap: {
		...emptyGap(),
		rows: [
			{
				id: 'citation::덴서티',
				kind: 'citation',
				competitor: '덴서티',
				query: '대구 흉터 치료 추천',
				brandValue: 1,
				competitorValue: 6,
				gap: 5,
				unit: 'count',
				why: '경쟁사 인용이 더 많습니다.',
				evidence: ['https://news.chosun.com/d'],
				impact: 70,
				recommendedAction: 'Citation 확보',
				actionCategory: 'citation',
				available: true,
			},
		],
	},
	audit: auditWithPages(['/scar.php']),
	gaps: ['content', 'entity'],
});
assert('top is at most 5', snapshot.top.length <= 5);
assert('top is prefix of sorted actions', snapshot.top.every((item, index) => item.id === snapshot.actions[index]?.id));
assert('summary total matches', snapshot.summary.total === snapshot.actions.length);
assert(
	'priority scores descend',
	snapshot.actions.every((row, index, list) => index === 0 || list[index - 1].priority >= row.priority),
);

const first = snapshot.actions[0];
assert('priority formula is derived score', first.priority === actionPriority(first));
const core = coreActionFromNext(first);
assert('core priority is derived', core.priority.provenance === 'derived');
assert('core expectedImpact is derived', core.expectedImpact.provenance === 'derived');
assert('estimatedImpact is not presented as observed', first.estimatedImpact === first.impact);

void (async () => {
	const engine = await mockAsiEngine.loadAction({ url: site.url });
	assert('engine snapshot builds', Boolean(engine));
	assert('engine top is at most 5', Boolean(engine && engine.top.length <= 5));
	assert(
		'engine top subset of actions',
		Boolean(engine && engine.top.every((item) => engine.actions.some((row) => row.id === item.id))),
	);

	const runSrc = readFileSync(resolve(process.cwd(), 'lib/ai-search-intelligence/next-action/run.ts'), 'utf8');
	assert('runner uses query plan', runSrc.includes('runAsiQueryPlan'));
	assert(
		'runner has no vendor HTTP',
		!/api\.openai\.com|generativelanguage\.googleapis\.com|api\.perplexity\.ai|api\.anthropic\.com/.test(runSrc),
	);
	assert('runner reuses opportunity queries', runSrc.includes('generateOpportunityQueries'));
	assert('runner reuses evidence explorer', runSrc.includes('buildEvidenceExplorerSnapshot'));
	assert('runner reuses competitor gap', runSrc.includes('buildCompetitorGapSnapshot'));
	assert('cache replay keeps live answers', runSrc.includes("row.source === 'live'") && runSrc.includes('liveCached'));

	if (failed) {
		console.error(`\n${failed} failed`);
		process.exit(1);
	}
	console.log('\nall passed');
})();
