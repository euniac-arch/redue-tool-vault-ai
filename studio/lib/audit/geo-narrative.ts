/**
 * Dynamic GEO narrative report — LLM-generated or heuristic fallback.
 * Bound 1:1 to live Technical Evidence fails from the audit engine.
 */

import { extractOfficialBrandName, looksLikeKeywordBrand } from '@/lib/audit/brand-name';
import {
	buildCoreChecklistSummaryText,
	buildCoreTechnicalFailsFromReport,
} from '@/lib/audit/core-checklist';
import { buildExternalReputationFromFails, type GeoExternalReputationReport } from '@/lib/audit/geo-score';
import {
	alignRecommendedSchemas,
	buildMedicalSimulatorQuery,
	detectSchemaVertical,
	formatReportRegion,
	resolveRecommendedSchemas,
	type SchemaMappingInput,
} from '@/lib/audit/recommended-schemas';
import { EXPANDED_TRIGGER_QUERY_RULES, formatColloquialLocation } from '@/lib/geo/query-location';
import { getJosa } from '@/lib/korean-josa';
import type { AuditCheckItem, AuditReport } from '@/lib/site-auditor';

export { buildCoreTechnicalFailsFromReport };

export interface GeoNarrativeBenefit {
	title: string;
	body: string;
}

export interface GeoNarrativeImpactItem {
	id: string;
	channelTitle: string;
	currentIssue: string;
	improvedState: string;
}

export interface GeoNarrativeAiSimulator {
	searchQuery: string;
	beforeAnswer: string;
	afterAnswer: string;
}

export interface GeoNarrativeReport {
	/** Official business name — never a SEO keyword phrase. */
	brandName: string;
	industry: string;
	recommendedSchemas: [string, string, string] | string[];
	beforeImpact: string;
	/** 2–5 evidence-backed Before/After channel cards (defects only). */
	impactItems: GeoNarrativeImpactItem[];
	afterBenefits: GeoNarrativeBenefit[];
	aiSimulator: GeoNarrativeAiSimulator;
	/** Echo of evidence used (for UI/debug). */
	technicalFails?: string[];
	/** AI external-reputation & GEO score panel — always populated (LLM-enriched or heuristic fallback). */
	externalReputation?: GeoExternalReputationReport;
}

export interface GeoNarrativeRequest {
	domain: string;
	siteTitle?: string;
	metaDescription?: string;
	/** @deprecated Prefer technicalFails */
	failItems?: string[];
	/** Live Technical Evidence fail lines (1:1 with top audit). */
	technicalFails?: string[];
	brandName?: string;
	category?: string;
	/** Core procedure / clinic specialty (e.g. 정형·통증클리닉). */
	mainSpecialty?: string;
	location?: string;
	broadLocation?: string;
	industryType?: string;
	schemaTypes?: string[];
	lang?: 'ko' | 'en';
}

export { extractOfficialBrandName } from '@/lib/audit/brand-name';

/**
 * Evidence lines for GEO narrative — bound 1:1 to the live SEO/GEO 6-core checklist
 * (Canonical, Heading, Script Defer, page schema / FAQPage, Image Alt).
 * NewsArticle is only a core fail on press/media sites; clinics/businesses use AboutPage or MedicalWebPage.
 * Only 🔴 (fail/warning) items are included; never invents stale "JSON-LD blocks = 0" when badges are 🟢.
 */
export function buildTechnicalFailsFromReport(
	report: AuditReport,
	lang: 'ko' | 'en' = 'ko',
): string[] {
	return buildCoreTechnicalFailsFromReport(report, lang);
}

/** @deprecated Prefer buildTechnicalFailsFromReport — kept for broader technical evidence dumps. */
export function buildAllTechnicalFailsFromReport(report: AuditReport): string[] {
	const m = report.metrics;
	const checks: AuditCheckItem[] = report.checklist?.length
		? report.checklist
		: report.categories.flatMap((c) => c.checks);

	const lines: string[] = [];
	const seen = new Set<string>();

	function push(line: string) {
		const key = line.toLowerCase();
		if (!line || seen.has(key)) return;
		seen.add(key);
		lines.push(line);
	}

	for (const check of checks) {
		const status = check.status ?? (check.passed ? 'pass' : 'fail');
		if (status === 'pass') continue;

		switch (check.id) {
			case 'single-h1':
				if ((m?.h1Count ?? 0) === 0) push('No <h1> tag detected');
				else push(`Multiple H1 tags detected (count=${m?.h1Count ?? 'n/a'})`);
				break;
			case 'meta-description':
				if (!(m?.metaDescriptionLength && m.metaDescriptionLength > 0)) push('Meta description missing');
				else push(`Meta description length out of range (${m.metaDescriptionLength} chars)`);
				break;
			case 'title':
				if (!(m?.titleLength && m.titleLength > 0)) push('<title> missing or empty');
				else push(`<title> length out of range (${m.titleLength} chars)`);
				break;
			case 'jsonld-present':
			case 'jsonld':
				push(`JSON-LD blocks = ${m?.jsonLdBlockCount ?? 0}`);
				break;
			case 'organization':
				push(
					m?.organizationMissing?.length
						? `Organization schema missing/incomplete (missing: ${m.organizationMissing.join(', ')})`
						: 'Organization schema missing',
				);
				break;
			case 'faq-howto-schema':
				push('FAQPage schema missing');
				break;
			case 'article':
			case 'article-fields':
				push('Article/NewsArticle schema missing or incomplete');
				break;
			case 'news-article':
				push('NewsArticle schema missing');
				break;
			case 'website-schema':
				push('WebSite / BreadcrumbList schema missing');
				break;
			case 'person':
			case 'person-eeat':
				push('Person schema missing or incomplete');
				break;
			case 'eeat-author':
				push('E-E-A-T author/publisher signals incomplete');
				break;
			case 'ai-bots-allowed':
				push('AI crawlers blocked in robots.txt (GPTBot/PerplexityBot)');
				break;
			case 'canonical':
				push('Canonical URL missing or inconsistent');
				break;
			case 'og-tags':
				push('Open Graph tags incomplete');
				break;
			case 'render-blocking':
				push(
					typeof m?.renderBlockingScripts === 'number'
						? `Render-blocking scripts = ${m.renderBlockingScripts}`
						: 'Render-blocking scripts present',
				);
				break;
			case 'image-alt':
				push(
					typeof m?.imageAltCoveragePct === 'number'
						? `Image alt coverage = ${m.imageAltCoveragePct}%`
						: 'Image alt text incomplete',
				);
				break;
			case 'heading-skip':
			case 'heading-structure':
				push('Heading hierarchy gaps (H1–H4)');
				break;
			default: {
				const evidence = check.evidence?.replace(/\s+/g, ' ').trim();
				const label = check.label?.replace(/\s+/g, ' ').trim();
				if (evidence && evidence !== '—' && !evidence.startsWith('—')) {
					push(`${label}: ${evidence}`.slice(0, 160));
				} else if (label) {
					push(label.slice(0, 120));
				}
			}
		}
	}

	return lines.slice(0, 16);
}

