/**
 * STEP 20 — Universal AI Query Intelligence Engine.
 * Any target site must produce queries from its own context.
 * No domain / brand / city / vertical is hardcoded in the engine.
 * Run: npx tsx scripts/test-intelligence-query-engine.ts
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { buildMockEvidenceSnapshot } from '../lib/ai-search-intelligence/mock/build-mock-evidence';
import {
	generateUniversalQueries,
	questionInputsFromContext,
} from '../lib/ai-search-intelligence/query-intelligence/generate';
import { QUERY_INTENTS } from '../lib/ai-search-intelligence/query-intelligence/intents';
import {
	clearAsiQueryPool,
	readAsiQueryDataset,
	readAsiQueryPool,
	resolveAsiTargetContext,
	syncAsiQueryPool,
	targetContextFromSite,
} from '../lib/ai-search-intelligence/target';
import type { LatestAuditPayload } from '../lib/audit/latest-audit-payload';
import type { AuditReport } from '../lib/site-auditor';

let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
	if (condition) {
		console.log(`ok  ${label}`);
		return;
	}
	failed += 1;
	console.error(`FAIL ${label}${detail ? ` — ${detail}` : ''}`);
}

function auditFor(url: string, meta: Record<string, unknown>): LatestAuditPayload {
	return {
		auditId: `audit-${url}`,
		report: {
			url,
			siteMeta: meta,
		} as unknown as AuditReport,
		defectCount: 0,
		score: 70,
		maxScore: 100,
		savedAt: '2026-08-30T00:00:00.000Z',
	};
}

const SITES = [
	{
		id: 'hotel',
		url: 'https://harborinn.example/',
		meta: { brandName: 'Harbor Inn', category: '호텔', primaryKeyword: '오션뷰', location: '제주', coreSpecialties: ['오션뷰', '스파'] },
		foreign: /피부과|법률|한식|쇼핑몰|나인원/,
	},
	{
		id: 'legal',
		url: 'https://northlaw.example/',
		meta: { brandName: 'North Law', category: '법률사무소', primaryKeyword: '계약', location: '서울', coreSpecialties: ['계약', '소송'] },
		foreign: /호텔|피부과|한식|쇼핑몰|나인원/,
	},
	{
		id: 'restaurant',
		url: 'https://seoulkitchen.example/',
		meta: { brandName: 'Seoul Kitchen', category: '한식당', primaryKeyword: '한우', location: '부산', coreSpecialties: ['한우', '코스'] },
		foreign: /호텔|법률|피부과|쇼핑몰|나인원/,
	},
] as const;

for (const site of SITES) {
	clearAsiQueryPool();
	const context = resolveAsiTargetContext({
		url: site.url,
		audit: auditFor(site.url, site.meta),
	});
	assert(`${site.id} context from audit`, Boolean(context?.boundFromAudit));
	assert(`${site.id} industry from siteMeta.category`, context?.industry === site.meta.category);
	assert(`${site.id} location from siteMeta`, context?.location === site.meta.location);
	assert(`${site.id} services from specialties`, site.meta.coreSpecialties.every((item) => context?.services.includes(item)));
	assert(`${site.id} audience stays empty unless provided`, context?.targetAudience == null);

	const generated = generateUniversalQueries(context!, { limit: 16 });
	syncAsiQueryPool(context!, { limit: 16 });
	assert(`${site.id} status QUERY_GENERATED`, generated.status === 'QUERY_GENERATED');
	assert(`${site.id} at least 10 queries`, generated.items.length >= 10);
	assert(`${site.id} uses location`, generated.items.some((item) => item.used.location));
	assert(`${site.id} uses industry or service`, generated.items.some((item) => item.used.industry || item.used.service));
	assert(`${site.id} no invented audience`, generated.items.every((item) => !item.used.audience));
	assert(`${site.id} no foreign vertical leak`, generated.items.every((item) => !site.foreign.test(item.query)));
	assert(`${site.id} dataset isolated`, readAsiQueryDataset(context!.domain)?.items.every((item) => !site.foreign.test(item.query)) === true);
}

clearAsiQueryPool();
const hotelCtx = resolveAsiTargetContext({
	url: SITES[0]!.url,
	audit: auditFor(SITES[0]!.url, SITES[0]!.meta),
});
const legalCtx = resolveAsiTargetContext({
	url: SITES[1]!.url,
	audit: auditFor(SITES[1]!.url, SITES[1]!.meta),
});
syncAsiQueryPool(hotelCtx!, { limit: 16 });
syncAsiQueryPool(legalCtx!, { limit: 16 });
assert('hotel pool does not contain legal queries', readAsiQueryPool(hotelCtx!.domain).every((item) => !item.query.includes('법률')));
assert('legal pool does not contain hotel queries', readAsiQueryPool(legalCtx!.domain).every((item) => !item.query.includes('호텔')));
assert('dataset keys differ', hotelCtx!.domain !== legalCtx!.domain);

const noAudience = targetContextFromSite(
	{ url: 'https://partial.example', brandName: 'Partial Co', domain: 'partial.example', location: '인천', category: '카페' },
	{ services: ['디저트'] },
);
const partial = generateUniversalQueries(noAudience, { hasQuestionOverrides: true });
assert('audience optional still generates', partial.status === 'QUERY_GENERATED' && partial.items.length >= 8);
assert('audience optional has no 고객 filler', partial.items.every((item) => !item.query.includes('고객')));

const noLocation = targetContextFromSite(
	{ url: 'https://noloc.example', brandName: 'NoLoc', domain: 'noloc.example', category: '서점' },
	{ services: ['중고서적'] },
);
const withoutCity = generateUniversalQueries(noLocation, { hasQuestionOverrides: true });
assert('missing location still generates', withoutCity.items.length >= 6);
assert('missing location skips nearby template', withoutCity.items.every((item) => !item.query.includes('근처')));

const urlOnly = resolveAsiTargetContext({ url: 'https://brandonly.example/' });
const empty = generateUniversalQueries(urlOnly!, {});
assert('url-only is NO_DATA', empty.status === 'NO_DATA');
assert('url-only does not invent 해당 업종', empty.items.every((item) => !/해당 업종|현지|핵심 서비스/.test(item.query)));
assert('url-only inputs stay empty', questionInputsFromContext(urlOnly!).industry === '' && questionInputsFromContext(urlOnly!).target === '');

const evidenceEmpty = buildMockEvidenceSnapshot({ url: 'https://brandonly.example/' });
assert('evidence url-only is NO_DATA', evidenceEmpty?.queryGeneration?.status === 'NO_DATA');
assert('evidence url-only no fallback industry', evidenceEmpty?.questionInputs.industry === '');

const evidenceBound = buildMockEvidenceSnapshot({
	url: 'https://harborinn.example/',
	audit: auditFor('https://harborinn.example/', SITES[0]!.meta),
});
assert('evidence bound uses audit location', evidenceBound?.questionInputs.location === '제주');
assert('evidence bound uses audit industry', evidenceBound?.questionInputs.industry === '호텔');
assert('evidence bound queries include context', Boolean(evidenceBound?.questions.some((item) => item.query.includes('제주') && item.query.includes('호텔'))));
assert('evidence bound is QUERY_GENERATED', evidenceBound?.queryGeneration?.status === 'QUERY_GENERATED');
assert('evidence bound count >= 10', (evidenceBound?.questions.length ?? 0) >= 10);

assert('intent catalog has 9 intents', QUERY_INTENTS.length === 9);

const engineRoots = [
	join(process.cwd(), 'lib', 'ai-search-intelligence', 'query-intelligence'),
	join(process.cwd(), 'lib', 'ai-search-intelligence', 'target'),
	join(process.cwd(), 'lib', 'ai-search-intelligence', 'sov', 'query-set.ts'),
	join(process.cwd(), 'lib', 'ai-search-intelligence', 'mock', 'build-mock-evidence.ts'),
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
const filler = /해당 업종|핵심 서비스/;
const engineSrc = engineRoots.flatMap(walk).map((file) => readFileSync(file, 'utf8')).join('\n');
assert('engine has no test-target hardcoding', !banned.test(engineSrc));
assert('query generator has no invented industry/service fillers', !filler.test(engineSrc));

if (failed) {
	console.error(`\n${failed} failed`);
	process.exit(1);
}
console.log('\nall passed');
