/**
 * Universal Competitor Intelligence engine.
 * nineoneclinic.com is a TEST TARGET fixture only — the engine must not
 * special-case any site, brand, query, or vertical.
 * Run: npx tsx scripts/test-intelligence-target-engine.ts
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
	asiDatasetScopeKey,
	clearAsiCompetitorStore,
	rebuildAsiCompetitorRegistry,
	stageAsiCompetitor,
	toCompetitorEntity,
	visibleCompetitorEntities,
	visibleCompetitorNames,
} from '../lib/ai-search-intelligence/competitors';
import { competitorKey } from '../lib/ai-search-intelligence/competitors/normalize';
import { appendAsiCitationStore, clearAsiCitationStore } from '../lib/ai-search-intelligence/citations/store';
import { generateOpportunityQueries } from '../lib/ai-search-intelligence/opportunity/generate-queries';
import { buildAsiQuerySet } from '../lib/ai-search-intelligence/sov/query-set';
import {
	clearAsiQueryPool,
	defaultRecommendQuery,
	readAsiQueryPool,
	resolveAsiTargetContext,
	syncAsiQueryPool,
	targetContextFromSite,
} from '../lib/ai-search-intelligence/target';
import type { AIResponse, AsiEngineId, AsiWarRoomSite } from '../lib/ai-search-intelligence/types';

let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
	if (condition) {
		console.log(`ok  ${label}`);
		return;
	}
	failed += 1;
	console.error(`FAIL ${label}${detail ? ` — ${detail}` : ''}`);
}

function liveResponse(
	partial: Partial<AIResponse> & Pick<AIResponse, 'provider' | 'query' | 'mentions' | 'recommendations'>,
): AIResponse {
	return {
		answer: `${(partial.recommendations ?? []).join(', ')}를 추천합니다.`,
		citations: [],
		confidence: 0.7,
		timestamp: '2026-08-30T00:00:00.000Z',
		source: 'live',
		...partial,
	};
}

type VerticalFixture = {
	id: string;
	site: AsiWarRoomSite;
	services: string[];
	observed: string;
	ownAlias: string;
};

const VERTICALS: VerticalFixture[] = [
	{
		id: 'hotel',
		site: { url: 'https://harborinn.example', brandName: 'Harbor Inn', domain: 'harborinn.example', location: '제주', category: '호텔' },
		services: ['오션뷰', '스파'],
		observed: 'Grand Harbor',
		ownAlias: 'HarborInn',
	},
	{
		id: 'legal',
		site: { url: 'https://northlaw.example', brandName: 'North Law', domain: 'northlaw.example', location: '서울', category: '법률사무소' },
		services: ['계약', '소송'],
		observed: 'Seoul Counsel',
		ownAlias: 'northlaw',
	},
	{
		id: 'restaurant',
		site: { url: 'https://seoulkitchen.example', brandName: 'Seoul Kitchen', domain: 'seoulkitchen.example', location: '부산', category: '한식당' },
		services: ['한우', '코스'],
		observed: 'Busan Table',
		ownAlias: 'seoulkitchen',
	},
	{
		id: 'retail',
		site: { url: 'https://citymall.example', brandName: 'City Mall', domain: 'citymall.example', location: '인천', category: '쇼핑몰' },
		services: ['가방', '슈즈'],
		observed: 'Harbor Outlet',
		ownAlias: 'citymall',
	},
];

/** Test-only fixture. Never imported by engine logic. */
const MEDICAL_TEST_TARGET: VerticalFixture = {
	id: 'medical-test-target',
	site: {
		url: 'https://nineoneclinic.com',
		brandName: '나인원의원',
		domain: 'nineoneclinic.com',
		location: '대구',
		category: '피부과',
	},
	services: ['리프팅', '흉터'],
	observed: '덴서티',
	ownAlias: 'nineoneclinic',
};

