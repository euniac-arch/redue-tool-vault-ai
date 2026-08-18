import * as cheerio from 'cheerio';
import type { CheerioAPI } from 'cheerio';
import { crawlCollectedPageMetas, type CrawledPageMeta } from '@/lib/audit/crawl-page-metas';
import {
	computeSchemaCoverage,
	extractFooterLegalText,
	extractNavItems,
	hasAriaLandmarks,
	parsePageHtml,
	splitPageTitle,
	type NavLinkItem,
	type PageParseResult,
} from '@/lib/audit/parser';
import { resolveSiteLogo } from '@/lib/audit/resolve-site-logo';
import { fetchPageResource } from '@/lib/audit/fetch-page';
import { fetchSitemapCheck, type SitemapCheckResult } from '@/lib/audit/sitemap';
import { clampEarned, earnedScoreForItem } from '@/lib/audit/scorePipeline';
import {
	coreEntityItemCopy,
	detectSchemaVertical,
	hasCoreEntitySchema,
	hasPageSchemaAlternative,
	isNewsMediaVertical,
} from '@/lib/audit/recommended-schemas';
import {
	extractSiteMetadata,
	type SiteMetadata,
} from '@/lib/audit/site-metadata';
import { canonicalMatches, evaluateCanonicalAccuracy } from '@/lib/audit/canonical-url';
import { checklistWeightForEngineId } from '@/lib/audit/checklistDefinitions';
import {
	HTTPS_CHECK_ID,
	HTTPS_P0_LABEL,
	HTTPS_RAW_POINTS,
	resolveIsHttps,
} from '@/lib/audit/scoreCalculator';
import { detectViewportInHtml } from '@/lib/audit/viewport';
import { detectCmsFromHtml, toAuditCmsLabel } from '@/lib/crawling/cms-from-html';
import { generateExecutiveSummary, type ExecutiveSummary } from '@/lib/audit/executive-summary';
import { buildLlmsTxtCheckItem, isLlmsTxtDocument } from '@/lib/audit/llms-txt-check';
import { parseAiBotAccessFromRobots, resolveAiBotsAllowed } from '@/lib/audit/robots-ai-bots';
import { sanitizeMainPageTitle } from '@/lib/solve/dynamic-php-schema';
import {
	fetchRealCompetitorSnapshot,
	snapshotHasRealCompetitors,
	type RealCompetitorSnapshot,
} from '@/lib/audit/realCompetitors';
import { generateQueryMatrix } from '@/lib/geo/query-matrix';
import { resolveIndustryConfigFromSite } from '@/lib/registry/universalIndustryRegistry';
import {
	auditStatusToStored,
	normalizeTo100,
	resolveAuditStatus,
} from '@/lib/audit/auditScoreCalculator';
import {
	CATEGORY_STATUS_TEXT,
	checkVerdict,
	countCheckVerdicts,
	isDiagnosticCategoryId,
	type DiagnosticCategoryId,
} from '@/lib/audit/onpage-diagnostic';
import { assertPublicHttpUrl } from './ssrf-guard';

const FETCH_TIMEOUT_MS = 10_000;

export type AuditLang = 'ko' | 'en';
export type AuditCheckStatus = 'pass' | 'fail' | 'warning';
export type AuditCategoryStatus = 'PASS' | 'WARN' | 'FAIL';
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
	/** Sync <script src> tags without async/defer — render-blocking risk. */
	renderBlockingScripts: number;
	jsonLdSnippets?: string[];
	organizationMissing?: string[];
	articleMissing?: string[];
	personMissing?: string[];
	h1Texts?: string[];
	/** Content-scoped H2 phrases for As-Is source audit (P5). */
	h2Texts?: string[];
	headingSkipExamples?: string[];
	/** Page-specific title (site/brand suffix stripped) for GEO / $page_meta binding. */
	pageTitle?: string;
	/** Full document `<title>` before site-name split. */
	documentTitle?: string;
	/** Raw crawled meta description for GEO narrative binding. */
	metaDescription?: string;
	/** Raw `og:title` for As-Is source audit (P4). */
	ogTitle?: string;
	/** Raw `og:description` for As-Is source audit (P4). */
	ogDescription?: string;
	/**
	 * Per-bot robots.txt access. `true` = allowed (no `Disallow: /` under that
	 * User-agent). Omitted on legacy stored reports.
	 */
	aiBotAccess?: Partial<Record<'gptbot' | 'perplexitybot' | 'claudebot' | 'google-extended', boolean>>;
	/** Live `/llms.txt` at the origin root (GEO standard AI index). */
	hasLlmsTxt?: boolean;
	/** Evidence line for the `/llms.txt` checklist row. */
	llmsTxtEvidence?: string;
	/** Final URL after redirect tracking (Punycode ASCII href). */
	finalUrl?: string;
	/** HSTS present on the final response. */
	hasHsts?: boolean;
	/** Valid sitemap.xml / sitemapindex fetched. */
	hasSitemap?: boolean;
	sitemapEvidence?: string;
	/** Viewport meta detected (performance / a11y). */
	hasViewport?: boolean;
	/** Basic ARIA / landmark presence. */
	hasAriaLandmarks?: boolean;
	httpStatus?: number | null;
}

/** Server geo hint for the target-entity meta card (optional on legacy reports). */
export interface AuditServerLocation {
	/** ISO 3166-1 alpha-2 when known (e.g. KR). */
	countryCode: string;
	/** Display label, e.g. "한국 / 서울" or "South Korea". */
	label: string;
	/** How the location was inferred. */
	source: 'header' | 'tld' | 'siteMeta' | 'unknown';
}

