import { buildRecommendedKeywordGroups } from '../lib/strategy/recommended-keywords';
import type { StrategyAuditContext, StrategyIndustryProfileRef } from '../lib/strategy/types';

function ctx(partial: Partial<StrategyAuditContext> & Pick<StrategyAuditContext, 'subIndustry' | 'location'>): StrategyAuditContext {
	return {
		auditId: 'audit-1',
		url: 'https://clinic.example/',
		siteName: '예제클리닉',
		industry: '병의원',
		industryType: 'MEDICAL',
		scores: {
			seo: null,
			geo: null,
			aeo: null,
			entity: null,
			local: null,
			content: null,
			trust: null,
			measured: null,
		},
		entities: { phrases: [], schemaTypes: ['MedicalClinic'] },
		localSignals: {
			location: partial.location || undefined,
			broadLocation: '대구',
			hasGeo: false,
			hasOpeningHours: false,
			sameAsCount: 0,
		},
		contentSignals: {},
		trustSignals: { isHttps: true, sameAsCount: 0 },
		schema: { types: ['MedicalClinic'] },
		pages: [],
		issues: [],
		recommendations: [],
		competitors: null,
		fetchedAt: '2026-08-16T00:00:00.000Z',
		source: 'api',
		...partial,
	};
}

function profile(specialties: string[], registryType: StrategyIndustryProfileRef['registryType'] = 'medical'): StrategyIndustryProfileRef {
	return {
		registryType,
		legacyType: registryType === 'medical' ? 'MEDICAL' : 'GENERAL',
		label: '병의원',
		schemaType: 'MedicalClinic',
		specialties,
	};
}

let failed = 0;
function assert(label: string, ok: boolean, detail = '') {
	if (ok) {
		console.log(`ok  ${label}`);
		return;
	}
	failed += 1;
	console.error(`fail  ${label}${detail ? ` — ${detail}` : ''}`);
}

const derm = buildRecommendedKeywordGroups(ctx({ subIndustry: '피부과', location: '대구 동구' }), profile(['피부과']), 'ko');
assert('derm metro uses high-intent procedures', derm.metro.includes('대구 흉터 치료') && derm.metro.includes('대구 리프팅'));
assert('derm metro avoids district+generic concat', derm.metro.every((item) => !/동구 피부시술|치료 솔루션/.test(item)));
assert('derm aeo mixes procedure + department', derm.aeo.includes('대구 흉터 치료 잘하는 곳') && derm.aeo.includes('대구 피부과 추천'));
assert('derm local uses district + hub', derm.local.includes('대구 동구 피부과') && derm.local.includes('동대구역 피부과'));
assert('derm does not invent device brands', derm.all.every((item) => !/덴서티|울트라클리어/.test(item)));
assert('derm metro matches requested procedures', derm.metro.includes('대구 여드름 흉터') && derm.metro.includes('대구 튼살 치료'));
assert('derm never mixes plastic procedures', derm.all.every((item) => !/쌍꺼풀|코성형|윤곽|지방흡입/.test(item)));
assert('three groups are balanced', derm.metro.length >= 3 && derm.aeo.length >= 2 && derm.local.length >= 2);

const dermTreatment = buildRecommendedKeywordGroups(ctx({ subIndustry: '피부시술', location: '대구 동구' }), profile(['피부시술']), 'ko');
assert('피부시술 cluster stays dermatology', dermTreatment.metro.includes('대구 흉터 치료') && dermTreatment.local.includes('대구 동구 피부과'));
assert('피부시술 never mixes plastic procedures', dermTreatment.all.every((item) => !/쌍꺼풀|코성형|윤곽|지방흡입/.test(item)));

const mixedLabel = buildRecommendedKeywordGroups(
	ctx({ subIndustry: '피부과', industry: '성형외과·피부과', location: '대구 동구' }),
	profile(['피부과']),
	'ko',
);
assert('derm wins over mixed industry label', mixedLabel.all.every((item) => !/쌍꺼풀|코성형|윤곽|지방흡입/.test(item)));

const dental = buildRecommendedKeywordGroups(ctx({ subIndustry: '치과', location: '부산 해운대구' }), profile(['치과', '임플란트']), 'ko');
assert('dental stays on dental intent', dental.metro.includes('부산 임플란트') && dental.all.every((item) => !/흉터|피부과/.test(item)));
assert('dental local uses Haeundae hub', dental.local.includes('해운대역 치과'));

const onPage = buildRecommendedKeywordGroups(
	ctx({
		subIndustry: '피부과',
		location: '대구 동구',
		entities: { phrases: ['리프팅', '여드름 흉터'], schemaTypes: ['MedicalClinic'] },
	}),
	profile(['피부과', '리프팅']),
	'ko',
);
assert('on-page lifting is promoted', onPage.metro[0] === '대구 리프팅' || onPage.metro.includes('대구 리프팅'));

const en = buildRecommendedKeywordGroups(ctx({ subIndustry: '피부과', location: '대구 동구' }), profile(['피부과']), 'en');
assert('english keeps metro + procedure', en.metro.includes('Daegu scar treatment'));
assert('english aeo uses recommend forms', en.aeo.some((item) => /best|recommended/i.test(item)));
assert(
	'english local names the hub',
	en.local.includes('Dongdaegu Station dermatology') || en.local.includes('Dongdaegu Station dermatology clinic'),
);

if (failed) {
	console.error(`\n${failed} assertion(s) failed`);
	process.exit(1);
}
console.log('\nrecommended-keyword assertions passed');
