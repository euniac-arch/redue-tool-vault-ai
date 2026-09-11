/**
 * `getAiFixGuide` expands each AI-engine cause badge (Structured Data 부족,
 * On-page 개선, Citation Signal 부족, Business Profile Signal 미연동…) into
 * a concrete action guide bound to the *currently diagnosed* site — never a
 * hardcoded business name. Run: npx tsx scripts/test-ai-fix-guide.ts
 */
import { getAiFixGuide } from '../lib/audit/ai-fix-guide';
import type { EngineCauseCategory, EngineCauseFactor } from '../lib/audit/engine-readiness';
import { resolveGeoWorkGuideModel } from '../lib/audit/geo-work-guide';
import type { AuditCheckItem, AuditReport } from '../lib/site-auditor';

let failed = 0;

function assert(label: string, condition: boolean, detail?: unknown) {
	if (condition) {
		console.log(`ok  ${label}`);
		return;
	}
	failed += 1;
	console.error(`fail ${label}${detail != null ? ` — ${String(detail)}` : ''}`);
}

function check(id: string, status: AuditCheckItem['status'], weight: number): AuditCheckItem {
	return { id, label: id, status, passed: status === 'pass', weight };
}

function baseReport(partial?: Partial<AuditReport>): AuditReport {
	return {
		url: 'https://example.com',
		lang: 'ko',
		fetchedAt: '2026-09-01T00:00:00.000Z',
		httpStatus: 200,
		responseTimeMs: 180,
		pageSizeBytes: 90_000,
		score: 49,
		maxScore: 122,
		status: 'POOR',
		statusLabel: '취약',
		categories: [],
		findings: [],
		checklist: [check('https', 'fail', 10)],
		...partial,
	};
}

function factorOf(id: string, category: EngineCauseCategory): Pick<EngineCauseFactor, 'id' | 'category'> {
	return { id, category };
}

// Every cause id emitted by the 4 live-grounding engine analyzers
// (Gemini / ChatGPT / Perplexity / Claude), plus the shared HTTPS-critical
// path and the Copilot/Clova-only ids kept for forward compatibility.
const ALL_CAUSE_FACTORS: Pick<EngineCauseFactor, 'id' | 'category'>[] = [
	factorOf('structured-data', 'structuredData'),
	factorOf('onpage', 'onpage'),
	factorOf('organization-entity', 'entity'),
	factorOf('local-geographic', 'localGeographic'),
	factorOf('nap-entity', 'entity'),
	factorOf('external-entity', 'externalSignal'),
	factorOf('bing-places-profile', 'businessProfile'),
	factorOf('gptbot', 'technical'),
	factorOf('citation-docs', 'citation'),
	factorOf('content-search-intent', 'searchIntent'),
	factorOf('geo-citation', 'citation'),
	factorOf('expert-content', 'content'),
	factorOf('eeat', 'eeat'),
	factorOf('technical-readiness', 'technical'),
	factorOf('claudebot', 'technical'),
	factorOf('https', 'technical'),
	factorOf('bing-entity', 'entity'),
	factorOf('naver-entity', 'entity'),
	factorOf('naver-place-profile', 'businessProfile'),
	factorOf('external-content', 'externalSignal'),
];

const clinicReport = baseReport({
	url: 'https://gana-derma.example.com',
	siteMeta: {
		domain: 'gana-derma.example.com',
		brandName: '가나다의원',
		category: '피부과',
		primaryKeyword: '흉터 치료',
		industryType: 'MEDICAL',
		location: '서울 강남구',
		broadLocation: '서울',
		targetUrl: 'https://gana-derma.example.com',
		vertical: 'medical',
	} as AuditReport['siteMeta'],
	napMatrix: {
		canonical: { name: '가나다의원', address: '서울 강남구 테헤란로 1', phone: '02-1234-5678' },
		rows: [],
		recommendations: [],
	},
});

const restaurantReport = baseReport({
	url: 'https://omakase-hana.example.com',
	metrics: {
		pageTitle: '스시하나 | 강남 오마카세 레스토랑',
		metaDescription: '스시하나는 강남 오마카세 전문 레스토랑입니다.',
	} as AuditReport['metrics'],
	siteMeta: {
		domain: 'omakase-hana.example.com',
		brandName: '스시하나',
		category: '오마카세 레스토랑',
		primaryKeyword: '오마카세',
		industryType: 'GENERAL',
		location: '서울 강남구',
		broadLocation: '서울',
		targetUrl: 'https://omakase-hana.example.com',
		vertical: 'local',
	} as AuditReport['siteMeta'],
});

const emptyReport = baseReport({ url: '' });

const clinicModel = resolveGeoWorkGuideModel(clinicReport, 'ko');
const restaurantModel = resolveGeoWorkGuideModel(restaurantReport, 'ko');
const emptyModel = resolveGeoWorkGuideModel(emptyReport, 'ko');

// 1) Every cause id known to the 4 live-grounding engines must resolve to a
//    non-empty, guide (never silently falling through to "").
for (const factor of ALL_CAUSE_FACTORS) {
	const guide = getAiFixGuide(factor, clinicModel, 'ko');
	assert(`[${factor.id}] ko guide has a non-empty actionSummary`, guide.actionSummary.trim().length > 10, guide.actionSummary);
	const guideEn = getAiFixGuide(factor, clinicModel, 'en');
	assert(`[${factor.id}] en guide has a non-empty actionSummary`, guideEn.actionSummary.trim().length > 10, guideEn.actionSummary);
}

