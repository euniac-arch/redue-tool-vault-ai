/**
 * Live citation explorer: observe only, never invent, classify source class.
 * Run: npx tsx scripts/test-intelligence-citations.ts
 */
import { createAsiEngine } from '../lib/ai-search-intelligence/adapters/create-engine';
import { overlayLiveCitations } from '../lib/ai-search-intelligence/citations/overlay';
import { classifyCitationSource } from '../lib/ai-search-intelligence/citations/classify';
import { mixAsiCitations } from '../lib/ai-search-intelligence/citations/mix';
import { normalizeAsiCitations, observedCitationUrls } from '../lib/ai-search-intelligence/citations/normalize';
import { clearAsiCitationStore } from '../lib/ai-search-intelligence/citations/store';
import { buildMockEvidenceSnapshot } from '../lib/ai-search-intelligence/mock/build-mock-evidence';
import { parseProviderAnswer } from '../lib/ai-search-intelligence/providers/normalize';
import type { AIResponse } from '../lib/ai-search-intelligence/types';

let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
	if (condition) {
		console.log(`ok  ${label}`);
		return;
	}
	failed += 1;
	console.error(`FAIL ${label}${detail ? ` — ${detail}` : ''}`);
}

const site = 'https://nineone.kr';

assert('owned official', classifyCitationSource('https://nineone.kr/about', site) === 'owned');
assert('local maps', classifyCitationSource('https://map.naver.com/p/entry/123', site) === 'local');
assert('social youtube', classifyCitationSource('https://www.youtube.com/watch?v=abc', site) === 'social');
assert('third party news', classifyCitationSource('https://news.chosun.com/site/data/x.html', site) === 'third_party');
assert('unknown empty host', classifyCitationSource('not-a-url', site) === 'unknown');

assert(
	'observed urls from extras + answer',
	observedCitationUrls({
		answer: 'See https://nineone.kr',
		providerUrls: ['https://map.naver.com/p/x'],
		citations: [{ url: 'https://invented.example/fake' }],
	}).includes('https://invented.example/fake') === false,
);
assert(
	'drops invented json url',
	!observedCitationUrls({
		answer: '추천합니다.',
		providerUrls: [],
		citations: [{ url: 'https://hallucinated.example' }],
	}).length,
);

const parsedEmpty = parseProviderAnswer(JSON.stringify({
	answer: '추천만 있고 링크는 없습니다.',
	mentions: ['나인원의원'],
	recommendations: ['나인원의원'],
	citations: [{ source: '가짜', url: 'https://fake.example', relevance: 90, authority: 90 }],
}));
assert('parse does not invent citations', parsedEmpty.citations.length === 0);

const parsedObserved = parseProviderAnswer(
	JSON.stringify({
		answer: '근거는 https://nineone.kr 입니다.',
		mentions: [],
		recommendations: [],
		citations: [{ url: 'https://nineone.kr' }, { url: 'https://fake.example' }],
	}),
	{ urls: ['https://map.naver.com/p/x'] },
);
assert('parse keeps observed extras url', parsedObserved.citations.some((item) => item.url.includes('map.naver')));
assert('parse keeps url written in answer', parsedObserved.citations.some((item) => item.url.includes('nineone.kr')));
assert('parse drops json-only fake url', !parsedObserved.citations.some((item) => item.url.includes('fake.example')));

function liveResponse(partial: Partial<AIResponse> & Pick<AIResponse, 'provider' | 'query'>): AIResponse {
	return {
		answer: '',
		mentions: [],
		recommendations: [],
		citations: [],
		confidence: 0.7,
		timestamp: new Date().toISOString(),
		source: 'live',
		...partial,
	};
}

const normalized = normalizeAsiCitations(
	[
		liveResponse({
			provider: 'perplexity',
			query: '대구 피부과 추천',
			answer: '나인원의원 https://nineone.kr',
			citations: [
				{ source: '나인원', url: 'https://nineone.kr', type: 'official', relevance: 0, authority: 0 },
				{ source: '지도', url: 'https://map.naver.com/p/x', type: 'map', relevance: 0, authority: 0 },
			],
		}),
		liveResponse({
			provider: 'chatgpt',
			query: '대구 피부과 추천',
			answer: '링크 없이 추천만 합니다.',
		}),
	],
	{ brand: '나인원의원', siteUrl: site },
);
assert('normalizes two observed sources', normalized.length === 2);
assert('owned relevance 100', normalized.some((item) => item.sourceType === 'owned' && item.brandRelevance === 100));
assert('does not invent for chatgpt empty', !normalized.some((item) => item.provider === 'chatgpt'));

const mix = mixAsiCitations(normalized);
assert('mix percents add to 100', mix.mix.owned.percent + mix.mix.local.percent + mix.mix.third_party.percent + mix.mix.social.percent + mix.mix.unknown.percent === 100);

const mock = buildMockEvidenceSnapshot({ url: 'https://sunshineclinic.kr' });
assert('mock still has 9 kinds', mock?.citations.length === 9);
assert('mock report is mock', mock?.citationReport.computedFrom === 'mock');
assert('mock report available', mock?.citationReport.available === true);

if (mock) {
	const unavailable = overlayLiveCitations(mock, {
		sources: [],
		responses: [
			liveResponse({ provider: 'chatgpt', query: 'q', answer: '인용 없음' }),
			liveResponse({ provider: 'gemini', query: 'q', answer: '인용 없음' }),
		],
	});
	assert('live without urls is unavailable', unavailable.citationReport.available === false);
	assert('unavailable does not keep invented mock cards', unavailable.citations.length === 0);
	assert('unavailable keeps response count', unavailable.citationReport.responseCount === 2);

	const live = overlayLiveCitations(mock, {
		sources: normalized,
		responses: [
			liveResponse({
				provider: 'perplexity',
				query: '대구 피부과 추천',
				answer: 'https://nineone.kr',
				citations: normalized.map((item) => ({
					source: item.title,
					url: item.url,
					type: item.kind,
					relevance: 0,
					authority: 0,
				})),
			}),
		],
	});
	assert('live overlay replaces citations', live.citationReport.computedFrom === 'live' && live.citations.length === 2);
	assert('live citations stay observed urls', live.citations.every((item) => item.cited && item.url.startsWith('https://')));
}

clearAsiCitationStore();
void createAsiEngine('mock')
	.loadEvidence({ url: 'https://sunshineclinic.kr' })
	.then((via) => {
		assert('mock engine keeps invented explorer', via?.citations.length === 9);
		assert('mock engine report is mock', via?.citationReport.computedFrom === 'mock');
		if (failed) {
			console.error(`\n${failed} failed`);
			process.exit(1);
		}
		console.log('\nall passed');
	});
