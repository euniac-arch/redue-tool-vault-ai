/**
 * 프로젝트 업종 카테고리 표준 정의
 * MEDICAL | CORPORATE | COMMERCE | PUBLIC | SOLUTIONS (+ ALL for filters)
 * Ported from redue-seo-inspector-ai/src/constants/projectCategories.js
 */

export const PROJECT_CATEGORY_LABELS = {
	MEDICAL: '의료/병원',
	CORPORATE: '기업/브랜드',
	COMMERCE: '쇼핑몰/EC',
	PUBLIC: '관공서/교육',
	SOLUTIONS: 'AI/웹솔루션',
} as const;

export type ProjectCategoryCode = keyof typeof PROJECT_CATEGORY_LABELS;
export type ProjectCategoryFilter = ProjectCategoryCode | 'ALL';

export const PROJECT_CATEGORY_CODES = Object.keys(PROJECT_CATEGORY_LABELS) as ProjectCategoryCode[];

/** 기존 미지정 데이터 / 자동 생성 프로젝트 Fallback */
export const DEFAULT_PROJECT_CATEGORY: ProjectCategoryCode = 'SOLUTIONS';

/** UI·쿼리 호환용 레거시 키 → 표준 코드 */
export const LEGACY_CATEGORY_MAP: Record<string, ProjectCategoryFilter> = {
	all: 'ALL',
	medical: 'MEDICAL',
	brand: 'CORPORATE',
	ecommerce: 'COMMERCE',
	public: 'PUBLIC',
	ai: 'SOLUTIONS',
	diagnosed: 'SOLUTIONS',
	'의료/병원': 'MEDICAL',
	'기업/브랜드': 'CORPORATE',
	'쇼핑몰/EC': 'COMMERCE',
	'관공서/교육': 'PUBLIC',
	'AI/웹솔루션': 'SOLUTIONS',
};

export function normalizeProjectCategory(
	value: unknown,
	{ allowAll = false }: { allowAll?: boolean } = {},
): ProjectCategoryFilter {
	if (value == null || value === '') {
		return allowAll ? 'ALL' : DEFAULT_PROJECT_CATEGORY;
	}
	const raw = String(value).trim();
	const upper = raw.toUpperCase();
	if (allowAll && (upper === 'ALL' || raw === 'all')) return 'ALL';
	if (upper in PROJECT_CATEGORY_LABELS) return upper as ProjectCategoryCode;
	if (LEGACY_CATEGORY_MAP[raw]) return LEGACY_CATEGORY_MAP[raw];
	if (LEGACY_CATEGORY_MAP[raw.toLowerCase()]) {
		return LEGACY_CATEGORY_MAP[raw.toLowerCase()];
	}
	return DEFAULT_PROJECT_CATEGORY;
}

export function getProjectCategoryLabel(code: unknown): string {
	const normalized = normalizeProjectCategory(code);
	if (normalized === 'ALL') return '전체';
	return PROJECT_CATEGORY_LABELS[normalized] || PROJECT_CATEGORY_LABELS[DEFAULT_PROJECT_CATEGORY];
}

export function isValidProjectCategory(value: unknown): value is ProjectCategoryCode {
	if (value == null || value === '') return false;
	const upper = String(value).trim().toUpperCase();
	return upper in PROJECT_CATEGORY_LABELS;
}
