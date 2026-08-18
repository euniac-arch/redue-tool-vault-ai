/**
 * Tab 2 detailed checklist — official scoring rows (24 items · 122 pts).
 *
 * Five standard categories stay 1:1 with the radar axes and measured cards:
 *   보안 & 인프라 15 · 웹 성능 & 접근성 12 · SEO 기술 기본기 29
 *   스키마 구조화 데이터 36 · GEO & AI 인용 신호 30
 *
 * Viewport, sitemap.xml, HSTS, and HTTP status are collected live and folded
 * into existing weighted rows (page-weight, canonical, https, response-time).
 * Do not add extra definition ids — the 24-row / 122-point scale stays fixed.
 *
 * `CHECKLIST_TOTAL_MAX` is always `Σ item.maxScore`. Never hardcode the
 * headline max — UI and the calculator read this (or the live checklist sum).
 */

export type ChecklistCategory =
	| 'security_infra'
	| 'web_perf_access'
	| 'basic_seo'
	| 'schema_data'
	| 'geo_ai_signals';
export type ChecklistPLevel = 'P0' | 'P1' | 'P2' | 'P3' | 'P4' | 'P5';

export interface ChecklistItemDef {
	id: string;
	name: string;
	maxScore: number;
	category: ChecklistCategory;
	pLevel?: ChecklistPLevel;
}

export const AUDIT_CHECKLIST_DEFINITIONS: ChecklistItemDef[] = [
	// 1. 보안 & 인프라 (2개 · 15점)
	{ id: 'ssl_https', name: "[P0: 긴급] 무료 Let's Encrypt SSL 보안 프로토콜 즉시 적용", maxScore: 10, category: 'security_infra', pLevel: 'P0' },
	{ id: 'server_ttfb', name: '서버 응답 속도 (TTFB < 1500ms)', maxScore: 5, category: 'security_infra', pLevel: 'P2' },

	// 2. 웹 성능 & 접근성 (3개 · 12점)
	{ id: 'html_size', name: 'HTML 문서 용량 (HTML < 1500KB)', maxScore: 5, category: 'web_perf_access', pLevel: 'P3' },
	{ id: 'render_blocking', name: '렌더링 차단 스크립트 최적화', maxScore: 3, category: 'web_perf_access', pLevel: 'P2' },
	{ id: 'image_alt', name: '이미지 alt 커버리지 (80% 이상)', maxScore: 4, category: 'web_perf_access', pLevel: 'P3' },

	// 3. SEO 기술 기본기 (7개 · 29점)
	{ id: 'title_length', name: '<title> 길이 적정성 (10–60자)', maxScore: 5, category: 'basic_seo', pLevel: 'P1' },
	{ id: 'meta_description', name: '메타 디스크립션 적정성 (70–160자)', maxScore: 5, category: 'basic_seo', pLevel: 'P1' },
	{ id: 'og_tags', name: 'Open Graph 3종 (title / description / image)', maxScore: 5, category: 'basic_seo', pLevel: 'P2' },
	{ id: 'canonical_url', name: 'Canonical URL 명시 및 정합성', maxScore: 5, category: 'basic_seo', pLevel: 'P1' },
	{ id: 'h1_single', name: 'H1 태그 단일성 (1개 감지)', maxScore: 4, category: 'basic_seo', pLevel: 'P2' },
	{ id: 'heading_hierarchy', name: '헤딩 계층 순서 (H1→H2→H3, 비약 없음)', maxScore: 3, category: 'basic_seo', pLevel: 'P3' },
	{ id: 'html_lang', name: 'html lang 속성 명시', maxScore: 2, category: 'basic_seo', pLevel: 'P4' },

	// 4. 스키마 구조화 데이터 (6개 · 36점)
	{ id: 'jsonld_parse', name: 'JSON-LD 블록 파싱 성공', maxScore: 8, category: 'schema_data', pLevel: 'P1' },
	{ id: 'local_business_props', name: 'LocalBusiness / 필수 속성 (logo / url / sameAs)', maxScore: 7, category: 'schema_data', pLevel: 'P1' },
	{ id: 'page_schema', name: 'AboutPage / MedicalWebPage 페이지 스키마', maxScore: 6, category: 'schema_data', pLevel: 'P2' },
	{ id: 'faq_howto_schema', name: 'FAQPage / HowTo 인용 친화 스키마', maxScore: 6, category: 'schema_data', pLevel: 'P2' },
	{ id: 'core_schema', name: '업종 핵심 스키마 (MedicalClinic / Organization)', maxScore: 5, category: 'schema_data', pLevel: 'P1' },
	{ id: 'aux_schema', name: 'WebSite / BreadcrumbList 보조 스키마', maxScore: 4, category: 'schema_data', pLevel: 'P3' },

	// 5. GEO & AI 인용 신호 (6개 · 30점)
	{ id: 'llms_txt', name: '[GEO 표준] /llms.txt AI 전용 인덱스 파일 구비 여부', maxScore: 6, category: 'geo_ai_signals', pLevel: 'P1' },
	{ id: 'ai_bots_robots', name: 'GPTBot / PerplexityBot 차단 없음 (robots.txt)', maxScore: 6, category: 'geo_ai_signals', pLevel: 'P1' },
	{ id: 'body_text_length', name: '본문 텍스트 충분성 (≥300자)', maxScore: 5, category: 'geo_ai_signals', pLevel: 'P2' },
	{ id: 'person_profile', name: 'Person 저자 프로필 (E-E-A-T)', maxScore: 5, category: 'geo_ai_signals', pLevel: 'P3' },
	{ id: 'eeat_knowledge_graph', name: 'E-E-A-T 저자·발행자 지식그래프 신호', maxScore: 4, category: 'geo_ai_signals', pLevel: 'P3' },
	{ id: 'heading_structure_exist', name: 'H1–H3 제목 구조 존재 및 시맨틱 아웃라인', maxScore: 4, category: 'geo_ai_signals', pLevel: 'P4' },
];

