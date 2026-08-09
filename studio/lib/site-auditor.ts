import * as cheerio from 'cheerio';
import {
	computeSchemaCoverage,
	parsePageHtml,
	type PageParseResult,
} from '@/lib/audit/parser';
import {
	extractSiteMetadata,
	type SiteMetadata,
} from '@/lib/audit/site-metadata';
import { assertPublicHttpUrl } from './ssrf-guard';

const FETCH_TIMEOUT_MS = 10_000;
const MAX_HTML_CHARS = 2_000_000;
const USER_AGENT = 'Mozilla/5.0 (compatible; ReduAiAuditBot/1.0; +https://redue.ai/audit)';

export type AuditLang = 'ko' | 'en';
export type AuditCheckStatus = 'pass' | 'fail' | 'warning';
export type AuditCategoryStatus = 'PASS' | 'FAIL';
export type AuditOverallStatus = 'CRITICAL' | 'POOR' | 'FAIR' | 'GOOD' | 'EXCELLENT';

export interface AuditCheckItem {
	id: string;
	label: string;
	/** Back-compat: true only when status === 'pass'. */
	passed: boolean;
	/** Optional on legacy stored reports; UI falls back to `passed`. */
	status?: AuditCheckStatus;
	weight: number;
	evidence?: string;
	why?: string;
	impact?: string;
}

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
	checkId?: string;
}

export interface AuditMetrics {
	titleLength: number;
	metaDescriptionLength: number;
	h1Count: number;
	headingSkipDetected: boolean;
	imagesTotal: number;
	imagesMissingAlt: number;
	imageAltCoveragePct: number;
	jsonLdBlockCount: number;
	schemaTypes: string[];
	bodyTextLength: number;
	jsonLdSnippets?: string[];
	organizationMissing?: string[];
	articleMissing?: string[];
	personMissing?: string[];
	h1Texts?: string[];
	headingSkipExamples?: string[];
	/** Raw crawled <title> text for GEO narrative binding. */
	pageTitle?: string;
	/** Raw crawled meta description for GEO narrative binding. */
	metaDescription?: string;
}

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
	/** 0–100: share of target Schema.org types detected. */
	schemaCoverage?: number;
	/** 0–100: heuristic AI citation readiness (GEO). */
	geoCitationScore?: number;
	/** Brand / category / location signals for dynamic GEO simulators. */
	siteMeta?: SiteMetadata;
	metrics?: AuditMetrics;
	categories: AuditCategory[];
	/** Flat checklist (all category checks) for the detailed report grid. */
	checklist?: AuditCheckItem[];
	findings: AuditFinding[];
}