for (const fixture of [...VERTICALS, MEDICAL_TEST_TARGET]) {
	clearAsiQueryPool(fixture.site.domain);
	clearAsiCompetitorStore(fixture.site.domain);
	clearAsiCitationStore(fixture.site.domain);

	const context = targetContextFromSite(fixture.site, { services: fixture.services });
	assert(`${fixture.id} context uses site url`, context.siteUrl === fixture.site.url);
	assert(`${fixture.id} context uses brand`, context.brandName === fixture.site.brandName);
	assert(`${fixture.id} context uses location`, context.location === fixture.site.location);
	assert(`${fixture.id} context uses category`, context.category === fixture.site.category);
	assert(
		`${fixture.id} services come from target`,
		fixture.services.every((item) => context.services.includes(item)),
	);

	const recommend = defaultRecommendQuery(context);
	assert(`${fixture.id} recommend uses location+category`, recommend === `${fixture.site.location} ${fixture.site.category} 추천`);
	assert(`${fixture.id} recommend is not hospital default`, !recommend.includes('병원'));

	const set = buildAsiQuerySet(fixture.site);
	assert(`${fixture.id} query set size`, set.length === 6);
	assert(`${fixture.id} query set recommend`, set.some((item) => item.query === recommend && item.category === 'recommend'));
	assert(
		`${fixture.id} query set has no foreign vertical`,
		set.every((item) => !/병원|피부과|호텔|법률사무소|한식당|쇼핑몰/.test(item.query) || item.query.includes(fixture.site.category!)),
	);

	const queries = generateOpportunityQueries({
		site: fixture.site,
		services: fixture.services,
		competitors: [fixture.observed],
		limit: 10,
	});
	assert(`${fixture.id} pool has 6-10 queries`, queries.length >= 6 && queries.length <= 10);
	assert(`${fixture.id} pool includes a service`, queries.some((item) => item.text.includes(fixture.services[0]!)));
	assert(`${fixture.id} pool includes competitor compare`, queries.some((item) => item.text.includes(fixture.observed)));
	assert(
		`${fixture.id} shared pool persisted`,
		queries.every((item) => readAsiQueryPool(fixture.site.domain).some((row) => row.query === item.text)),
	);

	const aliases = [fixture.site.brandName, fixture.ownAlias];
	appendAsiCitationStore(
		fixture.site.domain,
		[
			liveResponse({
				provider: 'chatgpt',
				query: recommend,
				mentions: [fixture.observed, fixture.site.brandName],
				recommendations: [fixture.observed],
			}),
			liveResponse({
				provider: 'gemini' as AsiEngineId,
				query: `${fixture.site.location} ${fixture.services[0]} 추천`,
				mentions: [fixture.observed],
				recommendations: [fixture.observed],
			}),
		],
		{ brand: fixture.site.brandName, aliases },
	);
	const roster = rebuildAsiCompetitorRegistry(fixture.site.domain, {
		brand: fixture.site.brandName,
		aliases,
		location: fixture.site.location,
		category: fixture.site.category,
	});
	assert(`${fixture.id} observed competitor from answers`, roster.some((row) => row.name === fixture.observed));
	assert(`${fixture.id} own brand excluded`, !roster.some((row) => row.name === fixture.site.brandName));
	assert(
		`${fixture.id} confirmed after two queries`,
		roster.find((row) => row.name === fixture.observed)?.stage === 'confirmed',
	);
	assert(`${fixture.id} visible roster`, visibleCompetitorNames(fixture.site.domain).includes(fixture.observed));
	const entity = visibleCompetitorEntities(fixture.site.domain).find((row) => row.entityKey === competitorKey(fixture.observed));
	assert(`${fixture.id} entity has competitorId`, Boolean(entity?.competitorId.includes(entity.entityKey)));
	assert(`${fixture.id} entity has competitorName`, entity?.competitorName === fixture.observed);
	assert(`${fixture.id} entity has normalizedName`, Boolean(entity?.normalizedName));
	assert(`${fixture.id} entity carries target category`, entity?.category === fixture.site.category);
}

const lounge = toCompetitorEntity('메디컬라운지의원', { scope: 'clinic.example', location: '대구', category: '피부과' });
assert('entity folds legal suffix', lounge?.entityKey === competitorKey('메디컬라운지'));
assert('entity id is scoped', lounge?.competitorId === `clinic.example::${lounge?.entityKey}`);
assert('entity reuses brand aliases', (lounge?.aliases.length ?? 0) >= 1);

clearAsiCompetitorStore();
clearAsiCitationStore();
appendAsiCitationStore(
	'clinic.example',
	[
		liveResponse({
			provider: 'chatgpt',
			query: '지역 추천',
			mentions: ['메디컬라운지'],
			recommendations: ['메디컬라운지'],
		}),
	],
	{ brand: 'Other Clinic', siteUrl: 'https://clinic.example', aliases: ['Other Clinic'] },
);
const fromAnswer = rebuildAsiCompetitorRegistry('clinic.example', {
	brand: 'Other Clinic',
	aliases: ['Other Clinic'],
});
assert(
	'메디컬라운지 only from live answer',
	fromAnswer.some((row) => row.competitorName === '메디컬라운지' && row.origin === 'live' && row.stage !== 'candidate'),
);

const hotelScope = { domain: 'same.example', projectId: 'hotel-project', siteId: 'same.example' };
const legalScope = { domain: 'same.example', projectId: 'legal-project', siteId: 'same.example' };
assert('project scopes isolate', asiDatasetScopeKey(hotelScope) !== asiDatasetScopeKey(legalScope));
clearAsiCompetitorStore(hotelScope);
clearAsiCompetitorStore(legalScope);
rebuildAsiCompetitorRegistry(hotelScope, {
	brand: 'Harbor Inn',
	aliases: ['Harbor Inn'],
	auditNames: [],
	responses: [
		liveResponse({
			provider: 'chatgpt',
			query: '호텔 추천',
			mentions: ['Grand Harbor'],
			recommendations: ['Grand Harbor'],
		}),
	],
});
rebuildAsiCompetitorRegistry(legalScope, {
	brand: 'North Law',
	aliases: ['North Law'],
	responses: [
		liveResponse({
			provider: 'chatgpt',
			query: '법률 추천',
			mentions: ['Seoul Counsel'],
			recommendations: ['Seoul Counsel'],
		}),
	],
});
assert('hotel dataset stays in hotel scope', visibleCompetitorNames(hotelScope).includes('Grand Harbor'));
assert('legal dataset stays in legal scope', visibleCompetitorNames(legalScope).includes('Seoul Counsel'));
assert('hotel names do not leak into legal', !visibleCompetitorNames(legalScope).includes('Grand Harbor'));
assert('legal names do not leak into hotel', !visibleCompetitorNames(hotelScope).includes('Seoul Counsel'));