/** Live `AuditCheckItem.id` → definition id. */
export const ENGINE_CHECK_TO_DEFINITION_ID: Record<string, string> = {
	https: 'ssl_https',
	'response-time': 'server_ttfb',
	'page-weight': 'html_size',
	'render-blocking': 'render_blocking',
	title: 'title_length',
	'meta-description': 'meta_description',
	'og-tags': 'og_tags',
	canonical: 'canonical_url',
	'single-h1': 'h1_single',
	'heading-skip': 'heading_hierarchy',
	'html-lang': 'html_lang',
	'jsonld-present': 'jsonld_parse',
	organization: 'local_business_props',
	'article-fields': 'page_schema',
	'news-article': 'core_schema',
	'faq-howto-schema': 'faq_howto_schema',
	faq: 'faq_howto_schema',
	'person-eeat': 'person_profile',
	'website-schema': 'aux_schema',
	'eeat-author': 'eeat_knowledge_graph',
	'llms-txt': 'llms_txt',
	'ai-bots-allowed': 'ai_bots_robots',
	'crawlable-text': 'body_text_length',
	'image-alt': 'image_alt',
	'heading-structure': 'heading_structure_exist',
};

const DEFINITION_BY_ID = new Map(AUDIT_CHECKLIST_DEFINITIONS.map((item) => [item.id, item]));

export function maxScoreFromChecklist(
	items?: ReadonlyArray<{ maxScore?: number; weight?: number }> | null,
): number {
	if (!items?.length) return 0;
	return items.reduce((sum, item) => {
		const n = Number(item.maxScore ?? item.weight ?? 0);
		return sum + (Number.isFinite(n) ? n : 0);
	}, 0);
}

export const CHECKLIST_ITEM_COUNT = AUDIT_CHECKLIST_DEFINITIONS.length;

export const CHECKLIST_TOTAL_MAX = maxScoreFromChecklist(AUDIT_CHECKLIST_DEFINITIONS);

/**
 * Official max: sum of the live checklist when it is a complete set,
 * otherwise the definition total (so partial stored reports keep the scale).
 */
export function resolveMaxRawScore(
	checklist?: ReadonlyArray<{ maxScore?: number; weight?: number }> | null,
): number {
	const live = maxScoreFromChecklist(checklist);
	if (live > 0 && checklist && checklist.length >= CHECKLIST_ITEM_COUNT) return live;
	return CHECKLIST_TOTAL_MAX;
}

export const CHECKLIST_CATEGORY_MAX: Record<ChecklistCategory, number> = AUDIT_CHECKLIST_DEFINITIONS.reduce(
	(acc, item) => {
		acc[item.category] += item.maxScore;
		return acc;
	},
	{
		security_infra: 0,
		web_perf_access: 0,
		basic_seo: 0,
		schema_data: 0,
		geo_ai_signals: 0,
	},
);

export function checklistDefById(id: string): ChecklistItemDef | undefined {
	return DEFINITION_BY_ID.get(id);
}

export function checklistDefForEngineId(engineId: string): ChecklistItemDef | undefined {
	const defId = ENGINE_CHECK_TO_DEFINITION_ID[engineId] ?? engineId;
	return DEFINITION_BY_ID.get(defId);
}

export function checklistWeightForEngineId(engineId: string): number | undefined {
	return checklistDefForEngineId(engineId)?.maxScore;
}

export function applyChecklistDefinitionWeights<T extends { id: string; weight: number }>(checks: T[]): T[] {
	return checks.map((check) => {
		const weight = checklistWeightForEngineId(check.id);
		return weight == null ? check : { ...check, weight };
	});
}
