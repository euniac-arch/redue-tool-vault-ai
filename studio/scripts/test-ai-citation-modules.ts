/**
 * AI citation modules on Execution Blueprint.
 * Run: npx tsx scripts/test-ai-citation-modules.ts
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { analyzeStrategy } from '../lib/strategy/common-engine';
import { containsVaguePronoun, estimateTokenCount } from '../lib/strategy/ai-citation';
import {
	INDUSTRY_BLUEPRINT_PROFILES,
	citationHay,
	matchBlueprintVariant,
	resolveBlueprintProfile,
} from '../lib/strategy/profiles';
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
		entities: { phrases: [], schemaTypes: ['MedicalClinic'], representativeName: '김원장' },
		localSignals: {
			location: '대구 동구',
			broadLocation: '대구',
			address: '대구광역시 동구',
			addressLocality: '동구',
			telephone: '053-000-0000',
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

function profile(specialties: string[] = ['피부과']): StrategyIndustryProfileRef {
	return {
		registryType: 'medical',
		legacyType: 'MEDICAL',
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

const base = { ctx: ctx(), profile: profile(), lang: 'ko' as const };

const scar = analyzeStrategy({ keyword: '대구 흉터 치료', ...base });
const acne = analyzeStrategy({ keyword: '대구 여드름 흉터', ...base });
const lifting = analyzeStrategy({ keyword: '대구 리프팅', ...base });
const derm = analyzeStrategy({ keyword: '대구 피부과', ...base });
const legal = analyzeStrategy({
	keyword: '대구 변호사',
	ctx: ctx({ industry: '법률', subIndustry: '법률사무소', industryType: 'LEGAL' }),
	profile: { registryType: 'legal', legacyType: 'LEGAL', label: '법률', schemaType: 'LegalService', specialties: ['법률'] },
	lang: 'ko',
});

assert('scar analysis exists', Boolean(scar?.blueprint.decisionMatrix));
assert('acne-scar topic', acne?.blueprint.decisionMatrix.topic === 'acne-scar');
assert('scar topic', scar?.blueprint.decisionMatrix.topic === 'scar');
assert('lifting topic', lifting?.blueprint.decisionMatrix.topic === 'lifting');
assert('derm hub topic', derm?.blueprint.decisionMatrix.topic === 'derm');
assert('legal topic stays non-medical', legal?.blueprint.decisionMatrix.topic === 'legal');

const scarTypes = scar?.blueprint.decisionMatrix.rows.map((row) => row.type).join(' ') || '';
assert('scar matrix has rolling/boxcar/ice-pick', /롤링|박스카|아이스픽/.test(scarTypes));
assert(
	'scar matrix names clinical devices',
	Boolean(scar && /포텐자|어븀야그|쥴|쥬베룩/.test(JSON.stringify(scar.blueprint.decisionMatrix.rows))),
);

const acneTypes = acne?.blueprint.decisionMatrix.rows.map((row) => row.type).join(' ') || '';
assert('acne matrix has three clinical types', /롤링형/.test(acneTypes) && /박스카형/.test(acneTypes) && /아이스픽형/.test(acneTypes));
assert('acne matrix has downtime column', (acne?.blueprint.decisionMatrix.columns.length ?? 0) >= 5);
assert('acne markdown is a table', Boolean(acne?.blueprint.decisionMatrix.markdown.includes('| 유형 |') && acne.blueprint.decisionMatrix.markdown.includes('| 롤링형 |')));
assert('acne html is a table', Boolean(acne?.blueprint.decisionMatrix.html.includes('<table>') && acne.blueprint.decisionMatrix.html.includes('롤링형')));

assert(
	'lifting matrix maps HIFU / RF / Juvelook',
	Boolean(lifting && /HIFU|쥬베룩|덴서티|어븀/.test(JSON.stringify(lifting.blueprint.decisionMatrix.rows))),
);
assert('lifting gain has 4.5mm', lifting?.blueprint.informationGain.items.some((item) => item.value.includes('4.5')) === true);

for (const [label, run] of [
	['scar', scar],
	['acne', acne],
	['lifting', lifting],
] as const) {
	const chunks = run?.blueprint.ragChunks || [];
	assert(`${label} has 2–3 RAG chunks`, chunks.length >= 2 && chunks.length <= 3);
	assert(
		`${label} RAG names brand + person + place + focus`,
		chunks.every((chunk) => chunk.text.includes('예제클리닉') && chunk.text.includes('김원장') && chunk.text.includes('대구')),
	);
	assert(`${label} RAG has no vague pronouns`, chunks.every((chunk) => !containsVaguePronoun(chunk.text)));
	assert(
		`${label} RAG token band 300–650`,
		chunks.every((chunk) => chunk.tokenEstimate >= 300 && chunk.tokenEstimate <= 650),
		chunks.map((chunk) => `${chunk.id}:${chunk.tokenEstimate}`).join(','),
	);
}

assert(
	'acne gain is numeric',
	acne?.blueprint.informationGain.items.some((item) => /2940/.test(item.value) && item.unit === 'nm') === true,
);
assert('acne gain has session counts', acne?.blueprint.informationGain.items.some((item) => /3/.test(item.value) && /회/.test(item.unit || '')) === true);
assert('safety heading is filter form', scar?.blueprint.safetySignals.heading === '이런 분께는 권장하지 않습니다');
assert('safety lists exclusions', (scar?.blueprint.safetySignals.notRecommended.length ?? 0) >= 3);
assert('safety has side effects and contraindications', Boolean(scar?.blueprint.safetySignals.sideEffects.length && scar.blueprint.safetySignals.contraindications.length));
assert(
	'safety disclaimer rejects rank promise',
	/검색 순위 보장도 아닙니다|not a ranking promise/i.test(scar?.blueprint.safetySignals.disclaimer || ''),
);

const llms = acne?.blueprint.llmsTxt;
assert('llms filename', llms?.filename === 'llms.txt' && llms.deployPath === '/llms.txt');
assert('llms has brand heading', Boolean(llms?.markdown.startsWith('# 예제클리닉')));
assert('llms has NAP and entity', Boolean(llms && /## NAP/.test(llms.markdown) && /## 개체/.test(llms.markdown)));
assert('llms embeds matrix markdown', Boolean(llms && llms.markdown.includes('| 롤링형 |')));
assert('llms embeds a RAG paragraph', Boolean(llms && llms.markdown.includes('포텐자')));
assert('pipeline still has 7 copy units', (acne?.blueprint.copyUnits.length ?? 0) === 7);
assert('pipeline page type unchanged for problem query', scar?.blueprint.pageStrategy.pageType === 'specialist_content');
assert('token helper matches stored estimate', estimateTokenCount(acne?.blueprint.ragChunks[0]?.text || '') === (acne?.blueprint.ragChunks[0]?.tokenEstimate ?? -1));

assert('registry exposes required keys', Boolean(INDUSTRY_BLUEPRINT_PROFILES.medical && INDUSTRY_BLUEPRINT_PROFILES.veterinary && INDUSTRY_BLUEPRINT_PROFILES.legal && INDUSTRY_BLUEPRINT_PROFILES.commerce && INDUSTRY_BLUEPRINT_PROFILES.default));
assert('medical registry type injects medical profile', resolveBlueprintProfile('medical').id === 'medical');
assert('beauty aliases to commerce profile', resolveBlueprintProfile('beauty').id === 'commerce');
assert('unknown type uses default profile', resolveBlueprintProfile('unknown-vertical').id === 'default');
assert(
	'medical profile matches acne-scar from keyword hay',
	matchBlueprintVariant(resolveBlueprintProfile('medical'), citationHay(['대구 여드름 흉터'])).id === 'acne-scar',
);
assert(
	'legal profile does not emit derm devices for a scar keyword',
	!/포텐자|어븀야그/.test(JSON.stringify(analyzeStrategy({
		keyword: '대구 흉터 치료',
		ctx: ctx({ industry: '법률', subIndustry: '법률사무소', industryType: 'LEGAL' }),
		profile: { registryType: 'legal', legacyType: 'LEGAL', label: '법률', schemaType: 'LegalService', specialties: ['법률'] },
		lang: 'ko',
	})?.blueprint.decisionMatrix.rows)),
);

const engineSource = readFileSync(resolve('lib/strategy/ai-citation.ts'), 'utf8');
assert(
	'citation engine has no industry equality branch',
	!/industry\s*===\s*['"]medical['"]/.test(engineSource) && !/registryType\s*===\s*['"]medical['"]/.test(engineSource),
);

const vet = analyzeStrategy({
	keyword: '대구 슬개골',
	ctx: ctx({ industry: '동물병원', subIndustry: '동물병원', industryType: 'GENERAL' }),
	profile: { registryType: 'veterinary', legacyType: 'GENERAL', label: '동물병원', schemaType: 'VeterinaryCare', specialties: ['동물병원'] },
	lang: 'ko',
});
assert('veterinary profile maps patella matrix', vet?.blueprint.decisionMatrix.topic === 'vet' && /슬개골/.test(JSON.stringify(vet.blueprint.decisionMatrix.rows)));

if (failed) {
	console.error(`\n${failed} assertion(s) failed`);
	process.exit(1);
}
console.log('\nai-citation module assertions passed');