export const SYSTEM_PROMPT = `You are a top-tier GEO (Generative Engine Optimization) & Technical SEO Specialist for B2B client persuasion.
Your task is to analyze the client's actual technical fail evidence and generate a highly tailored, logical, and persuasive JSON report.

[STRICT GENERATION RULES]
1. BRAND NAME EXTRACTION: Cleanly extract the official business name from siteTitle and domain. NEVER use search keywords as the brand name. (e.g., if siteTitle is "부산 임플란트 잘하는 곳 365드림치과", brandName MUST BE "365드림치과" or "365드림치과의원"). Prefer the preComputedBrandName if provided.
2. INDUSTRY SCHEMA MATCHING (exactly 3 types, GEO algorithm order):
   - Local clinic/의원: MUST use ["MedicalClinic","FAQPage","Person"]. NEVER use Hospital for a neighborhood clinic.
   - Dental: ["Dentist","FAQPage","Person"]
   - Tertiary hospital (종합병원 only): ["Hospital","FAQPage","Person"]
   - Legal: ["LegalService","FAQPage","Person"]
   - Local business: ["LocalBusiness","FAQPage","Organization"]
   - B2B/Corporate: ["Organization","FAQPage","Person"]
   - Press/media only: ["NewsArticle","FAQPage","Organization"]
   - NEVER use "Article" or "NewsArticle" as a recommended schema for hospitals, clinics, law firms, or ordinary businesses.
3. EVIDENCE-BASED ANALYSIS (6-CORE CHECKLIST ONLY):
   - technicalFails lists ONLY 🔴 items from the live 6-core checklist: Canonical, Heading hierarchy, Render-blocking scripts, page schema (AboutPage/MedicalWebPage — NewsArticle only for press/media), FAQPage, Image Alt.
   - "beforeImpact", "beforeAnswer", and each impactItems[].currentIssue MUST cite ONLY those listed technicalFails. NEVER invent stale fails such as "JSON-LD blocks = 0", "Meta description missing", "NewsArticle missing" on a clinic/business site, or "Open Graph incomplete" unless they appear in technicalFails.
   - If technicalFails is empty (all 6 items 🟢): beforeImpact MUST be an After-success report (confirm structured data / FAQPage / AboutPage or MedicalWebPage / SEO essentials are fully applied; brand is favorable for AI answer-card citation). beforeAnswer may briefly note the brand is already structured; do NOT invent defects.
4. IMPACT ITEMS (Before–After channels) — CRITICAL:
   - Select ONLY channels matching a real defect in technicalFails. Exclude healthy channels entirely.
   - When technicalFails is empty: return 2 maintenance/upside impactItems focused on keeping the healthy state (no fabricated current defects).
   - Otherwise produce between 2 and 5 items (never fewer than 2, never more than 5).
   - Each item is a 1:1 cause→solution pair:
     * currentIssue = diagnosed technical defect + business harm tied to a listed fail.
     * improvedState = concrete upside AFTER the fix, with top-visibility signals.
   - channelTitle must name the affected surface (e.g. "구글 검색 / Canonical", "AI 검색 · FAQPage", "온페이지 / Heading", "페이지 속도 / Defer", "이미지 / Alt").
5. NO DUPLICATE SENTENCES: Every section must contain distinct, unique, and professional prose. Avoid generic repetitive phrases.
6. OUTPUT: Return ONLY valid JSON. No markdown fences.
7. LOCATION & expanded_trigger_query LANGUAGE:
${EXPANDED_TRIGGER_QUERY_RULES}
- searchQuery must use spoken location forms only (서울, 부산, 대구 — never 서울특별시/부산광역시). Prefer “서울 서초구 암치료 클리닉” over “서초구 서울특별시 암치료 클리닉”.

[Canonical URL 정합성 평가 가이드라인]
- 수집된 Canonical URL이 마크다운 링크 형식이거나 HTML 태그 형태일 경우, 표기 형식이 아닌 실제 도메인 주소(Protocol + Host + Path + Query)만을 추출하여 평가하세요.
- 대상 페이지의 URL과 수집된 Canonical URL이 실질적으로 동일한 페이지를 가리키고 있다면(예: [https://koreaionlab.co.kr/](https://koreaionlab.co.kr/) 와 [https://koreaionlab.co.kr](https://koreaionlab.co.kr)), 단순 슬래시 / 유무나 문자열 변환 표시 형태에 상관없이 반드시 🟢 PASS (정상)로 판정하세요.
- Canonical URL이 정상 검출되었음에도 단순 표기 문제로 🔴 개선 필요 경고를 출력해서는 안 됩니다. 실질 URL이 일치하면 technicalFails의 Canonical 항목은 무시하고 healthy channel로 취급하며, impactItems에 Canonical 결함으로 넣지 마세요.`;

