/**
 * Domain-fit audit: Pass/Warn/Fail reason labels, MedicalClinic priorities,
 * and ready-to-paste JSON-LD without {{ }} placeholders.
 * Run: npx tsx scripts/test-checklist-jsonld-domain.ts
 */
import * as cheerio from 'cheerio';
import { buildPrioritizedActions, getActionPriorityMeta } from '../lib/audit/action-priority';
import {
	isPassReasonText,
	resolveChecklistReasonText,
} from '../lib/audit/checklist-reason';
import {
	buildJsonLdFixSnippets,
	jsonLdSnippetHasPlaceholder,
} from '../lib/audit/jsonld-snippets';
import { computeSchemaCoverage, isOrganizationLikeType, parseJsonLd } from '../lib/audit/parser';
import type { AuditCheckItem, AuditReport } from '../lib/site-auditor';

let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
	if (condition) {
		console.log(`ok  ${label}`);
		return;
	}
	failed += 1;
	console.error(`FAIL ${label}${detail ? ` — ${detail}` : ''}`);
}

function check(
	id: string,
	status: AuditCheckItem['status'],
	label = id,
	why?: string,
): AuditCheckItem {
	return { id, label, status, passed: status === 'pass', weight: 5, why };
}

function clinicReport(overrides?: Partial<AuditReport>): AuditReport {
	const checklist: AuditCheckItem[] = [
		check('canonical', 'pass', 'Canonical URL', '느린 TTFB는 이탈과 Core Web Vitals 악화로 이어집니다.'),
		check('response-time', 'pass', '서버 응답 속도 (56ms < 1500ms)', '느린 TTFB는 이탈과 Core Web Vitals 악화로 이어집니다.'),
		check('page-weight', 'pass', 'HTML 문서 용량'),
		check('organization', 'fail', 'LocalBusiness / MedicalClinic'),
		check('article-fields', 'warning', 'AboutPage / MedicalWebPage'),
		check('news-article', 'pass', 'NewsArticle', 'NewsArticle은 Discover·뉴스성 AI 인용에 Article보다 유리합니다.'),
		check('website-schema', 'warning', 'WebSite / BreadcrumbList'),
		check('person-eeat', 'fail', 'Person'),
		check('faq-howto-schema', 'fail', 'FAQPage'),
		check('jsonld-present', 'fail', 'JSON-LD'),
	];
	return {
		url: 'https://anseong-sunshine.example/',
		lang: 'ko',
		fetchedAt: '2026-08-16T00:00:00.000Z',
		httpStatus: 200,
		responseTimeMs: 56,
		pageSizeBytes: 42_000,
		score: 40,
		maxScore: 122,
		status: 'FAIR',
		statusLabel: '보통',
		siteMeta: {
			domain: 'anseong-sunshine.example',
			brandName: '안성햇살의원',
			category: '스포츠재활',
			primaryKeyword: '스포츠재활',
			industryType: 'MEDICAL',
			location: '안성',
			broadLocation: '경기',
			vertical: 'medical',
			targetUrl: 'https://anseong-sunshine.example/',
			ogImage: 'https://anseong-sunshine.example/images/clinic.png',
			coreSpecialties: ['스포츠재활', '아동발달센터', '통증치료'],
		},
		metrics: {
			titleLength: 18,
			metaDescriptionLength: 90,
			h1Count: 1,
			headingSkipDetected: false,
			imagesTotal: 4,
			imagesMissingAlt: 0,
			imageAltCoveragePct: 100,
			jsonLdBlockCount: 0,
			schemaTypes: [],
			bodyTextLength: 800,
			renderBlockingScripts: 1,
			pageTitle: '안성햇살의원',
			organizationMissing: ['logo', 'url', 'sameAs'],
			personMissing: ['name'],
		},
		categories: [],
		checklist,
		findings: [],
		...overrides,
	};
}

// —— 1. Pass items must not keep leftover penalty copy ——
assert(
	'penalty why is not treated as a pass rationale',
	!isPassReasonText('느린 TTFB는 이탈과 Core Web Vitals 악화로 이어집니다.'),
);
assert(
	'pass why is recognized',
	isPassReasonText('기준치(1500ms 미만)를 안정적으로 충족하여 정상 통과되었습니다.'),
);
assert(
	'stored penalty why on a Pass item falls back',
	resolveChecklistReasonText(
		'pass',
		true,
		'느린 TTFB는 이탈과 Core Web Vitals 악화로 이어집니다.',
		'기준치를 안정적으로 충족하여 정상 통과되었습니다.',
	) === '기준치를 안정적으로 충족하여 정상 통과되었습니다.',
);
assert(
	'fail items keep the defect reason',
	resolveChecklistReasonText('fail', false, 'FAQ/HowTo는 인용 단위로 자주 채택됩니다.', '통과') ===
		'FAQ/HowTo는 인용 단위로 자주 채택됩니다.',
);

