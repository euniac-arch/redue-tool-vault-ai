/**
 * NAP consistency matrix — compare statuses, fallback, prescriptions.
 * Run: npx tsx scripts/test-nap-matrix.ts
 */
import {
	buildNapMatrix,
	compareChannelNap,
	hydrateReportNapMatrix,
	inferChannelIdFromLabel,
	isUsableNapMatrix,
	napStatusLabel,
	resolveNapMatrix,
	sanitizeNapMatrix,
} from '../lib/audit/nap-matrix';
import { NINEONE_GUIDE_SAMPLE } from '../lib/guide/sample';
import { ensureGuideData } from '../lib/guide/ensure-guide-data';

let failed = 0;

function assert(label: string, condition: boolean, detail?: unknown) {
	if (condition) {
		console.log(`ok  ${label}`);
		return;
	}
	failed += 1;
	console.error(`FAIL ${label}`, detail ?? '');
}

const canonical = {
	name: '나인원의원',
	address: '대구광역시 동구 동부로 26길 6 대구 메리어트호텔 2층',
	phone: '053-123-4567',
};

assert(
	'exact match',
	compareChannelNap(canonical, canonical, 'naver_place', true).status === 'MATCH',
);

assert(
	'spacing-only name is WARNING',
	compareChannelNap(canonical, { name: '나인원 의원', address: canonical.address, phone: canonical.phone }, 'naver_place', true)
		.status === 'WARNING',
);

assert(
	'unit/floor difference is WARNING',
	compareChannelNap(
		canonical,
		{ name: '나인원의원', address: '대구광역시 동구 동부로 26길 6 대구 메리어트호텔', phone: canonical.phone },
		'naver_place',
		true,
	).status === 'WARNING',
);

assert(
	'phone digits match is WARNING',
	compareChannelNap(canonical, { name: canonical.name, address: canonical.address, phone: '0531234567' }, 'google_business', true)
		.status === 'WARNING',
);

assert(
	'jibun vs road is MISMATCH',
	compareChannelNap(
		canonical,
		{ name: '나인원의원', address: '대구 동구 신천동 100-1', phone: canonical.phone },
		'kakao_tmap',
		true,
	).status === 'MISMATCH',
);

assert(
	'unidentified empty is NOT_FOUND',
	compareChannelNap(canonical, {}, 'bing_places', false).status === 'NOT_FOUND',
);

assert(
	'identified place without collected NAP is UNAVAILABLE (not MATCH/WARNING)',
	compareChannelNap(canonical, {}, 'naver_place', true).status === 'UNAVAILABLE',
);
assert(
	'blocked social profile is UNAVAILABLE',
	compareChannelNap(canonical, { blocked: true, blockReason: '데이터 수집 불가(인스타그램 로그인·API 제약)' }, 'sns', true)
		.status === 'UNAVAILABLE',
);
assert(
	'blocked empty never becomes MATCH',
	compareChannelNap(canonical, { blocked: true }, 'youtube', true).status !== 'MATCH',
);
assert(
	'placeholder 미수집 is treated as empty',
	compareChannelNap(
		canonical,
		{ name: '미수집', address: '미수집', phone: '미수집' },
		'google_business',
		true,
	).status === 'UNAVAILABLE',
);

const gbpOverride = buildNapMatrix({
	brandName: canonical.name,
	address: canonical.address,
	telephone: canonical.phone,
	googleMapsLinked: true,
	collectedByChannel: { google_business: { name: '', address: '', phone: '' } },
	statusOverrides: { google_business: { status: 'MATCH', discrepancyNote: '' } },
});
const gbpRow = gbpOverride.rows.find((row) => row.channelId === 'google_business');
assert(
	'empty GBP + MATCH override is not 100% 일치',
	gbpRow?.status !== 'MATCH' && (gbpRow?.status === 'UNAVAILABLE' || gbpRow?.status === 'NOT_FOUND'),
	gbpRow,
);
assert('empty GBP has no collected name', !gbpRow?.collectedName, gbpRow);

const matrix = buildNapMatrix({
	brandName: canonical.name,
	address: canonical.address,
	telephone: canonical.phone,
	naverPlaceLinked: true,
	googleMapsLinked: false,
	bingPlacesLinked: false,
	collectedByChannel: {
		naver_place: {
			name: '나인원 의원',
			address: '대구광역시 동구 동부로26길 6 대구 메리어트호텔 2층',
			phone: '053-123-4567',
		},
		kakao_tmap: {
			name: '나인원의원',
			address: '서울 강남구 테헤란로 1',
			phone: '02-000-0000',
		},
	},
});

const homepage = matrix.rows.find((row) => row.channelId === 'homepage');
const naver = matrix.rows.find((row) => row.channelId === 'naver_place');
const bing = matrix.rows.find((row) => row.channelId === 'bing_places');
const kakao = matrix.rows.find((row) => row.channelId === 'kakao_tmap');