type Strings = typeof STRINGS.ko;

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
			passNote: '메타·헤딩 기본기 양호',
			failNote: '핵심 메타/헤딩 구조 미흡',
			title: (len: number) => `<title> 길이 적정성 (${len}자 · 권장 10–60)`,
			metaDescription: (len: number) => `메타 디스크립션 (${len}자 · 권장 70–160)`,
			ogTags: 'Open Graph 3종 (title / description / image)',
			canonical: 'Canonical URL 명시 및 정합성',
			singleH1: (count: number) => `H1 태그 단일성 (${count}개 감지)`,
			headingSkip: '헤딩 계층 순서 (H1→H2→H3, 비약 없음)',
		},
		performance: {
			label: '웹 성능',
			passNote: '응답·용량 양호',
			failNote: '로딩 속도/용량 개선 필요',
			responseTime: (ms: number) => `서버 응답 속도 (${ms}ms < 1500ms)`,
			pageWeight: (kb: string) => `HTML 문서 용량 (${kb}KB < 1500KB)`,
			renderBlocking: (n: number) => `렌더링 차단 스크립트 (${n}개 · 권장 ≤5)`,
		},
		schema: {
			label: '스키마 구조화 데이터 (JSON-LD)',
			passNote: '리치 결과·지식그래프 대응',
			failNote: '스키마 커버리지 부족',
			jsonldPresent: 'JSON-LD 블록 파싱 성공',
			organization: 'Organization 필수 속성 (logo / url / sameAs)',
			article: 'Article·NewsArticle 필수 속성',
			newsArticle: 'NewsArticle 스키마 (AI·Discover 인용에 유리)',
			websiteSchema: 'WebSite / BreadcrumbList 보조 스키마',
			person: 'Person 저자 프로필 (E-E-A-T)',
		},
		accessibility: {
			label: '웹 접근성',
			passNote: '접근성 기준 충족',
			failNote: '접근성 보완 필요',
			htmlLang: 'html lang 속성 명시',
			imageAlt: (pct: number, total: number, missing: number) =>
				`이미지 alt 커버리지 (${pct}% · ${missing}/${total} 누락)`,
			headingStructure: 'H1–H3 제목 구조 존재',
		},
		geo: {
			label: 'GEO (AI 검색엔진 인식)',
			passNote: 'AI 인용 신호 양호',
			failNote: 'AI 답변 인용 가능성 낮음',
			faqHowto: 'FAQPage / HowTo 인용 친화 스키마',
			aiBotsAllowed: 'GPTBot / PerplexityBot 차단 없음 (robots.txt)',
			crawlableText: (n: number) => `본문 텍스트 충분성 (${n}자 · 권장 ≥300)`,
			eeatAuthor: 'E-E-A-T 저자·발행자 지식그래프 신호',
		},
		why: {
			title: 'title은 SERP·소셜·AI 요약의 1차 식별자입니다.',
			metaDescription: '검색 스니펫 카피를 통제하지 못하면 CTR이 임의 문장에 좌우됩니다.',
			ogTags: '카카오/페이스북 등 공유 미리보기가 깨져 클릭 유도가 약해집니다.',
			canonical: '중복 URL이 색인되면 랭킹 신호가 분산됩니다.',
			singleH1: '다중/누락 H1은 주제 초점을 흐려 검색·AI 이해도를 떨어뜨립니다.',
			headingSkip: '헤딩 비약은 문서 아웃라인을 깨뜨려 접근성·시맨틱 SEO에 불리합니다.',
			responseTime: '느린 TTFB는 이탈과 Core Web Vitals 악화로 이어집니다.',
			pageWeight: '과대 HTML은 파싱·렌더 비용을 키워 모바일 성능에 치명적입니다.',
			renderBlocking: '동기 스크립트는 First Paint를 지연시킵니다.',
			jsonld: '유효한 JSON-LD가 없으면 리치 결과와 AI 구조 이해가 불가능합니다.',
			organization: 'Organization 누락 필드는 브랜드 지식패널·sameAs 그래프를 약화시킵니다.',
			article: 'Article 필수 속성 부재 시 기사형 리치결과·AI 출처 인용이 어렵습니다.',
			newsArticle: 'NewsArticle은 Discover·뉴스성 AI 인용에 Article보다 유리합니다.',
			website: 'WebSite/Breadcrumb는 사이트 계층과 sitelinks 신호를 보강합니다.',
			person: 'Person 프로필이 없으면 E-E-A-T 저자성이 증명되지 않습니다.',
			htmlLang: 'lang 부재는 언어 타겟팅·접근성 평가에 불리합니다.',
			imageAlt: 'alt 누락은 이미지 검색·스크린리더·멀티모달 AI 이해에 모두 불리합니다.',
			headingStructure: '제목 계층이 빈약하면 문서 토픽 추출이 어렵습니다.',
			faq: 'FAQ/HowTo는 Perplexity·ChatGPT Search의 인용 단위로 자주 채택됩니다.',
			robots: 'AI 크롤러 Disallow는 GEO 노출을 원천 차단합니다.',
			bodyText: '요약할 본문이 부족하면 AI가 인용할 근거 문단을 찾지 못합니다.',
			eeat: '저자·발행자 그래프가 없으면 AI가 신뢰 출처로 올리지 않습니다.',
		},
		impact: {
			title: '적정 title은 검색 클릭률과 AI 출처 라벨 정확도를 동시에 올립니다.',
			metaDescription: '의도한 스니펫으로 CTR 2배까지 끌어올린 사례가 흔합니다.',
			ogTags: '공유 트래픽·브랜드 인식이 즉시 개선됩니다.',
			canonical: '올바른 URL로 랭킹 권한을 집중시킬 수 있습니다.',
			singleH1: '주제 명확화로 상위 노출·AI 요약 일치율이 올라갑니다.',
			headingSkip: '시맨틱 아웃라인이 정리되면 섹션 단위 인용 확률이 높아집니다.',
			responseTime: '응답 개선은 이탈 감소와 순위 안정화로 이어집니다.',
			pageWeight: '문서 경량화는 LCP·모바일 SEO에 직접 기여합니다.',
			renderBlocking: '초기 렌더 가속은 체감 속도와 전환율을 높입니다.',
			jsonld: '구조화 데이터는 리치결과 배지와 AI 구조 파싱의 전제 조건입니다.',
			organization: 'logo·sameAs 완비 시 브랜드 엔티티 매칭 정확도가 상승합니다.',
			article: '필수 필드 충족 시 기사 카드·작성자 표시·AI 출처 인용이 가능해집니다.',
			newsArticle: 'NewsArticle 적용은 Discover·AI 뉴스성 답변 진입에 유리합니다.',
			website: '사이트 계층이 명확해져 내부 페이지 이해도가 올라갑니다.',
			person: '검증된 저자 그래프는 E-E-A-T 방어력과 AI 신뢰 인용을 강화합니다.',
			htmlLang: '올바른 언어 타겟으로 국제 SEO 노이즈를 줄입니다.',
			imageAlt: '이미지 검색 유입과 접근성 컴플라이언스를 동시에 확보합니다.',
			headingStructure: '토픽 클러스터가 분명해져 롱테일 쿼리 매칭이 좋아집니다.',
			faq: '질문-답변 단위 인용으로 AI 답변 상단 노출 기회를 만듭니다.',
			robots: 'AI 봇 허용은 GEO 트래픽의 최소 조건입니다.',
			bodyText: '충분한 본문은 AI 요약·인용 문단의 원재료가 됩니다.',
			eeat: '저자성 신호 강화는 알고리즘 업데이트 내성으로 이어집니다.',
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
			passNote: 'Meta & heading fundamentals look solid',
			failNote: 'Core meta/heading structure is weak',
			title: (len: number) => `<title> length (${len} chars · ideal 10–60)`,
			metaDescription: (len: number) => `Meta description (${len} chars · ideal 70–160)`,
			ogTags: 'Open Graph trio (title / description / image)',
			canonical: 'Canonical URL present & coherent',
			singleH1: (count: number) => `Single H1 (${count} detected)`,
			headingSkip: 'Heading hierarchy (no H1→H3 skips)',
		},
		performance: {
			label: 'Web Performance',
			passNote: 'Response & weight look healthy',
			failNote: 'Speed/size needs improvement',
			responseTime: (ms: number) => `Server response time (${ms}ms < 1500ms)`,
			pageWeight: (kb: string) => `HTML size (${kb}KB < 1500KB)`,
			renderBlocking: (n: number) => `Render-blocking scripts (${n} · ideal ≤5)`,
		},
		schema: {
			label: 'Structured Data (JSON-LD)',
			passNote: 'Rich-result & knowledge-graph ready',
			failNote: 'Schema coverage is insufficient',
			jsonldPresent: 'JSON-LD blocks parsed successfully',
			organization: 'Organization required fields (logo / url / sameAs)',
			article: 'Article / NewsArticle required fields',
			newsArticle: 'NewsArticle schema (better for AI & Discover)',
			websiteSchema: 'WebSite / BreadcrumbList support schemas',
			person: 'Person author profile (E-E-A-T)',
		},
		accessibility: {
			label: 'Web Accessibility',
			passNote: 'Meets accessibility baseline',
			failNote: 'Accessibility needs work',
			htmlLang: 'html lang attribute present',
			imageAlt: (pct: number, total: number, missing: number) =>
				`Image alt coverage (${pct}% · ${missing}/${total} missing)`,
			headingStructure: 'H1–H3 heading structure present',
		},
		geo: {
			label: 'GEO (AI Search Recognition)',
			passNote: 'Strong AI citation signals',
			failNote: 'Low chance of AI answer citation',
			faqHowto: 'FAQPage / HowTo citation-friendly schema',
			aiBotsAllowed: 'GPTBot / PerplexityBot not blocked (robots.txt)',
			crawlableText: (n: number) => `Body text sufficiency (${n} chars · ideal ≥300)`,
			eeatAuthor: 'E-E-A-T author/publisher knowledge-graph signals',
		},
		why: {
			title: 'Title is the primary identifier for SERPs, social, and AI summaries.',
			metaDescription: 'Without a controlled snippet, CTR depends on random on-page text.',
			ogTags: 'Broken share previews on Kakao/Facebook kill referral clicks.',
			canonical: 'Duplicate URLs split ranking authority.',
			singleH1: 'Missing/multiple H1s blur topical focus for search and AI.',
			headingSkip: 'Heading skips break the outline used by a11y tools and semantic SEO.',
			responseTime: 'Slow TTFB drives bounce and hurts Core Web Vitals.',
			pageWeight: 'Heavy HTML raises parse/render cost on mobile.',
			renderBlocking: 'Sync scripts delay First Paint.',
			jsonld: 'Without valid JSON-LD, rich results and structured AI parsing fail.',
			organization: 'Missing Organization fields weaken brand entity matching.',
			article: 'Incomplete Article fields block article rich results and AI citations.',
			newsArticle: 'NewsArticle outperforms generic Article for Discover/AI news answers.',
			website: 'WebSite/Breadcrumb reinforce site hierarchy and sitelinks signals.',
			person: 'Without Person profiles, author E-E-A-T cannot be proven.',
			htmlLang: 'Missing lang hurts language targeting and accessibility scoring.',
			imageAlt: 'Missing alt hurts image search, screen readers, and multimodal AI.',
			headingStructure: 'Thin heading trees make topic extraction harder.',
			faq: 'FAQ/HowTo blocks are frequently cited by Perplexity and ChatGPT Search.',
			robots: 'Disallowing AI crawlers blocks GEO visibility at the source.',
			bodyText: 'Too little body text leaves AI with nothing citable.',
			eeat: 'Without author/publisher graphs, AI rarely elevates the source.',
		},
		impact: {
			title: 'A precise title lifts SERP CTR and AI source-label accuracy together.',
			metaDescription: 'Owned snippets routinely double CTR versus auto excerpts.',
			ogTags: 'Share traffic and brand recognition improve immediately.',
			canonical: 'Concentrate ranking equity on the preferred URL.',
			singleH1: 'Clear topical focus improves rankings and AI summary fidelity.',
			headingSkip: 'A clean outline raises section-level citation odds.',
			responseTime: 'Faster responses reduce bounce and stabilize rankings.',
			pageWeight: 'Lighter documents improve LCP and mobile SEO.',
			renderBlocking: 'Faster first paint boosts perceived speed and conversion.',
			jsonld: 'Structured data is the prerequisite for rich badges and AI parsing.',
			organization: 'Complete logo/sameAs improves brand entity resolution.',
			article: 'Required fields unlock article cards, bylines, and AI citations.',
			newsArticle: 'NewsArticle improves Discover and AI news-answer entry.',
			website: 'Clearer site hierarchy improves understanding of inner pages.',
			person: 'Verified author graphs strengthen E-E-A-T and trusted AI citations.',
			htmlLang: 'Correct language targeting reduces international SEO noise.',
			imageAlt: 'Win image-search traffic and accessibility compliance together.',
			headingStructure: 'Clearer topic clusters improve long-tail query matching.',
			faq: 'Q&A units create top-of-answer citation opportunities.',
			robots: 'Allowing AI bots is the minimum bar for GEO traffic.',
			bodyText: 'Enough prose supplies the raw material for AI summaries.',
			eeat: 'Stronger authorship signals improve algorithm-update resilience.',
		},
	},
} satisfies Record<AuditLang, unknown>;