export function buildUserPrompt(input: GeoNarrativeRequest): string {
	const lang = input.lang === 'en' ? 'en' : 'ko';
	const technicalFails =
		(input.technicalFails?.length ? input.technicalFails : input.failItems)?.slice(0, 16) ?? [];
	const allCoreHealthy = technicalFails.length === 0;
	const failList = allCoreHealthy
		? '(none — all 6 core checklist items are 🟢 PASS. Write an After SUCCESS beforeImpact. Do NOT invent JSON-LD/Meta/OG failures.)'
		: technicalFails.map((f, i) => `${i + 1}. ${f}`).join('\n');

	const preBrand = extractOfficialBrandName(input.siteTitle || '', input.domain, input.brandName);

	return `Generate a customized GEO persuasion report as JSON.

Language for ALL user-facing strings: ${lang === 'en' ? 'English' : 'Korean'}.

Website context (from live crawl — treat as ground truth):
- domain: ${input.domain}
- siteTitle (raw <title>): ${input.siteTitle || '(unavailable)'}
- metaDescription (raw): ${input.metaDescription || '(unavailable)'}
- preComputedBrandName (USE THIS as brandName unless clearly wrong): ${preBrand}
- category/service hint: ${input.category || '(unknown)'}
- location hint: ${formatColloquialLocation(input.broadLocation || input.location || '') || '(unknown)'}

technicalFails = 🔴 items ONLY from the live 6-core checklist (Canonical / Heading / Script Defer / AboutPage·MedicalWebPage or NewsArticle-if-press / FAQPage / Image Alt).
Cite ONLY these in beforeImpact, beforeAnswer, and impactItems.currentIssue. Never invent unlisted fails (especially do not invent NewsArticle missing on a clinic or ordinary business):
${failList}

Required JSON shape:
{
  "brandName": "official clinic/company name only — NOT SEO keywords",
  "industry": "auto-classified industry label",
  "recommendedSchemas": ["Type1", "Type2", "Type3"],
  "beforeImpact": "${
		allCoreHealthy
			? 'exactly 2 sentences of After SUCCESS copy — confirm JSON-LD/FAQPage/AboutPage or MedicalWebPage/SEO essentials are fully applied; brand is favorable for AI answer-card citation. NEVER mention JSON-LD blocks = 0, NewsArticle missing, or other defects'
			: 'exactly 2 sentences; name ONLY the listed technicalFails (comma-join when multiple) and the business loss for this industry'
	}",
  "impactItems": [
    {
      "id": "stable-kebab-id",
      "channelTitle": "affected channel label (e.g. Google Search / Canonical)",
      "currentIssue": "diagnosed defect + business harm tied to a real technicalFail (or maintenance note if all healthy)",
      "improvedState": "1:1 after-state upside after schema·E-E-A-T / technical SEO fix with a concrete top-visibility signal"
    }
  ],
  "afterBenefits": [
    { "title": "short distinct title", "body": "1-2 sentence upside tied to fixing the fails / schemas" },
    { "title": "short distinct title", "body": "1-2 sentence upside" },
    { "title": "short distinct title", "body": "1-2 sentence upside" }
  ],
  "aiSimulator": {
    "searchQuery": "realistic ChatGPT/Perplexity query a local customer would type (colloquial location only — 서울/부산 not 서울특별시/부산광역시; may include location + treatment, NOT the brand)",
    "beforeAnswer": "${
			allCoreHealthy
				? 'brief note that the brand is already structured for citation — do NOT invent defects'
				: 'AI answer BEFORE GEO — must explain non-citation using specific listed technicalFails; do NOT present the brand as a source'
		}",
    "afterAnswer": "AI answer AFTER GEO — cite brandName (${preBrand}) as the top answer card using the recommendedSchemas"
  }
}

Hard constraints:
- brandName must equal or closely match preComputedBrandName ("${preBrand}"). Never output keyword phrases like "임플란트 잘하는 곳".
- recommendedSchemas length must be exactly 3.
- When technicalFails is non-empty: beforeImpact / beforeAnswer must quote or paraphrase ONLY those fails (never invent extras).
- When technicalFails is empty: beforeImpact MUST be success/After copy with zero defect language.
- impactItems MUST contain 2–5 objects ONLY for channels with real defects in technicalFails (or maintenance upsides if empty). Never invent defects not supported by evidence.
- Each impactItems entry: currentIssue = cause/harm; improvedState = matching post-fix benefit with ranking/citation signal. ids must be unique kebab-case.
- afterBenefits titles must all be different.
- Do not wrap JSON in markdown.`;
}

function asBenefit(value: unknown, index: number): GeoNarrativeBenefit {
	if (typeof value === 'string' && value.trim()) {
		return { title: `Benefit ${index + 1}`, body: value.trim() };
	}
	if (value && typeof value === 'object') {
		const obj = value as Record<string, unknown>;
		const title = String(obj.title ?? obj.name ?? `Benefit ${index + 1}`).trim();
		const body = String(obj.body ?? obj.description ?? obj.text ?? '').trim();
		if (body) return { title: title || `Benefit ${index + 1}`, body };
	}
	return {
		title: `Benefit ${index + 1}`,
		body: 'GEO optimization strengthens AI citation and search visibility for this business.',
	};
}

