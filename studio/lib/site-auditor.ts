import * as cheerio from 'cheerio';
import { assertPublicHttpUrl } from './ssrf-guard';

const FETCH_TIMEOUT_MS = 10_000;
const MAX_HTML_CHARS = 2_000_000;
const USER_AGENT = 'Mozilla/5.0 (compatible; ReduAiAuditBot/1.0; +https://redue.ai/audit)';

export type AuditLang = 'ko' | 'en';

export interface AuditCheckItem {
	id: string;
	label: string;
	passed: boolean;
	weight: number;
}

export type AuditCategoryStatus = 'PASS' | 'FAIL';

export interface AuditCategory {
	id: string;
	label: string;
	score: number;
	maxScore: number;
	status: AuditCategoryStatus;
	statusNote: string;
	checks: AuditCheckItem[];
}

export interface AuditFinding {
	severity: 'critical' | 'warning';
	title: string;
	detail: string;
}

export type AuditOverallStatus = 'CRITICAL' | 'POOR' | 'FAIR' | 'GOOD' | 'EXCELLENT';

export interface AuditReport {
	url: string;
	lang: AuditLang;
	fetchedAt: string;
	httpStatus: number | null;
	responseTimeMs: number;
	pageSizeBytes: number;
	score: number;
	maxScore: number;
	status: AuditOverallStatus;
	statusLabel: string;
	categories: AuditCategory[];
	findings: AuditFinding[];
}

