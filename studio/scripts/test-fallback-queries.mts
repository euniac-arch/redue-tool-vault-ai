import {
	buildFallbackSearchQueries,
	buildFallbackGoogleQueries,
	buildIndustryExpansionQueries,
	isBroadCompanyKeyword,
	softIdentityDedupeKey,
	normalizeBusinessName,
} from '../lib/crawling/target-discovery';

const { primary, fallbacks } = buildFallbackSearchQueries(
	'부산',
	'의료/클리닉',
	'내과',
	'MEDICAL_CLINIC',
);
console.log('primary:', primary);
console.log('fallbacks:', fallbacks);
console.log(
	'google:',
	buildFallbackGoogleQueries('부산', '의료/클리닉', '내과', 'MEDICAL_CLINIC'),
);

const company = buildFallbackSearchQueries('부산 기업', '기타', '부산 기업', 'OTHER');
console.log('company primary:', company.primary);
console.log('company fallbacks:', company.fallbacks);
console.log('industry expansions:', buildIndustryExpansionQueries('부산 기업'));
console.log('isBroad 부산 기업:', isBroadCompanyKeyword('부산 기업'));
console.log('isBroad 부산 사하구 치과:', isBroadCompanyKeyword('부산 사하구 치과'));

const a = softIdentityDedupeKey({
	siteName: '해운대내과의원',
	telephone: '051-123-4567',
});
const b = softIdentityDedupeKey({
	siteName: '해운대내과의원',
	telephone: '051-123-4567',
});
const c = softIdentityDedupeKey({
	siteName: '해운대내과의원',
	telephone: '051-999-8888',
});
const d = softIdentityDedupeKey({ siteName: '해운대내과의원' });
const e = softIdentityDedupeKey({
	siteName: '해운대내과의원',
	roadAddress: '부산광역시 해운대구 우동 123',
});
const f = softIdentityDedupeKey({
	siteName: '센텀내과의원',
	roadAddress: '부산광역시 해운대구 우동 123',
});

console.log({
	a,
	b,
	samePhone: a === b,
	diffPhone: a !== c,
	nameOnly: d,
	sameAddrDiffName: e !== f,
});
console.log('norm', normalizeBusinessName('부산진 내과의원'));