assert('hotel vs legal keys differ', competitorKey('Grand Harbor') !== competitorKey('Seoul Counsel'));
assert('legal suffix folds hotel', competitorKey('Harbor Inn Hotel') === competitorKey('Harbor Inn'));
assert('legal suffix folds law', competitorKey('North Law 법률사무소') === competitorKey('North Law'));
assert(
	'candidate stays candidate',
	stageAsiCompetitor({ mentionCount: 0, queryCount: 0, providerCount: 0 }) === 'candidate',
);
assert(
	'one mention is observed',
	stageAsiCompetitor({ mentionCount: 1, queryCount: 1, providerCount: 1 }) === 'observed',
);

const hotelFromUrl = resolveAsiTargetContext({
	url: 'https://harborinn.example',
	questions: { industry: '호텔', location: '제주', service: '오션뷰', target: '여행객' },
});
assert('resolver fills from questions when audit missing', hotelFromUrl?.category === '호텔' && hotelFromUrl.location === '제주');
assert('resolver industry from questions', hotelFromUrl?.industry === '호텔');
assert('resolver audience from questions is optional and kept', hotelFromUrl?.targetAudience === '여행객');
assert('resolver services include question service', hotelFromUrl?.services.includes('오션뷰') === true);

const empty = defaultRecommendQuery({ brandName: 'Solo Brand', location: undefined, category: undefined, services: [] });
assert('brand-only recommend has no vertical default', empty === 'Solo Brand 추천');

const sparseSite = { url: 'https://solo.example', brandName: 'Solo Brand', domain: 'solo.example' };
const sparseSet = buildAsiQuerySet(sparseSite);
assert('sparse set never invents 병원', sparseSet.every((item) => !item.query.includes('병원')));
assert('sparse set uses brand', sparseSet.some((item) => item.query.includes('Solo Brand')));

syncAsiQueryPool(targetContextFromSite(VERTICALS[0]!.site, { services: VERTICALS[0]!.services }));
assert('hotel pool has no 피부과/덴서티', readAsiQueryPool('harborinn.example').every((item) => !/피부과|덴서티|나인원/.test(item.query)));

const engineRoots = [
	join(process.cwd(), 'lib', 'ai-search-intelligence', 'target'),
	join(process.cwd(), 'lib', 'ai-search-intelligence', 'sov', 'query-set.ts'),
	join(process.cwd(), 'lib', 'ai-search-intelligence', 'opportunity', 'generate-queries.ts'),
	join(process.cwd(), 'lib', 'ai-search-intelligence', 'query-intelligence'),
	join(process.cwd(), 'lib', 'ai-search-intelligence', 'recommendation', 'simulate.ts'),
	join(process.cwd(), 'lib', 'ai-search-intelligence', 'adapters', 'live-engine.ts'),
	join(process.cwd(), 'lib', 'ai-search-intelligence', 'perception', 'run.ts'),
	join(process.cwd(), 'lib', 'ai-search-intelligence', 'competitors'),
];

function walk(path: string): string[] {
	const stat = statSync(path);
	if (stat.isFile()) return [path];
	return readdirSync(path).flatMap((name) => {
		const next = join(path, name);
		return statSync(next).isDirectory() ? walk(next) : [next];
	});
}

const banned = /nineoneclinic|나인원의원|메디컬라운지|덴서티/;
const engineSrc = engineRoots.flatMap(walk).map((file) => readFileSync(file, 'utf8')).join('\n');
assert('engine source has no test-target hardcoding', !banned.test(engineSrc));
assert('query-set has no 병원 default', !readFileSync(join(process.cwd(), 'lib', 'ai-search-intelligence', 'sov', 'query-set.ts'), 'utf8').includes("'병원'"));
assert(
	'generate-queries has no 병원 default',
	!readFileSync(join(process.cwd(), 'lib', 'ai-search-intelligence', 'opportunity', 'generate-queries.ts'), 'utf8').includes("'병원'"),
);
assert(
	'live-engine has no 병원 default',
	!readFileSync(join(process.cwd(), 'lib', 'ai-search-intelligence', 'adapters', 'live-engine.ts'), 'utf8').includes("'병원'"),
);

if (failed) {
	console.error(`\n${failed} failed`);
	process.exit(1);
}
console.log('\nall passed');