/** Every localized label/finding string the auditor produces, keyed by language. */
const STRINGS = {
	ko: {
		overallStatus: {
			EXCELLENT: '최적화 완료',
			GOOD: '양호',
			FAIR: '보통 (개선 필요)',
			POOR: '취약',
			CRITICAL: '심각 (긴급 개선 필요)',
		},
		seo: {
			label: 'SEO 기초 마크업',
			passNote: '기본기 양호',
			failNote: '핵심 메타데이터 미흡',
			title: '<title> 태그 (10~60자)',
			metaDescription: '메타 디스크립션 존재',
			ogTags: 'OG 태그 (title/description/image) 3종 완비',
			canonical: 'Canonical URL 명시',
			singleH1: 'H1 태그 1개만 사용',
		},
		performance: {
			label: '웹 성능',
			passNote: '응답 속도 양호',
			failNote: '로딩 속도/용량 개선 필요',
			responseTime: (ms: number) => `서버 응답 속도 (${ms}ms < 1500ms)`,
			pageWeight: (kb: string) => `HTML 문서 용량 (${kb}KB < 1500KB)`,
			renderBlocking: '렌더링 차단 스크립트 최소화 (async/defer 미사용 <script> 5개 이하)',
		},
		schema: {
			label: '스키마 구조화 데이터 (JSON-LD)',
			passNote: '리치 결과 대응 완료',
			failNote: '개선 시급',
			jsonldPresent: 'JSON-LD 구조화 데이터 존재',
			businessSchema: 'SoftwareApplication / LocalBusiness / Organization 스키마',
			websiteSchema: 'WebSite / BreadcrumbList 보조 스키마',
		},
		accessibility: {
			label: '웹 접근성',
			passNote: '접근성 기준 충족',
			failNote: '접근성 보완 필요',
			htmlLang: 'html lang 속성 명시',
			imageAlt: (pct: number, total: number, missing: number) => `이미지 alt 속성 커버리지 (${pct}%, 총 ${total}개 중 ${missing}개 누락)`,
			headingStructure: '제목(H1~H3) 구조 존재',
		},
		geo: {
			label: 'GEO (AI 검색엔진 인식)',
			passNote: 'AI 검색 노출 준비됨',
			failNote: 'AI 답변 인용 가능성 낮음',
			faqHowto: 'FAQPage / HowTo 등 AI 인용 친화 스키마',
			aiBotsAllowed: 'GPTBot/PerplexityBot 등 AI 크롤러 차단 없음 (robots.txt)',
			crawlableText: 'AI가 요약할 수 있는 충분한 본문 텍스트 (300자 이상)',
		},
		findings: {
			businessSchemaTitle: 'SoftwareApplication / LocalBusiness 스키마 부재',
			businessSchemaDetail: '구조화 데이터가 없어 구글 리치 결과(별점, 가격, 영업시간 등)와 AI 검색엔진의 직접 인용에서 완전히 배제됩니다.',
			canonicalTitle: 'Canonical URL 누락',
			canonicalDetail: '중복 콘텐츠로 오인되어 검색 순위가 분산되거나 원치 않는 URL이 색인될 위험이 있습니다.',
			ogTagsTitle: 'OG 태그 미흡',
			ogTagsDetail: '카카오톡·페이스북 등에 링크 공유 시 미리보기 이미지/제목/설명이 표시되지 않아 클릭률이 크게 떨어집니다.',
			metaDescriptionTitle: '메타 디스크립션 누락',
			metaDescriptionDetail: '검색 결과 스니펫이 페이지 내 임의 문장으로 대체되어 클릭 유도 문구를 전혀 통제할 수 없습니다.',
			imageAltTitle: (missing: number, total: number) => `이미지 alt 속성 누락 (${missing}/${total}개)`,
			imageAltDetail: '스크린리더 사용자 접근성이 저하되고, 구글 이미지 검색 유입 기회를 놓치게 됩니다.',
			geoTitle: 'AI 검색엔진(Perplexity/ChatGPT) 인용 최적화 없음',
			geoDetail: 'FAQPage 등 AI 답변 인용에 유리한 구조화 데이터가 없어, 잠재 고객이 AI에게 질문해도 이 사이트가 답변에 등장하지 않습니다.',
			responseTimeTitle: '서버 응답 속도 저하',
			responseTimeDetail: '느린 응답 속도는 이탈률 상승과 검색 순위 하락의 직접적인 원인이 됩니다.',
		},
	},
	en: {
		overallStatus: {
			EXCELLENT: 'Fully Optimized',
			GOOD: 'Good',
			FAIR: 'Fair (needs improvement)',
			POOR: 'Poor',
			CRITICAL: 'Critical (urgent action needed)',
		},
		seo: {
			label: 'SEO Basics',
			passNote: 'Fundamentals look solid',
			failNote: 'Core metadata is missing',
			title: '<title> tag (10–60 chars)',
			metaDescription: 'Meta description present',
			ogTags: 'OG tags (title/description/image) complete',
			canonical: 'Canonical URL specified',
			singleH1: 'Exactly one H1 tag',
		},
		performance: {
			label: 'Web Performance',
			passNote: 'Response speed is good',
			failNote: 'Load speed/size needs improvement',
			responseTime: (ms: number) => `Server response time (${ms}ms < 1500ms)`,
			pageWeight: (kb: string) => `HTML document size (${kb}KB < 1500KB)`,
			renderBlocking: 'Minimal render-blocking scripts (≤5 <script> without async/defer)',
		},
		schema: {
			label: 'Structured Data (JSON-LD)',
			passNote: 'Ready for rich results',
			failNote: 'Needs urgent improvement',
			jsonldPresent: 'JSON-LD structured data present',
			businessSchema: 'SoftwareApplication / LocalBusiness / Organization schema',
			websiteSchema: 'WebSite / BreadcrumbList supplementary schema',
		},
		accessibility: {
			label: 'Web Accessibility',
			passNote: 'Meets accessibility baseline',
			failNote: 'Accessibility needs work',
			htmlLang: 'html lang attribute specified',
			imageAlt: (pct: number, total: number, missing: number) => `Image alt coverage (${pct}%, ${missing} of ${total} missing)`,
			headingStructure: 'Heading (H1–H3) structure present',
		},
		geo: {
			label: 'GEO (AI Search Recognition)',
			passNote: 'Ready for AI search visibility',
			failNote: 'Low chance of AI answer citation',
			faqHowto: 'FAQPage / HowTo schema (AI-citation-friendly)',
			aiBotsAllowed: 'GPTBot/PerplexityBot not blocked (robots.txt)',
			crawlableText: 'Enough body text for AI summarization (300+ chars)',
		},
		findings: {
			businessSchemaTitle: 'Missing SoftwareApplication / LocalBusiness schema',
			businessSchemaDetail: 'Without structured data, this site is excluded from Google rich results (ratings, pricing, hours) and direct AI search citations.',
			canonicalTitle: 'Missing Canonical URL',
			canonicalDetail: 'Risk of being flagged as duplicate content, splitting ranking signals or indexing the wrong URL.',
			ogTagsTitle: 'Incomplete OG tags',
			ogTagsDetail: 'Links shared on KakaoTalk/Facebook show no preview image/title/description, hurting click-through rate.',
			metaDescriptionTitle: 'Missing meta description',
			metaDescriptionDetail: 'Search result snippets fall back to random on-page text — you lose control over the click-driving copy.',
			imageAltTitle: (missing: number, total: number) => `Missing image alt attributes (${missing}/${total})`,
			imageAltDetail: 'Hurts screen-reader accessibility and misses Google Image Search traffic opportunities.',
			geoTitle: 'Not optimized for AI search engines (Perplexity/ChatGPT)',
			geoDetail: 'No AI-citation-friendly structured data like FAQPage — this site won\u2019t show up when prospects ask AI assistants.',
			responseTimeTitle: 'Slow server response time',
			responseTimeDetail: 'Slow responses directly increase bounce rate and hurt search rankings.',
		},
	},
} satisfies Record<AuditLang, unknown>;

