/**
 * Derive industry / region / services / target / keywords from the current
 * site's diagnosis corpus only. Never invent another vertical's defaults.
 */
import type { SiteMetadata } from '@/lib/audit/site-metadata';

const FOREIGN_VERTICAL_RE = /피부시술|피부과|보톡스|필러|리프팅|울쎄라/i;

const CANCER_RE = /암치료|암\s*치료|암센터|암연구소|항암|중입자|oncolog|cancer/i;
const LAB_RE = /연구소|연구\s*기관|research(?:\s*lab)?|\blab\b/i;
const ION_RE = /이온치료|이온\s*치료|중입자|탄소이온|koreaion|ionlab/i;
const MEDICAL_RE = /암|중입자|이온|치료|병원|의원|클리닉|의료|연구소|oncolog|cancer|therap/i;

const KEYWORD_LEXICON: Array<{ test: RegExp; ko: string }> = [
	{ test: /암치료|암\s*치료|암센터/, ko: '암치료' },
	{ test: /이온치료|이온\s*치료|koreaion|ionlab/, ko: '이온' },
	{ test: /중입자|탄소이온/, ko: '중입자' },
	{ test: /암연구소|암치료연구소/, ko: '암연구소' },
	{ test: /연구소|research\s*lab/, ko: '연구소' },
	{ test: /항암/, ko: '항암' },
	{ test: /방사선/, ko: '방사선' },
];

function clean(value: unknown, max = 80): string {
	if (typeof value !== 'string') return '';
	return value.replace(/\s+/g, ' ').trim().slice(0, max);
}

function unique(values: readonly (string | undefined | null)[], limit = 8): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const raw of values) {
		const value = clean(raw, 48);
		if (!value) continue;
		const key = value.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(value);
		if (out.length >= limit) break;
	}
	return out;
}

export function intelligenceCorpus(meta: SiteMetadata | undefined, brand: string, domain: string): string {
	if (!meta) return [brand, domain].filter(Boolean).join(' ');
	return [
		brand,
		domain,
		meta.brandName,
		meta.title,
		meta.ogTitle,
		meta.ogSiteName,
		meta.metaDescription,
		meta.ogDescription,
		meta.metaKeywords,
		meta.category,
		meta.primaryKeyword,
		meta.businessEntity,
		meta.location,
		meta.broadLocation,
		...(meta.coreSpecialties ?? []),
		...(meta.serviceKeywords ?? []),
		...(meta.detectedKeywords ?? []),
		...(meta.entityPhrases ?? []),
		...(meta.needSignals ?? []),
		...(meta.h2Texts ?? []),
		...(meta.navMenuTexts ?? []),
	]
		.filter(Boolean)
		.join(' · ');
}

export function isForeignVerticalTerm(term: string, corpus: string): boolean {
	if (!FOREIGN_VERTICAL_RE.test(term)) return false;
	return !FOREIGN_VERTICAL_RE.test(corpus);
}

export function extractIntelligenceKeywords(
	corpus: string,
	extras: readonly (string | undefined | null)[] = [],
): string[] {
	const fromLexicon = KEYWORD_LEXICON.filter((row) => row.test.test(corpus)).map((row) => row.ko);
	return unique(
		[...fromLexicon, ...extras].filter((item) => item && !isForeignVerticalTerm(item, corpus)),
		8,
	);
}

export function composeIntelligenceIndustry(
	corpus: string,
	meta: SiteMetadata | undefined,
	brand: string,
): string {
	const category = clean(meta?.category) || clean(meta?.primaryKeyword) || clean(meta?.businessEntity);
	if (CANCER_RE.test(corpus) && LAB_RE.test(`${corpus} ${brand}`)) return '암치료 연구소 / 의료 연구';
	if (CANCER_RE.test(corpus)) return category || '암치료';
	return category;
}

export function composeIntelligenceLocation(meta: SiteMetadata | undefined, boundFromAudit: boolean): string {
	const location = clean(meta?.location) || clean(meta?.broadLocation);
	if (location) return location;
	return boundFromAudit ? '온라인/전국' : '';
}

export function composeIntelligenceServices(input: {
	corpus: string;
	meta?: SiteMetadata;
	industry?: string;
	overrides?: readonly (string | undefined | null)[];
}): string[] {
	const cancer = CANCER_RE.test(input.corpus) || ION_RE.test(input.corpus);
	const rows = unique(
		[
			...(input.overrides ?? []),
			...(input.meta?.coreSpecialties ?? []),
			...(input.meta?.serviceKeywords ?? []),
			input.meta?.businessEntity,
			cancer ? '암 연구/치료 솔루션' : '',
			input.meta?.primaryKeyword,
			input.meta?.category,
			input.industry,
		].filter((item) => item && !isForeignVerticalTerm(item, input.corpus)),
		6,
	);
	return rows;
}

export function inferIntelligenceTarget(corpus: string): string | undefined {
	if (CANCER_RE.test(corpus) && (LAB_RE.test(corpus) || ION_RE.test(corpus))) {
		return '암 환우 및 보호자, 중입자/방사선 치료 연구 관심층';
	}
	if (CANCER_RE.test(corpus)) return '암 환우 및 보호자';
	return undefined;
}

export function intelligenceIsMedicalCorpus(corpus: string): boolean {
	return MEDICAL_RE.test(corpus);
}

export function intelligenceOrgNoun(corpus: string): string {
	if (LAB_RE.test(corpus) || CANCER_RE.test(corpus)) return '연구소';
	return '';
}
