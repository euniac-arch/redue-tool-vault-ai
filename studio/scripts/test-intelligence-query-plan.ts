/**
 * Query → Deduplicate → Cache → Provider → Store.
 * One provider failure does not fail the batch.
 * Run: npx tsx scripts/test-intelligence-query-plan.ts
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { errorAsiResponse } from '../lib/ai-search-intelligence/providers/live-query';
import { createMockAsiProvider } from '../lib/ai-search-intelligence/providers/mock-provider';
import {
	asiProviderAvailability,
	dedupeAsiQueryTexts,
} from '../lib/ai-search-intelligence/providers/query-plan';
import { queryAsiProviders } from '../lib/ai-search-intelligence/providers/compose';

let failed = 0;

function assert(label: string, condition: boolean) {
	if (condition) {
		console.log(`ok  ${label}`);
		return;
	}
	failed += 1;
	console.error(`FAIL ${label}`);
}

function read(rel: string) {
	return readFileSync(resolve(process.cwd(), rel), 'utf8');
}

const plan = read('lib/ai-search-intelligence/providers/query-plan.ts');
const compose = read('lib/ai-search-intelligence/providers/compose.ts');

assert('plan dedupes before providers', plan.includes('dedupeAsiQueryTexts') && plan.includes('queryAsiProviders'));
assert('plan checks citation cache', plan.includes('storedForQuery') || plan.includes('readAsiCitationStore'));
assert('plan remesasure can refresh cache', plan.includes('refresh') && plan.includes('input.refresh'));
assert('plan persists observations', plan.includes('persistAsiObservations'));
assert('plan ingests competitor registry', plan.includes('ingestAsiCompetitorResponses'));
assert('compose isolates provider errors', compose.includes('Promise.all') && compose.includes('errorAsiResponse'));
assert('compose catch does not rethrow', compose.includes('catch (err)') && !compose.includes('throw classified'));

const duped = dedupeAsiQueryTexts([
	'대구 흉터 추천',
	'  대구 흉터 추천  ',
	'대구 흉터 추천',
	'서울 피부과 추천',
	'',
]);
assert('dedupe keeps first casing and unique texts', duped.length === 2 && duped[0] === '대구 흉터 추천');

void (async () => {
	const ok = await createMockAsiProvider('chatgpt').query({
		query: '부분 실패',
		url: 'https://sunshineclinic.kr',
		brand: 'Sunshine',
	});
	const timeout = errorAsiResponse(
		'perplexity',
		{ query: '부분 실패', url: 'https://sunshineclinic.kr', brand: 'Sunshine' },
		'provider_timeout',
		'provider_timeout',
	);
	const mix = asiProviderAvailability([ok, timeout]);
	assert('successful provider stays available', mix.available.includes('chatgpt'));
	assert(
		'timeout provider is unavailable not fatal',
		mix.unavailable.some((row) => row.provider === 'perplexity' && row.error === 'provider_timeout'),
	);

	const batch = await queryAsiProviders({
		query: '부분 실패 배치',
		url: 'https://sunshineclinic.kr',
		brand: 'Sunshine',
	});
	assert('batch still returns 4 engines when one path errors', batch.length === 4);
	assert('batch is not empty after a classified error', batch.every((row) => row.provider));

	if (failed) {
		console.error(`\n${failed} failed`);
		process.exit(1);
	}
	console.log('\nall passed');
})();
