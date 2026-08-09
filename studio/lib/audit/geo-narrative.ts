/**
 * Dynamic GEO narrative report — LLM-generated or heuristic fallback.
 * Bound 1:1 to live Technical Evidence fails from the audit engine.
 */

import { extractOfficialBrandName, looksLikeKeywordBrand } from '@/lib/audit/brand-name';
import type { AuditCheckItem, AuditReport } from '@/lib/site-auditor';

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
	location?: string;
	broadLocation?: string;
	lang?: 'ko' | 'en';
}

export { extractOfficialBrandName } from '@/lib/audit/brand-name';

/** Build evidence lines that mirror the Technical Evidence / checklist UI. */
export function buildTechnicalFailsFromReport(report: AuditReport): string[] {
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

	if (m) {
		if (m.h1Count === 0) push('No <h1> tag detected');
		if (!m.metaDescriptionLength) push('Meta description missing');
		if (!m.jsonLdBlockCount) push('JSON-LD blocks = 0');
		if (!m.schemaTypes?.length) push('No Schema.org types detected');
	}

	return lines.slice(0, 16);
}

export const SYSTEM_PROMPT = `You are a top-tier GEO (Generative Engine Optimization) & Technical SEO Specialist for B2B client persuasion.
Your task is to analyze the client's actual technical fail evidence and generate a highly tailored, logical, and persuasive JSON report.

[STRICT GENERATION RULES]
1. BRAND NAME EXTRACTION: Cleanly extract the official business name from siteTitle and domain. NEVER use search keywords as the brand name. (e.g., if siteTitle is "부산 임플란트 잘하는 곳 365드림치과", brandName MUST BE "365드림치과" or "365드림치과의원"). Prefer the preComputedBrandName if provided.
2. INDUSTRY SCHEMA MATCHING:
   - Medical/Dental: MUST use ["Dentist","MedicalClinic","FAQPage"] or ["Hospital","MedicalBusiness","FAQPage"] or ["Dentist","MedicalCondition","Person"]. NEVER use "Article" or "NewsArticle" as the primary schema for hospitals/clinics.
   - E-commerce: ["Product","Offer","AggregateRating"]
   - B2B/Corporate: ["Organization","Service","FAQPage"]
3. EVIDENCE-BASED ANALYSIS: The "beforeImpact", "beforeAnswer", and each impactItems[].currentIssue MUST explicitly reference the actual technicalFails provided (e.g., mention that "H1 tag missing" or "JSON-LD blocks = 0" is the direct reason AI engines cannot index their treatments/services).
4. IMPACT ITEMS (Before–After channels) — CRITICAL:
   - Analyze crawled evidence (Meta tags, Canonical, Schema.org/JSON-LD, Open Graph, LCP/speed, robots/AI bots, E-E-A-T/Person, etc.).
   - Select ONLY channels where a real defect was found. Exclude healthy channels entirely.
   - Produce between 2 and 5 items (never fewer than 2, never more than 5).
   - Each item is a 1:1 cause→solution pair:
     * currentIssue = diagnosed technical defect + business harm (e.g. "Schema.org 미비로 AI 크롤러 거부", "OG 태그 누락으로 메신저 공유 시 브랜드 신뢰도 하락", "Canonical URL 불일치로 구글 검색색인 탈락").
     * improvedState = concrete upside AFTER schema·E-E-A-T hardening / technical SEO fix, with top-visibility signals (e.g. "MedicalBusiness/FAQ 스키마 적용으로 Perplexity 정답 카드 인용률 300% 상승", "맞춤 OG 썸네일로 카카오톡 공유 클릭률 증대").
   - channelTitle must name the affected surface (e.g. "구글 검색 / Canonical", "AI 검색 · Schema.org", "소셜/OG 공유", "페이지 속도·LCP", "E-E-A-T / Person").
5. NO DUPLICATE SENTENCES: Every section must contain distinct, unique, and professional prose. Avoid generic repetitive phrases.
6. OUTPUT: Return ONLY valid JSON. No markdown fences.`;

