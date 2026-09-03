/**
 * Run: npx tsx scripts/test-mypage-dashboard.ts
 */
import { mapInquiryDoc, mapScrapDoc } from '../lib/mypage/firebase-mypage-service';
import { filterResearchScraps, mergeResearchScraps } from '../lib/mypage/research-scraps';
import { mergeWorkInquiries, normalizeWorkInquiry } from '../lib/mypage/work-inquiries';

let failed = 0;

function assert(label: string, condition: boolean, detail?: unknown) {
	if (condition) {
		console.log(`ok  ${label}`);
		return;
	}
	failed += 1;
	console.error(`FAIL ${label}${detail ? ` — ${JSON.stringify(detail)}` : ''}`);
}

const inquiry = normalizeWorkInquiry({
	id: 'contact_1',
	inquiryType: 'geo',
	title: '스키마 주입 문의',
	message: '병원 사이트 스키마를 넣고 싶습니다.',
	createdAt: '2026-08-25T00:00:00.000Z',
	status: 'in_progress',
});

assert('normalizes contact lead', Boolean(inquiry && inquiry.serviceType === 'SEO & GEO 최적화'));
assert('keeps in_progress status', inquiry?.status === 'in_progress');

const merged = mergeWorkInquiries(
	[{ ...inquiry!, id: 'a', createdAt: '2026-08-28' }],
	[{ ...inquiry!, id: 'a', createdAt: '2026-08-01' }, { ...inquiry!, id: 'b', createdAt: '2026-08-20' }],
);
assert('merge keeps first id and sorts newest', merged.map((item) => item.id).join('|') === 'a|b');

const scraps = filterResearchScraps(
	[
		{
			id: '1',
			queryKeyword: 'GEO 동향',
			articleTitle: 'AI Overviews 분석',
			source: 'Tech',
			articleUrl: 'https://example.com',
			aiSummary: '요약',
			scrappedAt: '2026-08-29',
			tag: 'AI / SEO',
		},
	],
	'overviews',
);
assert('scrap search matches title', scraps.length === 1);
assert('scrap search misses unknown', filterResearchScraps(scraps, '비자').length === 0);

const firestoreInquiry = mapInquiryDoc('inq_1', {
	serviceType: 'SEO & GEO 최적화',
	title: '스키마 문의',
	content: 'JSON-LD 주입을 요청합니다.',
	status: 'pending',
	createdAt: '2026-08-29T00:00:00.000Z',
});
assert('maps inquiry doc', Boolean(firestoreInquiry && firestoreInquiry.id === 'inq_1' && firestoreInquiry.status === 'pending'));

const firestoreScrap = mapScrapDoc('scrap_1', {
	queryKeyword: 'GEO',
	articleTitle: 'AI Overviews',
	source: 'Tech',
	articleUrl: 'https://example.com/geo',
	aiSummary: '요약',
	tag: 'AEO·GEO',
	createdAt: '2026-08-29T12:00:00.000Z',
});
assert('maps scrap doc', Boolean(firestoreScrap && firestoreScrap.articleUrl.includes('example.com')));

const mergedScraps = mergeResearchScraps(
	[
		{
			id: 'https://example.com/geo',
			queryKeyword: 'GEO',
			articleTitle: '로컬 AI 리서치 기사',
			source: 'Search Engine Land',
			articleUrl: 'https://example.com/geo',
			aiSummary: '요약',
			scrappedAt: '2026-08-29',
			tag: 'AEO·GEO',
		},
	],
	[
		{
			id: 'scrap_1',
			queryKeyword: 'GEO',
			articleTitle: '원격 중복',
			source: 'Tech',
			articleUrl: 'https://example.com/geo/',
			aiSummary: '원격',
			scrappedAt: '2026-08-28',
			tag: 'AEO·GEO',
		},
		{
			id: 'scrap_2',
			queryKeyword: 'AIO',
			articleTitle: '원격 단독',
			source: 'Tech',
			articleUrl: 'https://example.com/aio',
			aiSummary: '원격',
			scrappedAt: '2026-08-28',
			tag: '생성형AI',
		},
	],
);
assert('merge prefers local scrap and keeps remote extras', mergedScraps.map((item) => item.id).join('|') === 'https://example.com/geo|scrap_2');
assert('merge keeps local title', mergedScraps[0]?.articleTitle === '로컬 AI 리서치 기사');

if (failed > 0) {
	console.error(`\n${failed} assertion(s) failed`);
	process.exit(1);
}
console.log('\nall assertions passed');
