/**
 * Universal Schema Generator — Strict Ground-Truth graph builder.
 *
 * Shared by GnuBoard/Youngcart (`extend/redue.schema.php`), WordPress
 * (`mu-plugins/redue-schema.php`), and the Vanilla JS SaaS injector.
 * Nodes and keys are created only from verified facts. Empty / invented
 * values are omitted — never replaced with 홍길동, 050-0000-0000, 대표자명,
 * /logo.png, or any other placeholder.
 */

import { isUiStopword } from '@/lib/geo/clean-medical-entities';
import {
	ENTITY_SAME_AS_HOSTS,
	filterOfficialSameAs,
	type AvailableServiceNode,
} from '@/lib/audit/extractors/schema-entity-pack';
import { mergeServiceCatalog } from '@/lib/solve/core/service-catalog';

export const STRICT_SCHEMA_ENGINE_ID = 'redue-universal-schema';

/** Values the generator must never bake as defaults (extracted site text is still allowed). */
export const INVENTED_DEFAULT_NAMES = ['대표자명', '임의의 대표자', '홍길동'] as const;

export const INVENTED_DUMMY_PHONES = [
	'050-0000-0000',
	'02-0000-0000',
	'000-000-0000',
	'000-0000-0000',
	'00-0000-0000',
] as const;

export const INVENTED_DUMMY_TAX_IDS = ['000-00-00000', '0000000000', '111-11-11111', '1111111111'] as const;

export const TITLE_ONLY_REP_NAMES = [
	'대표',
	'대표자',
	'대표자명',
	'대표원장',
	'대표이사',
	'원장',
	'이사장',
	'수의사',
	'의료진',
	'CEO',
] as const;

/** GNB chrome that is not a service / procedure name. */
export const CATALOG_MENU_STOPWORDS = [
	'홈',
	'메인',
	'home',
	'소개',
	'about',
	'contact',
	'문의',
	'예약',
	'로그인',
	'회원가입',
	'사이트맵',
	'이용약관',
	'개인정보처리방침',
	'개인정보취급방침',
	'더보기',
	'바로가기',
	'오시는길',
	'찾아오시는길',
	'인사말',
	'공지사항',
	'게시판',
	'커뮤니티',
	'갤러리',
	'위치',
	'안내',
] as const;

export type GroundTruthService = string | { name: string; url?: string; type?: string; category?: string; description?: string };

export type GroundTruthFacts = {
	origin: string;
	siteName?: string;
	pageUrl?: string;
	pageName?: string;
	pageType?: string;
	description?: string;
	logo?: string;
	orgTypes?: string[];
	telephone?: string;
	faxNumber?: string;
	taxId?: string;
	streetAddress?: string;
	addressLocality?: string;
	addressRegion?: string;
	postalCode?: string;
	latitude?: string;
	longitude?: string;
	repName?: string;
	repTitle?: string;
	/** Official personal profile / SNS URLs for the founder Person node. */
	repSameAs?: string[];
	alumniOf?: string;
	knowsAbout?: string[];
	sameAs?: string[];
	services?: GroundTruthService[];
	navItems?: Array<{ name?: string; url?: string }>;
	/** True when taxID was captured next to a 사업자번호 label (pattern match, checksum optional). */
	taxIdLabeled?: boolean;
};

export type StrictJsonLdNode = Record<string, unknown>;

export type StrictSchemaGraph = {
	'@context': 'https://schema.org';
	'@graph': StrictJsonLdNode[];
};

function compact(value: string | null | undefined): string {
	return String(value || '')
		.replace(/\s+/g, ' ')
		.trim();
}

function originOf(raw: string): string {
	return compact(raw).replace(/\/+$/, '');
}

export function isInventedDefaultName(value: string | null | undefined): boolean {
	const name = compact(value);
	if (!name) return true;
	return (INVENTED_DEFAULT_NAMES as readonly string[]).includes(name);
}

export function isTitleOnlyRepName(value: string | null | undefined): boolean {
	const name = compact(value);
	if (!name) return true;
	return (TITLE_ONLY_REP_NAMES as readonly string[]).some((t) => t.toLowerCase() === name.toLowerCase());
}

