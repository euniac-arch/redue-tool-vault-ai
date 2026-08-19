/**
 * Footer / HTML / JSON-LD Person extractor for entity-disambiguation diagnostics.
 * Parses representative legal name + jobTitle so the UI can show both.
 *
 * Priority: JSON-LD (founder / Person / physician / employee / alumni)
 * → footer labels (대표자 / 대표원장 / 원장 / CEO).
 */

import {
	collectJsonLdNodesFromHtml,
	walkJsonLdNodes,
} from '@/lib/audit/extractors/nap';
import { parseJsonLdDocument } from '@/lib/audit/parser';

export interface ExtractedRepresentative {
	name: string;
	jobTitle: string;
	isExtracted: boolean;
}

export type RepresentativeLang = 'ko' | 'en';

const MISSING_NAME: Record<RepresentativeLang, string> = {
	ko: '미검출 (수동 입력 필요)',
	en: 'Not detected (manual input required)',
};

/** Longest titles first so "대표이사 홍길동" does not capture "이사" as the name. */
const TITLE_ALTS =
	'대표공인중개사|대표변호사|대표세무사|대표이사|대표원장|대표자명|대표자|원장|C\\.E\\.O\\.?|CEO|대표';

const NAME_GROUP = '([가-힣]{2,5}|[A-Za-z][A-Za-z.\\s-]{1,28})';

const FOOTER_REP_RE = new RegExp(
	`(${TITLE_ALTS})(?!번호|전화|문의|상담|메일)\\s*[:：|·ㆍ]?\\s*${NAME_GROUP}`,
	'i',
);

const TITLE_AS_NAME = /^(대표자명?|대표이사|대표원장|대표자|원장|이사|CEO|C\.E\.O\.?)$/i;

const NOISE_NAME =
	/^(상호|사업자|등록|번호|전화|주소|이메일|상담|문의|copyright|rights|reserved)$/i;

/** Org/chrome words that must never be compiled as Person.name. */
const REP_NAME_STOPWORDS =
	/병원|연구소|센터|안내|소개|진료안내|고객센터|상담실|의료진|연구팀/;

/**
 * Admin/engine labeled capture — keep in sync with PHP ob_start scanner.
 * `(?:대표자|대표원장|대표이사|대표|원장)\s*[:|]?\s*([가-힣]{2,5}|[a-zA-Z\s]{2,20})`
 */
export const LABELED_REP_RE =
	/(?:대표자|대표원장|대표이사|대표(?!공인|변호|세무|번호|전화)|원장)(?!번호|전화|문의|상담|메일)\s*[:|：]?\s*([가-힣]{2,5}|[a-zA-Z][a-zA-Z\s.]{1,19})/gu;

const PERSON_TYPES = new Set(['Person', 'Physician', 'Dentist', 'VeterinaryCare']);

function compact(value: string | null | undefined): string {
	return String(value || '')
		.replace(/\s+/g, ' ')
		.trim();
}