assert('homepage is canonical MATCH', homepage?.isCanonical === true && homepage.status === 'MATCH');
assert('homepage sits first', matrix.rows[0]?.channelId === 'homepage');
assert('naver spacing/unit is WARNING', naver?.status === 'WARNING', naver);
assert('bing unlinked is NOT_FOUND', bing?.status === 'NOT_FOUND', bing);
assert('kakao wrong city is MISMATCH', kakao?.status === 'MISMATCH', kakao);
assert('usable matrix', isUsableNapMatrix(matrix));
assert('unusable empty', !isUsableNapMatrix(undefined) && !isUsableNapMatrix({ canonical, rows: [], recommendations: [] }));
assert('badge MATCH', napStatusLabel('MATCH') === '100% 일치');
assert('badge WARNING', napStatusLabel('WARNING') === '표기 상이');
assert('badge MISMATCH', napStatusLabel('MISMATCH') === '불일치');
assert('badge NOT_FOUND', napStatusLabel('NOT_FOUND') === '채널 미식별');
assert('badge UNAVAILABLE', napStatusLabel('UNAVAILABLE') === '수집 불가(플랫폼 보안)');
assert(
	'recommendations mention kakao collected address',
	matrix.recommendations.some((item) => item.channelId === 'kakao_tmap' && item.prescription.includes('서울 강남구')),
	matrix.recommendations.find((item) => item.channelId === 'kakao_tmap')?.prescription,
);
assert(
	'recommendations omit NOT_FOUND channels like bing',
	!matrix.recommendations.some((item) => item.channelId === 'bing_places'),
	matrix.recommendations,
);

const legacy = ensureGuideData({
	brandName: '레거시브랜드',
	address: '서울 중구 세종대로 1',
	telephone: '02-111-2222',
});
assert('legacy guide synthesizes napMatrix from crawled identity', isUsableNapMatrix(legacy.napMatrix), legacy.napMatrix);
assert('legacy homepage uses crawled address', legacy.napMatrix?.rows[0]?.collectedAddress === '서울 중구 세종대로 1');

const llmPayload = {
	standard: { name: '레거시브랜드', address: '서울 중구 세종대로 1', phone: '02-111-2222' },
	channels: [
		{
			channelName: '공식 홈페이지',
			targetName: '레거시브랜드',
			targetAddress: '서울 중구 세종대로 1',
			targetPhone: '02-111-2222',
			status: 'MATCH',
			discrepancyNote: '',
		},
		{
			channelName: '네이버 플레이스 / 지도',
			targetName: '레거시 브랜드',
			targetAddress: '서울 중구 세종대로1',
			targetPhone: '021112222',
			status: 'WARNING',
			discrepancyNote: '호수 구분 표기 차이',
		},
	],
	consistencyScore: 75,
};
const fromLlm = resolveNapMatrix(llmPayload);
assert('LLM payload is usable', isUsableNapMatrix(fromLlm), fromLlm);
assert('LLM label maps to naver_place', inferChannelIdFromLabel('네이버 플레이스 / 지도') === 'naver_place');
assert('LLM naver collected name kept', fromLlm?.rows.find((row) => row.channelId === 'naver_place')?.collectedName === '레거시 브랜드', fromLlm);
assert(
	'LLM WARNING status preserved',
	fromLlm?.rows.find((row) => row.channelId === 'naver_place')?.status === 'WARNING',
	fromLlm?.rows.find((row) => row.channelId === 'naver_place'),
);
assert(
	'LLM discrepancyNote preserved',
	fromLlm?.rows.find((row) => row.channelId === 'naver_place')?.discrepancyNote === '호수 구분 표기 차이',
);

const legacyReport = {
	url: 'https://legacy.example',
	fetchedAt: new Date().toISOString(),
	httpStatus: 200,
	responseTimeMs: 100,
	pageSizeBytes: 1000,
	score: 80,
	maxScore: 125,
	status: 'FAIR' as const,
	statusLabel: '보통',
	categories: [],
	findings: [],
	siteMeta: {
		domain: 'legacy.example',
		brandName: '레거시클리닉',
		category: '클리닉',
		primaryKeyword: '클리닉',
		industryType: 'MEDICAL' as const,
		location: '서울',
		broadLocation: '서울',
		vertical: 'medical' as const,
		targetUrl: 'https://legacy.example',
		address: '서울특별시 강남구 테헤란로 1',
		telephone: '02-555-1212',
		sameAs: ['https://map.naver.com/p/entry/place/1'],
	},
};
const hydrated = hydrateReportNapMatrix(legacyReport as never);
assert('hydrate attaches napMatrix to legacy report', isUsableNapMatrix(hydrated?.napMatrix), hydrated?.napMatrix);
assert('hydrate homepage uses crawled phone', hydrated?.napMatrix?.rows[0]?.collectedPhone === '02-555-1212');
const hydratedNaver = hydrated?.napMatrix?.rows.find((row) => row.channelId === 'naver_place');
assert(
	'hydrate marks linked-but-uncollected naver as UNAVAILABLE',
	hydratedNaver?.status === 'UNAVAILABLE',
	hydratedNaver,
);
assert(
	'hydrate UNAVAILABLE note is collection-blocked, not a fake match',
	Boolean(hydratedNaver?.discrepancyNote && /수집 불가|차단/.test(hydratedNaver.discrepancyNote)),
	hydratedNaver?.discrepancyNote,
);

const sanitized = sanitizeNapMatrix(matrix, { brandName: canonical.name, address: canonical.address, telephone: canonical.phone });
assert('sanitize keeps rows', Boolean(sanitized && sanitized.rows.length === 7));

assert('sample guide ships a usable napMatrix', isUsableNapMatrix(NINEONE_GUIDE_SAMPLE.napMatrix));
assert(
	'sample has mixed statuses',
	new Set(NINEONE_GUIDE_SAMPLE.napMatrix?.rows.map((row) => row.status) || []).size > 1,
	NINEONE_GUIDE_SAMPLE.napMatrix?.rows.map((row) => row.status),
);

if (failed) {
	console.error(`\n${failed} failed`);
	process.exit(1);
}
console.log('\nall passed');