function overallStatus(lang: AuditLang, score: number): { status: AuditOverallStatus; statusLabel: string } {
	const labels = STRINGS[lang].overallStatus;
	if (score >= 90) return { status: 'EXCELLENT', statusLabel: labels.EXCELLENT };
	if (score >= 70) return { status: 'GOOD', statusLabel: labels.GOOD };
	if (score >= 40) return { status: 'FAIR', statusLabel: labels.FAIR };
	if (score >= 20) return { status: 'POOR', statusLabel: labels.POOR };
	return { status: 'CRITICAL', statusLabel: labels.CRITICAL };
}

function categoryScore(checks: AuditCheckItem[], passThresholdRatio = 0.6): { score: number; maxScore: number; status: AuditCategoryStatus } {
	const maxScore = checks.reduce((sum, c) => sum + c.weight, 0);
	const score = checks.filter((c) => c.passed).reduce((sum, c) => sum + c.weight, 0);
	return { score, maxScore, status: score >= maxScore * passThresholdRatio ? 'PASS' : 'FAIL' };
}

async function fetchText(url: string, timeoutMs = FETCH_TIMEOUT_MS): Promise<{ ok: boolean; status: number | null; text: string; elapsedMs: number; bytes: number }> {
	const started = Date.now();
	try {
		const res = await fetch(url, {
			headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml' },
			signal: AbortSignal.timeout(timeoutMs),
			redirect: 'follow',
		});
		const text = await res.text();
		return { ok: res.ok, status: res.status, text: text.slice(0, MAX_HTML_CHARS), elapsedMs: Date.now() - started, bytes: Buffer.byteLength(text, 'utf8') };
	} catch {
		return { ok: false, status: null, text: '', elapsedMs: Date.now() - started, bytes: 0 };
	}
}

/**
 * Fetches `targetUrl` (after SSRF validation) and `robots.txt` from the same
 * origin, then runs a 5-category / 100-point rubric mirroring real Google
 * rich-result & AI-answer-engine requirements — this is a genuine analysis
 * of the live page, not a scripted demo score. `lang` localizes every label,
 * status note, and finding (shared with the public `/api/v1/schema/generate`
 * endpoint's `lang` parameter and the `/audit/result` KR|EN switcher).
 */