function check(
	id: string,
	label: string,
	status: AuditCheckStatus,
	weight: number,
	extra?: Pick<AuditCheckItem, 'evidence' | 'why' | 'impact'>,
): AuditCheckItem {
	return {
		id,
		label,
		status,
		passed: status === 'pass',
		weight,
		...extra,
	};
}

function overallStatus(lang: AuditLang, score: number): { status: AuditOverallStatus; statusLabel: string } {
	const labels = STRINGS[lang].overallStatus;
	if (score >= 90) return { status: 'EXCELLENT', statusLabel: labels.EXCELLENT };
	if (score >= 70) return { status: 'GOOD', statusLabel: labels.GOOD };
	if (score >= 40) return { status: 'FAIR', statusLabel: labels.FAIR };
	if (score >= 20) return { status: 'POOR', statusLabel: labels.POOR };
	return { status: 'CRITICAL', statusLabel: labels.CRITICAL };
}

function categoryScore(checks: AuditCheckItem[], passThresholdRatio = 0.6) {
	const maxScore = checks.reduce((sum, c) => sum + c.weight, 0);
	const score = checks.reduce((sum, c) => {
		if (c.status === 'pass') return sum + c.weight;
		if (c.status === 'warning') return sum + c.weight * 0.5;
		return sum;
	}, 0);
	return {
		score: Math.round(score * 10) / 10,
		maxScore,
		status: (score >= maxScore * passThresholdRatio ? 'PASS' : 'FAIL') as AuditCategoryStatus,
	};
}