/** Person.name — real extracted name only. Titles like 대표원장 are not names. */
export function isValidGroundTruthRepName(value: string | null | undefined): boolean {
	const name = compact(value);
	if (!name) return false;
	if (name === '대표자명') return false;
	if (isTitleOnlyRepName(name)) return false;
	if (!/^([가-힣]{2,4}|[A-Za-z][A-Za-z.\s]{1,19})$/.test(name)) return false;
	return true;
}

export function isDummyPhoneNumber(value: string | null | undefined): boolean {
	const raw = compact(value);
	if (!raw) return true;
	const digits = raw.replace(/\D/g, '');
	if (!digits) return true;
	if (/^0+$/.test(digits) || /^(\d)\1+$/.test(digits)) return true;
	const hyphen = raw.replace(/\s+/g, '');
	return (INVENTED_DUMMY_PHONES as readonly string[]).includes(hyphen);
}

export function isDummyTaxId(value: string | null | undefined): boolean {
	const raw = compact(value).replace(/\s+/g, '');
	if (!raw) return true;
	const digits = raw.replace(/\D/g, '');
	if (!digits || /^0+$/.test(digits) || /^(\d)\1+$/.test(digits)) return true;
	return (INVENTED_DUMMY_TAX_IDS as readonly string[]).includes(raw) || (INVENTED_DUMMY_TAX_IDS as readonly string[]).includes(digits);
}

/** Korean 사업자등록번호 checksum (국세청 10-digit). */
export function isKoreanTaxIdChecksumValid(value: string | null | undefined): boolean {
	const digits = compact(value).replace(/\D/g, '');
	if (digits.length !== 10) return false;
	const w = [1, 3, 7, 1, 3, 7, 1, 3, 5];
	let sum = 0;
	for (let i = 0; i < 8; i++) sum += Number(digits[i]) * w[i];
	sum += Number(digits[8]) * 5 + Math.floor((Number(digits[8]) * 5) / 10);
	const check = (10 - (sum % 10)) % 10;
	return check === Number(digits[9]);
}

export function matchesKoreanTaxIdPattern(value: string | null | undefined): boolean {
	const raw = compact(value);
	if (/^\d{3}-\d{2}-\d{5}$/.test(raw)) return true;
	return /^\d{10}$/.test(raw.replace(/\D/g, ''));
}

/**
 * Bind taxID only when a real pattern was extracted and it is not a dummy.
 * Checksum is preferred; labeled footer captures still bind when the hyphenated
 * `000-00-00000` pattern matches (sites occasionally typo the check digit).
 */