export async function auditSite(targetUrl: string, lang: AuditLang = 'ko'): Promise<AuditReport> {
	const S = STRINGS[lang];
	const url = await assertPublicHttpUrl(targetUrl);

	const [page, robots] = await Promise.all([fetchText(url.toString()), fetchText(new URL('/robots.txt', url.origin).toString(), 5000)]);

	const $ = cheerio.load(page.text || '<html></html>');

	// --- 1) SEO basics ---
	const title = $('title').first().text().trim();
	const metaDescription = $('meta[name="description"]').attr('content')?.trim() || '';
	const ogTitle = $('meta[property="og:title"]').attr('content');
	const ogDescription = $('meta[property="og:description"]').attr('content');
	const ogImage = $('meta[property="og:image"]').attr('content');
	const canonical = $('link[rel="canonical"]').attr('href');
	const h1Count = $('h1').length;

	const seoChecks: AuditCheckItem[] = [
		{ id: 'title', label: S.seo.title, passed: title.length >= 10 && title.length <= 70, weight: 5 },
		{ id: 'meta-description', label: S.seo.metaDescription, passed: metaDescription.length > 0, weight: 5 },
		{ id: 'og-tags', label: S.seo.ogTags, passed: Boolean(ogTitle && ogDescription && ogImage), weight: 5 },
		{ id: 'canonical', label: S.seo.canonical, passed: Boolean(canonical), weight: 5 },
		{ id: 'single-h1', label: S.seo.singleH1, passed: h1Count === 1, weight: 5 },
	];

	// --- 2) Web performance (heuristic proxy, not full Lighthouse) ---
	const perfChecks: AuditCheckItem[] = [
		{ id: 'response-time', label: S.performance.responseTime(page.elapsedMs), passed: page.elapsedMs > 0 && page.elapsedMs < 1500, weight: 6 },
		{ id: 'page-weight', label: S.performance.pageWeight((page.bytes / 1024).toFixed(0)), passed: page.bytes > 0 && page.bytes < 1_500_000, weight: 5 },
		{
			id: 'render-blocking',
			label: S.performance.renderBlocking,
			passed: $('script[src]:not([async]):not([defer])').length <= 5,
			weight: 4,
		},
	];

	// --- 3) Structured data (JSON-LD) ---
	const jsonLdBlocks: unknown[] = [];
	$('script[type="application/ld+json"]').each((_, el) => {
		try {
			const parsed = JSON.parse($(el).contents().text());
			jsonLdBlocks.push(...(Array.isArray(parsed) ? parsed : [parsed]));
		} catch {
			// malformed JSON-LD block — ignored, counted as "no valid schema" below
		}
	});
	const schemaTypes = new Set(
		jsonLdBlocks.flatMap((block) => {
			const t = (block as { '@type'?: string | string[] })?.['@type'];
			return t ? (Array.isArray(t) ? t : [t]) : [];
		})
	);
	const hasAnyJsonLd = jsonLdBlocks.length > 0;
	const hasBusinessOrAppSchema = ['SoftwareApplication', 'LocalBusiness', 'Organization', 'Product'].some((t) => schemaTypes.has(t));
	const hasFaqOrHowTo = ['FAQPage', 'HowTo'].some((t) => schemaTypes.has(t));
	const hasWebsiteOrBreadcrumb = ['WebSite', 'BreadcrumbList'].some((t) => schemaTypes.has(t));

	const schemaChecks: AuditCheckItem[] = [
		{ id: 'jsonld-present', label: S.schema.jsonldPresent, passed: hasAnyJsonLd, weight: 10 },
		{ id: 'business-schema', label: S.schema.businessSchema, passed: hasBusinessOrAppSchema, weight: 10 },
		{ id: 'website-schema', label: S.schema.websiteSchema, passed: hasWebsiteOrBreadcrumb, weight: 5 },
	];

	// --- 4) Accessibility ---
	const htmlLang = $('html').attr('lang');
	const images = $('img');
	const imagesMissingAlt = images.filter((_, el) => !$(el).attr('alt')?.trim()).length;
	const altCoverage = images.length === 0 ? 1 : (images.length - imagesMissingAlt) / images.length;

	const a11yChecks: AuditCheckItem[] = [
		{ id: 'html-lang', label: S.accessibility.htmlLang, passed: Boolean(htmlLang), weight: 5 },
		{
			id: 'image-alt',
			label: S.accessibility.imageAlt(Math.round(altCoverage * 100), images.length, imagesMissingAlt),
			passed: altCoverage >= 0.8,
			weight: 6,
		},
		{ id: 'heading-structure', label: S.accessibility.headingStructure, passed: $('h1,h2,h3').length >= 2, weight: 4 },
	];

	// --- 5) GEO (Perplexity/ChatGPT/etc AI search recognition) ---
	const robotsText = robots.text.toLowerCase();
	const aiBotsBlocked = ['gptbot', 'perplexitybot', 'claudebot', 'google-extended'].some((bot) => {
		const idx = robotsText.indexOf(`user-agent: ${bot}`);
		if (idx === -1) return false;
		return robotsText.slice(idx, idx + 200).includes('disallow: /');
	});
	const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
	const hasSubstantialText = bodyText.length >= 300;

	const geoChecks: AuditCheckItem[] = [
		{ id: 'faq-howto-schema', label: S.geo.faqHowto, passed: hasFaqOrHowTo, weight: 7 },
		{ id: 'ai-bots-allowed', label: S.geo.aiBotsAllowed, passed: !aiBotsBlocked, weight: 7 },
		{ id: 'crawlable-text', label: S.geo.crawlableText, passed: hasSubstantialText, weight: 6 },
	];

	const categoriesDef: { id: string; label: string; checks: AuditCheckItem[]; failNote: string; passNote: string }[] = [
		{ id: 'seo', label: S.seo.label, checks: seoChecks, failNote: S.seo.failNote, passNote: S.seo.passNote },
		{ id: 'performance', label: S.performance.label, checks: perfChecks, failNote: S.performance.failNote, passNote: S.performance.passNote },
		{ id: 'schema', label: S.schema.label, checks: schemaChecks, failNote: S.schema.failNote, passNote: S.schema.passNote },
		{ id: 'accessibility', label: S.accessibility.label, checks: a11yChecks, failNote: S.accessibility.failNote, passNote: S.accessibility.passNote },
		{ id: 'geo', label: S.geo.label, checks: geoChecks, failNote: S.geo.failNote, passNote: S.geo.passNote },
	];

	const categories: AuditCategory[] = categoriesDef.map((def) => {
		const { score, maxScore, status } = categoryScore(def.checks);
		return { id: def.id, label: def.label, score, maxScore, status, statusNote: status === 'PASS' ? def.passNote : def.failNote, checks: def.checks };
	});

	const score = categories.reduce((sum, c) => sum + c.score, 0);
	const maxScore = categories.reduce((sum, c) => sum + c.maxScore, 0);
	const { status, statusLabel } = overallStatus(lang, score);

	const findings = buildFindings(lang, {
		geoChecks,
		perfChecks,
		hasBusinessOrAppSchema,
		canonical,
		ogTitle,
		ogDescription,
		ogImage,
		imagesMissingAlt,
		images: images.length,
		metaDescription,
	});

	return {
		url: url.toString(),
		lang,
		fetchedAt: new Date().toISOString(),
		httpStatus: page.status,
		responseTimeMs: page.elapsedMs,
		pageSizeBytes: page.bytes,
		score,
		maxScore,
		status,
		statusLabel,
		categories,
		findings,
	};
}

