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
3. EVIDENCE-BASED ANALYSIS: The "beforeImpact" and "beforeAnswer" sections MUST explicitly reference the actual technicalFails provided (e.g., mention that "H1 tag missing" or "JSON-LD blocks = 0" is the direct reason AI engines cannot index their treatments/services).
4. NO DUPLICATE SENTENCES: Every section must contain distinct, unique, and professional prose. Avoid generic repetitive phrases.
5. OUTPUT: Return ONLY valid JSON. No markdown fences.`;

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

technicalFails from the live Technical Evidence audit (MUST cite these in beforeImpact & beforeAnswer):
${failList}

Required JSON shape:
{
  "brandName": "official clinic/company name only — NOT SEO keywords",
  "industry": "auto-classified industry label",
  "recommendedSchemas": ["Type1", "Type2", "Type3"],
  "beforeImpact": "exactly 2 sentences; must name 1-2 concrete technicalFails and the business loss for this industry",
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

export function normalizeGeoNarrative(raw: unknown, input: GeoNarrativeRequest): GeoNarrativeReport {
	const domain = input.domain || 'example.com';
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

	return {
		brandName,
		industry,
		recommendedSchemas: schemas,
		beforeImpact:
			String(obj.beforeImpact ?? '').trim() ||
			`현재 ${domain}은(는) ${failHint} 결함으로 AI 검색엔진이 진료/서비스 정보를 구조적으로 수집하지 못합니다. 그 결과 ${brandName}이(가) ChatGPT·Perplexity 정답 카드에서 제외되고 경쟁 유입이 유실됩니다.`,
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

	if (lang === 'en') {
		return normalizeGeoNarrative(
			{
				brandName: brand,
				industry,
				recommendedSchemas: schemas,
				beforeImpact: `Because the live audit found “${failA}” and “${failB}”, AI engines cannot reliably parse ${brand}'s ${industry} offerings. Competitors with complete schema keep winning the top answer card.`,
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