// 2) Dynamic binding — the same cause id must surface the *live* brand name,
//    never a hardcoded reference business (e.g. 나인원의원), and must not
//    leak another diagnosed site's brand into this one's guide.
const clinicStructured = getAiFixGuide(factorOf('structured-data', 'structuredData'), clinicModel, 'ko');
assert(
	'clinic structured-data guide mentions the live clinic brand',
	clinicStructured.actionSummary.includes('가나다의원'),
	clinicStructured.actionSummary,
);
assert(
	'clinic structured-data guide never hardcodes 나인원의원',
	!clinicStructured.actionSummary.includes('나인원의원') && !(clinicStructured.codeSnippet || '').includes('나인원의원'),
);
assert(
	'clinic structured-data guide recommends the MedicalClinic schema type',
	clinicStructured.actionSummary.includes('MedicalClinic'),
	clinicStructured.actionSummary,
);

const restaurantStructured = getAiFixGuide(factorOf('structured-data', 'structuredData'), restaurantModel, 'ko');
assert(
	'restaurant structured-data guide mentions its own brand, not the clinic',
	restaurantStructured.actionSummary.includes('스시하나') && !restaurantStructured.actionSummary.includes('가나다의원'),
	restaurantStructured.actionSummary,
);
assert(
	'restaurant structured-data guide recommends the Restaurant schema type',
	restaurantStructured.actionSummary.includes('Restaurant'),
	restaurantStructured.actionSummary,
);

// 3) Business Profile Signal guide — NAP + sameAs mapping, bound to the live site.
const bizProfile = getAiFixGuide(factorOf('bing-places-profile', 'businessProfile'), clinicModel, 'ko');
assert('business-profile guide mentions the live brand', bizProfile.actionSummary.includes('가나다의원'));
assert('business-profile guide has a sameAs code snippet', Boolean(bizProfile.codeSnippet?.includes('sameAs')));
assert('business-profile guide detail carries the NAP address', Boolean(bizProfile.detail?.includes('테헤란로')));

// 4) Content / FAQ guide — question templates bound to brand + service.
const faqGuide = getAiFixGuide(factorOf('content-search-intent', 'searchIntent'), clinicModel, 'ko');
assert('faq guide has 3 question-template checklist items', (faqGuide.checklist ?? []).length === 3, faqGuide.checklist);
assert(
	'faq guide code snippet is valid FAQPage JSON-LD',
	(() => {
		try {
			const parsed = JSON.parse(faqGuide.codeSnippet ?? '') as Record<string, unknown>;
			return parsed['@type'] === 'FAQPage';
		} catch {
			return false;
		}
	})(),
	faqGuide.codeSnippet,
);

// 5) Citation Signal guide — 3rd-party distribution, references the live domain URL.
const citationGuide = getAiFixGuide(factorOf('citation-docs', 'citation'), clinicModel, 'ko');
assert(
	'citation guide references the live domain, not a hardcoded one',
	citationGuide.actionSummary.includes('gana-derma.example.com'),
	citationGuide.actionSummary,
);

// 6) On-page guide — Title/Meta/H1 rewrite examples come straight from the model.
const onpageGuide = getAiFixGuide(factorOf('onpage', 'onpage'), clinicModel, 'ko');
assert(
	'onpage guide code snippet carries the live Title/Meta/H1 examples',
	Boolean(onpageGuide.codeSnippet?.includes(clinicModel.titleExample)),
	onpageGuide.codeSnippet,
);

// 7) robots.txt guides name the correct crawler + alias.
const gptbotGuide = getAiFixGuide(factorOf('gptbot', 'technical'), clinicModel, 'ko');
assert('gptbot guide snippet allows GPTBot', Boolean(gptbotGuide.codeSnippet?.includes('User-agent: GPTBot')));
const claudebotGuide = getAiFixGuide(factorOf('claudebot', 'technical'), clinicModel, 'ko');
assert('claudebot guide snippet allows ClaudeBot', Boolean(claudebotGuide.codeSnippet?.includes('User-agent: ClaudeBot')));

// 8) Generic domain fallback — a crawl-blocked / metadata-less report must
//    never throw and must fall back to a safe generic label, not an empty
//    string or a foreign hardcoded brand.
for (const factor of ALL_CAUSE_FACTORS) {
	const guide = getAiFixGuide(factor, emptyModel, 'ko');
	assert(
		`[${factor.id}] empty-report guide falls back safely (no hardcoded brand, non-empty)`,
		guide.actionSummary.trim().length > 0 && !guide.actionSummary.includes('나인원의원'),
		guide.actionSummary,
	);
}

// 9) Unknown / future cause ids must still resolve via the category fallback
//    instead of throwing or returning an empty guide.
const unknownFactor = getAiFixGuide(factorOf('some-future-cause-id', 'brandAuthority'), clinicModel, 'ko');
assert('unknown cause id falls back to its category guide', unknownFactor.actionSummary.trim().length > 0);

if (failed > 0) {
	console.error(`\n${failed} ai-fix-guide assertion(s) failed`);
	process.exit(1);
}
console.log('\nai-fix-guide assertions passed');