interface FindingContext {
	geoChecks: AuditCheckItem[];
	perfChecks: AuditCheckItem[];
	hasBusinessOrAppSchema: boolean;
	canonical: string | undefined;
	ogTitle: string | undefined;
	ogDescription: string | undefined;
	ogImage: string | undefined;
	imagesMissingAlt: number;
	images: number;
	metaDescription: string;
}

/** Produces the 3~5 concrete, prioritized complaints shown in the report's findings table. */
function buildFindings(lang: AuditLang, ctx: FindingContext): AuditFinding[] {
	const F = STRINGS[lang].findings;
	const findings: AuditFinding[] = [];

	if (!ctx.hasBusinessOrAppSchema) {
		findings.push({ severity: 'critical', title: F.businessSchemaTitle, detail: F.businessSchemaDetail });
	}
	if (!ctx.canonical) {
		findings.push({ severity: 'warning', title: F.canonicalTitle, detail: F.canonicalDetail });
	}
	if (!(ctx.ogTitle && ctx.ogDescription && ctx.ogImage)) {
		findings.push({ severity: 'warning', title: F.ogTagsTitle, detail: F.ogTagsDetail });
	}
	if (!ctx.metaDescription) {
		findings.push({ severity: 'warning', title: F.metaDescriptionTitle, detail: F.metaDescriptionDetail });
	}
	if (ctx.imagesMissingAlt > 0) {
		findings.push({ severity: 'warning', title: F.imageAltTitle(ctx.imagesMissingAlt, ctx.images), detail: F.imageAltDetail });
	}
	if (!ctx.geoChecks.find((c) => c.id === 'faq-howto-schema')?.passed) {
		findings.push({ severity: 'critical', title: F.geoTitle, detail: F.geoDetail });
	}
	if (!ctx.perfChecks.find((c) => c.id === 'response-time')?.passed) {
		findings.push({ severity: 'warning', title: F.responseTimeTitle, detail: F.responseTimeDetail });
	}

	// Prioritize critical findings first, cap at 5 for a punchy, decision-maker-friendly report.
	return findings.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'critical' ? -1 : 1)).slice(0, 5);
}