/** Search-index permission snapshot for the target-entity meta card. */
export interface AuditIndexStatus {
	/** Combined robots.txt + meta robots + X-Robots-Tag. */
	allowed: boolean;
	robotsTxtOk: boolean;
	metaRobotsOk: boolean;
	/** Short evidence string for UI / debug. */
	evidence: string;
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
	/** High-res brand logo extracted from schema / header / icons / og:image. */
	logoUrl?: string;
	/** As-Is keywords crawled from meta / HTML / schema (alias of siteMeta.detectedKeywords). */
	detectedKeywords?: string[];
	/** Hosting region inferred from CDN headers / TLD / site signals. */
	serverLocation?: AuditServerLocation;
	/** Whether general search crawlers may index the audited URL. */
	indexStatus?: AuditIndexStatus;
	/** Whether `<meta name="viewport">` is present (mobile readability). */
	hasViewportMeta?: boolean;
	/** Live TLS / HTTPS on the audited origin (optional on legacy reports). */
	hasSsl?: boolean;
	/** CMS inferred from live HTML (Gnuboard JS globals / theme paths, WP, builders…). */
	cmsType?: string;
	metrics?: AuditMetrics;
	categories: AuditCategory[];
	/** Flat checklist (all category checks) for the detailed report grid. */
	checklist?: AuditCheckItem[];
	findings: AuditFinding[];
	/** Same-origin internal links (path + query) from the crawled page. */
	collectedUrls?: string[];
	/** GNB / header nav labels discovered on the audited page. */
	navItems?: NavLinkItem[];
	/** Footer / 사업자 정보 corpus for Organization.legalName (상호·법인명·(주)). */
	footerText?: string;
	/** Content-scoped Title/H1 for collected subpages (incl. board.php?bo_table=*). */
	pageMetas?: CrawledPageMeta[];
	/** Personalized C-level briefing from live scores + geo/industry keywords. */
	executiveSummary?: ExecutiveSummary;
	/** True after a GEO prescription apply event was recorded (scores stay measured). */
	isPrescriptionApplied?: boolean;
	/** ISO timestamp when the GEO prescription apply event was recorded. */
	prescriptionAppliedAt?: string;
	/** Whether `score` is a crawled measurement or a projected After-state. */
	scoreSource?: 'measured' | 'projected';
	/** Engine-index tracking after apply — does not change measured `score`. */
	trackingStatus?: 'SYNCING' | 'PENDING_INDEX' | 'TRACKING';
	/** Expected composite score after engines re-index (ghost-line guide only). */
	expectedScore?: number;
	/** Expected AI citation index after engines re-index (ghost-line guide only). */
	expectedCitationScore?: number;
	/** Live Naver/Google competitor names bound to Tab 1 SoV. */
	realCompetitors?: RealCompetitorSnapshot;
	/** URL after http→https / www redirect tracking. */
	finalUrl?: string;
	redirectChain?: Array<{ from: string; to: string; status: number }>;
	/** Live sitemap.xml check against the final origin. */
	sitemap?: SitemapCheckResult;
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
			label: 'SEO 기술 기본기',
			passNote: '메타·헤딩 기본기 양호',
			warnNote: '메타·헤딩 보완 필요',
			failNote: '핵심 메타/헤딩 구조 미흡',
			title: (len: number) => `<title> 길이 적정성 (${len}자 · 권장 10–60)`,
			metaDescription: (len: number) => `메타 디스크립션 (${len}자 · 권장 70–160)`,
			ogTags: 'Open Graph 3종 (title / description / image)',
			canonical: 'Canonical URL 명시 및 정합성',
			singleH1: (count: number) => `H1 태그 단일성 (${count}개 감지)`,
			headingSkip: '헤딩 계층 순서 (H1→H2→H3, 비약 없음)',
			https: HTTPS_P0_LABEL.ko,
		},
		security: {
			label: '보안 & 인프라',
			passNote: 'SSL·서버 응답 양호',
			warnNote: '보안/응답 속도 주의',
			failNote: 'SSL 또는 서버 응답 개선 필요',
		},
		performance: {
			label: '웹 성능 & 접근성',
			passNote: '문서 경량화·접근성 양호',
			warnNote: '용량/렌더 차단/alt 주의',
			failNote: '성능 또는 접근성 개선 필요',
			responseTime: (ms: number) => `서버 응답 속도 (${ms}ms < 1500ms)`,
			pageWeight: (kb: string) => `HTML 문서 용량 (${kb}KB < 1500KB)`,
			renderBlocking: (n: number) => `렌더링 차단 스크립트 (${n}개 · 권장 ≤5)`,
		},
		schema: {
			label: '스키마 구조화 데이터',
			passNote: '리치 결과·지식그래프 대응',
			warnNote: '스키마 일부 누락',
			failNote: '스키마 커버리지 부족',
			jsonldPresent: 'JSON-LD 블록 파싱 성공',
			organization: 'Organization 필수 속성 (name / url / logo / sameAs)',
			localEntity: 'LocalBusiness / 필수 속성 (name / url / telephone / address)',
			article: 'Article·NewsArticle 필수 속성',
			newsArticle: 'NewsArticle 스키마 (AI·Discover 인용에 유리)',
			pageSchema: 'AboutPage / MedicalWebPage 페이지 스키마',
			websiteSchema: 'WebSite / BreadcrumbList 보조 스키마',
			person: 'Person 저자 프로필 (E-E-A-T)',
		},
		accessibility: {
			label: '웹 접근성 & 태그',
			passNote: '접근성 기준 충족',
			warnNote: '접근성 보완 권고',
			failNote: '접근성 보완 필요',
			htmlLang: 'html lang 속성 명시',
			imageAlt: (pct: number, total: number, missing: number) =>
				`이미지 alt 커버리지 (${pct}% · ${missing}/${total} 누락)`,
			headingStructure: 'H1–H3 제목 구조 존재',
		},
		geo: {
			label: 'GEO & AI 인용 신호',
			passNote: 'AI 인용 신호 양호',
			warnNote: 'AI 인용 신호 보완 필요',
			failNote: 'AI 답변 인용 가능성 낮음',
			faqHowto: 'FAQPage / HowTo 인용 친화 스키마',
			aiBotsAllowed: 'GPTBot / PerplexityBot 차단 없음 (robots.txt)',
			crawlableText: (n: number) => `본문 텍스트 충분성 (${n}자 · 권장 ≥300)`,
			eeatAuthor: 'E-E-A-T 저자·발행자 지식그래프 신호',
			llmsTxt: '[GEO 표준] /llms.txt AI 전용 인덱스 파일 구비 여부',
		},
		why: {
			title: 'title은 SERP·소셜·AI 요약의 1차 식별자입니다.',
			metaDescription: '검색 스니펫 카피를 통제하지 못하면 CTR이 임의 문장에 좌우됩니다.',
			ogTags: '카카오/페이스북 등 공유 미리보기가 깨져 클릭 유도가 약해집니다.',
			canonical: '중복 URL이 색인되면 랭킹 신호가 분산됩니다.',
			singleH1: '다중/누락 H1은 주제 초점을 흐려 검색·AI 이해도를 떨어뜨립니다.',
			headingSkip: '헤딩 비약은 문서 아웃라인을 깨뜨려 접근성·시맨틱 SEO에 불리합니다.',
			https: 'http:// 비보안 프로토콜은 브라우저 경고·AI 엔진 인용 신뢰도를 동시에 무너뜨립니다. 무료 Let\'s Encrypt SSL을 즉시 적용하세요.',
			responseTime: '느린 TTFB는 이탈과 Core Web Vitals 악화로 이어집니다.',
			pageWeight: '과대 HTML은 파싱·렌더 비용을 키워 모바일 성능에 치명적입니다.',
			renderBlocking: '동기 스크립트는 First Paint를 지연시킵니다.',
			jsonld: '유효한 JSON-LD가 없으면 리치 결과와 AI 구조 이해가 불가능합니다.',
			organization: 'Organization 누락 필드는 브랜드 지식패널·sameAs 그래프를 약화시킵니다.',
			article: 'Article 필수 속성 부재 시 기사형 리치결과·AI 출처 인용이 어렵습니다.',
			newsArticle: 'NewsArticle은 Discover·뉴스성 AI 인용에 Article보다 유리합니다.',
			pageSchema: '일반 기업·병의원은 NewsArticle 대신 AboutPage 또는 MedicalWebPage로 공식 소개를 구조화해야 합니다.',
			website: 'WebSite/Breadcrumb는 사이트 계층과 sitelinks 신호를 보강합니다.',
			person: 'Person 프로필이 없으면 E-E-A-T 저자성이 증명되지 않습니다.',
			htmlLang: 'lang 부재는 언어 타겟팅·접근성 평가에 불리합니다.',
			imageAlt: 'alt 누락은 이미지 검색·스크린리더·멀티모달 AI 이해에 모두 불리합니다.',
			headingStructure: '제목 계층이 빈약하면 문서 토픽 추출이 어렵습니다.',
			faq: 'FAQ/HowTo는 Perplexity·ChatGPT Search의 인용 단위로 자주 채택됩니다.',
			robots: 'AI 크롤러 Disallow는 GEO 노출을 원천 차단합니다.',
			bodyText: '요약할 본문이 부족하면 AI가 인용할 근거 문단을 찾지 못합니다.',
			eeat: '저자·발행자 그래프가 없으면 AI가 신뢰 출처로 올리지 않습니다.',
			llmsTxt: '/llms.txt가 사이트 루트에 없어 GPTBot·Perplexity 등 AI 크롤러가 공식 사실 인덱스를 읽지 못합니다. 루트에 표준 마크다운을 배포하세요.',
		},
		impact: {
			title: '적정 title은 검색 클릭률과 AI 출처 라벨 정확도를 동시에 올립니다.',
			metaDescription: '의도한 스니펫으로 CTR 2배까지 끌어올린 사례가 흔합니다.',
			ogTags: '공유 트래픽·브랜드 인식이 즉시 개선됩니다.',
			canonical: '올바른 URL로 랭킹 권한을 집중시킬 수 있습니다.',
			singleH1: '주제 명확화로 상위 노출·AI 요약 일치율이 올라갑니다.',
			headingSkip: '시맨틱 아웃라인이 정리되면 섹션 단위 인용 확률이 높아집니다.',
			https: 'SSL 적용 시 보안 감점·등급 상한(Hard Cap)이 해제되고 AI 인용 신뢰도가 회복됩니다.',
			responseTime: '응답 개선은 이탈 감소와 순위 안정화로 이어집니다.',
			pageWeight: '문서 경량화는 LCP·모바일 SEO에 직접 기여합니다.',
			renderBlocking: '초기 렌더 가속은 체감 속도와 전환율을 높입니다.',
			jsonld: '구조화 데이터는 리치결과 배지와 AI 구조 파싱의 전제 조건입니다.',
			organization: 'logo·sameAs 완비 시 브랜드 엔티티 매칭 정확도가 상승합니다.',
			article: '필수 필드 충족 시 기사 카드·작성자 표시·AI 출처 인용이 가능해집니다.',
			newsArticle: 'NewsArticle 적용은 Discover·AI 뉴스성 답변 진입에 유리합니다.',
			pageSchema: 'AboutPage·MedicalWebPage 적용 시 병의원·기업 공식 페이지가 AI 정답 출처로 인용됩니다.',
			website: '사이트 계층이 명확해져 내부 페이지 이해도가 올라갑니다.',
			person: '검증된 저자 그래프는 E-E-A-T 방어력과 AI 신뢰 인용을 강화합니다.',
			htmlLang: '올바른 언어 타겟으로 국제 SEO 노이즈를 줄입니다.',
			imageAlt: '이미지 검색 유입과 접근성 컴플라이언스를 동시에 확보합니다.',
			headingStructure: '토픽 클러스터가 분명해져 롱테일 쿼리 매칭이 좋아집니다.',
			faq: '질문-답변 단위 인용으로 AI 답변 상단 노출 기회를 만듭니다.',
			robots: 'AI 봇 허용은 GEO 트래픽의 최소 조건입니다.',
			bodyText: '충분한 본문은 AI 요약·인용 문단의 원재료가 됩니다.',
			eeat: '저자성 신호 강화는 알고리즘 업데이트 내성으로 이어집니다.',
			llmsTxt: '/llms.txt는 상호·NAP·핵심 FAQ를 AI가 우선 인용하는 표준 진입점입니다.',
		},
		passWhy: {
			title: 'title 길이 기준(10–60자)을 안정적으로 충족하여 정상 통과되었습니다.',
			metaDescription: '메타 디스크립션 길이 기준(70–160자)을 안정적으로 충족하여 정상 통과되었습니다.',
			ogTags: 'Open Graph 3종(title / description / image)이 모두 확인되어 정상 통과되었습니다.',
			canonical: 'Canonical URL이 페이지 URL과 정합되어 중복 색인 기준을 충족, 정상 통과되었습니다.',
			singleH1: 'H1이 1개로 주제 초점이 명확하여 정상 통과되었습니다.',
			headingSkip: '헤딩 계층(H1→H2→H3)에 비약이 없어 정상 통과되었습니다.',
			https: 'HTTPS 보안 프로토콜이 적용되어 브라우저·AI 검색 신뢰 기준을 충족, 정상 통과되었습니다.',
			responseTime: '기준치(1500ms 미만)를 안정적으로 충족하여 정상 통과되었습니다.',
			pageWeight: '기준치(HTML 1500KB 미만)를 안정적으로 충족하여 정상 통과되었습니다.',
			renderBlocking: '기준치(렌더 차단 스크립트 5개 이하)를 충족하여 정상 통과되었습니다.',
			jsonld: '유효한 JSON-LD 블록이 파싱되어 구조화 데이터 기준을 충족, 정상 통과되었습니다.',
			organization: 'LocalBusiness/Organization의 name·url 및 NAP(telephone/address) 또는 logo·sameAs가 확인되어 정상 통과되었습니다.',
			article: 'Article/NewsArticle 필수 속성이 충족되어 정상 통과되었습니다.',
			newsArticle: 'NewsArticle 스키마가 확인되어 정상 통과되었습니다.',
			newsArticleNa:
				'이 업종은 NewsArticle이 필수 항목이 아니며, LocalBusiness/MedicalClinic 기준으로 정상 통과되었습니다.',
			pageSchema: 'AboutPage 또는 MedicalWebPage가 확인되어 페이지 스키마 기준을 충족, 정상 통과되었습니다.',
			website: 'WebSite 또는 BreadcrumbList가 확인되어 보조 스키마 기준을 충족, 정상 통과되었습니다.',
			person: 'Person 저자/대표 프로필 식별자가 확인되어 정상 통과되었습니다.',
			htmlLang: 'html lang 속성이 명시되어 정상 통과되었습니다.',
			imageAlt: '이미지 alt 커버리지 기준(80% 이상)을 충족하여 정상 통과되었습니다.',
			headingStructure: 'H1–H3 제목 구조가 존재하여 정상 통과되었습니다.',
			faq: 'FAQPage/HowTo 스키마가 확인되어 GEO 인용 기준을 충족, 정상 통과되었습니다.',
			robots: 'GPTBot/PerplexityBot 등 AI 크롤러가 차단되지 않아 정상 통과되었습니다.',
			bodyText: '본문 텍스트 기준(300자 이상)을 충족하여 정상 통과되었습니다.',
			eeat: 'Person·Organization 지식그래프 신호가 확인되어 정상 통과되었습니다.',
			llmsTxt: '/llms.txt가 사이트 루트에서 확인되어 AI 전용 인덱스 기준을 충족, 정상 통과되었습니다.',
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
			label: 'SEO Technical Fundamentals',
			passNote: 'Meta & heading fundamentals look solid',
			warnNote: 'Meta & heading need attention',
			failNote: 'Core meta/heading structure is weak',
			title: (len: number) => `<title> length (${len} chars · ideal 10–60)`,
			metaDescription: (len: number) => `Meta description (${len} chars · ideal 70–160)`,
			ogTags: 'Open Graph trio (title / description / image)',
			canonical: 'Canonical URL present & coherent',
			singleH1: (count: number) => `Single H1 (${count} detected)`,
			headingSkip: 'Heading hierarchy (no H1→H3 skips)',
			https: HTTPS_P0_LABEL.en,
		},
		security: {
			label: 'Security & Infrastructure',
			passNote: 'SSL and server response look healthy',
			warnNote: 'Security/response needs attention',
			failNote: 'SSL or server response needs improvement',
		},
		performance: {
			label: 'Web Performance & Accessibility',
			passNote: 'Document weight & accessibility look healthy',
			warnNote: 'Size/render-blocking/alt needs attention',
			failNote: 'Performance or accessibility needs improvement',
			responseTime: (ms: number) => `Server response time (${ms}ms < 1500ms)`,
			pageWeight: (kb: string) => `HTML size (${kb}KB < 1500KB)`,
			renderBlocking: (n: number) => `Render-blocking scripts (${n} · ideal ≤5)`,
		},
		schema: {
			label: 'Structured Data (Schema)',
			passNote: 'Rich-result & knowledge-graph ready',
			warnNote: 'Schema coverage is incomplete',
			failNote: 'Schema coverage is insufficient',
			jsonldPresent: 'JSON-LD blocks parsed successfully',
			organization: 'Organization required fields (name / url / logo / sameAs)',
			localEntity: 'LocalBusiness required fields (name / url / telephone / address)',
			article: 'Article / NewsArticle required fields',
			newsArticle: 'NewsArticle schema (better for AI & Discover)',
			pageSchema: 'AboutPage / MedicalWebPage page schema',
			websiteSchema: 'WebSite / BreadcrumbList support schemas',
			person: 'Person author profile (E-E-A-T)',
		},
		accessibility: {
			label: 'Web Accessibility & Tags',
			passNote: 'Meets accessibility baseline',
			warnNote: 'Accessibility needs attention',
			failNote: 'Accessibility needs work',
			htmlLang: 'html lang attribute present',
			imageAlt: (pct: number, total: number, missing: number) =>
				`Image alt coverage (${pct}% · ${missing}/${total} missing)`,
			headingStructure: 'H1–H3 heading structure present',
		},
		geo: {
			label: 'GEO & AI Citation Signals',
			passNote: 'Strong AI citation signals',
			warnNote: 'AI citation signals need work',
			failNote: 'Low chance of AI answer citation',
			faqHowto: 'FAQPage / HowTo citation-friendly schema',
			aiBotsAllowed: 'GPTBot / PerplexityBot not blocked (robots.txt)',
			crawlableText: (n: number) => `Body text sufficiency (${n} chars · ideal ≥300)`,
			eeatAuthor: 'E-E-A-T author/publisher knowledge-graph signals',
			llmsTxt: '[GEO standard] /llms.txt AI-only index file present',
		},
		why: {
			title: 'Title is the primary identifier for SERPs, social, and AI summaries.',
			metaDescription: 'Without a controlled snippet, CTR depends on random on-page text.',
			ogTags: 'Broken share previews on Kakao/Facebook kill referral clicks.',
			canonical: 'Duplicate URLs split ranking authority.',
			singleH1: 'Missing/multiple H1s blur topical focus for search and AI.',
			headingSkip: 'Heading skips break the outline used by a11y tools and semantic SEO.',
			https: 'Plain HTTP triggers browser warnings and collapses AI-engine citation trust. Apply free Let\'s Encrypt SSL immediately.',
			responseTime: 'Slow TTFB drives bounce and hurts Core Web Vitals.',
			pageWeight: 'Heavy HTML raises parse/render cost on mobile.',
			renderBlocking: 'Sync scripts delay First Paint.',
			jsonld: 'Without valid JSON-LD, rich results and structured AI parsing fail.',
			organization: 'Missing Organization fields weaken brand entity matching.',
			article: 'Incomplete Article fields block article rich results and AI citations.',
			newsArticle: 'NewsArticle outperforms generic Article for Discover/AI news answers.',
			pageSchema: 'Clinics and ordinary businesses should use AboutPage or MedicalWebPage — not NewsArticle — as the page schema.',
			website: 'WebSite/Breadcrumb reinforce site hierarchy and sitelinks signals.',
			person: 'Without Person profiles, author E-E-A-T cannot be proven.',
			htmlLang: 'Missing lang hurts language targeting and accessibility scoring.',
			imageAlt: 'Missing alt hurts image search, screen readers, and multimodal AI.',
			headingStructure: 'Thin heading trees make topic extraction harder.',
			faq: 'FAQ/HowTo blocks are frequently cited by Perplexity and ChatGPT Search.',
			robots: 'Disallowing AI crawlers blocks GEO visibility at the source.',
			bodyText: 'Too little body text leaves AI with nothing citable.',
			eeat: 'Without author/publisher graphs, AI rarely elevates the source.',
			llmsTxt: '/llms.txt is missing at the site root, so GPTBot and Perplexity cannot read an official fact index. Publish the standard markdown at the origin root.',
		},
		impact: {
			title: 'A precise title lifts SERP CTR and AI source-label accuracy together.',
			metaDescription: 'Owned snippets routinely double CTR versus auto excerpts.',
			ogTags: 'Share traffic and brand recognition improve immediately.',
			canonical: 'Concentrate ranking equity on the preferred URL.',
			singleH1: 'Clear topical focus improves rankings and AI summary fidelity.',
			headingSkip: 'A clean outline raises section-level citation odds.',
			https: 'Enabling SSL lifts the security penalty and the S/A grade hard cap, restoring AI citation trust.',
			responseTime: 'Faster responses reduce bounce and stabilize rankings.',
			pageWeight: 'Lighter documents improve LCP and mobile SEO.',
			renderBlocking: 'Faster first paint boosts perceived speed and conversion.',
			jsonld: 'Structured data is the prerequisite for rich badges and AI parsing.',
			organization: 'Complete logo/sameAs improves brand entity resolution.',
			article: 'Required fields unlock article cards, bylines, and AI citations.',
			newsArticle: 'NewsArticle improves Discover and AI news-answer entry.',
			pageSchema: 'AboutPage or MedicalWebPage lets AI cite the official clinic/business page as a source.',
			website: 'Clearer site hierarchy improves understanding of inner pages.',
			person: 'Verified author graphs strengthen E-E-A-T and trusted AI citations.',
			htmlLang: 'Correct language targeting reduces international SEO noise.',
			imageAlt: 'Win image-search traffic and accessibility compliance together.',
			headingStructure: 'Clearer topic clusters improve long-tail query matching.',
			faq: 'Q&A units create top-of-answer citation opportunities.',
			robots: 'Allowing AI bots is the minimum bar for GEO traffic.',
			bodyText: 'Enough prose supplies the raw material for AI summaries.',
			eeat: 'Stronger authorship signals improve algorithm-update resilience.',
			llmsTxt: '/llms.txt is the standard entry point for brand, NAP, and core FAQ citation.',
		},
		passWhy: {
			title: 'Title length (10–60 characters) stably meets the threshold and passed.',
			metaDescription: 'Meta description length (70–160 characters) stably meets the threshold and passed.',
			ogTags: 'Open Graph title, description, and image are all present and passed.',
			canonical: 'Canonical URL matches the page URL, so duplicate-index risk is cleared and passed.',
			singleH1: 'Exactly one H1 keeps topical focus clear and passed.',
			headingSkip: 'Heading hierarchy has no H1→H3 skips and passed.',
			https: 'HTTPS is enabled, so the browser and AI-search trust bar is met and passed.',
			responseTime: 'Server response stably meets the threshold (under 1500ms) and passed.',
			pageWeight: 'HTML size stably meets the threshold (under 1500KB) and passed.',
			renderBlocking: 'Render-blocking scripts meet the threshold (≤5) and passed.',
			jsonld: 'Valid JSON-LD blocks parsed successfully and passed.',
			organization: 'LocalBusiness/Organization name, url, and NAP (telephone/address) or logo/sameAs are present and passed.',
			article: 'Article/NewsArticle required fields are complete and passed.',
			newsArticle: 'NewsArticle schema is present and passed.',
			newsArticleNa:
				'NewsArticle is not required for this vertical; LocalBusiness/MedicalClinic criteria are used and this item passed.',
			pageSchema: 'AboutPage or MedicalWebPage is present, so the page-schema bar is met and passed.',
			website: 'WebSite or BreadcrumbList is present, so the support-schema bar is met and passed.',
			person: 'Person author/director identifiers are present and passed.',
			htmlLang: 'The html lang attribute is present and passed.',
			imageAlt: 'Image alt coverage meets the threshold (80%+) and passed.',
			headingStructure: 'H1–H3 heading structure is present and passed.',
			faq: 'FAQPage/HowTo schema is present, so the GEO citation bar is met and passed.',
			robots: 'AI crawlers such as GPTBot/PerplexityBot are not blocked and passed.',
			bodyText: 'Body text meets the threshold (300+ characters) and passed.',
			eeat: 'Person and Organization knowledge-graph signals are present and passed.',
			llmsTxt: '/llms.txt is present at the site root, so the AI index bar is met and passed.',
		},
	},
} satisfies Record<AuditLang, unknown>;

