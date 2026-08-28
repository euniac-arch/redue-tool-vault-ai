/**
 * Default target-keyword pipeline for Strategy Studio.
 * Run: npx tsx scripts/test-default-keyword.ts
 */
import { resolveStrategyDefaultKeyword, seedTargetKeywordFromContext } from '../lib/strategy/default-keyword';
import { buildRecommendedKeywordGroups } from '../lib/strategy/recommended-keywords';
import type { StrategyAuditContext, StrategyIndustryProfileRef } from '../lib/strategy/types';

function ctx(partial: Partial<StrategyAuditContext> = {}): StrategyAuditContext {
	return {
		auditId: 'audit-1',
		url: 'https://clinic.example/',
		siteName: '예제클리닉',
		industry: '병의원',
		industryType: 'MEDICAL',
		subIndustry: '피부과',
		location: '대구 동구',
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
			location: partial.location || '대구 동구',
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

function profile(
	specialties: string[],
	registryType: StrategyIndustryProfileRef['registryType'] = 'medical',
	label = '병의원',
): StrategyIndustryProfileRef {
	return {
		registryType,
		legacyType: registryType === 'medical' ? 'MEDICAL' : 'GENERAL',
		label,
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

function lead(context: StrategyAuditContext, ref: StrategyIndustryProfileRef, query?: string) {
	const groups = buildRecommendedKeywordGroups(context, ref, 'ko');
	return {
		groups,
		value: resolveStrategyDefaultKeyword({ queryKeyword: query, groups, ctx: context, profile: ref, lang: 'ko' }),
	};
}

const derm = lead(ctx({ subIndustry: '피부과', location: '대구 동구' }), profile(['피부과']));
assert('medical default is metro procedure', derm.value === '대구 흉터 치료', derm.value);
assert('medical broad aliases metro', derm.groups.broad[0] === derm.groups.metro[0]);
assert('query keyword wins', lead(ctx(), profile(['피부과']), '대구 리프팅').value === '대구 리프팅');

const vet = lead(
	ctx({ industry: '동물병원', subIndustry: '동물병원', location: '부산 해운대구', localSignals: { location: '부산 해운대구', broadLocation: '부산', hasGeo: false, hasOpeningHours: false, sameAsCount: 0 } }),
	profile(['동물병원'], 'veterinary', '동물병원'),
);
assert('veterinary default is metro surgery', vet.value === '부산 슬개골 탈구 수술', vet.value);

const legal = lead(
	ctx({ industry: '법률', subIndustry: '법률사무소', location: '대구 중구', localSignals: { location: '대구 중구', broadLocation: '대구', hasGeo: false, hasOpeningHours: false, sameAsCount: 0 } }),
	profile(['형사전문'], 'legal', '법률'),
);
assert('legal default appends 변호사', legal.value === '대구 형사전문 변호사', legal.value);

const commerce = lead(
	ctx({
		industry: '유통',
		subIndustry: '식자재',
		location: null,
		localSignals: { hasGeo: false, hasOpeningHours: false, sameAsCount: 0 },
		entities: { phrases: ['업소용 식자재 도매 납품'], schemaTypes: [] },
	}),
	profile(['업소용 식자재 도매 납품'], 'professional', '유통'),
);
assert('commerce default uses on-page item', commerce.value === '업소용 식자재 도매 납품', commerce.value);

const general = lead(
	ctx({ industry: '일반', subIndustry: null, location: '대구', localSignals: { broadLocation: '대구', hasGeo: false, hasOpeningHours: false, sameAsCount: 0 } }),
	profile([], 'general', '일반'),
);
assert('general default is location + industry + 추천', /대구/.test(general.value) && /추천/.test(general.value), general.value);

const seeded = seedTargetKeywordFromContext(ctx({ subIndustry: '피부과', location: '대구 동구' }), profile(['피부과']), 'ko');
assert('seed matches first-rank keyword', seeded.seed === '대구 흉터 치료' && seeded.value === '대구 흉터 치료');

if (failed) {
	console.error(`\n${failed} assertion(s) failed`);
	process.exit(1);
}
console.log('\ndefault-keyword assertions passed');
