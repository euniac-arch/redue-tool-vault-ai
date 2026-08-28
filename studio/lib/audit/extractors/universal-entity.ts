/**
 * Universal Entity Parser — shared JSON-LD + DOM extraction for
 * E-E-A-T / Entity Disambiguation diagnostics.
 *
 * One result object drives the gauge (taxID · CID · sameAs · Person KG)
 * and the LLM 5-property checklist so schema and footer never diverge.
 */

import {
	collectJsonLdNodesFromHtml,
	walkJsonLdNodes,
} from '@/lib/audit/extractors/nap';
import { parseJsonLdDocument } from '@/lib/audit/parser';
import { isOfficialChannelUrl } from '@/lib/audit/extractors/schema-entity-pack';
import { extractUniversalSameAs } from '@/lib/audit/extractors/universal-same-as';
import type { SchemaPropertyCheck } from '@/types/geo-diagnostic';

export type UniversalEntityLang = 'ko' | 'en';

export const MISSING_REP_NAME: Record<UniversalEntityLang, string> = {
	ko: '미검출 (수동 입력 필요)',
	en: 'Not detected (manual input required)',
};

/**
 * Footer / body representative-name capture.
 * Longest titles first; 대표/원장 reject compound suffixes (번호·제품·실…).
 */
export const FOOTER_REP_NAME_RE =
	/(?:대표원장|대표이사|대표자명|대표변호사|대표세무사|대표공인중개사|대표자|원장(?!실|님|진|회)|대표(?!번호|전화|문의|상담|메일|제품|공인|변호|세무))\s*[:：|·ㆍ]?\s*([가-힣]{2,4})(?=\s|<|$|\||\/)/u;

export const FOOTER_REP_NAME_EN_RE =
	/(?:대표원장|대표이사|대표자|대표(?!번호|전화)|CEO|C\.E\.O\.?)\s*[:：|·ㆍ]?\s*([A-Za-z][A-Za-z.\s-]{1,28})(?=\s|<|$|\||\/)/i;

/** Schema + labeled DOM taxID / vatID. */
export const TAX_ID_LABELED_RE =
	/(?:taxID|vatID|leiCode|사업자\s*등록\s*번호|사업자번호|등록번호)\s*[:："'\s=]*["']?(\d{3}-?\d{2}-?\d{5}|\d{10})/i;

export const TAX_ID_HYPHEN_RE = /\b(\d{3}-\d{2}-\d{5})\b/;

/** Naver Place / Kakao Map / Google Maps identity hosts. */
export const PLACE_MAP_HOST_RE =
	/(?:map\.naver\.com|place\.naver\.com|m\.place\.naver\.com|pcmap\.place\.naver\.com|place\.map\.kakao\.com|map\.kakao\.com|maps\.google(?:apis)?\.com|google\.[a-z.]+\/maps|goo\.gl\/maps|g\.page)/i;

const PERSON_TYPES = new Set(['Person', 'Physician', 'Dentist', 'VeterinaryCare']);

const ORG_TYPES = new Set([
	'Organization',
	'MedicalClinic',
	'Hospital',
	'Dentist',
	'Physician',
	'VeterinaryCare',
	'MedicalBusiness',
	'Pharmacy',
	'LegalService',
	'Attorney',
	'AccountingService',
	'HomeAndConstructionBusiness',
	'HealthClub',
	'ExerciseGym',
	'EducationalOrganization',
	'RealEstateAgent',
	'ProfessionalService',
	'LocalBusiness',
	'Store',
	'Restaurant',
	'BeautySalon',
	'OnlineStore',
	'SoftwareApplication',
	'Manufacturer',
]);

const PERSON_TO_ORG_KEYS = ['worksFor', 'affiliation'] as const;
const ORG_TO_PERSON_KEYS = ['founder', 'alumniOf', 'employee', 'employees', 'physician', 'director', 'member'] as const;

const TITLE_AS_NAME = /^(대표자명?|대표이사|대표원장|대표변호사|대표세무사|대표자|원장|이사|CEO|C\.E\.O\.?)$/i;

const NOISE_NAME =
	/^(상호|사업자|등록|번호|전화|주소|이메일|상담|문의|copyright|rights|reserved)$/i;

const NAME_PARTICLE_TAIL = /(?:으로|에서|에게|부터|까지|이다|입니다|하며|하고|하여)$/;

/** Common nouns / particles that must never compile as Person.name. */
export const REP_NAME_STOPWORDS = new Set([
	'제품으로',
	'제품',
	'대표',
	'문의',
	'안내',
	'상담',
	'진료',
	'정보',
	'병원',
	'연구소',
	'센터',
	'소개',
	'상호',
	'사업자',
	'등록',
	'번호',
	'전화',
	'주소',
	'이메일',
	'고객센터',
	'의료진',
	'연구팀',
	'진료안내',
	'상담실',
	'인사말',
	'오시는길',
	'바로가기',
	'더보기',
	'이사회',
	'이사',
]);

const HREF_RE = /<a\b[^>]*\bhref\s*=\s*['"]([^'"]+)['"]/gi;

export interface ExtractedRepresentative {
	name: string;
	jobTitle: string;
	isExtracted: boolean;
	source: 'schema' | 'footer' | 'none';
}

export interface PlaceIdentity {
	/** Numeric CID / place id when available; otherwise the map URL. */
	cid: string;
	urls: string[];
}

export interface PersonKgLink {
	linked: boolean;
	personName: string;
	personJobTitle: string;
	personId: string;
	orgId: string;
}

export interface SameAsFidelity {
	complete: boolean;
	count: number;
	snsCount: number;
	placeCount: number;
	urls: string[];
}

/**
 * Weekday/night-hours coverage computed from every `OpeningHoursSpecification`
 * row reachable in the JSON-LD graph — not just a raw "is something present" flag.
 */
export interface OpeningHoursCoverage {
	complete: boolean;
	/** False when no structured JSON-LD row could be parsed (raw-text fallback only). */
	parsed: boolean;
	/** Distinct Mon–Sat days with a valid opens/closes pair. */
	weekdayCount: number;
	/** True once weekdayCount reaches the 4-day-or-more completeness bar. */
	weekdayPass: boolean;
	/** True when any valid row's closing time reaches the night-care threshold (19:30+). */
	nightHoursPass: boolean;
	/** True when Saturday or Sunday carries a valid opens/closes pair. */
	weekendPass: boolean;
	/** Normalized day names actually covered, in week order (Mon–Sat). */
	coveredDays: string[];
}

export interface SchemaFiveProperties {
	entityType: { complete: boolean; value: string };
	sameAs: SameAsFidelity;
	geo: { complete: boolean; latitude: string; longitude: string };
	openingHours: OpeningHoursCoverage;
	availableService: { complete: boolean; count: number; categoryCount: number };
}

export interface UniversalEntityPack {
	representative: ExtractedRepresentative;
	taxId: string;
	place: PlaceIdentity;
	sameAs: string[];
	personKg: PersonKgLink;
	schema: SchemaFiveProperties;
}

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
	return textOf(obj.name) || textOf(obj.value) || textOf(obj.text);
}