async function fetchText(
	url: string,
	timeoutMs = FETCH_TIMEOUT_MS,
): Promise<{ ok: boolean; status: number | null; text: string; elapsedMs: number; bytes: number }> {
	const started = Date.now();
	try {
		const res = await fetch(url, {
			headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml' },
			signal: AbortSignal.timeout(timeoutMs),
			redirect: 'follow',
		});
		const text = await res.text();
		return {
			ok: res.ok,
			status: res.status,
			text: text.slice(0, MAX_HTML_CHARS),
			elapsedMs: Date.now() - started,
			bytes: Buffer.byteLength(text, 'utf8'),
		};
	} catch {
		return { ok: false, status: null, text: '', elapsedMs: Date.now() - started, bytes: 0 };
	}
}

function truncate(value: string, max = 96): string {
	const cleaned = value.replace(/\s+/g, ' ').trim();
	return cleaned.length > max ? `${cleaned.slice(0, max)}…` : cleaned;
}

function canonicalMatches(pageUrl: string, canonical: string | null): boolean {
	if (!canonical) return false;
	try {
		const page = new URL(pageUrl);
		const can = new URL(canonical, page);
		return page.origin === can.origin;
	} catch {
		return false;
	}
}

function computeGeoCitationScore(args: {
	schema: PageParseResult['schema'];
	aiBotsBlocked: boolean;
	bodyTextLength: number;
	organizationComplete: boolean;
	personComplete: boolean;
}): number {
	let score = 0;
	if (args.schema.hasFaqOrHowTo) score += 25;
	if (!args.aiBotsBlocked) score += 20;
	if (args.bodyTextLength >= 300) score += 15;
	if (args.schema.hasNewsArticle) score += 15;
	else if (args.schema.hasArticle) score += 8;
	if (args.personComplete) score += 15;
	if (args.organizationComplete) score += 10;
	return Math.min(100, score);
}

