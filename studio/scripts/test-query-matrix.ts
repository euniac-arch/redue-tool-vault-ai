/**
 * Dynamic query matrix — slot extraction + Level 1–3 / SoV assembly.
 * Run: npx tsx scripts/test-query-matrix.ts
 */
import { buildSovQueryPresets } from '../lib/audit/realCompetitors';
import { buildTriggerQueries } from '../lib/audit/ai-engine-visibility';
import { collectAuditTargetKeywords } from '../lib/geo/prescription-patches';
import { classifyMetaKeywords, isSameBrandEntity } from '../lib/geo/brand-entities';
import {
	extractKeywordSlots,
	generateQueryMatrix,
	queryHasCategoryNoun,
	refineCategoryNouns,
} from '../lib/geo/query-matrix';
import type { AuditReport } from '../lib/site-auditor';

let failed = 0;

function assert(label: string, condition: boolean, detail?: unknown) {
	if (condition) {
		console.log(`ok  ${label}`);
		return;
	}
	failed += 1;
	console.error(`FAIL ${label}${detail ? ` — ${JSON.stringify(detail)}` : ''}`);
}

const agency = generateQueryMatrix({
	lang: 'ko',
	brandName: 'Made in Heaven',
	ogTitle: 'Made in Heaven | 부산 행사 에이전시 · 섭외',
	title: 'Made in Heaven | 행사 대행 · 섭외',
	metaKeywords: 'Made in Heaven, 메이드인헤븐, Dabin Lee, 이다빈, 섭외, 행사, 에이전시, 현장 운영, 연예인 섭외, 행사 기획',
	metaDescription: '연예인 섭외와 행사 기획, 현장 운영을 하는 행사 섭외 에이전시입니다.',
	representativeName: '이다빈',
	schemaTypes: ['EmploymentAgency'],
	jsonLdSnippets: [
		JSON.stringify({
			'@type': 'EmploymentAgency',
			name: 'Made in Heaven',
			hasOfferCatalog: {
				'@type': 'OfferCatalog',
				name: '행사대행',
				itemListElement: [{ '@type': 'Offer', itemOffered: { name: '섭외' } }],
			},
		}),
	],
	nap: { addressRegion: '부산', addressLocality: '해운대' },
});

assert('agency brand slot', agency.slots.brandName === 'Made in Heaven');
assert('agency location from NAP', agency.slots.location === '부산 해운대', agency.slots.location);
assert(
	'agency category nouns from schema/og/catalog',
	agency.slots.categoryNouns.some((n) => /에이전시|행사|섭외/.test(n)),
	agency.slots.categoryNouns,
);
assert('agency level1 is brand only', agency.triggerQueries.level1 === 'Made in Heaven');
assert(
	'agency level2 has location+noun or noun+intent',
	agency.level2.some((q) => /에이전시|행사|섭외/.test(q) && !agency.slots.intentModifiers.includes(q)),
	agency.level2.slice(0, 6),
);
assert(
	'agency level3 is conversational',
	agency.level3.some((q) => /어디가 좋아\?/.test(q) || /견적\/상담 잘하는 곳 추천해줘/.test(q)),
	agency.level3.slice(0, 4),
);
assert(
	'agency SoV targets never intent-only',
	agency.sovTargets.every((q) => queryHasCategoryNoun(q, agency.slots.categoryNouns)),
	agency.sovTargets.filter((q) => !queryHasCategoryNoun(q, agency.slots.categoryNouns)),
);
assert(
	'agency blocks modifier-only queries',
	!agency.sovTargets.includes('믿을 만한 곳') && !agency.sovTargets.includes('추천'),
);
assert(
	'agency category nouns drop brand and person names',
	agency.slots.categoryNouns.every((n) => !/made|heaven|메이드|이다빈|dabin/i.test(n)),
	agency.slots.categoryNouns,
);
assert(
	'agency SoV chip 1 is category 추천',
	/추천$/.test(agency.sovPresets[0]) && /행사|섭외|에이전시/.test(agency.sovPresets[0]) && !/Made|메이드|Heaven/i.test(agency.sovPresets[0]),
	agency.sovPresets,
);
assert(
	'agency SoV chip 2 is detail + industry',
	/에이전시/.test(agency.sovPresets[1]) && !/추천|잘하는곳/.test(agency.sovPresets[1]) && !/Made|메이드/i.test(agency.sovPresets[1]),
	agency.sovPresets,
);
assert(
	'agency SoV chip 3 is 잘하는곳',
	/잘하는곳$/.test(agency.sovPresets[2]) && !/Made|메이드|Heaven/i.test(agency.sovPresets[2]),
	agency.sovPresets,
);