export function normalizeGroundTruthTaxId(
	value: string | null | undefined,
	opts?: { labeled?: boolean },
): string {
	const raw = compact(value);
	if (!raw || isDummyTaxId(raw)) return '';
	const digits = raw.replace(/\D/g, '');
	if (digits.length !== 10) return '';
	const hyphenated = `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
	if (isKoreanTaxIdChecksumValid(digits)) return hyphenated;
	if (opts?.labeled && /^\d{3}-\d{2}-\d{5}$/.test(raw.replace(/\s+/g, ''))) return hyphenated;
	return '';
}

export function normalizeGroundTruthPhone(value: string | null | undefined): string {
	const raw = compact(value);
	if (!raw || isDummyPhoneNumber(raw)) return '';
	return raw;
}

export function isCatalogMenuStopword(name: string | null | undefined): boolean {
	const value = compact(name);
	if (!value) return true;
	if (isUiStopword(value)) return true;
	const folded = value.replace(/\s+/g, '').toLowerCase();
	return (CATALOG_MENU_STOPWORDS as readonly string[]).some((stop) => stop.replace(/\s+/g, '').toLowerCase() === folded);
}

export function normalizeGroundTruthServices(
	services: readonly GroundTruthService[] | null | undefined,
	navItems?: Array<{ name?: string; url?: string }>,
	opts?: { medical?: boolean; origin?: string },
): AvailableServiceNode[] {
	const fallbackType = opts?.medical ? 'MedicalProcedure' : 'Service';
	const origin = originOf(opts?.origin || '');
	const out: AvailableServiceNode[] = [];
	const seen = new Set<string>();

	const push = (
		nameRaw: string,
		urlRaw?: string,
		typeRaw?: string,
		categoryRaw?: string,
		descriptionRaw?: string,
	) => {
		const name = compact(nameRaw);
		if (!name || isCatalogMenuStopword(name)) return;
		const key = name.toLowerCase();
		if (seen.has(key)) return;
		seen.add(key);
		const type = typeRaw === 'MedicalProcedure' || typeRaw === 'Service' ? typeRaw : fallbackType;
		let url = compact(urlRaw);
		if (url && !/^https?:\/\//i.test(url) && origin) {
			url = `${origin}/${url.replace(/^\/+/, '')}`;
		}
		const node: AvailableServiceNode = url ? { '@type': type, name, url } : { '@type': type, name };
		const category = compact(categoryRaw);
		const description = compact(descriptionRaw);
		if (category) node.category = category;
		if (description) node.description = description;
		out.push(node);
	};

	for (const item of services || []) {
		if (typeof item === 'string') {
			push(item);
			continue;
		}
		if (item?.name) push(item.name, item.url, item.type, item.category, item.description);
	}
	if (out.length) return out;

	for (const nav of navItems || []) {
		if (nav?.name) push(nav.name, nav.url);
	}
	return out;
}

export function normalizeGroundTruthSameAs(urls: readonly string[] | null | undefined, origin?: string): string[] {
	return filterOfficialSameAs([...(urls || [])], origin);
}

export function isOfficialChannelHost(raw: string | null | undefined): boolean {
	try {
		const url = new URL(String(raw || '').startsWith('http') ? String(raw) : `https://${String(raw || '').replace(/^\/\//, '')}`);
		const host = url.hostname.replace(/^www\./i, '').toLowerCase();
		return (ENTITY_SAME_AS_HOSTS as readonly string[]).some((needle) => host === needle || host.endsWith(`.${needle}`));
	} catch {
		return false;
	}
}

function setIf(node: StrictJsonLdNode, key: string, value: unknown): void {
	if (value === undefined || value === null) return;
	if (typeof value === 'string') {
		const trimmed = compact(value);
		if (!trimmed) return;
		node[key] = trimmed;
		return;
	}
	if (Array.isArray(value) && value.length === 0) return;
	node[key] = value;
}

/**
 * Build one Schema.org `@graph` from verified facts only.
 * Person / founder / employee / sameAs / catalog / taxID / fax are omitted
 * when the matching fact is missing. WebPage.about / isPartOf bind only
 * when Organization / WebSite nodes exist.
 */
