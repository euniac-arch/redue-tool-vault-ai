import type { IndustryType } from '@/lib/audit/site-metadata';

export type IndustryPreset = {
	slug: string;
	code: string;
	industryType: IndustryType;
	label: { ko: string; en: string };
};

const PRESETS: Record<string, IndustryPreset> = {
	medical: { slug: 'medical', code: 'MEDICAL', industryType: 'MEDICAL', label: { ko: '의료 · 피부과', en: 'Medical / Dermatology' } },
	food: { slug: 'food', code: 'FOOD', industryType: 'LOCAL_STORE', label: { ko: '음식 · 외식', en: 'Food / Dining' } },
	legal: { slug: 'legal', code: 'LEGAL', industryType: 'GENERAL', label: { ko: '법률', en: 'Legal' } },
	hotel: { slug: 'hotel', code: 'HOTEL', industryType: 'LOCAL_STORE', label: { ko: '호텔 · 숙박', en: 'Hotel / Stay' } },
	education: { slug: 'education', code: 'EDUCATION', industryType: 'GENERAL', label: { ko: '교육 · 학원', en: 'Education' } },
	beauty: { slug: 'beauty', code: 'BEAUTY', industryType: 'LOCAL_STORE', label: { ko: '뷰티 · 피부관리', en: 'Beauty' } },
	professional: { slug: 'professional', code: 'PROFESSIONAL', industryType: 'GENERAL', label: { ko: '전문직', en: 'Professional' } },
	'real-estate': { slug: 'real-estate', code: 'REAL ESTATE', industryType: 'GENERAL', label: { ko: '부동산', en: 'Real estate' } },
	automotive: { slug: 'automotive', code: 'AUTOMOTIVE', industryType: 'LOCAL_STORE', label: { ko: '자동차', en: 'Automotive' } },
	fitness: { slug: 'fitness', code: 'FITNESS', industryType: 'LOCAL_STORE', label: { ko: '피트니스', en: 'Fitness' } },
	'e-commerce': { slug: 'e-commerce', code: 'E-COMMERCE', industryType: 'LOCAL_STORE', label: { ko: '이커머스', en: 'E-commerce' } },
	b2b: { slug: 'b2b', code: 'B2B', industryType: 'B2B_MFG', label: { ko: 'B2B', en: 'B2B' } },
	tourism: { slug: 'tourism', code: 'TOURISM', industryType: 'LOCAL_STORE', label: { ko: '관광 · 여행', en: 'Tourism' } },
};

const ALIASES: Record<string, string> = {
	restaurant: 'food',
	ecommerce: 'e-commerce',
	realestate: 'real-estate',
	realty: 'real-estate',
	law: 'legal',
	clinic: 'medical',
	dermatology: 'medical',
};

export function industryCodeToSlug(code: string): string {
	return code
		.trim()
		.toLowerCase()
		.replace(/&/g, 'and')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

export function parseIndustryPreset(raw: string | null | undefined): IndustryPreset | null {
	if (!raw) return null;
	const normalized = industryCodeToSlug(raw);
	const slug = ALIASES[normalized] ?? normalized;
	return PRESETS[slug] ?? null;
}

export function buildAuditEngineHref(opts?: { tab?: 'live' | 'history'; industry?: string | null }): string {
	const params = new URLSearchParams();
	if (opts?.tab === 'history') params.set('tab', 'history');
	const industry = (opts?.industry || '').trim();
	if (industry) params.set('industry', industry);
	const query = params.toString();
	return query ? `/audit?${query}` : '/audit';
}

export const INDUSTRY_PRESET_STORAGE_KEY = 'redue:industry-preset';