function buildSeoChecks(S: Strings, parsed: PageParseResult, pageUrl: string): AuditCheckItem[] {
	const { meta, headings } = parsed;
	const titleOk = meta.titleLength >= 10 && meta.titleLength <= 60;
	const titleWarn = meta.titleLength > 0 && !titleOk;
	const descOk = meta.metaDescriptionLength >= 70 && meta.metaDescriptionLength <= 160;
	const descWarn = meta.metaDescriptionLength > 0 && !descOk;
	const ogOk = Boolean(meta.ogTitle && meta.ogDescription && meta.ogImage);
	const canOk = Boolean(meta.canonical) && canonicalMatches(pageUrl, meta.canonical);
	const canWarn = Boolean(meta.canonical) && !canOk;

	return [
		check(
			'title',
			S.seo.title(meta.titleLength),
			titleOk ? 'pass' : titleWarn ? 'warning' : 'fail',
			5,
			{
				evidence: meta.title
					? `<title>${truncate(meta.title, 70)}</title>`
					: '— <title> not found',
				why: S.why.title,
				impact: S.impact.title,
			},
		),
		check(
			'meta-description',
			S.seo.metaDescription(meta.metaDescriptionLength),
			descOk ? 'pass' : descWarn ? 'warning' : 'fail',
			5,
			{
				evidence: meta.metaDescription
					? `content="${truncate(meta.metaDescription, 90)}"`
					: '— meta[name=description] missing',
				why: S.why.metaDescription,
				impact: S.impact.metaDescription,
			},
		),
		check('og-tags', S.seo.ogTags, ogOk ? 'pass' : 'fail', 5, {
			evidence: ogOk
				? `og:title ✓ · og:description ✓ · og:image ✓`
				: `missing: ${[!meta.ogTitle && 'og:title', !meta.ogDescription && 'og:description', !meta.ogImage && 'og:image'].filter(Boolean).join(', ')}`,
			why: S.why.ogTags,
			impact: S.impact.ogTags,
		}),
		check('canonical', S.seo.canonical, canOk ? 'pass' : canWarn ? 'warning' : 'fail', 5, {
			evidence: meta.canonical ? `rel=canonical href="${truncate(meta.canonical, 80)}"` : '— canonical link missing',
			why: S.why.canonical,
			impact: S.impact.canonical,
		}),
		check(
			'single-h1',
			S.seo.singleH1(headings.h1Count),
			headings.h1Count === 1 ? 'pass' : headings.h1Count === 0 ? 'fail' : 'warning',
			5,
			{
				evidence:
					headings.h1Count === 0
						? '— no <h1> detected'
						: headings.h1Texts.map((t, i) => `H1#${i + 1}: "${truncate(t, 48)}"`).join(' · '),
				why: S.why.singleH1,
				impact: S.impact.singleH1,
			},
		),
		check(
			'heading-skip',
			S.seo.headingSkip,
			!headings.hasSkip ? 'pass' : 'warning',
			4,
			{
				evidence: headings.hasSkip
					? `skip detected: ${headings.skipExamples.join(', ')}`
					: `levels: ${headings.levels.slice(0, 12).map((l) => `H${l}`).join(' → ') || '—'}`,
				why: S.why.headingSkip,
				impact: S.impact.headingSkip,
			},
		),
	];
}