function asRecord(value: unknown): Record<string, unknown> | null {
	return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function textOf(value: unknown): string {
	if (typeof value === 'string' || typeof value === 'number') return compact(String(value));
	const obj = asRecord(value);
	if (!obj) return '';
	return textOf(obj.name);
}

function typeList(node: Record<string, unknown>): string[] {
	const raw = node['@type'];
	if (typeof raw === 'string') return [raw.replace(/^https?:\/\/schema\.org\//i, '')];
	if (Array.isArray(raw)) {
		return raw.map((item) => String(item).replace(/^https?:\/\/schema\.org\//i, '')).filter(Boolean);
	}
	return [];
}

function normalizeJobTitle(raw: string | null | undefined): string {
	const title = compact(raw).replace(/\.$/, '');
	if (!title) return '';
	if (/^c\.?e\.?o\.?$/i.test(title)) return 'CEO';
	if (title === '대표자명') return '대표자';
	return title;
}

function looksLikePersonName(raw: string | null | undefined): boolean {
	const name = compact(raw).replace(/\s*(전화|주소|사업자|이메일|TEL|Copyright).*$/i, '');
	if (!name) return false;
	if (TITLE_AS_NAME.test(name) || NOISE_NAME.test(name)) return false;
	if (isNoiseRepresentativeName(name)) return false;
	if (/^[가-힣]{2,5}$/.test(name)) return true;
	if (/^[A-Za-z][A-Za-z.\s-]{1,28}$/.test(name) && name.replace(/[^A-Za-z]/g, '').length >= 2) {
		return true;
	}
	return false;
}

/** True when a captured token is chrome/org copy, not a person name. */
export function isNoiseRepresentativeName(raw: string | null | undefined): boolean {
	const name = compact(raw);
	if (!name) return true;
	if (TITLE_AS_NAME.test(name) || NOISE_NAME.test(name)) return true;
	if (REP_NAME_STOPWORDS.test(name)) return true;
	return false;
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
		defaultRepresentativeTitle(opts.industryType);
	return {
		name,
		jobTitle: title,
		isExtracted: Boolean(name),
	};
}

function inferJobTitle(htmlText: string, matchedTitle?: string): string {
	const fromMatch = normalizeJobTitle(matchedTitle);
	if (fromMatch && fromMatch !== '대표자명') return fromMatch === '대표자명' ? '대표자' : fromMatch;
	if (/대표이사/.test(htmlText)) return '대표이사';
	if (/대표원장/.test(htmlText)) return '대표원장';
	if (/원장/.test(htmlText)) return '원장';
	if (/대표자/.test(htmlText)) return '대표자';
	return '대표';
}

function collectNodes(htmlText: string): Record<string, unknown>[] {
	const fromHtml = collectJsonLdNodesFromHtml(htmlText);
	if (fromHtml.length) return fromHtml;
	const trimmed = compact(htmlText);
	if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
		const parsed = parseJsonLdDocument(trimmed);
		if (!parsed) return [];
		const nodes: Record<string, unknown>[] = [];
		walkJsonLdNodes(parsed, (node) => nodes.push(node));
		return nodes;
	}
	return [];
}

function personFromNode(node: Record<string, unknown>, fallbackTitle?: string): { name: string; jobTitle: string } | null {
	const name = textOf(node.name);
	if (!looksLikePersonName(name)) return null;
	const jobTitle = normalizeJobTitle(textOf(node.jobTitle) || textOf(node.roleName) || fallbackTitle);
	return { name, jobTitle };
}

function extractLinkedPerson(
	node: Record<string, unknown>,
	key: string,
	fallbackTitle?: string,
): { name: string; jobTitle: string } | null {
	const value = node[key];
	if (!value) return null;
	if (typeof value === 'string' && looksLikePersonName(value)) {
		return { name: compact(value), jobTitle: fallbackTitle || '' };
	}
	if (Array.isArray(value)) {
		for (const item of value) {
			if (typeof item === 'string' && looksLikePersonName(item)) {
				return { name: compact(item), jobTitle: fallbackTitle || '' };
			}
			const rec = asRecord(item);
			if (rec) {
				const person = personFromNode(rec, fallbackTitle);
				if (person) return person;
			}
		}
		return null;
	}
	const rec = asRecord(value);
	return rec ? personFromNode(rec, fallbackTitle) : null;
}

function extractFromJsonLdGraph(htmlText: string): { name: string | null; jobTitle: string | null } {
	const nodes = collectNodes(htmlText);
	const founders: Array<{ name: string; jobTitle: string }> = [];
	const titledPeople: Array<{ name: string; jobTitle: string }> = [];
	const people: Array<{ name: string; jobTitle: string }> = [];

	for (const node of nodes) {
		const founder = extractLinkedPerson(node, 'founder', '대표자') || extractLinkedPerson(node, 'director', '대표');
		if (founder) founders.push(founder);

		for (const key of ['employee', 'employees', 'physician', 'alumni', 'member'] as const) {
			const linked = extractLinkedPerson(node, key, key === 'physician' ? '원장' : '');
			if (linked) {
				if (/대표|원장|이사|CEO/i.test(linked.jobTitle)) titledPeople.push(linked);
				else people.push(linked);
			}
		}

		if (typeList(node).some((type) => PERSON_TYPES.has(type))) {
			const person = personFromNode(node);
			if (person) {
				if (/대표|원장|이사|CEO/i.test(person.jobTitle)) titledPeople.push(person);
				else people.push(person);
			}
		}
	}

	const picked = founders[0] || titledPeople[0] || people[0];
	if (!picked) return { name: null, jobTitle: null };
	return { name: picked.name, jobTitle: picked.jobTitle || null };
}

function extractFromJsonLdPerson(htmlText: string): { name: string | null; jobTitle: string | null } {
	const fromGraph = extractFromJsonLdGraph(htmlText);
	if (fromGraph.name) return fromGraph;

	const windows: string[] = [];
	for (const match of htmlText.matchAll(/"@type"\s*:\s*"(?:Person|Physician)"/gi)) {
		const at = match.index ?? 0;
		windows.push(htmlText.slice(Math.max(0, at - 400), at + 800));
	}
	for (const key of ['founder', 'employee', 'physician', 'alumni']) {
		const keyRe = new RegExp(`"${key}"\\s*:\\s*(?:\\{\\s*[^}]*"name"\\s*:\\s*"([^"]{2,40})"|("([^"]{2,40})"))`, 'i');
		const hit = htmlText.match(keyRe);
		const name = compact(hit?.[1] || hit?.[3]);
		if (looksLikePersonName(name)) {
			return { name, jobTitle: key === 'founder' ? '대표자' : key === 'physician' ? '원장' : null };
		}
	}
	for (const chunk of windows) {
		const name = compact(chunk.match(/"name"\s*:\s*"([^"]{2,40})"/i)?.[1]);
		const jobTitle = compact(chunk.match(/"jobTitle"\s*:\s*"([^"]{1,40})"/i)?.[1]);
		if (looksLikePersonName(name)) {
			return { name, jobTitle: normalizeJobTitle(jobTitle) || null };
		}
	}
	return { name: null, jobTitle: null };
}

/**
 * Parse representative name + jobTitle from webpage HTML / footer / JSON-LD.
 * Examples: "대표 : 홍길동", "대표자: 홍길동", "대표이사 홍길동", "CEO John Doe"
 */
function extractFromLabeledPattern(text: string): { name: string | null; jobTitle: string | null } {
	LABELED_REP_RE.lastIndex = 0;
	let hit: RegExpExecArray | null;
	while ((hit = LABELED_REP_RE.exec(text)) !== null) {
		const name = compact(hit[1]);
		if (!looksLikePersonName(name)) continue;
		const prefix = compact(hit[0].slice(0, Math.max(0, hit[0].length - (hit[1]?.length || 0))));
		const titleMatch = prefix.match(/대표자|대표원장|대표이사|대표|원장/);
		return { name, jobTitle: normalizeJobTitle(titleMatch?.[0]) || null };
	}
	return { name: null, jobTitle: null };
}

export function extractRepresentative(
	htmlText: string,
	lang: RepresentativeLang = 'ko',
): ExtractedRepresentative {
	const jsonLd = extractFromJsonLdPerson(htmlText);
	const text = compact(htmlText.replace(/<[^>]+>/g, ' '));
	const labeled = extractFromLabeledPattern(text);
	const match = text.match(FOOTER_REP_RE);
	const footerName = looksLikePersonName(match?.[2]) ? compact(match?.[2]) : null;
	const footerTitle = normalizeJobTitle(match?.[1]);

	const repName = jsonLd.name || labeled.name || footerName;
	const jobTitle = jsonLd.jobTitle || labeled.jobTitle || inferJobTitle(text, footerTitle);

	return {
		name: repName || MISSING_NAME[lang] || MISSING_NAME.ko,
		jobTitle,
		isExtracted: Boolean(repName),
	};
}

/** UI label: "홍길동 대표" — always shows name and jobTitle together. */
export function formatRepresentativeLabel(
	name: string | null | undefined,
	jobTitle: string | null | undefined,
	lang: RepresentativeLang = 'ko',
): string {
	const title = compact(jobTitle) || '대표';
	const person = compact(name) || MISSING_NAME[lang];
	return `${person} ${title}`;
}