export function buildUserPrompt(input: GeoNarrativeRequest): string {
	const lang = input.lang === 'en' ? 'en' : 'ko';
	const technicalFails =
		(input.technicalFails?.length ? input.technicalFails : input.failItems)?.slice(0, 16) ?? [];
	const failList =
		technicalFails.length > 0
			? technicalFails.map((f, i) => `${i + 1}. ${f}`).join('\n')
			: '(none listed — still write a conservative GEO persuasion report)';

	const preBrand = extractOfficialBrandName(input.siteTitle || '', input.domain, input.brandName);

	return `Generate a customized GEO persuasion report as JSON.

Language for ALL user-facing strings: ${lang === 'en' ? 'English' : 'Korean'}.

Website context (from live crawl — treat as ground truth):
- domain: ${input.domain}
- siteTitle (raw <title>): ${input.siteTitle || '(unavailable)'}
- metaDescription (raw): ${input.metaDescription || '(unavailable)'}
- preComputedBrandName (USE THIS as brandName unless clearly wrong): ${preBrand}
- category/service hint: ${input.category || '(unknown)'}
- location hint: ${input.broadLocation || input.location || '(unknown)'}

technicalFails from the live Technical Evidence audit (MUST cite these in beforeImpact, beforeAnswer, and impactItems.currentIssue):
${failList}

Required JSON shape:
{
  "brandName": "official clinic/company name only — NOT SEO keywords",
  "industry": "auto-classified industry label",
  "recommendedSchemas": ["Type1", "Type2", "Type3"],
  "beforeImpact": "exactly 2 sentences; must name 1-2 concrete technicalFails and the business loss for this industry",
  "impactItems": [
    {
      "id": "stable-kebab-id",
      "channelTitle": "affected channel label (e.g. Google Search / Canonical)",
      "currentIssue": "diagnosed defect + business harm tied to a real technicalFail",
      "improvedState": "1:1 after-state upside after schema·E-E-A-T / technical SEO fix with a concrete top-visibility signal"
    }
  ],
  "afterBenefits": [
    { "title": "short distinct title", "body": "1-2 sentence upside tied to fixing the fails / schemas" },
    { "title": "short distinct title", "body": "1-2 sentence upside" },
    { "title": "short distinct title", "body": "1-2 sentence upside" }
  ],
  "aiSimulator": {
    "searchQuery": "realistic ChatGPT/Perplexity query a local customer would type (may include location + treatment, NOT the brand)",
    "beforeAnswer": "AI answer BEFORE GEO — must explain non-citation using specific technicalFails; do NOT present the brand as a source",
    "afterAnswer": "AI answer AFTER GEO — cite brandName (${preBrand}) as the top answer card using the recommendedSchemas"
  }
}

Hard constraints:
- brandName must equal or closely match preComputedBrandName ("${preBrand}"). Never output keyword phrases like "임플란트 잘하는 곳".
- recommendedSchemas length must be exactly 3.
- beforeImpact / beforeAnswer must quote or paraphrase at least two technicalFails when available.
- impactItems MUST contain 2–5 objects ONLY for channels with real defects in technicalFails (Meta, Canonical, Schema.org, Open Graph, LCP/speed, robots/AI bots, E-E-A-T, etc.). Skip healthy channels. Never invent defects not supported by evidence.
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

	if (has('json-ld', 'schema.org', 'organization', 'faqpage', 'article', 'website', 'newsarticle', 'person')) {
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

	if (has('ttfb', 'page weight', 'lcp', 'render-blocking', 'response time', '속도', '용량')) {
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

	if (has('h1', 'heading')) {
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

	const unique = items.filter(
		(item, idx, arr) => arr.findIndex((x) => x.id === item.id) === idx,
	);
	const sliced = unique.slice(0, 5);
	if (sliced.length >= 2) return sliced;

	const defaults = getDefaultImpactItems(lang);
	if (sliced.length === 1) return [sliced[0]!, defaults[1]!].slice(0, 2);
	return defaults;
}

export function normalizeGeoNarrative(raw: unknown, input: GeoNarrativeRequest): GeoNarrativeReport {
	const domain = input.domain || 'example.com';
	const lang = input.lang === 'en' ? 'en' : 'ko';
	const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
	const schemas = Array.isArray(obj.recommendedSchemas)
		? obj.recommendedSchemas.map((s) => String(s).trim()).filter(Boolean).slice(0, 3)
		: [];

	const safeBrand = extractOfficialBrandName(input.siteTitle || '', domain, input.brandName);
	let brandName = String(obj.brandName ?? '').trim() || safeBrand;
	if (looksLikeKeywordBrand(brandName) || brandName.length > 40) {
		brandName = safeBrand;
	}

	const industry = String(obj.industry ?? '').trim() || '일반 서비스';
	const isMedical = /의료|치과|병원|의원|클리닉|피부|성형|dental|clinic|hospital|medical/i.test(
		`${industry} ${input.category} ${input.siteTitle}`,
	);
	const isShop = /쇼핑|커머스|쇼핑몰|ecommerce|store/i.test(industry);
	const isB2b = /b2b|제조|기업|법인|software|it\//i.test(industry);

	if (schemas.length < 3) {
		const fallback = isMedical
			? /치과|dental|implant/i.test(`${industry} ${input.category} ${input.siteTitle}`)
				? ['Dentist', 'MedicalClinic', 'FAQPage']
				: ['Hospital', 'MedicalBusiness', 'FAQPage']
			: isShop
				? ['Product', 'Offer', 'AggregateRating']
				: isB2b
					? ['Organization', 'Service', 'FAQPage']
					: ['Organization', 'FAQPage', 'Person'];
		while (schemas.length < 3) schemas.push(fallback[schemas.length]!);
	}

	if (isMedical && /^(Article|NewsArticle|BlogPosting)$/i.test(schemas[0] || '')) {
		schemas[0] = /치과|dental/i.test(`${industry} ${input.siteTitle}`) ? 'Dentist' : 'Hospital';
		if (!schemas.includes('FAQPage')) schemas[2] = 'FAQPage';
	}

	const benefitsRaw = Array.isArray(obj.afterBenefits) ? obj.afterBenefits : [];
	const afterBenefits = [0, 1, 2].map((i) => asBenefit(benefitsRaw[i], i));

	const sim = (obj.aiSimulator && typeof obj.aiSimulator === 'object'
		? obj.aiSimulator
		: {}) as Record<string, unknown>;

	const fails = (input.technicalFails?.length ? input.technicalFails : input.failItems) ?? [];
	const failHint = fails.slice(0, 2).join(', ') || 'structured data gaps';

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

	return {
		brandName,
		industry,
		recommendedSchemas: schemas,
		beforeImpact:
			String(obj.beforeImpact ?? '').trim() ||
			`현재 ${domain}은(는) ${failHint} 결함으로 AI 검색엔진이 진료/서비스 정보를 구조적으로 수집하지 못합니다. 그 결과 ${brandName}이(가) ChatGPT·Perplexity 정답 카드에서 제외되고 경쟁 유입이 유실됩니다.`,
		impactItems,
		afterBenefits,
		aiSimulator: {
			searchQuery:
				String(sim.searchQuery ?? '').trim() ||
				'이 분야에서 믿을 수 있는 추천 업체/사이트 알려줘',
			beforeAnswer:
				String(sim.beforeAnswer ?? '').trim() ||
				`기술 결함(${failHint}) 때문에 공식 브랜드 출처 배지 없이 포털·디렉터리 결과만 인용됩니다. ${brandName}은(는) 등장하지 않습니다.`,
			afterAnswer:
				String(sim.afterAnswer ?? '').trim() ||
				`공식 스키마 기준 최우선 추천은 ${brandName}(${domain})입니다. ${schemas[0]}·FAQPage 신호로 상단 정답 카드에 인용됩니다.`,
		},
		technicalFails: fails,
	};
}

/** Deterministic offline fallback when no LLM API key is configured. */
export function buildHeuristicGeoNarrative(input: GeoNarrativeRequest): GeoNarrativeReport {
	const lang = input.lang === 'en' ? 'en' : 'ko';
	const domain = input.domain || 'example.com';
	const brand = extractOfficialBrandName(input.siteTitle || '', domain, input.brandName);
	const category = input.category || (lang === 'ko' ? '전문 서비스' : 'professional services');
	const loc = input.broadLocation || input.location || '';
	const locPrefix = loc ? `${loc} ` : '';
	const fails = (input.technicalFails?.length ? input.technicalFails : input.failItems) ?? [];
	const failCorpus = `${fails.join(' ')} ${category} ${input.siteTitle} ${input.metaDescription}`.toLowerCase();

	const medical = /의료|치과|피부|병원|의원|클리닉|dental|clinic|hospital|medical|임플란트/.test(failCorpus);
	const legal = /법률|변호사|법무|legal|attorney|law/.test(failCorpus);
	const shop = /쇼핑|커머스|쇼핑몰|store|shop|ecommerce|product/.test(failCorpus);
	const software = /소프트웨어|saas|it\/|플랫폼|software|platform/.test(failCorpus);
	const mfg = /제조|공장|haccp|manufactur|factory/.test(failCorpus);

	let industry = lang === 'ko' ? '전문 서비스' : 'Professional services';
	let schemas = ['Organization', 'Service', 'FAQPage'];

	if (medical) {
		const dental = /치과|dental|implant|임플란트/.test(failCorpus);
		industry = dental
			? lang === 'ko'
				? '의료/치과'
				: 'Healthcare / dental'
			: lang === 'ko'
				? '의료/클리닉'
				: 'Healthcare / clinic';
		schemas = dental
			? ['Dentist', 'MedicalClinic', 'FAQPage']
			: ['Hospital', 'MedicalBusiness', 'FAQPage'];
	} else if (legal) {
		industry = lang === 'ko' ? '법률 서비스' : 'Legal services';
		schemas = ['LegalService', 'Attorney', 'FAQPage'];
	} else if (shop) {
		industry = lang === 'ko' ? '쇼핑몰' : 'E-commerce';
		schemas = ['Product', 'Offer', 'AggregateRating'];
	} else if (software) {
		industry = lang === 'ko' ? 'IT/소프트웨어' : 'IT / software';
		schemas = ['Organization', 'SoftwareApplication', 'FAQPage'];
	} else if (mfg) {
		industry = lang === 'ko' ? '제조/B2B' : 'Manufacturing / B2B';
		schemas = ['Organization', 'Service', 'FAQPage'];
	}

	const failA = fails[0] || 'JSON-LD blocks = 0';
	const failB = fails[1] || 'FAQPage schema missing';

	const impactItems = buildImpactItemsFromFails(fails, schemas, lang);

	if (lang === 'en') {
		return normalizeGeoNarrative(
			{
				brandName: brand,
				industry,
				recommendedSchemas: schemas,
				beforeImpact: `Because the live audit found “${failA}” and “${failB}”, AI engines cannot reliably parse ${brand}'s ${industry} offerings. Competitors with complete schema keep winning the top answer card.`,
				impactItems,
				afterBenefits: [
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
					searchQuery: loc
						? `Across ${loc}, who is the most trustworthy ${category} provider with strong reviews?`
						: `Recommend a trustworthy ${category} clinic or company.`,
					beforeAnswer: `I can only surface generic directories because the site shows “${failA}” and “${failB}”. ${brand} is not cited as an official source.`,
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
			beforeImpact: `실측 진단에서 “${failA}”, “${failB}”가 확인되어 AI 검색엔진이 ${brand}의 ${industry} 정보를 구조적으로 수집·인용하지 못합니다. 이 상태에서는 ChatGPT·Perplexity 상단 정답 카드가 경쟁사·포털로 넘어가 신규 상담 유입이 유실됩니다.`,
			impactItems,
			afterBenefits: [
				{
					title: '실측 결함 해소로 인용 재개',
					body: `${failA} 문제를 바로잡으면 AI가 ${brand}의 핵심 서비스/진료 주제를 파싱할 수 있는 최소 조건이 복구됩니다.`,
				},
				{
					title: '업종 스키마 정합 매칭',
					body: `${schemas.join(' / ')} 적용 시 ${locPrefix}${category} 질의에서 ${brand}이(가) 지식 그래프 엔티티로 우선 매칭됩니다.`,
				},
				{
					title: '정답 카드 선점',
					body: `FAQPage와 공식 상호 스키마가 결합되면 ${brand}이(가) 디렉터리가 아닌 최상위 Source로 인용됩니다.`,
				},
			],
			aiSimulator: {
				searchQuery: loc
					? `${loc} 전체에서 ${category} 과잉진료 없고 후기 좋은 추천 알려줘. 믿을 만한 곳 어디야?`
					: `${category} 관련해서 가장 평가 좋은 대표 추천 알려줘.`,
				beforeAnswer: `현재 사이트에 “${failA}”, “${failB}” 결함이 있어 공식 출처 배지 없이 포털·블로그만 인용됩니다. ${brand}은(는) 정답 카드에 등장하지 않습니다.`,
				afterAnswer: `공식 스키마 기준 최우선 추천은 ${brand}(${domain})입니다. ${schemas[0]}·FAQPage 신호로 상단 정답 카드에 인용됩니다.`,
			},
		},
		input,
	);
}