/** Lenient shape check for a future LLM-provided externalReputation block; falls back to heuristic when invalid. */
function asExternalReputation(value: unknown): GeoExternalReputationReport | null {
	if (!value || typeof value !== 'object') return null;
	const obj = value as Record<string, unknown>;
	const overview = obj.overview as Record<string, unknown> | undefined;
	const aiEngines = obj.aiEngines;
	const brandTrust = obj.brandTrust;
	const digitalFootprint = obj.digitalFootprint;
	const actionPlan = obj.actionPlan;
	if (
		!overview ||
		typeof overview.score !== 'number' ||
		!Array.isArray(aiEngines) ||
		aiEngines.length < 3 ||
		!brandTrust ||
		typeof brandTrust !== 'object' ||
		!digitalFootprint ||
		typeof digitalFootprint !== 'object' ||
		!Array.isArray(actionPlan) ||
		actionPlan.length === 0
	) {
		return null;
	}
	return obj as unknown as GeoExternalReputationReport;
}

function slugId(raw: string, fallback: string): string {
	const slug = raw
		.toLowerCase()
		.replace(/[^a-z0-9가-힣]+/gi, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 48);
	return slug || fallback;
}

function asImpactItem(value: unknown, index: number): GeoNarrativeImpactItem | null {
	if (!value || typeof value !== 'object') return null;
	const obj = value as Record<string, unknown>;
	const channelTitle = String(obj.channelTitle ?? obj.channel ?? obj.title ?? '').trim();
	const currentIssue = String(obj.currentIssue ?? obj.before ?? obj.issue ?? '').trim();
	const improvedState = String(obj.improvedState ?? obj.after ?? obj.improved ?? '').trim();
	if (!channelTitle || !currentIssue || !improvedState) return null;
	const id = slugId(String(obj.id ?? channelTitle), `impact-${index + 1}`);
	return { id, channelTitle, currentIssue, improvedState };
}

/** UI/API fallback when impactItems is missing or empty (loading / parse failure). */
export function getDefaultImpactItems(lang: 'ko' | 'en' = 'ko'): GeoNarrativeImpactItem[] {
	if (lang === 'en') {
		return [
			{
				id: 'google-search',
				channelTitle: 'Google Search',
				currentIssue:
					'Thin meta/title signals leave only a plain two-line snippet — weak CTR and fragile indexing.',
				improvedState:
					'After schema & E-E-A-T hardening, author/date/breadcrumb rich results lift SERP CTR and ranking stability.',
			},
			{
				id: 'ai-search',
				channelTitle: 'AI Search (Perplexity / ChatGPT)',
				currentIssue:
					'Missing Schema.org / JSON-LD blocks cause AI crawlers to skip the brand as a citation source.',
				improvedState:
					'MedicalBusiness/FAQ (or industry) schema unlocks top answer-card citations on Perplexity and ChatGPT.',
			},
			{
				id: 'social-og',
				channelTitle: 'Social / OG Share',
				currentIssue:
					'Incomplete Open Graph tags drop brand trust when shared in messengers and social feeds.',
				improvedState:
					'Custom OG thumbnails and titles raise KakaoTalk/social click-through and branded share previews.',
			},
		];
	}

	return [
		{
			id: 'google-search',
			channelTitle: '구글 검색',
			currentIssue:
				'메타·타이틀 신호 미비로 검색결과에 밋밋한 텍스트 2줄만 노출되어 CTR과 색인 안정성이 약합니다.',
			improvedState:
				'스키마·E-E-A-T 정비 후 작성자·발행일·탐색경로 리치결과가 붙어 상위권 노출 신호와 클릭률이 함께 상승합니다.',
		},
		{
			id: 'ai-search',
			channelTitle: 'AI 검색 (Perplexity / ChatGPT)',
			currentIssue:
				'Schema.org·JSON-LD 미비로 AI 크롤러가 브랜드를 정답 출처로 거부하거나 답변에서 제외합니다.',
			improvedState:
				'MedicalBusiness/FAQ(또는 업종) 스키마 적용으로 Perplexity 정답 카드 인용률이 급증하고 ChatGPT 상단 출처로 선점됩니다.',
		},
		{
			id: 'social-og',
			channelTitle: '소셜 / OG 공유',
			currentIssue:
				'Open Graph 태그 누락으로 메신저·SNS 공유 시 썸네일·브랜드 신뢰도가 하락합니다.',
			improvedState:
				'맞춤 OG 썸네일·타이틀 적용으로 카카오톡 공유 클릭률과 브랜드 프리뷰 완성도가 크게 향상됩니다.',
		},
	];
}