function buildSchemaChecks(S: Strings, parsed: PageParseResult): AuditCheckItem[] {
	const { schema } = parsed;
	const orgComplete = schema.hasOrganization && schema.organizationMissing.length === 0;
	const articleComplete = (schema.hasArticle || schema.hasNewsArticle) && schema.articleMissing.length === 0;
	const personComplete = schema.hasPerson && schema.personMissing.length === 0;

	return [
		check(
			'jsonld-present',
			S.schema.jsonldPresent,
			schema.validBlockCount > 0 ? 'pass' : 'fail',
			8,
			{
				evidence: `blocks=${schema.rawBlockCount}, parsed_nodes=${schema.validBlockCount}, parse_errors=${schema.parseErrors}${
					schema.types.length ? ` · types=[${schema.types.join(', ')}]` : ''
				}`,
				why: S.why.jsonld,
				impact: S.impact.jsonld,
			},
		),
		check(
			'organization',
			S.schema.organization,
			orgComplete ? 'pass' : schema.hasOrganization ? 'warning' : 'fail',
			7,
			{
				evidence: schema.hasOrganization
					? schema.organizationMissing.length
						? `Organization present · missing: ${schema.organizationMissing.join(', ')}`
						: 'Organization · logo, url, sameAs ✓'
					: '— Organization schema not found',
				why: S.why.organization,
				impact: S.impact.organization,
			},
		),
		check(
			'article-fields',
			S.schema.article,
			articleComplete ? 'pass' : schema.hasArticle || schema.hasNewsArticle ? 'warning' : 'fail',
			7,
			{
				evidence:
					schema.hasArticle || schema.hasNewsArticle
						? schema.articleMissing.length
							? `Article-like schema present · missing: ${schema.articleMissing.join(', ')}`
							: 'Article/NewsArticle required fields ✓'
						: '— Article / NewsArticle not found',
				why: S.why.article,
				impact: S.impact.article,
			},
		),
		check(
			'news-article',
			S.schema.newsArticle,
			schema.hasNewsArticle ? 'pass' : schema.hasArticle ? 'warning' : 'fail',
			5,
			{
				evidence: schema.hasNewsArticle
					? 'NewsArticle detected'
					: schema.hasArticle
						? 'Generic Article only — prefer NewsArticle for news/insight pages'
						: '— NewsArticle missing',
				why: S.why.newsArticle,
				impact: S.impact.newsArticle,
			},
		),
		check(
			'website-schema',
			S.schema.websiteSchema,
			schema.hasWebSite || schema.hasBreadcrumb ? 'pass' : 'fail',
			4,
			{
				evidence: `WebSite=${schema.hasWebSite ? '✓' : '✗'} · BreadcrumbList=${schema.hasBreadcrumb ? '✓' : '✗'}`,
				why: S.why.website,
				impact: S.impact.website,
			},
		),
		check(
			'person-eeat',
			S.schema.person,
			personComplete ? 'pass' : schema.hasPerson ? 'warning' : 'fail',
			6,
			{
				evidence: schema.hasPerson
					? schema.personMissing.length
						? `Person present · missing: ${schema.personMissing.join(', ')}`
						: 'Person author profile identifiers ✓'
					: '— Person schema not found',
				why: S.why.person,
				impact: S.impact.person,
			},
		),
	];
}

/**
 * Fetches live HTML + robots.txt and runs a precision, LLM-free SEO/GEO audit.
 */