const classified = classifyMetaKeywords({
	brandName: 'Made in Heaven',
	title: 'Made in Heaven | 행사 대행 · 섭외',
	keywords: 'Made in Heaven, 메이드인헤븐, Dabin Lee, 이다빈, 섭외, 행사, 에이전시, 현장 운영',
	description: '연예인 섭외와 행사 기획, 현장 운영 전문 에이전시',
	representativeName: '이다빈',
});
assert(
	'classifier marks brand + person stopwords',
	classified.brandEntities.some((n) => /made|heaven|메이드/i.test(n)) && classified.personNames.includes('이다빈'),
	classified,
);
assert(
	'classifier keeps service nouns',
	classified.categoryNouns.some((n) => /섭외|행사|에이전시|현장/.test(n)) &&
		classified.categoryNouns.every((n) => !/made|heaven|메이드|이다빈|dabin/i.test(n)),
	classified.categoryNouns,
);
assert('transliteration aliases match', isSameBrandEntity('Made in Heaven', '메이드인헤븐'));
assert('person alias matches', isSameBrandEntity('이다빈', 'Dabin Lee'));

const dental = generateQueryMatrix({
	lang: 'ko',
	brandName: '센텀스마일치과',
	ogTitle: '센텀스마일치과 | 부산 임플란트 전문',
	schemaTypes: ['Dentist'],
	primaryKeyword: '임플란트',
	location: '부산 센텀',
});
assert('dental schema noun', dental.slots.categoryNouns.includes('치과') || dental.slots.categoryNouns.includes('임플란트'), dental.slots.categoryNouns);
assert('dental level2 includes 부산 임플란트 or 부산 치과', dental.level2.some((q) => /부산/.test(q) && /임플란트|치과/.test(q)), dental.level2.slice(0, 4));
assert('dental SoV preset has category noun', queryHasCategoryNoun(dental.sovPresets[1], dental.slots.categoryNouns), dental.sovPresets);

const refined = refineCategoryNouns(
	['믿을 만한 곳', '추천', '부산', '에이전시', 'Made in Heaven', '섭외', '홈페이지'],
	{ brandName: 'Made in Heaven', location: '부산', lang: 'ko' },
);
assert('refine drops intent/brand/location/UI', refined.includes('에이전시') && refined.includes('섭외') && !refined.includes('추천') && !refined.includes('부산'), refined);

const slots = extractKeywordSlots({
	brandName: 'OO치과',
	ogTitle: 'OO치과 | 임플란트 · 치과',
	schemaTypes: ['Dentist'],
	location: '분당',
});
assert('extractor returns 3 layers', slots.brandName === 'OO치과' && slots.categoryNouns.length > 0 && slots.intentModifiers.includes('추천'));

const ion = buildTriggerQueries({
	brandName: '파티클케어',
	category: '해외 중입자 치료 상담',
	primaryKeyword: '해외 중입자 치료 상담',
	location: '',
	domain: 'particle-care.example.com',
	lang: 'ko',
	businessEntity: '해외 중입자 치료 상담',
	needSignals: ['상담'],
	title: '파티클케어 | 해외 중입자 치료 전문 상담',
});
assert('ion level1 is brand', ion.level1 === '파티클케어');
assert('ion level2/3 keep 중입자 and skip invented 야간', /중입자/.test(ion.level2 + ion.level3) && !/야간/.test(ion.level2 + ion.level3), ion);

const sovDental = buildSovQueryPresets('부산', '치과');
assert('SoV no longer hardcodes 도수치료', !sovDental.some((q) => /도수치료/.test(q)), sovDental);
assert('SoV dental chips include 치과', sovDental.every((q) => /치과/.test(q)), sovDental);

const presets = buildSovQueryPresets('안성', '도수치료', '추나치료');
assert('legacy preset1 is category 추천', presets[0] === '안성 도수치료 추천', presets);
assert('legacy preset2 is detail service', presets[1] === '안성 추나치료', presets);
assert('legacy preset3 is 잘하는곳', presets[2] === '안성 추나치료 잘하는곳', presets);

const auditStub = {
	lang: 'ko',
	siteMeta: {
		domain: 'seocho-clinic.example.com',
		brandName: '서초중입자센터',
		category: '중입자치료',
		primaryKeyword: '중입자 치료',
		industryType: 'MEDICAL',
		location: '서울 서초구',
		broadLocation: '서울',
		vertical: 'medical',
		targetUrl: 'https://seocho-clinic.example.com',
		businessEntity: '중입자 치료 상담',
		entityPhrases: ['중입자', '암치료'],
	},
	metrics: {
		jsonLdSnippets: [
			JSON.stringify({
				'@type': 'MedicalClinic',
				name: '서초중입자센터',
				hasOfferCatalog: { '@type': 'OfferCatalog', name: '중입자 치료' },
			}),
		],
	},
} as AuditReport;
const auditKeywords = collectAuditTargetKeywords(auditStub);
assert('answer-center keywords keep entity nouns', auditKeywords.includes('중입자 치료 상담') && auditKeywords.includes('중입자'), auditKeywords);
assert('answer-center drops brand/location', !auditKeywords.includes('서울 서초구') && !auditKeywords.includes('서초중입자센터'), auditKeywords);

if (failed) {
	console.error(`\n${failed} assertion(s) failed`);
	process.exit(1);
}
console.log('\nquery-matrix: all assertions passed');