function checklistWeight(id: string, fallback: number): number {
	return checklistWeightForEngineId(id) ?? fallback;
}

function check(
	id: string,
	label: string,
	status: AuditCheckStatus,
	weight: number,
	extra?: Pick<AuditCheckItem, 'evidence' | 'why' | 'impact'> & { passWhy?: string },
): AuditCheckItem {
	const { passWhy, why, ...rest } = extra ?? {};
	return {
		id,
		label,
		status,
		passed: status === 'pass',
		weight,
		...rest,
		why: status === 'pass' && passWhy ? passWhy : why,
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

function categoryScore(checks: AuditCheckItem[]) {
	const maxScore = checks.reduce((sum, c) => sum + (Number.isFinite(c.weight) ? c.weight : 0), 0);
	const score = checks.reduce((sum, c) => sum + earnedScoreForItem(c), 0);
	const rawScore = clampEarned(score, maxScore);
	const { defectCount, warningCount } = countCheckVerdicts(checks);
	const status = auditStatusToStored(
		resolveAuditStatus(normalizeTo100(rawScore, maxScore), defectCount, warningCount),
	);
	return {
		score: rawScore,
		maxScore,
		status,
	};
}

function categoryStatusNote(
	id: string,
	status: AuditCategoryStatus,
	lang: AuditLang,
	fallback: { passNote: string; warnNote?: string; failNote: string },
): string {
	if (isDiagnosticCategoryId(id)) {
		const key = status === 'PASS' ? 'pass' : status === 'WARN' ? 'warning' : 'fail';
		return CATEGORY_STATUS_TEXT[id as DiagnosticCategoryId][lang][key];
	}
	if (status === 'PASS') return fallback.passNote;
	if (status === 'WARN') return fallback.warnNote ?? fallback.failNote;
	return fallback.failNote;
}

const COUNTRY_LABELS: Record<string, { ko: string; en: string }> = {
	KR: { ko: '한국', en: 'South Korea' },
	JP: { ko: '일본', en: 'Japan' },
	US: { ko: '미국', en: 'United States' },
	CN: { ko: '중국', en: 'China' },
	TW: { ko: '대만', en: 'Taiwan' },
	HK: { ko: '홍콩', en: 'Hong Kong' },
	SG: { ko: '싱가포르', en: 'Singapore' },
	DE: { ko: '독일', en: 'Germany' },
	GB: { ko: '영국', en: 'United Kingdom' },
	AU: { ko: '호주', en: 'Australia' },
	VN: { ko: '베트남', en: 'Vietnam' },
	TH: { ko: '태국', en: 'Thailand' },
	ID: { ko: '인도네시아', en: 'Indonesia' },
	IN: { ko: '인도', en: 'India' },
	FR: { ko: '프랑스', en: 'France' },
	CA: { ko: '캐나다', en: 'Canada' },
};

function countryCodeFromHeaders(headers: Record<string, string>): string | null {
	for (const key of [
		'cf-ipcountry',
		'x-vercel-ip-country',
		'cloudfront-viewer-country',
		'x-country-code',
		'x-geo-country',
	]) {
		const raw = (headers[key] || '').toUpperCase();
		if (/^[A-Z]{2}$/.test(raw) && raw !== 'XX' && raw !== 'T1') return raw;
	}
	return null;
}

function countryCodeFromTld(hostname: string): string | null {
	const host = hostname.toLowerCase().replace(/\.$/, '');
	if (host.endsWith('.kr') || host.endsWith('.co.kr') || host.endsWith('.or.kr') || host.endsWith('.go.kr')) {
		return 'KR';
	}
	if (host.endsWith('.jp')) return 'JP';
	if (host.endsWith('.cn')) return 'CN';
	if (host.endsWith('.tw')) return 'TW';
	if (host.endsWith('.sg')) return 'SG';
	if (host.endsWith('.de')) return 'DE';
	if (host.endsWith('.uk') || host.endsWith('.co.uk')) return 'GB';
	if (host.endsWith('.au')) return 'AU';
	if (host.endsWith('.vn')) return 'VN';
	if (host.endsWith('.th')) return 'TH';
	if (host.endsWith('.id')) return 'ID';
	if (host.endsWith('.in')) return 'IN';
	if (host.endsWith('.fr')) return 'FR';
	if (host.endsWith('.ca')) return 'CA';
	return null;
}

function resolveServerLocation(args: {
	headers: Record<string, string>;
	hostname: string;
	siteMeta?: SiteMetadata;
	lang: AuditLang;
}): AuditServerLocation {
	const headerCode = countryCodeFromHeaders(args.headers);
	const tldCode = countryCodeFromTld(args.hostname);
	const cityHint = (args.siteMeta?.broadLocation || args.siteMeta?.location || '').trim();
	const code = headerCode || tldCode || '';
	const source: AuditServerLocation['source'] = headerCode
		? 'header'
		: tldCode
			? 'tld'
			: 'unknown';

	if (!code) {
		// Business locality is not hosting geo — only use as soft fallback label.
		if (cityHint) {
			return {
				countryCode: '—',
				label: args.lang === 'ko' ? `추정 · ${cityHint}` : `Est. · ${cityHint}`,
				source: 'siteMeta',
			};
		}
		return {
			countryCode: '—',
			label: args.lang === 'ko' ? '위치 미확인' : 'Unknown region',
			source: 'unknown',
		};
	}

	const country = COUNTRY_LABELS[code];
	const countryName = country ? (args.lang === 'ko' ? country.ko : country.en) : code;
	const label =
		cityHint && (code === 'KR' || /[가-힣]/.test(cityHint))
			? `${countryName} / ${cityHint}`
			: countryName;

	return { countryCode: code, label, source };
}

/** True when a robots User-agent block effectively Disallow: / the whole site. */
function robotsTxtBlocksAll(robotsText: string): boolean {
	const normalized = robotsText.replace(/\r/g, '\n').toLowerCase();
	if (!normalized.trim()) return false;

	const blocks = normalized.split(/(?=user-agent\s*:)/i);
	let starBlocked = false;
	let anyBlocked = false;

	for (const block of blocks) {
		if (!/user-agent\s*:/i.test(block)) continue;
		const agents = [...block.matchAll(/user-agent\s*:\s*([^\n#]+)/gi)].map((m) => m[1].trim());
		const disallowAll = /disallow\s*:\s*\/\s*(?:#|$)/m.test(block);
		if (!disallowAll) continue;
		if (agents.some((a) => a === '*')) starBlocked = true;
		if (agents.some((a) => a === 'googlebot' || a === 'bingbot' || a === 'yandex')) anyBlocked = true;
	}

	return starBlocked || anyBlocked;
}

function metaRobotsAllowsIndex($: CheerioAPI, xRobotsTag?: string): boolean {
	const metaContent = ($('meta[name="robots"]').attr('content') || '').toLowerCase();
	const googlebot = ($('meta[name="googlebot"]').attr('content') || '').toLowerCase();
	const header = (xRobotsTag || '').toLowerCase();
	const blob = [metaContent, googlebot, header].filter(Boolean).join(',');
	if (!blob) return true;
	return !/\bnoindex\b/.test(blob);
}

function resolveIndexStatus(args: {
	robotsText: string;
	robotsOk: boolean;
	$: CheerioAPI;
	xRobotsTag?: string;
}): AuditIndexStatus {
	const robotsTxtOk = args.robotsOk ? !robotsTxtBlocksAll(args.robotsText) : true;
	const metaRobotsOk = metaRobotsAllowsIndex(args.$, args.xRobotsTag);
	const allowed = robotsTxtOk && metaRobotsOk;
	const parts: string[] = [];
	if (!args.robotsOk) parts.push('robots.txt unreachable (assumed open)');
	else parts.push(robotsTxtOk ? 'robots.txt allows crawl' : 'robots.txt Disallow:/');
	parts.push(metaRobotsOk ? 'meta/X-Robots index OK' : 'noindex directive');
	return {
		allowed,
		robotsTxtOk,
		metaRobotsOk,
		evidence: parts.join(' · '),
	};
}

export interface AuditSiteOptions {
	/** Bypass CDN/proxy & prior HTML caches; append `?_redue_nocache=` on fetches. */
	forceRefresh?: boolean;
}

function truncate(value: string, max = 96): string {
	const cleaned = value.replace(/\s+/g, ' ').trim();
	return cleaned.length > max ? `${cleaned.slice(0, max)}…` : cleaned;
}

function computeGeoCitationScore(args: {
	schema: PageParseResult['schema'];
	aiBotsBlocked: boolean;
	bodyTextLength: number;
	organizationComplete: boolean;
	personComplete: boolean;
	newsVertical?: boolean;
}): number {
	let score = 0;
	if (args.schema.hasFaqOrHowTo) score += 25;
	if (!args.aiBotsBlocked) score += 20;
	if (args.bodyTextLength >= 300) score += 15;
	if (args.newsVertical) {
		if (args.schema.hasNewsArticle) score += 15;
		else if (args.schema.hasArticle) score += 8;
	} else if (args.schema.hasMedicalWebPage || args.schema.hasAboutPage) {
		score += 15;
	} else if (args.schema.hasArticle || args.schema.hasWebPage) {
		score += 8;
	}
	if (args.personComplete) score += 15;
	if (args.organizationComplete) score += 10;
	return Math.min(100, score);
}

function buildSeoChecks(
	S: Strings,
	parsed: PageParseResult,
	pageUrl: string,
	crawl?: { sitemapOk?: boolean; robotsOk?: boolean; robotsBlocksAll?: boolean },
): AuditCheckItem[] {
	const { meta, headings } = parsed;
	const titleOk = meta.titleLength >= 10 && meta.titleLength <= 60;
	const titleWarn = meta.titleLength > 0 && !titleOk;
	const descOk = meta.metaDescriptionLength >= 70 && meta.metaDescriptionLength <= 160;
	const descWarn = meta.metaDescriptionLength > 0 && !descOk;
	const ogOk = Boolean(meta.ogTitle && meta.ogDescription && meta.ogImage);
	const canOk = Boolean(meta.canonical) && canonicalMatches(pageUrl, meta.canonical);
	const crawlBlocked = crawl?.robotsBlocksAll === true;
	const discoveryGap = crawl?.sitemapOk === false && crawl?.robotsOk === false;
	const canWarn = (Boolean(meta.canonical) && !canOk) || (canOk && (crawlBlocked || discoveryGap));

	return [
		check(
			'title',
			S.seo.title(meta.titleLength),
			titleOk ? 'pass' : titleWarn ? 'warning' : 'fail',
			checklistWeight('title', 5),
			{
				evidence: meta.title
					? `<title>${truncate(meta.title, 70)}</title>`
					: '— <title> not found',
				why: S.why.title,
				passWhy: S.passWhy.title,
				impact: S.impact.title,
			},
		),
		check(
			'meta-description',
			S.seo.metaDescription(meta.metaDescriptionLength),
			descOk ? 'pass' : descWarn ? 'warning' : 'fail',
			checklistWeight('meta-description', 5),
			{
				evidence: meta.metaDescription
					? `content="${truncate(meta.metaDescription, 90)}"`
					: '— meta[name=description] missing',
				why: S.why.metaDescription,
				passWhy: S.passWhy.metaDescription,
				impact: S.impact.metaDescription,
			},
		),
		check('og-tags', S.seo.ogTags, ogOk ? 'pass' : 'fail', checklistWeight('og-tags', 5), {
			evidence: ogOk
				? `og:title ✓ · og:description ✓ · og:image ✓`
				: `missing: ${[!meta.ogTitle && 'og:title', !meta.ogDescription && 'og:description', !meta.ogImage && 'og:image'].filter(Boolean).join(', ')}`,
			why: S.why.ogTags,
			passWhy: S.passWhy.ogTags,
			impact: S.impact.ogTags,
		}),
		check('canonical', S.seo.canonical, canOk && !canWarn ? 'pass' : canWarn ? 'warning' : 'fail', checklistWeight('canonical', 5), {
			evidence: (() => {
				const sitemapBit = crawl?.sitemapOk ? 'sitemap ✓' : 'sitemap ✗';
				const robotsBit = crawl?.robotsOk ? 'robots.txt ✓' : 'robots.txt ✗';
				if (!meta.canonical) return `— canonical link missing · ${sitemapBit} · ${robotsBit}`;
				const result = evaluateCanonicalAccuracy(meta.canonical, pageUrl);
				if (result.status === 'PASS') {
					return `rel=canonical href="${truncate(result.canonical, 80)}" · ${sitemapBit} · ${robotsBit}`;
				}
				if ('extracted' in result) {
					return `rel=canonical href="${truncate(result.extracted, 60)}" (expected ${truncate(result.expected, 40)}) · ${sitemapBit}`;
				}
				return `rel=canonical href="${truncate(meta.canonical, 80)}" · ${sitemapBit}`;
			})(),
			why: S.why.canonical,
			passWhy: S.passWhy.canonical,
			impact: S.impact.canonical,
		}),
		check(
			'single-h1',
			S.seo.singleH1(headings.h1Count),
			headings.h1Count === 1 ? 'pass' : headings.h1Count === 0 ? 'fail' : 'warning',
			checklistWeight('single-h1', 4),
			{
				evidence:
					headings.h1Count === 0
						? '— no <h1> detected'
						: headings.h1Texts.map((t, i) => `H1#${i + 1}: "${truncate(t, 48)}"`).join(' · '),
				why: S.why.singleH1,
				passWhy: S.passWhy.singleH1,
				impact: S.impact.singleH1,
			},
		),
		check(
			'heading-skip',
			S.seo.headingSkip,
			!headings.hasSkip ? 'pass' : 'warning',
			checklistWeight('heading-skip', 3),
			{
				evidence: headings.hasSkip
					? `skip detected: ${headings.skipExamples.join(', ')}`
					: `levels: ${headings.levels.slice(0, 12).map((l) => `H${l}`).join(' → ') || '—'}`,
				why: S.why.headingSkip,
				passWhy: S.passWhy.headingSkip,
				impact: S.impact.headingSkip,
			},
		),
		check('html-lang', S.accessibility.htmlLang, parsed.meta.htmlLang ? 'pass' : 'fail', checklistWeight('html-lang', 2), {
			evidence: parsed.meta.htmlLang ? `<html lang="${parsed.meta.htmlLang}">` : '— lang attribute missing',
			why: S.why.htmlLang,
			passWhy: S.passWhy.htmlLang,
			impact: S.impact.htmlLang,
		}),
	];
}

function buildSchemaChecks(
	S: Strings,
	parsed: PageParseResult,
	siteMeta?: SiteMetadata,
	lang: AuditLang = 'ko',
): AuditCheckItem[] {
	const { schema } = parsed;
	const orgComplete = schema.hasOrganization && schema.organizationMissing.length === 0;
	const articleComplete = (schema.hasArticle || schema.hasNewsArticle) && schema.articleMissing.length === 0;
	const mapping = {
		industry: siteMeta?.category,
		category: siteMeta?.category,
		siteTitle: siteMeta?.title,
		brandName: siteMeta?.brandName,
		domain: siteMeta?.domain,
		primaryKeyword: siteMeta?.primaryKeyword,
		industryType: siteMeta?.industryType,
		schemaTypes: schema.types,
	};
	const newsVertical = isNewsMediaVertical(mapping);
	const vertical = detectSchemaVertical(mapping);
	const medicalLike =
		vertical === 'medical-clinic' || vertical === 'medical-hospital' || vertical === 'dental';
	const pageAltOk = hasPageSchemaAlternative(schema.types, vertical) || schema.hasAboutPage || schema.hasMedicalWebPage;
	const coreEntityCopy = coreEntityItemCopy(vertical, lang);
	const hasCoreEntity =
		hasCoreEntitySchema(schema.types, vertical) || orgComplete || pageAltOk;
	const articleOrPageOk = newsVertical
		? articleComplete
		: articleComplete || pageAltOk;
	const entityLabel = newsVertical ? S.schema.organization : S.schema.localEntity;
	const entityTypes = schema.types.filter((t) =>
		/Organization|LocalBusiness|MedicalClinic|MedicalBusiness|Hospital|Dentist|Physician|VeterinaryCare|LegalService|Attorney|AccountingService|BeautySalon|HealthClub|ExerciseGym|EducationalOrganization|RealEstateAgent|Restaurant|ProfessionalService|HomeAndConstructionBusiness/i.test(
			t,
		),
	);
	const entityName = entityTypes[0] || (medicalLike ? 'MedicalClinic' : 'LocalBusiness');

	return [
		check(
			'jsonld-present',
			S.schema.jsonldPresent,
			schema.validBlockCount > 0 ? 'pass' : 'fail',
			checklistWeight('jsonld-present', 8),
			{
				evidence: `blocks=${schema.rawBlockCount}, parsed_nodes=${schema.validBlockCount}, parse_errors=${schema.parseErrors}${
					schema.types.length ? ` · types=[${schema.types.join(', ')}]` : ''
				}`,
				why: S.why.jsonld,
				passWhy: S.passWhy.jsonld,
				impact: S.impact.jsonld,
			},
		),
		check(
			'organization',
			entityLabel,
			orgComplete ? 'pass' : schema.hasOrganization ? 'warning' : 'fail',
			checklistWeight('organization', 7),
			{
				evidence: schema.hasOrganization
					? schema.organizationMissing.length
						? `${entityName} present · missing: ${schema.organizationMissing.join(', ')}`
						: `${entityName} · name/url/NAP ✓`
					: `— ${entityName} / Organization schema not found`,
				why: S.why.organization,
				passWhy: S.passWhy.organization,
				impact: S.impact.organization,
			},
		),
		check(
			'article-fields',
			newsVertical ? S.schema.article : S.schema.pageSchema,
			articleOrPageOk
				? 'pass'
				: newsVertical
					? schema.hasArticle || schema.hasNewsArticle
						? 'warning'
						: 'fail'
					: 'warning',
			checklistWeight('article-fields', 6),
			{
				evidence: newsVertical
					? schema.hasArticle || schema.hasNewsArticle
						? schema.articleMissing.length
							? `Article-like schema present · missing: ${schema.articleMissing.join(', ')}`
							: 'Article/NewsArticle required fields ✓'
						: '— Article / NewsArticle not found'
					: pageAltOk
						? `AboutPage=${schema.hasAboutPage ? '✓' : '✗'} · MedicalWebPage=${schema.hasMedicalWebPage ? '✓' : '✗'}`
						: schema.hasArticle || schema.hasNewsArticle
							? schema.articleMissing.length
								? `Article-like schema present · missing: ${schema.articleMissing.join(', ')}`
								: 'Article fields ✓ (optional for this vertical)'
							: '— AboutPage / MedicalWebPage not found (optional support schema)',
				why: newsVertical ? S.why.article : S.why.pageSchema,
				passWhy: newsVertical ? S.passWhy.article : S.passWhy.pageSchema,
				impact: newsVertical ? S.impact.article : S.impact.pageSchema,
			},
		),
		check(
			'news-article',
			newsVertical ? S.schema.newsArticle : coreEntityCopy.label,
			newsVertical
				? schema.hasNewsArticle
					? 'pass'
					: schema.hasArticle
						? 'warning'
						: 'fail'
				: hasCoreEntity
					? 'pass'
					: 'warning',
			checklistWeight('news-article', 5),
			{
				evidence: newsVertical
					? schema.hasNewsArticle
						? 'NewsArticle detected'
						: schema.hasArticle
							? 'Generic Article only — prefer NewsArticle for news/insight pages'
							: 'NewsArticle missing'
					: hasCoreEntity
						? `core entity: ${entityTypes.join(', ') || entityName}`
						: `core entity missing · expected ${coreEntityCopy.label}`,
				why: newsVertical ? S.why.newsArticle : coreEntityCopy.why,
				passWhy: newsVertical ? S.passWhy.newsArticle : coreEntityCopy.passWhy,
				impact: newsVertical ? S.impact.newsArticle : S.impact.pageSchema,
			},
		),
		check(
			'website-schema',
			S.schema.websiteSchema,
			schema.hasWebSite || schema.hasBreadcrumb ? 'pass' : 'warning',
			checklistWeight('website-schema', 4),
			{
				evidence: `WebSite=${schema.hasWebSite ? '✓' : '✗'} · BreadcrumbList=${schema.hasBreadcrumb ? '✓' : '✗'}`,
				why: S.why.website,
				passWhy: S.passWhy.website,
				impact: S.impact.website,
			},
		),
	];
}

/**
 * Fetches live HTML + robots.txt and runs a precision, LLM-free SEO/GEO audit.
 * When `forceRefresh` is set, outbound fetches append `?_redue_nocache=` and send no-cache headers.
 */
export async function auditSite(
	targetUrl: string,
	lang: AuditLang = 'ko',
	options?: AuditSiteOptions,
): Promise<AuditReport> {
	const S = STRINGS[lang];
	const url = await assertPublicHttpUrl(targetUrl);
	const forceRefresh = options?.forceRefresh === true;
	const fetchOpts = { forceRefresh };

	const page = await fetchPageResource(url.toString(), {
		timeoutMs: FETCH_TIMEOUT_MS,
		forceRefresh,
	});
	let finalUrl = url;
	try {
		finalUrl = new URL(page.finalUrl || url.toString());
	} catch {
		finalUrl = url;
	}
	const origin = finalUrl.origin;
	const [robots, llms] = await Promise.all([
		fetchPageResource(new URL('/robots.txt', origin).toString(), {
			timeoutMs: 5000,
			forceRefresh,
			accept: 'text/plain,text/*;q=0.8,*/*;q=0.4',
			skipSsrf: true,
			maxChars: 200_000,
		}),
		fetchPageResource(new URL('/llms.txt', origin).toString(), {
			timeoutMs: 4000,
			forceRefresh,
			accept: 'text/plain,text/*;q=0.8,*/*;q=0.4',
			skipSsrf: true,
			maxChars: 80_000,
		}),
	]);
	const sitemapResult = await fetchSitemapCheck(origin, robots.text, fetchOpts);
	const hasLlmsTxt = isLlmsTxtDocument(llms.text, llms.status);
	const llmsTxtEvidence = hasLlmsTxt
		? `GET /llms.txt — ${llms.status ?? '200'} · ${llms.bytes}B`
		: `GET /llms.txt — ${llms.status ?? 'unreachable'}`;

	const html = page.text || '<html></html>';
	const $ = cheerio.load(html);
	const parsed = parsePageHtml($, finalUrl.toString(), undefined, html);
	const siteMeta = extractSiteMetadata($, finalUrl.toString(), lang, html);
	const logoTask = resolveSiteLogo(html, finalUrl.toString(), siteMeta.domain, {
		$,
		ogImage: siteMeta.ogImage,
	}).catch((error) => {
		console.error('[auditSite] deep logo resolve failed:', error);
		return siteMeta.logoUrl ?? null;
	});
	const pageSpecificTitle = sanitizeMainPageTitle(
		splitPageTitle(parsed.meta.title, siteMeta.brandName) ||
			parsed.meta.pageTitle ||
			parsed.meta.title,
		siteMeta.brandName || 'Site',
	);
	const scopedMainH1 = sanitizeMainPageTitle(
		parsed.headings.h1Texts[0] || pageSpecificTitle,
		siteMeta.brandName || pageSpecificTitle,
	);
	const navItems = extractNavItems($, finalUrl.toString());
	const footerText = extractFooterLegalText($);
	const competitorRegion = siteMeta.location || siteMeta.broadLocation;
	const competitorIndustry = resolveIndustryConfigFromSite({
		lang,
		brandName: siteMeta.brandName,
		location: competitorRegion,
		primaryKeyword: siteMeta.primaryKeyword,
		category: siteMeta.category,
		services: siteMeta.coreSpecialties,
		domain: siteMeta.domain,
		url: finalUrl.toString(),
		legacyIndustry: siteMeta.industryType,
		title: siteMeta.title,
		description: siteMeta.metaDescription || siteMeta.ogDescription,
		keywords: siteMeta.metaKeywords,
		schemaTypes: siteMeta.schemaEntityTypes,
		navMenuTexts: siteMeta.navMenuTexts,
	});
	const competitorMainService =
		siteMeta.coreSpecialties?.[0] ||
		siteMeta.primaryKeyword ||
		siteMeta.category ||
		competitorIndustry.mainService;
	const competitorPresets = generateQueryMatrix({
		lang,
		siteMeta,
		brandName: siteMeta.brandName,
		category: siteMeta.category,
		primaryKeyword: competitorMainService,
		location: competitorRegion,
		coreSpecialties: siteMeta.coreSpecialties,
		schemaTypes: siteMeta.schemaEntityTypes,
		ogTitle: siteMeta.ogTitle,
		title: siteMeta.title,
		detectedKeywords: siteMeta.detectedKeywords,
		jsonLdSnippets: parsed.schema.snippets,
	}).sovPresets;
	const competitorTask = fetchRealCompetitorSnapshot({
		clientName: siteMeta.brandName,
		region: competitorRegion,
		mainService: competitorMainService,
		categoryName: siteMeta.category,
		lang,
		query: competitorPresets[0] || competitorPresets[1],
	}).catch((error) => {
		console.error('[auditSite] live competitor fetch failed:', error);
		return undefined;
	});
	const pageMetas = await crawlCollectedPageMetas({
		origin: finalUrl.origin,
		mainUrl: finalUrl.toString(),
		collectedUrls: parsed.internalLinks,
		siteName: siteMeta.brandName,
		mainTitle: pageSpecificTitle,
		mainDescription: parsed.meta.metaDescription,
		navItems,
		forceRefresh,
	});

	const aiBotAccess = parseAiBotAccessFromRobots(robots.text);
	const aiBotsBlocked = !resolveAiBotsAllowed(aiBotAccess);
	const serverLocation = resolveServerLocation({
		headers: page.headers,
		hostname: finalUrl.hostname,
		siteMeta,
		lang,
	});
	const indexStatus = resolveIndexStatus({
		robotsText: robots.text,
		robotsOk: robots.ok,
		$,
		xRobotsTag: page.headers['x-robots-tag'],
	});
	/** Cheerio + order/case-tolerant regex — either path confirms a responsive viewport. */
	const hasViewportMeta =
		$('meta[name]')
			.toArray()
			.some((el) => {
				const name = ($(el).attr('name') || '').trim().toLowerCase();
				return name === 'viewport';
			}) || detectViewportInHtml(html);

	const orgComplete = parsed.schema.hasOrganization && parsed.schema.organizationMissing.length === 0;
	const personComplete = parsed.schema.hasPerson && parsed.schema.personMissing.length === 0;
	const nap = parsed.schema.nap;
	const napOk = Boolean(nap?.name && (nap.telephone || nap.address));
	const ariaLandmarks = hasAriaLandmarks($);
	const statusOk = page.status != null && page.status >= 200 && page.status < 400;
	const statusPass = page.status != null && page.status >= 200 && page.status < 300;

	const seoChecks = buildSeoChecks(S, parsed, finalUrl.toString(), {
		sitemapOk: sitemapResult.ok,
		robotsOk: robots.ok,
		robotsBlocksAll: robotsTxtBlocksAll(robots.text),
	});
	const httpsOk = resolveIsHttps({ url: finalUrl.toString() }) && !page.unsafeRedirect;
	const hops = page.redirectChain.length;
	const securityChecks: AuditCheckItem[] = [
		check(
			HTTPS_CHECK_ID,
			S.seo.https,
			httpsOk ? 'pass' : 'fail',
			checklistWeight(HTTPS_CHECK_ID, HTTPS_RAW_POINTS),
			{
				evidence: httpsOk
					? `protocol=https · SSL on · HSTS=${page.hasHsts ? '✓' : '✗'} · hops=${hops}`
					: `protocol=${finalUrl.protocol.replace(':', '')} · SSL off${page.unsafeRedirect ? ' · unsafe https→http redirect' : ''}`,
				why: S.why.https,
				passWhy: S.passWhy.https,
				impact: S.impact.https,
			},
		),
		check(
			'response-time',
			S.performance.responseTime(page.elapsedMs),
			!statusOk
				? 'fail'
				: !statusPass
					? 'warning'
					: page.elapsedMs > 0 && page.elapsedMs < 1500
						? 'pass'
						: page.elapsedMs < 3000
							? 'warning'
							: 'fail',
			checklistWeight('response-time', 5),
			{
				evidence: `HTTP ${page.status ?? 'unreachable'} · TTFB≈${page.elapsedMs}ms · hops=${hops}${page.hasHsts ? ' · HSTS' : ''}${page.hasCsp ? ' · CSP' : ''}`,
				why: S.why.responseTime,
				passWhy: S.passWhy.responseTime,
				impact: S.impact.responseTime,
			},
		),
	];
	const sizeOk = page.bytes > 0 && page.bytes < 1_500_000;
	const perfChecks: AuditCheckItem[] = [
		check(
			'page-weight',
			S.performance.pageWeight((page.bytes / 1024).toFixed(0)),
			!sizeOk ? 'fail' : hasViewportMeta ? 'pass' : 'warning',
			checklistWeight('page-weight', 5),
			{
				evidence: `${(page.bytes / 1024).toFixed(1)} KB HTML · viewport=${hasViewportMeta ? '✓' : '✗'}`,
				why: S.why.pageWeight,
				passWhy: S.passWhy.pageWeight,
				impact: S.impact.pageWeight,
			},
		),
		check(
			'render-blocking',
			S.performance.renderBlocking(parsed.renderBlockingScripts),
			parsed.renderBlockingScripts <= 5 ? 'pass' : 'warning',
			checklistWeight('render-blocking', 3),
			{
				evidence: `${parsed.renderBlockingScripts} sync <script src> without async/defer`,
				why: S.why.renderBlocking,
				passWhy: S.passWhy.renderBlocking,
				impact: S.impact.renderBlocking,
			},
		),
		check(
			'image-alt',
			S.accessibility.imageAlt(parsed.images.coveragePct, parsed.images.total, parsed.images.missingAlt),
			parsed.images.coveragePct >= 80
				? ariaLandmarks || parsed.images.total === 0
					? 'pass'
					: 'warning'
				: parsed.images.coveragePct >= 50
					? 'warning'
					: 'fail',
			checklistWeight('image-alt', 4),
			{
				evidence: `${parsed.images.total - parsed.images.missingAlt}/${parsed.images.total} images have alt · landmarks=${ariaLandmarks ? '✓' : '✗'}`,
				why: S.why.imageAlt,
				passWhy: S.passWhy.imageAlt,
				impact: S.impact.imageAlt,
			},
		),
	];
	const schemaChecks = [
		...buildSchemaChecks(S, parsed, siteMeta, lang),
		check('faq-howto-schema', S.geo.faqHowto, parsed.schema.hasFaqOrHowTo ? 'pass' : 'fail', checklistWeight('faq-howto-schema', 6), {
			evidence: parsed.schema.hasFaqOrHowTo
				? `types include ${parsed.schema.types.filter((t) => t === 'FAQPage' || t === 'HowTo').join(', ')}`
				: '— FAQPage / HowTo not detected',
			why: S.why.faq,
			passWhy: S.passWhy.faq,
			impact: S.impact.faq,
		}),
	];
	const geoChecks: AuditCheckItem[] = [
		check('ai-bots-allowed', S.geo.aiBotsAllowed, !aiBotsBlocked ? 'pass' : 'fail', checklistWeight('ai-bots-allowed', 6), {
			evidence: aiBotsBlocked ? 'AI bot Disallow:/ detected in robots.txt' : 'No AI-bot Disallow:/ found',
			why: S.why.robots,
			passWhy: S.passWhy.robots,
			impact: S.impact.robots,
		}),
		check(
			'crawlable-text',
			S.geo.crawlableText(parsed.bodyTextLength),
			parsed.bodyTextLength >= 300 ? 'pass' : parsed.bodyTextLength >= 120 ? 'warning' : 'fail',
			checklistWeight('crawlable-text', 5),
			{
				evidence: `${parsed.bodyTextLength} chars of body text`,
				why: S.why.bodyText,
				passWhy: S.passWhy.bodyText,
				impact: S.impact.bodyText,
			},
		),
		check(
			'eeat-author',
			S.geo.eeatAuthor,
			personComplete && orgComplete && napOk
				? 'pass'
				: parsed.schema.hasPerson || parsed.schema.hasOrganization
					? 'warning'
					: 'fail',
			checklistWeight('eeat-author', 4),
			{
				evidence: `Person=${personComplete ? '✓' : parsed.schema.hasPerson ? 'partial' : '✗'} · Organization=${
					orgComplete ? '✓' : parsed.schema.hasOrganization ? 'partial' : '✗'
				} · NAP=${napOk ? '✓' : '✗'}`,
				why: S.why.eeat,
				passWhy: S.passWhy.eeat,
				impact: S.impact.eeat,
			},
		),
		buildLlmsTxtCheckItem({ lang, present: hasLlmsTxt, evidence: llmsTxtEvidence }),
		check(
			'person-eeat',
			S.schema.person,
			personComplete ? 'pass' : parsed.schema.hasPerson ? 'warning' : 'fail',
			checklistWeight('person-eeat', 5),
			{
				evidence: parsed.schema.hasPerson
					? parsed.schema.personMissing.length
						? `Person present · missing: ${parsed.schema.personMissing.join(', ')}`
						: 'Person author profile identifiers ✓'
					: '— Person schema not found',
				why: S.why.person,
				passWhy: S.passWhy.person,
				impact: S.impact.person,
			},
		),
		check(
			'heading-structure',
			S.accessibility.headingStructure,
			parsed.headings.hasH1ToH3 ? 'pass' : 'fail',
			checklistWeight('heading-structure', 4),
			{
				evidence: `H1=${parsed.headings.h1Count}, outline length=${parsed.headings.levels.length}`,
				why: S.why.headingStructure,
				passWhy: S.passWhy.headingStructure,
				impact: S.impact.headingStructure,
			},
		),
	];

	const categoriesDef = [
		{
			id: 'security',
			label: S.security.label,
			checks: securityChecks,
			failNote: S.security.failNote,
			warnNote: S.security.warnNote,
			passNote: S.security.passNote,
		},
		{
			id: 'performance',
			label: S.performance.label,
			checks: perfChecks,
			failNote: S.performance.failNote,
			warnNote: S.performance.warnNote,
			passNote: S.performance.passNote,
		},
		{
			id: 'seo',
			label: S.seo.label,
			checks: seoChecks,
			failNote: S.seo.failNote,
			warnNote: S.seo.warnNote,
			passNote: S.seo.passNote,
		},
		{
			id: 'schema',
			label: S.schema.label,
			checks: schemaChecks,
			failNote: S.schema.failNote,
			warnNote: S.schema.warnNote,
			passNote: S.schema.passNote,
		},
		{
			id: 'geo',
			label: S.geo.label,
			checks: geoChecks,
			failNote: S.geo.failNote,
			warnNote: S.geo.warnNote,
			passNote: S.geo.passNote,
		},
	];

	const categories: AuditCategory[] = categoriesDef.map((def) => {
		const { score, maxScore, status } = categoryScore(def.checks);
		return {
			id: def.id,
			label: def.label,
			score,
			maxScore,
			status,
			statusNote: categoryStatusNote(def.id, status, lang, def),
			checks: def.checks,
		};
	});

	const checklist = categories.flatMap((c) => c.checks);
	const score = Math.round(categories.reduce((sum, c) => sum + c.score, 0) * 10) / 10;
	const maxScore = categories.reduce((sum, c) => sum + c.maxScore, 0);
	const { status, statusLabel } = overallStatus(lang, normalizeTo100(score, maxScore));
	const schemaCoverage = computeSchemaCoverage(parsed.schema.types);
	const geoCategory = categories.find((c) => c.id === 'geo');
	const geoCitationScore = geoCategory
		? normalizeTo100(geoCategory.score, geoCategory.maxScore)
		: computeGeoCitationScore({
				schema: parsed.schema,
				aiBotsBlocked,
				bodyTextLength: parsed.bodyTextLength,
				organizationComplete: orgComplete,
				personComplete,
				newsVertical: isNewsMediaVertical({
					industry: siteMeta?.category,
					category: siteMeta?.category,
					siteTitle: siteMeta?.title,
					brandName: siteMeta?.brandName,
					domain: siteMeta?.domain,
					primaryKeyword: siteMeta?.primaryKeyword,
					industryType: siteMeta?.industryType,
					schemaTypes: parsed.schema.types,
				}),
			});
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

	const [fetchedCompetitors, resolvedLogo] = await Promise.all([competitorTask, logoTask]);
	const realCompetitors = snapshotHasRealCompetitors(fetchedCompetitors)
		? fetchedCompetitors
		: undefined;
	if (resolvedLogo) {
		siteMeta.logoUrl = resolvedLogo;
	}

	return {
		url: finalUrl.toString(),
		finalUrl: finalUrl.toString(),
		redirectChain: page.redirectChain,
		sitemap: sitemapResult,
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
		logoUrl: siteMeta?.logoUrl,
		detectedKeywords: siteMeta?.detectedKeywords,
		serverLocation,
		indexStatus,
		hasViewportMeta,
		cmsType: toAuditCmsLabel(detectCmsFromHtml(html), lang),
		hasSsl: resolveIsHttps({ url: finalUrl.toString() }) && !page.unsafeRedirect,
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
			renderBlockingScripts: parsed.renderBlockingScripts,
			jsonLdSnippets: parsed.schema.snippets,
			organizationMissing: parsed.schema.organizationMissing,
			articleMissing: parsed.schema.articleMissing,
			personMissing: parsed.schema.personMissing,
			h1Texts: parsed.headings.h1Texts.length
				? parsed.headings.h1Texts
				: scopedMainH1
					? [scopedMainH1]
					: [],
			h2Texts: parsed.headings.h2Texts?.length ? parsed.headings.h2Texts : undefined,
			headingSkipExamples: parsed.headings.skipExamples,
			pageTitle: pageSpecificTitle || undefined,
			documentTitle: parsed.meta.title || undefined,
			metaDescription: parsed.meta.metaDescription || undefined,
			ogTitle: parsed.meta.ogTitle || undefined,
			ogDescription: parsed.meta.ogDescription || undefined,
			aiBotAccess,
			hasLlmsTxt,
			llmsTxtEvidence,
			finalUrl: finalUrl.toString(),
			hasHsts: page.hasHsts,
			hasSitemap: sitemapResult.ok,
			sitemapEvidence: sitemapResult.evidence,
			hasViewport: hasViewportMeta,
			hasAriaLandmarks: ariaLandmarks,
			httpStatus: page.status,
		},
		categories,
		checklist,
		findings,
		collectedUrls: parsed.internalLinks,
		navItems,
		footerText: footerText || undefined,
		pageMetas,
		executiveSummary: generateExecutiveSummary(
			{
				score,
				maxScore,
				categories: categories.map((c) => ({
					id: c.id,
					label: c.label,
					score: c.score,
					maxScore: c.maxScore,
				})),
			},
			{
				location: siteMeta?.location,
				broadLocation: siteMeta?.broadLocation,
				category: siteMeta?.category,
				primaryKeyword: siteMeta?.primaryKeyword,
				brandName: siteMeta?.brandName,
			},
			lang,
		),
		realCompetitors,
	};
}
