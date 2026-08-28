/**
 * Footer / HTML / JSON-LD Person extractor for entity-disambiguation diagnostics.
 * Parses representative legal name + jobTitle so the UI can show both.
 *
 * Priority: JSON-LD `@type: Person` → footer labels (대표자 / 대표원장 / 원장 / CEO).
 */

import {
	FOOTER_REP_NAME_RE,
	MISSING_REP_NAME,
	extractRepresentativeName,
	formatRepresentativeParen,
	isNoiseRepresentativeName,
	looksLikePersonName,
	type UniversalEntityLang,
} from '@/lib/audit/extractors/universal-entity';

export interface ExtractedRepresentative {
	name: string;
	jobTitle: string;
	isExtracted: boolean;
}

export type RepresentativeLang = UniversalEntityLang;

export {
	FOOTER_REP_NAME_RE,
	formatRepresentativeParen,
	isNoiseRepresentativeName,
	looksLikePersonName,
};

/**
 * Admin/engine labeled capture — keep in sync with the universal footer parser.
 */
export const LABELED_REP_RE = new RegExp(FOOTER_REP_NAME_RE.source, 'gu');

function compact(value: string | null | undefined): string {
	return String(value || '')
		.replace(/\s+/g, ' ')
		.trim();
}

/** Default jobTitle when the site did not label one (의료 → 대표원장, else 대표자). */
export function defaultRepresentativeTitle(industryType?: string | null): string {
	const industry = String(industryType || '').toUpperCase();
	if (
		industry === 'MEDICAL' ||
		/HOSPITAL|CLINIC|VET|DENTAL|PHARMA|HEALTH/.test(industry)
	) {
		return '대표원장';
	}
	return '대표자';
}

/**
 * Bind admin override + HTML/footer detection into engine `$rep_name` / `$rep_title`.
 * Empty name is valid (PHP falls back to `{site_name} 의료진/연구팀`).
 */
export function resolveEngineRepresentative(opts: {
	adminName?: string | null;
	adminTitle?: string | null;
	htmlCorpus?: string | null;
	industryType?: string | null;
	lang?: RepresentativeLang;
}): ExtractedRepresentative {
	const adminName = compact(opts.adminName);
	const adminTitle = compact(opts.adminTitle);
	const detected = extractRepresentative(opts.htmlCorpus || '', opts.lang || 'ko');
	const name = !isNoiseRepresentativeName(adminName)
		? adminName
		: detected.isExtracted && !isNoiseRepresentativeName(detected.name)
			? detected.name
			: '';
	const title =
		adminTitle ||
		(detected.isExtracted ? detected.jobTitle : '') ||
		(name ? defaultRepresentativeTitle(opts.industryType) : '');
	return {
		name,
		jobTitle: title,
		isExtracted: Boolean(name),
	};
}

/**
 * Parse representative name + jobTitle from webpage HTML / footer / JSON-LD.
 * Priority: `@type: Person` → labeled footer regex (stopwords reject 제품으로 등).
 */
export function extractRepresentative(
	htmlText: string,
	lang: RepresentativeLang = 'ko',
): ExtractedRepresentative {
	const parsed = extractRepresentativeName(htmlText, lang);
	return {
		name: parsed.name,
		jobTitle: parsed.jobTitle,
		isExtracted: parsed.isExtracted,
	};
}

/** UI label: "홍길동 대표" — always shows name and jobTitle together. */
export function formatRepresentativeLabel(
	name: string | null | undefined,
	jobTitle: string | null | undefined,
	lang: RepresentativeLang = 'ko',
): string {
	const title = compact(jobTitle) || '대표';
	const person = compact(name) || MISSING_REP_NAME[lang];
	return `${person} ${title}`;
}