export async function auditSite(targetUrl: string, lang: AuditLang = 'ko'): Promise<AuditReport> {
	const S = STRINGS[lang];
	const url = await assertPublicHttpUrl(targetUrl);

	const [page, robots] = await Promise.all([
		fetchText(url.toString()),
		fetchText(new URL('/robots.txt', url.origin).toString(), 5000),
	]);

	const $ = cheerio.load(page.text || '<html></html>');
	const parsed = parsePageHtml($);

	const robotsText = robots.text.toLowerCase();
	const aiBotsBlocked = ['gptbot', 'perplexitybot', 'claudebot', 'google-extended'].some((bot) => {
		const idx = robotsText.indexOf(`user-agent: ${bot}`);
		if (idx === -1) return false;
		return robotsText.slice(idx, idx + 200).includes('disallow: /');
	});

	const orgComplete = parsed.schema.hasOrganization && parsed.schema.organizationMissing.length === 0;
	const personComplete = parsed.schema.hasPerson && parsed.schema.personMissing.length === 0;

	const seoChecks = buildSeoChecks(S, parsed, url.toString());
	const perfChecks: AuditCheckItem[] = [
		check(
			'response-time',
			S.performance.responseTime(page.elapsedMs),
			page.elapsedMs > 0 && page.elapsedMs < 1500 ? 'pass' : page.elapsedMs < 3000 ? 'warning' : 'fail',
			6,
			{ evidence: `TTFB≈${page.elapsedMs}ms`, why: S.why.responseTime, impact: S.impact.responseTime },
		),
		check(
			'page-weight',
			S.performance.pageWeight((page.bytes / 1024).toFixed(0)),
			page.bytes > 0 && page.bytes < 1_500_000 ? 'pass' : 'fail',
			5,
			{
				evidence: `${(page.bytes / 1024).toFixed(1)} KB HTML`,
				why: S.why.pageWeight,
				impact: S.impact.pageWeight,
			},
		),
		check(
			'render-blocking',
			S.performance.renderBlocking(parsed.renderBlockingScripts),
			parsed.renderBlockingScripts <= 5 ? 'pass' : 'warning',
			4,
			{
				evidence: `${parsed.renderBlockingScripts} sync <script src> without async/defer`,
				why: S.why.renderBlocking,
				impact: S.impact.renderBlocking,
			},
		),
	];
	const schemaChecks = buildSchemaChecks(S, parsed);
	const a11yChecks: AuditCheckItem[] = [
		check('html-lang', S.accessibility.htmlLang, parsed.meta.htmlLang ? 'pass' : 'fail', 5, {
			evidence: parsed.meta.htmlLang ? `<html lang="${parsed.meta.htmlLang}">` : '— lang attribute missing',
			why: S.why.htmlLang,
			impact: S.impact.htmlLang,
		}),
		check(
			'image-alt',
			S.accessibility.imageAlt(parsed.images.coveragePct, parsed.images.total, parsed.images.missingAlt),
			parsed.images.coveragePct >= 80 ? 'pass' : parsed.images.coveragePct >= 50 ? 'warning' : 'fail',
			6,
			{
				evidence: `${parsed.images.total - parsed.images.missingAlt}/${parsed.images.total} images have alt`,
				why: S.why.imageAlt,
				impact: S.impact.imageAlt,
			},
		),
		check(
			'heading-structure',
			S.accessibility.headingStructure,
			parsed.headings.hasH1ToH3 ? 'pass' : 'fail',
			4,
			{
				evidence: `H1=${parsed.headings.h1Count}, outline length=${parsed.headings.levels.length}`,
				why: S.why.headingStructure,
				impact: S.impact.headingStructure,
			},
		),
	];
	const geoChecks: AuditCheckItem[] = [
		check('faq-howto-schema', S.geo.faqHowto, parsed.schema.hasFaqOrHowTo ? 'pass' : 'fail', 7, {
			evidence: parsed.schema.hasFaqOrHowTo
				? `types include ${parsed.schema.types.filter((t) => t === 'FAQPage' || t === 'HowTo').join(', ')}`
				: '— FAQPage / HowTo not detected',
			why: S.why.faq,
			impact: S.impact.faq,
		}),
		check('ai-bots-allowed', S.geo.aiBotsAllowed, !aiBotsBlocked ? 'pass' : 'fail', 7, {
			evidence: aiBotsBlocked ? 'AI bot Disallow:/ detected in robots.txt' : 'No AI-bot Disallow:/ found',
			why: S.why.robots,
			impact: S.impact.robots,
		}),
		check(
			'crawlable-text',
			S.geo.crawlableText(parsed.bodyTextLength),
			parsed.bodyTextLength >= 300 ? 'pass' : parsed.bodyTextLength >= 120 ? 'warning' : 'fail',
			6,
			{
				evidence: `${parsed.bodyTextLength} chars of body text`,
				why: S.why.bodyText,
				impact: S.impact.bodyText,
			},
		),
		check(
			'eeat-author',
			S.geo.eeatAuthor,
			personComplete && orgComplete ? 'pass' : parsed.schema.hasPerson || parsed.schema.hasOrganization ? 'warning' : 'fail',
			6,
			{
				evidence: `Person=${personComplete ? '✓' : parsed.schema.hasPerson ? 'partial' : '✗'} · Organization=${
					orgComplete ? '✓' : parsed.schema.hasOrganization ? 'partial' : '✗'
				}`,
				why: S.why.eeat,
				impact: S.impact.eeat,
			},
		),
	];

	const categoriesDef = [
		{ id: 'seo', label: S.seo.label, checks: seoChecks, failNote: S.seo.failNote, passNote: S.seo.passNote },
		{
			id: 'performance',
			label: S.performance.label,
			checks: perfChecks,
			failNote: S.performance.failNote,
			passNote: S.performance.passNote,
		},
		{
			id: 'schema',
			label: S.schema.label,
			checks: schemaChecks,
			failNote: S.schema.failNote,
			passNote: S.schema.passNote,
		},
		{
			id: 'accessibility',
			label: S.accessibility.label,
			checks: a11yChecks,
			failNote: S.accessibility.failNote,
			passNote: S.accessibility.passNote,
		},
		{ id: 'geo', label: S.geo.label, checks: geoChecks, failNote: S.geo.failNote, passNote: S.geo.passNote },
	];

	const categories: AuditCategory[] = categoriesDef.map((def) => {
		const { score, maxScore, status } = categoryScore(def.checks);
		return {
			id: def.id,
			label: def.label,
			score,
			maxScore,
			status,
			statusNote: status === 'PASS' ? def.passNote : def.failNote,
			checks: def.checks,
		};
	});

	const checklist = categories.flatMap((c) => c.checks);
	const score = Math.round(categories.reduce((sum, c) => sum + c.score, 0) * 10) / 10;
	const maxScore = categories.reduce((sum, c) => sum + c.maxScore, 0);
	const { status, statusLabel } = overallStatus(lang, (score / maxScore) * 100);
	const schemaCoverage = computeSchemaCoverage(parsed.schema.types);
	const geoCitationScore = computeGeoCitationScore({
		schema: parsed.schema,
		aiBotsBlocked,
		bodyTextLength: parsed.bodyTextLength,
		organizationComplete: orgComplete,
		personComplete,
	});
	const siteMeta = extractSiteMetadata($, url.toString(), lang);

	const findings: AuditFinding[] = checklist
		.filter((c) => c.status !== 'pass')
		.map((c) => ({
			severity: c.status === 'fail' ? ('critical' as const) : ('warning' as const),
			title: c.label,
			detail: [c.evidence, c.why].filter(Boolean).join(' — '),
			checkId: c.id,
		}))
		.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'critical' ? -1 : 1))
		.slice(0, 8);

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
		schemaCoverage,
		geoCitationScore,
		siteMeta,
		metrics: {
			titleLength: parsed.meta.titleLength,
			metaDescriptionLength: parsed.meta.metaDescriptionLength,
			h1Count: parsed.headings.h1Count,
			headingSkipDetected: parsed.headings.hasSkip,
			imagesTotal: parsed.images.total,
			imagesMissingAlt: parsed.images.missingAlt,
			imageAltCoveragePct: parsed.images.coveragePct,
			jsonLdBlockCount: parsed.schema.rawBlockCount,
			schemaTypes: parsed.schema.types,
			bodyTextLength: parsed.bodyTextLength,
			jsonLdSnippets: parsed.schema.snippets,
			organizationMissing: parsed.schema.organizationMissing,
			articleMissing: parsed.schema.articleMissing,
			personMissing: parsed.schema.personMissing,
			h1Texts: parsed.headings.h1Texts,
			headingSkipExamples: parsed.headings.skipExamples,
			pageTitle: parsed.meta.title || undefined,
			metaDescription: parsed.meta.metaDescription || undefined,
		},
		categories,
		checklist,
		findings,
	};
}