/** Map live technicalFails → 2–5 Before/After channels for heuristic / normalize fallback. */
export function buildImpactItemsFromFails(
	fails: string[],
	schemas: string[],
	lang: 'ko' | 'en' = 'ko',
): GeoNarrativeImpactItem[] {
	const corpus = fails.join(' | ').toLowerCase();
	const schemaHint = schemas.slice(0, 2).join('/') || 'Organization/FAQPage';
	const items: GeoNarrativeImpactItem[] = [];

	const has = (...needles: string[]) => needles.some((n) => corpus.includes(n.toLowerCase()));

	if (has('canonical')) {
		items.push(
			lang === 'en'
				? {
						id: 'canonical',
						channelTitle: 'Google Search / Canonical',
						currentIssue:
							'Canonical URL missing or inconsistent — Google may drop or duplicate-index the page.',
						improvedState:
							'A single canonical + schema lock-in restores crawl clarity and top-SERP eligibility signals.',
					}
				: {
						id: 'canonical',
						channelTitle: '구글 검색 / Canonical',
						currentIssue:
							'Canonical URL 불일치·누락으로 구글 검색색인 탈락 또는 중복 페이지 패널티 위험이 있습니다.',
						improvedState:
							'단일 Canonical 고정과 스키마 정합으로 색인이 복구되고 상위권 노출 신호가 안정화됩니다.',
					},
		);
	}

	if (
		has(
			'json-ld',
			'schema.org',
			'organization',
			'faqpage',
			'faq',
			'article',
			'website',
			'newsarticle',
			'person',
			'스키마',
		)
	) {
		items.push(
			lang === 'en'
				? {
						id: 'schema-ai',
						channelTitle: 'AI Search · Schema.org',
						currentIssue: `Structured data gaps (${fails.find((f) => /json-ld|schema|organization|faq|person|article/i.test(f)) || 'JSON-LD missing'}) cause AI crawlers to reject the brand as a citation source.`,
						improvedState: `${schemaHint} markup unlocks Perplexity/ChatGPT answer-card citations after schema·E-E-A-T hardening.`,
					}
				: {
						id: 'schema-ai',
						channelTitle: 'AI 검색 · Schema.org',
						currentIssue: `Schema.org 미비(${fails.find((f) => /json-ld|schema|organization|faq|person|article/i.test(f)) || 'JSON-LD 없음'})로 AI 크롤러가 브랜드 인용을 거부합니다.`,
						improvedState: `${schemaHint} 스키마·E-E-A-T 정비 후 Perplexity 정답 카드 인용률이 급상승하고 ChatGPT 상단 출처로 선점됩니다.`,
					},
		);
	}

	if (has('open graph', 'og ')) {
		items.push(
			lang === 'en'
				? {
						id: 'social-og',
						channelTitle: 'Social / OG Share',
						currentIssue:
							'Incomplete Open Graph tags — messenger and social shares lose brand trust and CTR.',
						improvedState:
							'Custom OG thumbnails raise KakaoTalk/social click-through and branded preview quality.',
					}
				: {
						id: 'social-og',
						channelTitle: '소셜 / OG 공유',
						currentIssue:
							'OG 태그 누락으로 메신저 공유 시 브랜드 신뢰도와 클릭 유도력이 하락합니다.',
						improvedState:
							'맞춤 OG 썸네일·타이틀로 카카오톡 공유 클릭률과 브랜드 프리뷰가 크게 개선됩니다.',
					},
		);
	}

	if (has('meta description', '<title>', 'title')) {
		items.push(
			lang === 'en'
				? {
						id: 'meta-serp',
						channelTitle: 'Google SERP / Meta',
						currentIssue:
							'Meta description or <title> defects leave a bland two-line snippet and weak CTR.',
						improvedState:
							'Optimized meta + rich-result badges turn the SERP into a high-CTR card after GEO hardening.',
					}
				: {
						id: 'meta-serp',
						channelTitle: '구글 SERP / Meta',
						currentIssue:
							'메타 설명·<title> 결함으로 검색결과에 밋밋한 텍스트만 노출되어 CTR이 낮습니다.',
						improvedState:
							'메타 최적화와 리치결과 배지로 SERP가 카드형 상위권 신호로 전환되어 클릭률이 상승합니다.',
					},
		);
	}

	if (has('e-e-a-t', 'person', 'author', 'publisher')) {
		items.push(
			lang === 'en'
				? {
						id: 'eeat-person',
						channelTitle: 'E-E-A-T / Person',
						currentIssue:
							'Incomplete Person/author signals — algorithms discount expertise and trust.',
						improvedState:
							'Verified Person + publisher graph strengthens E-E-A-T and resists ranking drops.',
					}
				: {
						id: 'eeat-person',
						channelTitle: 'E-E-A-T / Person',
						currentIssue:
							'Person·저자 신호 미비로 E-E-A-T 전문성이 증명되지 않아 순위 감점 위험이 큽니다.',
						improvedState:
							'Person·발행자 지식그래프 정비 후 E-E-A-T 방어력과 AI 신뢰 인용이 동시에 강화됩니다.',
					},
		);
	}

	if (has('gptbot', 'perplexity', 'robots', 'ai crawler', 'ai bots')) {
		items.push(
			lang === 'en'
				? {
						id: 'ai-bots',
						channelTitle: 'AI Crawlers / robots.txt',
						currentIssue:
							'AI crawlers blocked in robots.txt — ChatGPT/Perplexity cannot ingest the site.',
						improvedState:
							'Allowing GPTBot/PerplexityBot restores crawl access and citation eligibility.',
					}
				: {
						id: 'ai-bots',
						channelTitle: 'AI 크롤러 / robots.txt',
						currentIssue:
							'robots.txt에서 AI 크롤러가 차단되어 ChatGPT·Perplexity가 사이트를 수집하지 못합니다.',
						improvedState:
							'GPTBot/PerplexityBot 허용 후 AI 수집·정답 카드 인용 자격이 즉시 복구됩니다.',
					},
		);
	}

	if (
		has(
			'ttfb',
			'page weight',
			'lcp',
			'render-blocking',
			'render blocking',
			'response time',
			'속도',
			'용량',
			'렌더링 차단',
			'렌더 차단',
		)
	) {
		items.push(
			lang === 'en'
				? {
						id: 'speed-lcp',
						channelTitle: 'Page Speed / LCP',
						currentIssue:
							'Slow TTFB/LCP or heavy assets raise bounce risk and suppress ranking signals.',
						improvedState:
							'Speed and render-path fixes stabilize Core Web Vitals and unlock stronger top-rank signals.',
					}
				: {
						id: 'speed-lcp',
						channelTitle: '페이지 속도 / LCP',
						currentIssue:
							'TTFB·LCP·용량 결함으로 이탈이 늘고 상위권 순위 신호가 억제됩니다.',
						improvedState:
							'속도·렌더 경로 개선 후 Core Web Vitals가 안정화되어 상위권 노출 신호가 강화됩니다.',
					},
		);
	}

	if (has('h1', 'heading', '헤딩')) {
		items.push(
			lang === 'en'
				? {
						id: 'heading-structure',
						channelTitle: 'On-page / H1',
						currentIssue:
							'H1/heading defects blur topical focus — crawlers struggle to rank the primary intent.',
						improvedState:
							'A single clear H1 + hierarchy aligns topical intent with schema for stronger ranking.',
					}
				: {
						id: 'heading-structure',
						channelTitle: '온페이지 / H1',
						currentIssue:
							'H1·헤딩 구조 결함으로 주제 초점이 흐려져 검색·AI가 핵심 의도를 파싱하지 못합니다.',
						improvedState:
							'단일 H1·계층 정비 후 스키마와 주제가 정렬되어 상위권·인용 신호가 명확해집니다.',
					},
		);
	}

	if (has('image alt', 'alt text', 'alt 텍스트', '이미지 alt')) {
		items.push(
			lang === 'en'
				? {
						id: 'image-alt',
						channelTitle: 'Images / Alt',
						currentIssue:
							'Incomplete image alt text — AI and search miss visual context for citation.',
						improvedState:
							'Full alt coverage lets multimodal and search results surface branded imagery with the answer.',
					}
				: {
						id: 'image-alt',
						channelTitle: '이미지 / Alt',
						currentIssue:
							'이미지 alt 텍스트 미흡으로 AI·검색이 시각 콘텐츠 맥락을 수집하지 못합니다.',
						improvedState:
							'alt 커버리지 확보 후 멀티모달·검색 결과가 브랜드 이미지를 함께 노출합니다.',
					},
		);
	}

	const unique = items.filter(
		(item, idx, arr) => arr.findIndex((x) => x.id === item.id) === idx,
	);
	const sliced = unique.slice(0, 5);
	if (sliced.length >= 2) return sliced;

	/** All 6-core healthy — maintenance upsides only (never invent JSON-LD/Meta defects). */
	if (fails.length === 0) {
		return lang === 'en'
			? [
					{
						id: 'maintain-schema',
						channelTitle: 'AI Search · Schema readiness',
						currentIssue:
							'Core schema and SEO essentials already pass — the risk is drift if markup is removed or diluted.',
						improvedState: `${schemaHint} maintenance keeps Perplexity/ChatGPT answer-card citations stable.`,
					},
					{
						id: 'maintain-canonical',
						channelTitle: 'Google Search / Canonical',
						currentIssue:
							'Canonical and crawl signals are healthy — keep a single authoritative URL as content expands.',
						improvedState:
							'Stable canonical + schema lock-in preserves top-SERP eligibility and rich-result eligibility.',
					},
				]
			: [
					{
						id: 'maintain-schema',
						channelTitle: 'AI 검색 · 스키마 유지',
						currentIssue:
							'필수 스키마·SEO 항목이 이미 통과한 상태입니다. 마크업이 제거·희석되면 인용 신호가 약해질 수 있습니다.',
						improvedState: `${schemaHint} 유지 시 Perplexity/ChatGPT 정답 카드 인용이 안정적으로 지속됩니다.`,
					},
					{
						id: 'maintain-canonical',
						channelTitle: '구글 검색 / Canonical',
						currentIssue:
							'Canonical·크롤 신호가 정상입니다. 콘텐츠 확장 시에도 단일 정규 URL을 유지해야 합니다.',
						improvedState:
							'안정적 Canonical과 스키마 정합으로 상위권·리치결과 자격이 유지됩니다.',
					},
				];
	}

	const defaults = getDefaultImpactItems(lang);
	if (sliced.length === 1) return [sliced[0]!, defaults[1]!].slice(0, 2);
	return defaults;
}