export function buildStrictSchemaGraph(facts: GroundTruthFacts): StrictSchemaGraph {
	const origin = originOf(facts.origin);
	const pageUrl = compact(facts.pageUrl) || `${origin}/`;
	const siteName = compact(facts.siteName);
	const orgTypes =
		facts.orgTypes && facts.orgTypes.length > 0 ? facts.orgTypes.filter(Boolean) : ['Organization', 'LocalBusiness'];
	const telephone = normalizeGroundTruthPhone(facts.telephone);
	const faxNumber = normalizeGroundTruthPhone(facts.faxNumber);
	const taxId = normalizeGroundTruthTaxId(facts.taxId, { labeled: facts.taxIdLabeled !== false });
	const street = compact(facts.streetAddress);
	const logo = compact(facts.logo);
	const lat = compact(facts.latitude);
	const lng = compact(facts.longitude);
	const medical = orgTypes.some((t) =>
		/MedicalClinic|Physician|Hospital|Dentist|VeterinaryCare|Pharmacy|MedicalBusiness/i.test(t),
	);
	const services = normalizeGroundTruthServices(facts.services, facts.navItems, { medical, origin });
	const sameAs = normalizeGroundTruthSameAs(facts.sameAs, origin);
	const repName = isValidGroundTruthRepName(facts.repName) ? compact(facts.repName) : '';
	const repTitle = compact(facts.repTitle);
	const repSameAs = normalizeGroundTruthSameAs(facts.repSameAs, origin);
	const alumniOf = compact(facts.alumniOf);
	const knowsAbout = (facts.knowsAbout || []).map(compact).filter(Boolean).slice(0, 8);
	const hasOrg = Boolean(origin);
	const hasWebsite = hasOrg;

	const orgId = `${origin}/#organization`;
	const websiteId = `${origin}/#website`;
	const personId = `${origin}/#person`;
	const pageId = `${pageUrl}#webpage`;
	const crumbId = `${pageUrl}#breadcrumb`;

	const orgNode: StrictJsonLdNode = {
		'@type': orgTypes,
		'@id': orgId,
	};
	setIf(orgNode, 'name', siteName);
	setIf(orgNode, 'url', origin);
	setIf(orgNode, 'description', facts.description);
	setIf(orgNode, 'telephone', telephone);
	setIf(orgNode, 'faxNumber', faxNumber);
	setIf(orgNode, 'taxID', taxId);
	if (logo) {
		orgNode.logo = { '@type': 'ImageObject', url: logo };
	}
	if (street) {
		const address: StrictJsonLdNode = { '@type': 'PostalAddress', streetAddress: street };
		setIf(address, 'addressLocality', facts.addressLocality);
		setIf(address, 'addressRegion', facts.addressRegion);
		setIf(address, 'postalCode', facts.postalCode);
		address.addressCountry = 'KR';
		orgNode.address = address;
	}
	if (lat && lng && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))) {
		orgNode.geo = { '@type': 'GeoCoordinates', latitude: Number(lat), longitude: Number(lng) };
	}
	if (sameAs.length) orgNode.sameAs = sameAs;
	mergeServiceCatalog(orgNode, services, orgTypes);
	if (repName) {
		orgNode.founder = { '@id': personId };
		orgNode.employee = { '@id': personId };
	}

	const websiteNode: StrictJsonLdNode = {
		'@type': 'WebSite',
		'@id': websiteId,
	};
	setIf(websiteNode, 'name', siteName);
	setIf(websiteNode, 'url', origin);
	if (hasOrg) websiteNode.publisher = { '@id': orgId };

	const webpageNode: StrictJsonLdNode = {
		'@type': compact(facts.pageType) || 'WebPage',
		'@id': pageId,
	};
	setIf(webpageNode, 'name', facts.pageName || siteName);
	setIf(webpageNode, 'url', pageUrl);
	setIf(webpageNode, 'description', facts.description);
	if (hasWebsite) webpageNode.isPartOf = { '@id': websiteId };
	if (hasOrg) webpageNode.about = { '@id': orgId };
	webpageNode.breadcrumb = { '@id': crumbId };

	const graph: StrictJsonLdNode[] = [orgNode, websiteNode, webpageNode];

	if (repName) {
		const personNode: StrictJsonLdNode = {
			'@type': 'Person',
			'@id': personId,
			name: repName,
			worksFor: { '@id': orgId },
		};
		if (repTitle) personNode.jobTitle = repTitle;
		if (repSameAs.length) personNode.sameAs = repSameAs;
		if (alumniOf) {
			personNode.alumniOf = { '@type': 'EducationalOrganization', name: alumniOf };
		}
		if (knowsAbout.length) personNode.knowsAbout = knowsAbout;
		graph.push(personNode);
	}

	return { '@context': 'https://schema.org', '@graph': graph };
}

export function graphHasPerson(graph: StrictSchemaGraph): boolean {
	return graph['@graph'].some((node) => node['@type'] === 'Person');
}

const ORG_LIKE_TYPES = new Set([
	'Organization',
	'LocalBusiness',
	'MedicalClinic',
	'Physician',
	'Hospital',
	'Dentist',
	'VeterinaryCare',
	'Pharmacy',
	'MedicalBusiness',
	'LegalService',
	'ProfessionalService',
	'OnlineStore',
	'Store',
]);

export function graphOrgNode(graph: StrictSchemaGraph): StrictJsonLdNode | undefined {
	return graph['@graph'].find((node) => {
		const type = node['@type'];
		const types = Array.isArray(type) ? type : [type];
		return types.some((item) => typeof item === 'string' && ORG_LIKE_TYPES.has(item));
	});
}