// —— 2. MedicalClinic counts as the Organization entity ——
const clinicLd = JSON.stringify({
	'@context': 'https://schema.org',
	'@type': 'MedicalClinic',
	name: '안성햇살의원',
	url: 'https://anseong-sunshine.example/',
	logo: 'https://anseong-sunshine.example/logo.png',
	sameAs: ['https://anseong-sunshine.example/'],
});
const $ = cheerio.load(`<html><head><script type="application/ld+json">${clinicLd}</script></head></html>`);
const parsed = parseJsonLd($, `<script type="application/ld+json">${clinicLd}</script>`);
assert('MedicalClinic is an organization-like type', isOrganizationLikeType('MedicalClinic'));
assert('MedicalClinic JSON-LD sets hasOrganization', parsed.hasOrganization === true, String(parsed.hasOrganization));
assert(
	'MedicalClinic coverage is not blocked by missing NewsArticle',
	computeSchemaCoverage(['MedicalClinic', 'FAQPage', 'Person']) >= 50,
	String(computeSchemaCoverage(['MedicalClinic', 'FAQPage', 'Person'])),
);

// —— 3. Priority: official 24-item pLevels (FAQ P2, entity P1, Person P3) ——
const clinicActions = buildPrioritizedActions(clinicReport().checklist ?? [], { newsVertical: false });
const byId = Object.fromEntries(clinicActions.map((row) => [row.id, row]));
assert('FAQPage is P2 on a clinic', byId['faq-howto-schema']?.priority === 'P2' && byId['faq-howto-schema']?.geoHighlight);
assert('Organization / MedicalClinic is P1', byId.organization?.priority === 'P1');
assert('Person is P3 E-E-A-T', byId['person-eeat']?.priority === 'P3');
assert('WebSite is P3 support schema', byId['website-schema']?.priority === 'P3' && !byId['website-schema']?.geoHighlight);
assert('AboutPage/Article is P2 on a clinic', byId['article-fields']?.priority === 'P2' && !byId['article-fields']?.geoHighlight);
assert('news-article does not appear as a clinic action (it passed)', !byId['news-article']);

const newsArticleMeta = getActionPriorityMeta(check('news-article', 'fail'), { newsVertical: true });
assert('NewsArticle stays P3 GEO-MUST on press sites', newsArticleMeta.priority === 'P3' && newsArticleMeta.geoHighlight);

// —— 4. JSON-LD snippets are complete MedicalClinic / Person / FAQ — no Article, no {{ }} ——
const snippets = buildJsonLdFixSnippets(clinicReport(), 'ko');
const ids = snippets.map((s) => s.id);
assert('clinic snippets include MedicalClinic entity', snippets.some((s) => s.schemaType === 'MedicalClinic'));
assert('clinic snippets include Person', ids.includes('person'));
assert('clinic snippets include FAQPage', ids.includes('faq'));
assert('clinic snippets do not force Article/NewsArticle', !ids.includes('article'));
assert(
	'no {{ }} placeholders in any snippet',
	snippets.every((s) => !jsonLdSnippetHasPlaceholder(s.code)),
	snippets.find((s) => jsonLdSnippetHasPlaceholder(s.code))?.code.slice(0, 180),
);

const entity = snippets.find((s) => s.id === 'organization');
assert('entity code uses the live clinic name', Boolean(entity && entity.code.includes('안성햇살의원')));
assert(
	'entity code maps the crawled logo URL',
	Boolean(entity && entity.code.includes('https://anseong-sunshine.example/images/clinic.png')),
);
assert('entity @type is MedicalClinic, not Organization', Boolean(entity && entity.code.includes('"@type": "MedicalClinic"')));

const person = snippets.find((s) => s.id === 'person');
assert('Person is a director/specialist profile', Boolean(person && person.code.includes('대표원장') && person.code.includes('전문의')));

const faq = snippets.find((s) => s.id === 'faq');
assert('FAQ injects 스포츠재활', Boolean(faq && faq.code.includes('스포츠재활')));
assert('FAQ injects 아동발달', Boolean(faq && faq.code.includes('아동발달')));
assert('FAQ injects 통증치료', Boolean(faq && faq.code.includes('통증치료')));
const faqQuestions = faq ? (faq.code.match(/"@type": "Question"/g) || []).length : 0;
assert('FAQ has 3–5 complete Q&As', faqQuestions >= 3 && faqQuestions <= 5, String(faqQuestions));

if (failed) {
	console.error(`\n${failed} assertion(s) failed`);
	process.exit(1);
}
console.log('\nall checklist / JSON-LD domain-fit assertions passed');