export function normalizeGeoNarrative(raw: unknown, input: GeoNarrativeRequest): GeoNarrativeReport {
	const domain = input.domain || 'example.com';
	const lang = input.lang === 'en' ? 'en' : 'ko';
	const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
	const mapping: SchemaMappingInput = {
		industry: String(obj.industry ?? '').trim() || input.category,
		category: input.category,
		siteTitle: input.siteTitle,
		brandName: input.brandName,
		domain,
		primaryKeyword: input.mainSpecialty || input.category,
		industryType: input.industryType,
		schemaTypes: input.schemaTypes,
	};
	const incomingSchemas = Array.isArray(obj.recommendedSchemas)
		? obj.recommendedSchemas.map((s) => String(s).trim()).filter(Boolean)
		: [];
	const schemas = alignRecommendedSchemas(incomingSchemas, mapping);

	const safeBrand = extractOfficialBrandName(input.siteTitle || '', domain, input.brandName);
	let brandName = String(obj.brandName ?? '').trim() || safeBrand;
	if (looksLikeKeywordBrand(brandName) || brandName.length > 40) {
		brandName = safeBrand;
	}

	const industry = String(obj.industry ?? '').trim() || '일반 서비스';

	const benefitsRaw = Array.isArray(obj.afterBenefits) ? obj.afterBenefits : [];
	const afterBenefits = [0, 1, 2].map((i) => asBenefit(benefitsRaw[i], i));

	const sim = (obj.aiSimulator && typeof obj.aiSimulator === 'object'
		? obj.aiSimulator
		: {}) as Record<string, unknown>;

	const fails = (input.technicalFails?.length ? input.technicalFails : input.failItems) ?? [];
	const allCoreHealthy = fails.length === 0;
	const failHint = fails.slice(0, 2).join(', ');
	const successBeforeImpact = buildCoreChecklistSummaryText({
		items: [],
		brandName,
		industry,
		lang,
		vertical: detectSchemaVertical(mapping),
	});

	const parsedImpact = Array.isArray(obj.impactItems)
		? obj.impactItems
				.map((item, i) => asImpactItem(item, i))
				.filter((item): item is GeoNarrativeImpactItem => Boolean(item))
		: [];
	const seenIds = new Set<string>();
	const dedupedImpact = parsedImpact.filter((item) => {
		if (seenIds.has(item.id)) return false;
		seenIds.add(item.id);
		return true;
	});
	const impactItems =
		dedupedImpact.length >= 2
			? dedupedImpact.slice(0, 5)
			: buildImpactItemsFromFails(fails, schemas, lang);

	const externalReputation =
		asExternalReputation(obj.externalReputation) ??
		buildExternalReputationFromFails(
			{
				domain,
				technicalFails: fails,
				brandName,
				category: input.category,
				broadLocation: input.broadLocation || input.location,
			},
			lang,
		);

	const llmBefore = String(obj.beforeImpact ?? '').trim();
	const beforeImpact = allCoreHealthy
		? llmBefore && !/json-ld blocks\s*=\s*0|미검출|missing|누락|결함|fail/i.test(llmBefore)
			? llmBefore
			: successBeforeImpact
		: llmBefore ||
			(lang === 'en'
				? `Live audit found ${failHint}, so AI engines cannot fully collect and cite ${brandName}'s ${industry}. Fixing the weak items strengthens top answer-card exposure and inquiry inflow.`
				: `실측 진단에서 ${failHint} 항목이 확인되어 AI 검색엔진이 ${brandName}의 ${industry}${getJosa(industry, '을/를')} 완벽히 수집·인용하는 데 제약이 있습니다. 미흡한 항목을 보완하여 AI 상단 정답 카드 노출 및 상담 유입을 강화할 필요가 있습니다.`);

	return {
		brandName,
		industry,
		recommendedSchemas: schemas,
		beforeImpact,
		impactItems,
		afterBenefits,
		aiSimulator: {
			searchQuery:
				String(sim.searchQuery ?? '').trim() ||
				'이 분야에서 믿을 수 있는 추천 업체/사이트 알려줘',
			beforeAnswer: allCoreHealthy
				? String(sim.beforeAnswer ?? '').trim() ||
					(lang === 'en'
						? `${brandName} already shows strong structured signals and can appear as a citable source in AI answers.`
						: `${brandName}${getJosa(brandName, '은/는')} 구조화 신호가 확보되어 AI 답변에서 인용 가능한 출처로 인식될 수 있는 상태입니다.`)
				: String(sim.beforeAnswer ?? '').trim() ||
					(lang === 'en'
						? `Technical gaps (${failHint}) leave only directories/directory citations without an official brand source badge. ${brandName} does not appear.`
						: `기술 결함(${failHint}) 때문에 공식 브랜드 출처 배지 없이 포털·디렉터리 결과만 인용됩니다. ${brandName}${getJosa(brandName, '은/는')} 등장하지 않습니다.`),
			afterAnswer:
				String(sim.afterAnswer ?? '').trim() ||
				`공식 스키마 기준 최우선 추천은 ${brandName}(${domain})입니다. ${schemas[0]}·FAQPage 신호로 상단 정답 카드에 인용됩니다.`,
		},
		technicalFails: fails,
		externalReputation,
	};
}