function typeList(node: Record<string, unknown>): string[] {
	const raw = node['@type'];
	if (typeof raw === 'string') return [raw.replace(/^https?:\/\/schema\.org\//i, '')];
	if (Array.isArray(raw)) {
		return raw.map((item) => String(item).replace(/^https?:\/\/schema\.org\//i, '')).filter(Boolean);
	}
	return [];
}

/**
 * `@type`-array-safe business/organization check. Schema.org nodes are
 * frequently multi-typed (e.g. `["MedicalClinic","Physician","LocalBusiness"]`),
 * so this accepts a single type string or the raw array and matches if *any*
 * entry resolves to a recognized org/business entity.
 */
export function isTargetOrgType(types: string | readonly string[] | null | undefined): boolean {
	if (!types) return false;
	const list = Array.isArray(types) ? types : [types];
	return list.some((raw) => {
		const t = String(raw).replace(/^https?:\/\/schema\.org\//i, '').trim();
		return Boolean(t) && (ORG_TYPES.has(t) || /Organization|Business|Clinic|Hospital|Store|Service$/i.test(t));
	});
}

function nodeId(node: Record<string, unknown>): string {
	return compact(String(node['@id'] || node.id || ''));
}

function refId(value: unknown): string {
	if (typeof value === 'string') {
		const raw = compact(value);
		if (!raw) return '';
		if (raw.startsWith('#') || raw.startsWith('/') || /^https?:\/\//i.test(raw)) return raw;
		return '';
	}
	const rec = asRecord(value);
	return rec ? nodeId(rec) : '';
}

function idsMatch(a: string, b: string): boolean {
	if (!a || !b) return false;
	const left = a.replace(/\/+$/, '').toLowerCase();
	const right = b.replace(/\/+$/, '').toLowerCase();
	return left === right || left.endsWith(right) || right.endsWith(left);
}

function extractLooseJsonLdBlocks(text: string): string[] {
	const blocks: string[] = [];
	let i = 0;
	while (i < text.length) {
		const start = text.indexOf('{', i);
		if (start < 0) break;
		let depth = 0;
		let inStr = false;
		let esc = false;
		let closed = false;
		for (let j = start; j < text.length; j += 1) {
			const ch = text[j];
			if (inStr) {
				if (esc) esc = false;
				else if (ch === '\\') esc = true;
				else if (ch === '"') inStr = false;
				continue;
			}
			if (ch === '"') inStr = true;
			else if (ch === '{') depth += 1;
			else if (ch === '}') {
				depth -= 1;
				if (depth === 0) {
					const block = text.slice(start, j + 1);
					if (/"@type"\s*:/.test(block)) blocks.push(block);
					i = j + 1;
					closed = true;
					break;
				}
			}
		}
		if (!closed) i = start + 1;
	}
	return blocks;
}

function pushParsedNodes(raw: string, nodes: Record<string, unknown>[]): void {
	const parsed = parseJsonLdDocument(raw);
	if (!parsed) return;
	walkJsonLdNodes(parsed, (node) => nodes.push(node));
}

function collectNodes(htmlText: string): Record<string, unknown>[] {
	const nodes: Record<string, unknown>[] = [];
	const fromHtml = collectJsonLdNodesFromHtml(htmlText);
	if (fromHtml.length) nodes.push(...fromHtml);
	if (!nodes.length) {
		const trimmed = compact(htmlText);
		if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
			pushParsedNodes(trimmed, nodes);
		}
	}
	if (!nodes.length) {
		for (const block of extractLooseJsonLdBlocks(htmlText)) {
			pushParsedNodes(block, nodes);
		}
	}
	return nodes;
}

function isPersonType(node: Record<string, unknown>): boolean {
	return typeList(node).some((type) => PERSON_TYPES.has(type));
}

function isOrgType(node: Record<string, unknown>): boolean {
	return isTargetOrgType(typeList(node));
}

export function isNoiseRepresentativeName(raw: string | null | undefined): boolean {
	const name = compact(raw);
	if (!name) return true;
	if (TITLE_AS_NAME.test(name) || NOISE_NAME.test(name)) return true;
	if (REP_NAME_STOPWORDS.has(name)) return true;
	if (NAME_PARTICLE_TAIL.test(name)) return true;
	if (/병원|연구소|센터|안내|소개|진료안내|고객센터|상담실|의료진|연구팀/.test(name)) return true;
	return false;
}

export function looksLikePersonName(raw: string | null | undefined): boolean {
	const name = compact(raw).replace(/\s*(전화|주소|사업자|이메일|TEL|Copyright).*$/i, '');
	if (!name) return false;
	if (isNoiseRepresentativeName(name)) return false;
	if (/^[가-힣]{2,5}$/.test(name)) return true;
	if (/^[A-Za-z][A-Za-z.\s-]{1,28}$/.test(name) && name.replace(/[^A-Za-z]/g, '').length >= 2) {
		return true;
	}
	return false;
}

function normalizeJobTitle(raw: string | null | undefined): string {
	const title = compact(raw).replace(/\.$/, '');
	if (!title) return '';
	if (/^c\.?e\.?o\.?$/i.test(title)) return 'CEO';
	if (title === '대표자명') return '대표자';
	return title;
}

function inferJobTitle(htmlText: string, matchedTitle?: string): string {
	const fromMatch = normalizeJobTitle(matchedTitle);
	if (fromMatch && fromMatch !== '대표자명') return fromMatch;
	if (/대표이사/.test(htmlText)) return '대표이사';
	if (/대표원장/.test(htmlText)) return '대표원장';
	if (/대표변호사/.test(htmlText)) return '대표변호사';
	if (/원장/.test(htmlText)) return '원장';
	if (/대표자/.test(htmlText)) return '대표자';
	return '대표';
}

function personFromNode(
	node: Record<string, unknown>,
	fallbackTitle?: string,
): { name: string; jobTitle: string; id: string } | null {
	const name = textOf(node.name);
	if (!looksLikePersonName(name)) return null;
	const jobTitle = normalizeJobTitle(textOf(node.jobTitle) || textOf(node.roleName) || fallbackTitle);
	return { name, jobTitle, id: nodeId(node) };
}

function extractLinkedPerson(
	node: Record<string, unknown>,
	key: string,
	fallbackTitle?: string,
): { name: string; jobTitle: string; id: string } | null {
	const value = node[key];
	if (!value) return null;
	if (typeof value === 'string' && looksLikePersonName(value)) {
		return { name: compact(value), jobTitle: fallbackTitle || '', id: '' };
	}
	if (Array.isArray(value)) {
		for (const item of value) {
			if (typeof item === 'string' && looksLikePersonName(item)) {
				return { name: compact(item), jobTitle: fallbackTitle || '', id: '' };
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

/** JSON-LD `@type: Person` (and founder / physician links) — 1st-priority representative. */
export function extractSchemaPerson(htmlText: string): { name: string; jobTitle: string; id: string } | null {
	const nodes = collectNodes(htmlText);
	const founders: Array<{ name: string; jobTitle: string; id: string }> = [];
	const titledPeople: Array<{ name: string; jobTitle: string; id: string }> = [];
	const people: Array<{ name: string; jobTitle: string; id: string }> = [];

	for (const node of nodes) {
		const founder =
			extractLinkedPerson(node, 'founder', '대표자') || extractLinkedPerson(node, 'director', '대표');
		if (founder) founders.push(founder);

		for (const key of ['employee', 'employees', 'physician', 'alumni', 'member'] as const) {
			const linked = extractLinkedPerson(node, key, key === 'physician' ? '원장' : '');
			if (linked) {
				if (/대표|원장|이사|CEO/i.test(linked.jobTitle)) titledPeople.push(linked);
				else people.push(linked);
			}
		}

		if (isPersonType(node)) {
			const person = personFromNode(node);
			if (person) {
				if (/대표|원장|이사|CEO/i.test(person.jobTitle)) titledPeople.push(person);
				else people.push(person);
			}
		}
	}

	return founders[0] || titledPeople[0] || people[0] || null;
}

function extractFromLabeledFooter(text: string): { name: string; jobTitle: string } | null {
	FOOTER_REP_NAME_RE.lastIndex = 0;
	const ko = text.match(FOOTER_REP_NAME_RE);
	if (ko?.[1] && looksLikePersonName(ko[1])) {
		const prefix = compact(ko[0].slice(0, Math.max(0, ko[0].length - ko[1].length)));
		const titleMatch = prefix.match(
			/대표원장|대표이사|대표자명|대표변호사|대표세무사|대표공인중개사|대표자|원장|대표/,
		);
		return { name: compact(ko[1]), jobTitle: normalizeJobTitle(titleMatch?.[0]) };
	}
	FOOTER_REP_NAME_EN_RE.lastIndex = 0;
	const en = text.match(FOOTER_REP_NAME_EN_RE);
	if (en?.[1] && looksLikePersonName(en[1])) {
		const prefix = compact(en[0].slice(0, Math.max(0, en[0].length - en[1].length)));
		const titleMatch = prefix.match(/대표원장|대표이사|대표자|대표|CEO|C\.E\.O\.?/i);
		return { name: compact(en[1]), jobTitle: normalizeJobTitle(titleMatch?.[0]) };
	}
	return null;
}

export function extractRepresentativeName(
	htmlText: string,
	lang: UniversalEntityLang = 'ko',
): ExtractedRepresentative {
	const schema = extractSchemaPerson(htmlText);
	if (schema?.name) {
		return {
			name: schema.name,
			jobTitle: schema.jobTitle,
			isExtracted: true,
			source: 'schema',
		};
	}
	const text = compact(htmlText.replace(/<[^>]+>/g, ' '));
	const labeled = extractFromLabeledFooter(text);
	if (labeled) {
		return {
			name: labeled.name,
			jobTitle: labeled.jobTitle || inferJobTitle(text, labeled.jobTitle),
			isExtracted: true,
			source: 'footer',
		};
	}
	return {
		name: MISSING_REP_NAME[lang] || MISSING_REP_NAME.ko,
		jobTitle: inferJobTitle(text),
		isExtracted: false,
		source: 'none',
	};
}

/** UI label: "배우리 (대표원장)". */
export function formatRepresentativeParen(
	name: string | null | undefined,
	jobTitle: string | null | undefined,
	lang: UniversalEntityLang = 'ko',
): string {
	const person = compact(name) || MISSING_REP_NAME[lang];
	const title = compact(jobTitle);
	return title ? `${person} (${title})` : person;
}

export function normalizeTaxId(value: string | null | undefined): string {
	const digits = (value || '').replace(/\D/g, '');
	if (digits.length !== 10) return compact(value);
	return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
}

function taxFromNodes(nodes: Record<string, unknown>[]): string {
	for (const node of nodes) {
		const raw = compact(textOf(node.taxID) || textOf(node.vatID) || textOf(node.leiCode));
		if (!raw) continue;
		const digits = raw.replace(/\D/g, '');
		if (digits.length === 10 || /^\d{3}-?\d{2}-?\d{5}$/.test(raw)) return normalizeTaxId(raw);
	}
	return '';
}

export function extractTaxIdPrecise(corpus: string): string {
	const nodes = collectNodes(corpus);
	const fromSchema = taxFromNodes(nodes);
	if (fromSchema) return fromSchema;
	const labeled = corpus.match(TAX_ID_LABELED_RE);
	if (labeled?.[1]) return normalizeTaxId(labeled[1]);
	const hyphen = corpus.match(TAX_ID_HYPHEN_RE);
	return hyphen?.[1] ? normalizeTaxId(hyphen[1]) : '';
}

function normalizeHref(raw: string): string {
	const value = compact(raw).replace(/[.,);]+$/g, '');
	if (!value) return '';
	try {
		const url = new URL(value.startsWith('http') ? value : `https://${value.replace(/^\/\//, '')}`);
		url.hash = '';
		url.protocol = 'https:';
		return url.toString().replace(/\/$/, '');
	} catch {
		return '';
	}
}

function isPlaceMapUrl(url: string): boolean {
	return PLACE_MAP_HOST_RE.test(url);
}

function cidFromUrl(url: string): string {
	const fromQuery = url.match(/(?:cid|ludocid)=(\d{8,})/i);
	if (fromQuery?.[1]) return fromQuery[1];
	const fromNaver = url.match(
		/(?:place\.naver\.com|map\.naver\.com|m\.place\.naver\.com|pcmap\.place\.naver\.com)\/[^\s"'<>]*?\/(\d{8,})/i,
	);
	if (fromNaver?.[1]) return fromNaver[1];
	const fromKakao = url.match(/(?:place\.map\.kakao\.com|map\.kakao\.com)\/(?:[^/\s"'<>]+\/)*(\d{6,})/i);
	if (fromKakao?.[1]) return fromKakao[1];
	if (/goo\.gl\/maps\//i.test(url) || /google\.[a-z.]+\/maps/i.test(url) || /maps\.google/i.test(url)) {
		return url;
	}
	if (/^\d{8,}$/.test(url)) return url;
	if (isPlaceMapUrl(url)) return url;
	return '';
}

function collectHrefUrls(corpus: string): string[] {
	const urls: string[] = [];
	HREF_RE.lastIndex = 0;
	let match: RegExpExecArray | null;
	while ((match = HREF_RE.exec(corpus)) !== null) {
		const url = normalizeHref(match[1]);
		if (url) urls.push(url);
	}
	for (const hit of corpus.match(/https?:\/\/[^\s"'\\<>]+/gi) ?? []) {
		const url = normalizeHref(hit);
		if (url) urls.push(url);
	}
	return urls;
}

function sameAsFromNodes(nodes: Record<string, unknown>[]): string[] {
	const urls: string[] = [];
	for (const node of nodes) {
		const sameAs = node.sameAs;
		if (typeof sameAs === 'string') urls.push(normalizeHref(sameAs));
		else if (Array.isArray(sameAs)) {
			for (const item of sameAs) {
				if (typeof item === 'string') urls.push(normalizeHref(item));
			}
		}
	}
	return urls.filter(Boolean);
}

export function classifyOfficialSameAs(urls: readonly string[]): { sns: string[]; place: string[] } {
	const sns: string[] = [];
	const place: string[] = [];
	for (const url of urls) {
		if (isPlaceMapUrl(url)) place.push(url);
		else sns.push(url);
	}
	return { sns, place };
}

/** Shared sameAs fidelity used by the entity gauge and the 5-property checklist. */
export function sameAsFidelityFromUrls(urls: readonly string[]): SameAsFidelity {
	const { sns, place } = classifyOfficialSameAs(urls);
	return {
		complete: urls.length >= 2,
		count: urls.length,
		snsCount: sns.length,
		placeCount: place.length,
		urls: [...urls],
	};
}

export function formatSameAsCheckDetail(fidelity: SameAsFidelity, lang: UniversalEntityLang = 'ko'): string {
	const { snsCount, placeCount, count } = fidelity;
	if (lang === 'en') {
		if (snsCount > 0 && placeCount === 0) return `SNS ${snsCount} registered (Maps/Place missing)`;
		if (snsCount === 0 && placeCount > 0) return `Maps/Place ${placeCount} registered (SNS missing)`;
		return `${count} official SNS / map links`;
	}
	if (snsCount > 0 && placeCount === 0) return `SNS ${snsCount}개 등록됨 (지도/플레이스 미등록)`;
	if (snsCount === 0 && placeCount > 0) return `지도/플레이스 ${placeCount}개 (SNS 미등록)`;
	return `공식 SNS·지도/플레이스 ${count}개`;
}

export function collectOfficialSameAs(corpus: string, extra: readonly string[] = []): string[] {
	const nodes = collectNodes(corpus);
	const seen = new Set<string>();
	const out: string[] = [];
	const push = (raw: string) => {
		const url = normalizeHref(raw);
		if (!url) return;
		if (!isOfficialChannelUrl(url) && !isPlaceMapUrl(url)) return;
		const key = url.replace(/\/+$/, '').toLowerCase();
		if (seen.has(key)) return;
		seen.add(key);
		out.push(url);
	};
	for (const url of extra) push(url);
	for (const url of extractUniversalSameAs(corpus, extra)) push(url);
	for (const url of sameAsFromNodes(nodes)) push(url);
	for (const url of collectHrefUrls(corpus)) push(url);
	return out;
}

export function extractPlaceIdentity(corpus: string, extra: readonly string[] = []): PlaceIdentity {
	const urls = collectOfficialSameAs(corpus, extra).filter((url) => isPlaceMapUrl(url));
	let cid = '';
	for (const url of urls) {
		const found = cidFromUrl(url);
		if (found && /^\d{6,}$/.test(found)) {
			cid = found;
			break;
		}
		if (!cid && found) cid = found;
	}
	if (!cid) {
		const loose = cidFromUrl(corpus);
		if (loose) cid = loose;
	}
	return { cid, urls };
}

export function extractPlaceCidPrecise(value: string | null | undefined): string {
	const raw = compact(value);
	if (!raw) return '';
	return extractPlaceIdentity(raw).cid || cidFromUrl(raw);
}

function valuesOf(node: Record<string, unknown>, key: string): unknown[] {
	const value = node[key];
	if (value == null) return [];
	return Array.isArray(value) ? value : [value];
}

export function detectPersonKnowledgeGraph(corpus: string): PersonKgLink {
	const nodes = collectNodes(corpus);
	const people = nodes.filter(isPersonType);
	const orgs = nodes.filter(isOrgType);
	const empty: PersonKgLink = { linked: false, personName: '', personJobTitle: '', personId: '', orgId: '' };

	if (!people.length && !orgs.length) return empty;

	const namedPeople = people
		.map((node) => personFromNode(node))
		.filter((item): item is NonNullable<typeof item> => Boolean(item));

	for (const person of people) {
		const parsed = personFromNode(person);
		const pid = nodeId(person);
		for (const key of PERSON_TO_ORG_KEYS) {
			for (const ref of valuesOf(person, key)) {
				const nested = asRecord(ref);
				const rid = refId(ref);
				const matchedOrg = orgs.find((org) => (rid && idsMatch(nodeId(org), rid)) || (nested && org === nested));
				if (nested && isOrgType(nested)) {
					return {
						linked: true,
						personName: parsed?.name || '',
						personJobTitle: parsed?.jobTitle || '',
						personId: pid,
						orgId: nodeId(nested) || rid,
					};
				}
				if (matchedOrg) {
					return {
						linked: true,
						personName: parsed?.name || '',
						personJobTitle: parsed?.jobTitle || '',
						personId: pid,
						orgId: nodeId(matchedOrg),
					};
				}
			}
		}
	}

	for (const org of orgs) {
		const oid = nodeId(org);
		for (const key of ORG_TO_PERSON_KEYS) {
			for (const ref of valuesOf(org, key)) {
				const nested = asRecord(ref);
				const rid = refId(ref);
				const matchedPerson =
					people.find((person) => rid && idsMatch(nodeId(person), rid)) ||
					(nested && isPersonType(nested) ? nested : null);
				if (nested && (isPersonType(nested) || looksLikePersonName(textOf(nested.name)))) {
					const parsed = personFromNode(nested) || namedPeople[0];
					return {
						linked: true,
						personName: parsed?.name || textOf(nested.name),
						personJobTitle: parsed?.jobTitle || '',
						personId: nodeId(nested) || rid,
						orgId: oid,
					};
				}
				if (matchedPerson) {
					const parsed = personFromNode(matchedPerson) || namedPeople[0];
					return {
						linked: true,
						personName: parsed?.name || '',
						personJobTitle: parsed?.jobTitle || '',
						personId: nodeId(matchedPerson),
						orgId: oid,
					};
				}
			}
		}
	}

	const first = namedPeople[0];
	return first
		? { linked: false, personName: first.name, personJobTitle: first.jobTitle, personId: first.id, orgId: '' }
		: empty;
}

function geoFromNodes(nodes: Record<string, unknown>[]): { latitude: string; longitude: string } {
	for (const node of nodes) {
		const geo = asRecord(node.geo) || (typeList(node).some((t) => /GeoCoordinates/i.test(t)) ? node : null);
		const lat = compact(textOf(geo?.latitude) || textOf(node.latitude));
		const lng = compact(textOf(geo?.longitude) || textOf(node.longitude));
		if (lat && lng && /^-?\d+(\.\d+)?$/.test(lat) && /^-?\d+(\.\d+)?$/.test(lng)) {
			return { latitude: lat, longitude: lng };
		}
	}
	return { latitude: '', longitude: '' };
}

/** Week order used both for `Mo-Fr` range expansion and Mon–Sat coverage counting. */
const WEEK_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;
const MON_TO_SAT: readonly string[] = WEEK_ORDER.slice(0, 6);

/** `openingHours` shorthand (Mo, Tue, Wed, …) → canonical schema.org day name. */
const DAY_ABBR_TO_FULL: Record<string, string> = {
	mo: 'Monday',
	mon: 'Monday',
	tu: 'Tuesday',
	tue: 'Tuesday',
	tues: 'Tuesday',
	we: 'Wednesday',
	wed: 'Wednesday',
	th: 'Thursday',
	thu: 'Thursday',
	thur: 'Thursday',
	thurs: 'Thursday',
	fr: 'Friday',
	fri: 'Friday',
	sa: 'Saturday',
	sat: 'Saturday',
	su: 'Sunday',
	sun: 'Sunday',
};

const FULL_DAY_RE = /(sunday|monday|tuesday|wednesday|thursday|friday|saturday)/i;

/** Nightly-closing bar — 19:30 covers both the 19:30 and 20:00 targets requested for night care. */
const NIGHT_HOURS_THRESHOLD_MINUTES = 19 * 60 + 30;

function canonicalDayName(raw: string): string | null {
	const match = compact(raw).match(FULL_DAY_RE);
	if (!match) return null;
	const word = match[1].toLowerCase();
	return word.charAt(0).toUpperCase() + word.slice(1);
}

function expandDayRange(startToken: string, endToken: string): string[] {
	const start = canonicalDayName(startToken) || DAY_ABBR_TO_FULL[startToken.toLowerCase()];
	const end = canonicalDayName(endToken) || DAY_ABBR_TO_FULL[endToken.toLowerCase()];
	const startIdx = start ? WEEK_ORDER.indexOf(start as (typeof WEEK_ORDER)[number]) : -1;
	const endIdx = end ? WEEK_ORDER.indexOf(end as (typeof WEEK_ORDER)[number]) : -1;
	if (startIdx === -1 || endIdx === -1) return [];
	const out: string[] = [];
	for (let i = startIdx, guard = 0; guard <= WEEK_ORDER.length; guard += 1) {
		out.push(WEEK_ORDER[i]);
		if (i === endIdx) break;
		i = (i + 1) % WEEK_ORDER.length;
	}
	return out;
}

/** Expands one comma-separated day token — a full name, an abbreviation, or an "Mo-Fr" range. */
function expandDayToken(token: string): string[] {
	const raw = compact(token);
	if (!raw) return [];
	const range = raw.match(/^([A-Za-z]{2,9})\s*-\s*([A-Za-z]{2,9})$/);
	if (range) {
		const expanded = expandDayRange(range[1], range[2]);
		if (expanded.length) return expanded;
	}
	const full = canonicalDayName(raw);
	if (full) return [full];
	const abbr = DAY_ABBR_TO_FULL[raw.toLowerCase()];
	return abbr ? [abbr] : [];
}

/**
 * Normalizes any `dayOfWeek` shape into standard English day names:
 * a single string ("Monday"), an array (["Monday","Tuesday"]), a schema.org
 * URI ("https://schema.org/Friday"), or an `openingHours` shorthand token
 * embedded with a time range ("Mo 09:30-18:30", "Mo-Fr 09:00-18:00").
 * Unknown tokens are dropped rather than throwing.
 */
export function normalizeDayOfWeek(value: unknown): string[] {
	if (value == null) return [];
	const items = Array.isArray(value) ? value : [value];
	const out: string[] = [];
	const push = (day: string) => {
		if (day && !out.includes(day)) out.push(day);
	};
	for (const item of items) {
		if (item == null) continue;
		const rec = asRecord(item);
		const raw = compact(rec ? textOf(rec.name) || String(rec['@id'] || '') : String(item));
		if (!raw) continue;
		const stripped = raw.replace(/^https?:\/\/schema\.org\//i, '').trim();
		const direct = canonicalDayName(stripped) || DAY_ABBR_TO_FULL[stripped.toLowerCase()];
		if (direct) {
			push(direct);
			continue;
		}
		// Shorthand day tokens that precede a time range, e.g. "Mo,We-Fr 09:30-18:30".
		const dayPart = stripped.match(/^[A-Za-z,\-\s]+/)?.[0] || '';
		for (const token of dayPart.split(',')) {
			expandDayToken(token).forEach(push);
		}
	}
	return out;
}

/** Parses "HH:mm" (optionally "HH:mm:ss") into minutes since midnight; null when unparsable. */
function parseClockMinutes(raw: unknown): number | null {
	const value = compact(textOf(raw));
	const match = value.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
	if (!match) return null;
	const hours = Number(match[1]);
	const minutes = Number(match[2]);
	if (!Number.isFinite(hours) || !Number.isFinite(minutes) || minutes > 59) return null;
	return hours * 60 + minutes;
}

interface OpeningHoursRow {
	days: string[];
	opensMinutes: number | null;
	closesMinutes: number | null;
}

/** Splits an `openingHours` shorthand string into day/time groups, e.g. "Mo-Fr 09:00-18:00 Sa 09:00-13:00". */
function parseOpeningHoursShorthand(raw: string): OpeningHoursRow[] {
	const rows: OpeningHoursRow[] = [];
	const dayToken = 'mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun|mo|tu|we|th|fr|sa|su';
	const groupRe = new RegExp(
		`((?:${dayToken})(?:\\s*[-,]\\s*(?:${dayToken}))*)\\s+(\\d{1,2}:\\d{2})\\s*-\\s*(\\d{1,2}:\\d{2})`,
		'gi',
	);
	let match: RegExpExecArray | null;
	while ((match = groupRe.exec(raw)) !== null) {
		const days = normalizeDayOfWeek(match[1]);
		if (!days.length) continue;
		rows.push({ days, opensMinutes: parseClockMinutes(match[2]), closesMinutes: parseClockMinutes(match[3]) });
	}
	return rows;
}

function pushSpecRow(rows: OpeningHoursRow[], spec: Record<string, unknown>): void {
	const days = normalizeDayOfWeek(spec.dayOfWeek);
	const opensMinutes = parseClockMinutes(spec.opens);
	const closesMinutes = parseClockMinutes(spec.closes);
	if (!days.length && opensMinutes == null && closesMinutes == null) return;
	// A spec without an explicit dayOfWeek is schema.org shorthand for "every day".
	rows.push({ days: days.length ? days : [...WEEK_ORDER], opensMinutes, closesMinutes });
}

/**
 * Depth-bounded, cycle-safe walk over every nested object reachable from
 * `roots` — every key, not a fixed whitelist. Several schema properties
 * (`OpeningHoursSpecification`, `hasOfferCatalog`, …) get attached by CMS
 * templates under arbitrary keys (`department`, `provider`,
 * `subOrganization`, …), so a generic walk is what prevents those from
 * silently dropping out of the analysis.
 */
function forEachNestedNode(
	roots: Record<string, unknown>[],
	onNode: (node: Record<string, unknown>) => void,
	maxDepth = 6,
): void {
	const visited = new Set<Record<string, unknown>>();
	const visit = (node: Record<string, unknown>, depth: number) => {
		if (!node || visited.has(node) || depth > maxDepth) return;
		visited.add(node);
		onNode(node);
		for (const value of Object.values(node)) {
			if (Array.isArray(value)) {
				for (const item of value) {
					const rec = asRecord(item);
					if (rec) visit(rec, depth + 1);
				}
			} else {
				const rec = asRecord(value);
				if (rec) visit(rec, depth + 1);
			}
		}
	};
	for (const root of roots) visit(root, 0);
}

/**
 * Collects every opens/closes row reachable from `nodes`, regardless of
 * whether the `OpeningHoursSpecification` sits at the JSON-LD root, inside a
 * `@graph` entry, or nested under an arbitrary key. This deep walk is what
 * fixes the "@graph 계층 탐색 누락" false negative.
 */
function collectOpeningHoursRows(nodes: Record<string, unknown>[]): OpeningHoursRow[] {
	const rows: OpeningHoursRow[] = [];

	forEachNestedNode(nodes, (node) => {
		if (typeList(node).some((t) => /OpeningHoursSpecification/i.test(t))) {
			pushSpecRow(rows, node);
		}

		const spec = node.openingHoursSpecification;
		if (spec) {
			for (const row of Array.isArray(spec) ? spec : [spec]) {
				const rec = asRecord(row);
				if (rec) pushSpecRow(rows, rec);
			}
		}

		const shorthand = node.openingHours;
		if (typeof shorthand === 'string' && compact(shorthand)) {
			rows.push(...parseOpeningHoursShorthand(shorthand));
		} else if (Array.isArray(shorthand)) {
			for (const entry of shorthand) {
				if (typeof entry === 'string') rows.push(...parseOpeningHoursShorthand(entry));
			}
		}
	});

	return rows;
}

function evaluateOpeningHours(nodes: Record<string, unknown>[], corpus: string): OpeningHoursCoverage {
	const rows = collectOpeningHoursRows(nodes);
	const validRows = rows.filter((row) => row.opensMinutes != null && row.closesMinutes != null);

	const coveredDays = MON_TO_SAT.filter((day) => validRows.some((row) => row.days.includes(day)));
	const weekdayCount = coveredDays.length;
	const weekdayPass = weekdayCount >= 4;

	const nightHoursPass = validRows.some((row) => {
		const { opensMinutes, closesMinutes } = row;
		if (closesMinutes == null) return false;
		if (closesMinutes >= NIGHT_HOURS_THRESHOLD_MINUTES) return true;
		// A closing time earlier than the opening time means the shift wraps past midnight.
		return opensMinutes != null && closesMinutes < opensMinutes;
	});

	const weekendPass = validRows.some((row) => row.days.includes('Saturday') || row.days.includes('Sunday'));

	// Some templating engines emit OpeningHoursSpecification markup our
	// structured parser can't fully walk (e.g. single-quoted pseudo-JSON in an
	// inline script). A raw type match still counts as "present" so a real
	// property never regresses into a false-negative "missing" warning.
	const rawTypePresent = /"@type"\s*:\s*"OpeningHoursSpecification"/i.test(corpus);
	const parsed = rows.length > 0;

	return {
		complete: weekdayPass || (!parsed && rawTypePresent),
		parsed,
		weekdayCount,
		weekdayPass,
		nightHoursPass,
		weekendPass,
		coveredDays,
	};
}

interface ServiceCatalogItem {
	name: string;
	/** Parent OfferCatalog/category name, when the item was reached through one. */
	category: string;
}

/** Resolves a leaf Offer/Service row's display name across the shapes sites actually emit. */
function offerItemName(row: unknown): string {
	if (typeof row === 'string') return compact(row);
	const rec = asRecord(row);
	if (!rec) return '';
	const itemOffered = asRecord(rec.itemOffered);
	return (
		textOf(itemOffered?.name) ||
		textOf(rec.name) ||
		textOf(rec.serviceType) ||
		textOf(itemOffered?.serviceType) ||
		''
	);
}

function looksLikeOfferCatalog(rec: Record<string, unknown>): boolean {
	return typeList(rec).some((t) => /OfferCatalog/i.test(t)) || Array.isArray(rec.itemListElement);
}

/**
 * Flattens a (possibly multi-level) `OfferCatalog` — category catalogs whose
 * `itemListElement` rows are themselves `OfferCatalog` nodes are recursed
 * into, so a 2–3 level "카테고리 → 하위 카테고리 → 서비스" tree still yields
 * the real leaf services instead of just counting the top-level categories.
 */
function flattenOfferCatalog(
	catalog: Record<string, unknown>,
	out: ServiceCatalogItem[],
	categoryName = '',
	depth = 0,
): void {
	if (depth > 5) return;
	const catalogName = textOf(catalog.name) || categoryName;
	const rawItems = catalog.itemListElement;
	const rows = rawItems == null ? [] : Array.isArray(rawItems) ? rawItems : [rawItems];

	if (!rows.length) {
		// A catalog node with a name but no itemListElement still represents one named offering.
		if (catalogName) out.push({ name: catalogName, category: categoryName });
		return;
	}

	for (const row of rows) {
		if (typeof row === 'string') {
			if (compact(row)) out.push({ name: compact(row), category: catalogName });
			continue;
		}
		const rec = asRecord(row);
		if (!rec) continue;
		if (looksLikeOfferCatalog(rec)) {
			flattenOfferCatalog(rec, out, catalogName, depth + 1);
			continue;
		}
		const leafName = offerItemName(rec);
		out.push({ name: leafName || catalogName, category: catalogName });
	}
}

/**
 * Collects every service/offer reachable from `nodes` via `hasOfferCatalog`
 * (including multi-level nested categories) or `availableService`, no matter
 * which node in the graph carries the property.
 */
function collectServiceCatalogItems(nodes: Record<string, unknown>[]): ServiceCatalogItem[] {
	const items: ServiceCatalogItem[] = [];

	forEachNestedNode(nodes, (node) => {
		const catalog = node.hasOfferCatalog;
		if (catalog) {
			for (const row of Array.isArray(catalog) ? catalog : [catalog]) {
				const rec = asRecord(row);
				if (rec) flattenOfferCatalog(rec, items);
				else if (typeof row === 'string' && compact(row)) items.push({ name: compact(row), category: '' });
			}
		}

		const service = node.availableService;
		if (service) {
			for (const row of Array.isArray(service) ? service : [service]) {
				const name = offerItemName(row);
				if (name) items.push({ name, category: '' });
			}
		}
	});

	return items;
}

function evaluateAvailableService(nodes: Record<string, unknown>[]): { complete: boolean; count: number; categoryCount: number } {
	const items = collectServiceCatalogItems(nodes);
	const categoryCount = new Set(items.map((item) => item.category).filter(Boolean)).size;
	return { complete: items.length > 0, count: items.length, categoryCount };
}

function findEntityType(nodes: Record<string, unknown>[], schemaTypes: readonly string[] = []): string {
	const types = [
		...schemaTypes.map((t) => t.replace(/^https?:\/\/schema\.org\//i, '')),
		...nodes.flatMap(typeList),
	];
	return (
		[...ORG_TYPES].find((candidate) => types.some((t) => t.toLowerCase() === candidate.toLowerCase())) ||
		types.find((t) => t && t !== 'WebSite' && t !== 'WebPage' && t !== 'BreadcrumbList') ||
		''
	);
}

export function evaluateSchemaFiveProperties(
	corpus: string,
	opts?: { schemaTypes?: readonly string[]; expectedType?: string; sameAs?: readonly string[] },
): SchemaFiveProperties {
	const nodes = collectNodes(corpus);
	const sameAs = collectOfficialSameAs(corpus, opts?.sameAs);
	const geo = geoFromNodes(nodes);
	const entityType = findEntityType(nodes, opts?.schemaTypes);
	return {
		entityType: {
			complete: Boolean(entityType),
			value: entityType || opts?.expectedType || '',
		},
		sameAs: sameAsFidelityFromUrls(sameAs),
		geo: {
			complete: Boolean(geo.latitude && geo.longitude),
			latitude: geo.latitude,
			longitude: geo.longitude,
		},
		openingHours: evaluateOpeningHours(nodes, corpus),
		availableService: evaluateAvailableService(nodes),
	};
}

/** Detail line for the openingHoursSpecification check — surfaces the actual weekday/night/weekend read, not just a static label. */
export function formatOpeningHoursCheckDetail(
	coverage: OpeningHoursCoverage,
	lang: UniversalEntityLang = 'ko',
): string {
	if (!coverage.parsed) {
		return lang === 'en' ? 'Weekday / evening hours' : '요일/야간 영업시간';
	}
	if (lang === 'en') {
		const weekday = `${coverage.weekdayCount}/6 weekdays`;
		const night = coverage.nightHoursPass ? 'evening hours OK' : 'no evening hours';
		const weekend = coverage.weekendPass ? ' · weekend open' : '';
		return `Weekday / evening hours (${weekday}, ${night}${weekend})`;
	}
	const weekday = `요일 ${coverage.weekdayCount}/6`;
	const night = coverage.nightHoursPass ? '야간진료 충족' : '야간진료 미충족';
	const weekend = coverage.weekendPass ? ' · 주말진료' : '';
	return `요일/야간 영업시간 (${weekday} · ${night}${weekend})`;
}

/** Detail line for the hasOfferCatalog / availableService check — reports the actual flattened leaf/category counts. */
export function formatAvailableServiceCheckDetail(
	availableService: SchemaFiveProperties['availableService'],
	lang: UniversalEntityLang = 'ko',
): string {
	if (!availableService.complete) {
		return lang === 'en' ? 'Service / specialty catalog' : '서비스·진료과목 목록';
	}
	const category = availableService.categoryCount > 1 ? availableService.categoryCount : 0;
	if (lang === 'en') {
		return `Service / specialty catalog (${availableService.count} item${availableService.count === 1 ? '' : 's'}${
			category ? ` · ${category} categories` : ''
		})`;
	}
	return `서비스·진료과목 목록 (${availableService.count}개${category ? ` · ${category}개 카테고리` : ''})`;
}

export function schemaFiveToChecks(
	schema: SchemaFiveProperties,
	lang: UniversalEntityLang = 'ko',
): SchemaPropertyCheck[] {
	return [
		{
			id: 'entityType',
			label: '@type',
			complete: schema.entityType.complete,
			detail: schema.entityType.value,
		},
		{
			id: 'geoCoordinates',
			label: 'geo',
			complete: schema.geo.complete,
			detail:
				schema.geo.complete && schema.geo.latitude
					? `GeoCoordinates ${schema.geo.latitude}, ${schema.geo.longitude}`
					: lang === 'en'
						? 'GeoCoordinates latitude/longitude'
						: 'GeoCoordinates 위도/경도',
		},
		{
			id: 'openingHours',
			label: 'openingHoursSpecification',
			complete: schema.openingHours.complete,
			detail: formatOpeningHoursCheckDetail(schema.openingHours, lang),
		},
		{
			id: 'hasOfferCatalog',
			label: 'hasOfferCatalog / availableService',
			complete: schema.availableService.complete,
			detail: formatAvailableServiceCheckDetail(schema.availableService, lang),
		},
		{
			id: 'sameAs',
			label: 'sameAs',
			complete: schema.sameAs.complete,
			detail: formatSameAsCheckDetail(schema.sameAs, lang),
		},
	];
}

/** Parse JSON-LD + DOM into one E-E-A-T entity pack. */
export function parseUniversalEntity(
	corpus: string,
	opts?: {
		lang?: UniversalEntityLang;
		schemaTypes?: readonly string[];
		expectedType?: string;
		sameAs?: readonly string[];
	},
): UniversalEntityPack {
	const lang = opts?.lang || 'ko';
	const representative = extractRepresentativeName(corpus, lang);
	const taxId = extractTaxIdPrecise(corpus);
	const sameAs = collectOfficialSameAs(corpus, opts?.sameAs);
	const place = extractPlaceIdentity(corpus, sameAs);
	const personKg = detectPersonKnowledgeGraph(corpus);
	if (!representative.isExtracted && personKg.personName && looksLikePersonName(personKg.personName)) {
		representative.name = personKg.personName;
		representative.jobTitle = personKg.personJobTitle || representative.jobTitle;
		representative.isExtracted = true;
		representative.source = 'schema';
	}
	return {
		representative,
		taxId,
		place,
		sameAs,
		personKg,
		schema: evaluateSchemaFiveProperties(corpus, {
			schemaTypes: opts?.schemaTypes,
			expectedType: opts?.expectedType,
			sameAs,
		}),
	};
}