/** Deterministic offline fallback when no LLM API key is configured. */
export function buildHeuristicGeoNarrative(input: GeoNarrativeRequest): GeoNarrativeReport {
	const lang = input.lang === 'en' ? 'en' : 'ko';
	const domain = input.domain || 'example.com';
	const brand = extractOfficialBrandName(input.siteTitle || '', domain, input.brandName);
	const category = input.category || (lang === 'ko' ? '전문 서비스' : 'professional services');
	const loc = formatReportRegion(input.location || input.broadLocation || '');
	const locPrefix = loc ? `${loc} ` : '';
	const fails = (input.technicalFails?.length ? input.technicalFails : input.failItems) ?? [];
	const failCorpus = `${fails.join(' ')} ${category} ${input.siteTitle} ${input.metaDescription}`.toLowerCase();

	const mapping: SchemaMappingInput = {
		industry: input.category,
		category: input.category,
		siteTitle: input.siteTitle,
		brandName: brand,
		domain,
		primaryKeyword: input.mainSpecialty || input.category,
		industryType: input.industryType,
		schemaTypes: input.schemaTypes,
	};
	const vertical = detectSchemaVertical({ ...mapping, industry: failCorpus });
	const schemas = resolveRecommendedSchemas({ ...mapping, industry: failCorpus });

	let industry = lang === 'ko' ? '전문 서비스' : 'Professional services';
	if (vertical === 'dental') industry = lang === 'ko' ? '의료/치과' : 'Healthcare / dental';
	else if (vertical === 'medical-clinic' || vertical === 'medical-hospital') {
		industry = lang === 'ko' ? '의료/클리닉' : 'Healthcare / clinic';
	} else if (vertical === 'legal') industry = lang === 'ko' ? '법률 서비스' : 'Legal services';
	else if (vertical === 'local') industry = lang === 'ko' ? '쇼핑몰' : 'E-commerce';
	else if (vertical === 'b2b') industry = lang === 'ko' ? '제조/B2B' : 'Manufacturing / B2B';
	else if (vertical === 'news') industry = lang === 'ko' ? '언론/미디어' : 'Press / media';

	const allCoreHealthy = fails.length === 0;
	const failA = fails[0];
	const failB = fails[1];
	const issueList = fails.join(', ');

	const beforeImpact = allCoreHealthy
		? buildCoreChecklistSummaryText({
				items: [],
				brandName: brand,
				industry,
				lang,
				vertical,
			})
		: lang === 'en'
			? `Live audit found ${issueList}, which constrains AI search engines from fully collecting and citing ${brand}'s ${industry}. Strengthening the weak items is needed to improve top answer-card exposure and inquiry inflow.`
			: `실측 진단에서 ${issueList} 항목이 확인되어 AI 검색엔진이 ${brand}의 ${industry}${getJosa(industry, '을/를')} 완벽히 수집·인용하는 데 제약이 있습니다. 미흡한 항목을 보완하여 AI 상단 정답 카드 노출 및 상담 유입을 강화할 필요가 있습니다.`;

	const impactItems = buildImpactItemsFromFails(fails, schemas, lang);

	if (lang === 'en') {
		return normalizeGeoNarrative(
			{
				brandName: brand,
				industry,
				recommendedSchemas: schemas,
				beforeImpact,
				impactItems,
				afterBenefits: allCoreHealthy
					? [
							{
								title: 'Maintain citation readiness',
								body: `${brand} already clears the six essentials — keep schema and crawl signals fresh so ChatGPT/Perplexity keep citing it.`,
							},
							{
								title: 'Industry schema lock-in',
								body: `Deploying ${schemas.join(' / ')} maps ${brand} as the canonical ${category} entity for ${locPrefix}queries.`,
							},
							{
								title: 'Own the answer card',
								body: `With FAQPage + entity markup, ${brand} remains the cited source instead of directories.`,
							},
						]
					: [
							{
								title: 'Repair citation blockers',
								body: `Fixing ${failA} restores a crawlable topical signal so ChatGPT/Perplexity can understand ${brand}.`,
							},
							{
								title: 'Industry schema lock-in',
								body: `Deploying ${schemas.join(' / ')} maps ${brand} as the canonical ${category} entity for ${locPrefix}queries.`,
							},
							{
								title: 'Own the answer card',
								body: `With FAQPage + entity markup, ${brand} becomes the cited source instead of directories.`,
							},
						],
				aiSimulator: {
					searchQuery:
						vertical === 'medical-clinic' || vertical === 'medical-hospital' || vertical === 'dental'
							? buildMedicalSimulatorQuery(loc, input.mainSpecialty || category, 'en')
							: loc
								? `Across ${loc}, who is the most trustworthy ${category} provider with strong reviews?`
								: `Recommend a trustworthy ${category} clinic or company.`,
					beforeAnswer: allCoreHealthy
						? `${brand} already shows strong structured signals and can appear as a citable source in AI answers.`
						: `I can only surface generic directories because the site shows “${failA}”${failB ? ` and “${failB}”` : ''}. ${brand} is not cited as an official source.`,
					afterAnswer: `The top verified recommendation is ${brand} (${domain}). ${schemas[0]} + FAQPage signals place it in the primary answer card.`,
				},
			},
			input,
		);
	}

	return normalizeGeoNarrative(
		{
			brandName: brand,
			industry,
			recommendedSchemas: schemas,
			beforeImpact,
			impactItems,
			afterBenefits: allCoreHealthy
				? [
						{
							title: '인용 준비 상태 유지',
							body: `${brand}${getJosa(brand, '은/는')} 필수 6대 항목을 통과한 상태입니다. 스키마·크롤 신호를 유지하면 ChatGPT·Perplexity 인용이 지속됩니다.`,
						},
						{
							title: '업종 스키마 정합 매칭',
							body: `${schemas.join(' / ')} 적용 시 ${locPrefix}${category} 질의에서 ${brand}${getJosa(brand, '이/가')} 지식 그래프 엔티티로 우선 매칭됩니다.`,
						},
						{
							title: '정답 카드 선점',
							body: `FAQPage와 공식 상호 스키마가 결합되면 ${brand}${getJosa(brand, '이/가')} 디렉터리가 아닌 최상위 Source로 인용됩니다.`,
						},
					]
				: [
						{
							title: '실측 결함 해소로 인용 재개',
							body: `${failA} 문제를 바로잡으면 AI가 ${brand}의 핵심 서비스/진료 주제를 파싱할 수 있는 최소 조건이 복구됩니다.`,
						},
						{
							title: '업종 스키마 정합 매칭',
							body: `${schemas.join(' / ')} 적용 시 ${locPrefix}${category} 질의에서 ${brand}${getJosa(brand, '이/가')} 지식 그래프 엔티티로 우선 매칭됩니다.`,
						},
						{
							title: '정답 카드 선점',
							body: `FAQPage와 공식 상호 스키마가 결합되면 ${brand}${getJosa(brand, '이/가')} 디렉터리가 아닌 최상위 Source로 인용됩니다.`,
						},
					],
			aiSimulator: {
				searchQuery:
					vertical === 'medical-clinic' || vertical === 'medical-hospital' || vertical === 'dental'
						? buildMedicalSimulatorQuery(loc, input.mainSpecialty || category, 'ko')
						: loc
							? `${loc} ${category} 도입 의료기관 및 진료시간 안내`
							: `${category} 관련해서 가장 평가 좋은 대표 추천 알려줘.`,
				beforeAnswer: allCoreHealthy
					? `${brand}${getJosa(brand, '은/는')} 구조화 신호가 확보되어 AI 답변에서 인용 가능한 출처로 인식될 수 있는 상태입니다.`
					: `현재 사이트에 “${failA}”${failB ? `, “${failB}”` : ''} 결함이 있어 공식 출처 배지 없이 포털·블로그만 인용됩니다. ${brand}${getJosa(brand, '은/는')} 정답 카드에 등장하지 않습니다.`,
				afterAnswer: `공식 스키마 기준 최우선 추천은 ${brand}(${domain})입니다. ${schemas[0]}·FAQPage 신호로 상단 정답 카드에 인용됩니다.`,
			},
		},
		input,
	);
}
