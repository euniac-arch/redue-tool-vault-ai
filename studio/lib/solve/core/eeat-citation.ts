/**
 * E-E-A-T Person + LocalBusiness NAP + FAQPage/HowTo citation graph.
 * Shared by audit extractors (TS), Solve page picker, and PHP schema controllers.
 */

import { parseQueryLocation } from '@/lib/geo/query-location';
import {
	extractStreetAddressFromText,
	extractTelephoneFromText,
	KR_STREET_ADDRESS_RE,
	TELEPHONE_BODY_RE,
} from '@/lib/solve/core/entity-patterns';
import type { SolvePageMeta } from '@/lib/solve/types';

export const PERSON_FRAGMENT_ID = '#person';
export const ORG_FRAGMENT_ID = '#organization';

export const FAQ_VIRTUAL_PATH = '/faq';
export const HOWTO_VIRTUAL_PATH = '/howto';

export const FAQ_GUIDE_TITLE = '[FAQ/이용안내]';
export const HOWTO_GUIDE_TITLE = '[HowTo 절차안내]';

export type FaqQaItem = { q: string; a: string };

export type HowToStepSpec = {
	position: number;
	name: string;
	text: string;
};

export type CompleteNap = {
	telephone: string;
	streetAddress: string;
	addressCountry: 'KR';
	addressLocality: string;
	addressRegion: string;
	postalCode?: string;
};

const KR_METRO_TOKEN_RE = /^(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)/;

function hostFromUrl(raw?: string): string {
	try {
		return new URL(String(raw || '')).hostname.replace(/^www\./i, '');
	} catch {
		return String(raw || '')
			.replace(/^https?:\/\//i, '')
			.replace(/[/:].*$/, '')
			.replace(/^www\./i, '');
	}
}

/**
 * Always-complete PostalAddress parts. Prefer footer/meta NAP, then
 * domain/상호명 지역 토큰 (예: 강서24시동물병원 → 서울 / 강서구).
 */
export function inferKrPostalAddressFromIdentity(input: {
	streetAddress?: string;
	addressLocality?: string;
	addressRegion?: string;
	siteName?: string;
	targetUrl?: string;
	corpus?: string;
}): Pick<CompleteNap, 'streetAddress' | 'addressLocality' | 'addressRegion' | 'addressCountry'> {
	const site = compact(input.siteName);
	const host = hostFromUrl(input.targetUrl);
	const givenStreet = compact(input.streetAddress);
	const givenLocality = compact(input.addressLocality);
	const givenRegion = compact(input.addressRegion);
	const blob = [givenStreet, givenLocality, givenRegion, site, host, compact(input.corpus)]
		.filter(Boolean)
		.join(' ');
	const loc = parseQueryLocation(blob);
	const metroOk = Boolean(loc.metro && KR_METRO_TOKEN_RE.test(loc.metro));
	const districtOk = Boolean(loc.district && /(?:시|군|구)$/.test(loc.district));
	const addressRegion = givenRegion || (metroOk ? loc.metro : '');
	const addressLocality = givenLocality || (districtOk ? loc.district : '');
	const regionFinal = addressRegion || (metroOk ? loc.metro : '대한민국');
	const localityFinal = addressLocality || site || host || regionFinal || '대한민국';
	const streetAddress =
		givenStreet ||
		[regionFinal !== '대한민국' ? regionFinal : '', localityFinal !== site ? localityFinal : '']
			.filter(Boolean)
			.join(' ') ||
		(site ? `${site} 소재지` : localityFinal);
	return {
		streetAddress,
		addressLocality: localityFinal,
		addressRegion: regionFinal,
		addressCountry: 'KR',
	};
}

export type PersonEeatInput = {
	origin: string;
	canonicalUrl: string;
	siteName: string;
	repName?: string;
	repTitle?: string;
	knowsAbout?: string[];
	alumniOf?: string;
};

export type CitationPageKind = 'faq' | 'howto';

const FAQ_PAGE_RE =
	/(?:^|\/)faq(?:\.php|\/|$)|자주.?묻는|자주하는.?질문|이용.?안내|고객.?안내|q\s*&\s*a|\bqna\b|\bqa\b/i;
const HOWTO_PAGE_RE =
	/예약|진료.?안내|이용.?절차|오시는.?길|방문.?안내|howto|how-to|guide|reserve|booking|접수/i;

function compact(value: string | null | undefined): string {
	return String(value || '')
		.replace(/\s+/g, ' ')
		.trim();
}

export function personNodeId(origin: string): string {
	return `${String(origin || '').replace(/\/+$/, '')}/${PERSON_FRAGMENT_ID}`;
}

export function organizationNodeId(origin: string): string {
	return `${String(origin || '').replace(/\/+$/, '')}/${ORG_FRAGMENT_ID}`;
}

export function idRef(id: string): { '@id': string } {
	return { '@id': id };
}

/** Labeled NAP scan — CMS settings + footer/body corpus. */
export function extractNapFromCorpus(text: string): { telephone: string; streetAddress: string } {
	const blob = compact(text);
	return {
		telephone: extractTelephoneFromText(blob),
		streetAddress: extractStreetAddressFromText(blob),
	};
}

/**
 * Complete LocalBusiness NAP. Never invent dummy 02-0000 numbers —
 * fill from extracted / compiled site fields, then site-identity address fallback.
 */
export function resolveCompleteNap(input: {
	corpus?: string;
	telephone?: string;
	streetAddress?: string;
	addressLocality?: string;
	addressRegion?: string;
	postalCode?: string;
	siteName?: string;
	targetUrl?: string;
}): CompleteNap {
	const extracted = extractNapFromCorpus(input.corpus || '');
	const telephone = compact(input.telephone) || extracted.telephone;
	const inferred = inferKrPostalAddressFromIdentity({
		streetAddress: compact(input.streetAddress) || extracted.streetAddress,
		addressLocality: input.addressLocality,
		addressRegion: input.addressRegion,
		siteName: input.siteName,
		targetUrl: input.targetUrl,
		corpus: input.corpus,
	});
	return {
		telephone,
		streetAddress: inferred.streetAddress,
		addressCountry: 'KR',
		addressLocality: inferred.addressLocality,
		addressRegion: inferred.addressRegion,
		postalCode: compact(input.postalCode) || undefined,
	};
}

export function postalAddressNode(nap: CompleteNap): Record<string, string> {
	const inferred = inferKrPostalAddressFromIdentity(nap);
	const node: Record<string, string> = {
		'@type': 'PostalAddress',
		streetAddress: inferred.streetAddress,
		addressLocality: inferred.addressLocality,
		addressRegion: inferred.addressRegion,
		addressCountry: 'KR',
	};
	if (nap.postalCode) node.postalCode = nap.postalCode;
	return node;
}

export function buildPersonEeatNode(input: PersonEeatInput): Record<string, unknown> | null {
	const name = compact(input.repName);
	if (!name) return null;
	const jobTitle = compact(input.repTitle);
	const origin = String(input.origin || '').replace(/\/+$/, '');
	const node: Record<string, unknown> = {
		'@type': 'Person',
		'@id': personNodeId(origin),
		name,
		worksFor: idRef(organizationNodeId(origin)),
		url: input.canonicalUrl || `${origin}/`,
	};
	if (jobTitle) node.jobTitle = jobTitle;
	const knows = (input.knowsAbout || []).map(compact).filter(Boolean).slice(0, 8);
	if (knows.length) node.knowsAbout = knows;
	const alumni = compact(input.alumniOf);
	if (alumni) {
		node.alumniOf = { '@type': 'EducationalOrganization', name: alumni };
	}
	return node;
}

export function defaultFaqItems(
	siteName: string,
	origin: string,
	opts?: { opens?: string; closes?: string; telephone?: string },
): FaqQaItem[] {
	const site = compact(siteName) || '본원';
	const host = compact(origin) || '';
	const opens = compact(opts?.opens) || '09:00';
	const closes = compact(opts?.closes) || '18:00';
	const tel = compact(opts?.telephone);
	const telHint = tel ? ` 전화(${tel}) 또는 ` : ' ';
	return [
		{
			q: `${site} 진료시간은 어떻게 되나요?`,
			a: `${site} 평일 진료시간은 ${opens}–${closes}입니다. 토요일·공휴일 운영 여부는 방문 전 안내 페이지에서 확인해 주세요.`,
		},
		{
			q: `${site}에 주차할 수 있나요?`,
			a: `${site} 방문 시 건물 또는 인근 주차 공간을 이용하실 수 있습니다. 자세한 주차 안내는 오시는길/이용안내 페이지를 참고하세요.`,
		},
		{
			q: `${site} 예약은 어떻게 하나요?`,
			a: `${site}는${telHint}공식 웹사이트(${host || '공식 사이트'})를 통해 진료·상담 일정을 예약하실 수 있습니다.`,
		},
	];
}

export function defaultHowToSteps(siteName: string): HowToStepSpec[] {
	const site = compact(siteName) || '본원';
	return [
		{
			position: 1,
			name: '진료/상담 예약',
			text: `온라인 또는 전화를 통해 ${site}에서 원하는 일정을 예약합니다.`,
		},
		{
			position: 2,
			name: '방문 및 접수',
			text: '안내 데스크에서 접수 및 기본 문진을 진행합니다.',
		},
		{
			position: 3,
			name: '맞춤 검사 및 진료',
			text: '전문진의 정밀 검진 및 맞춤 케어를 받습니다.',
		},
		{
			position: 4,
			name: '안내 및 이후 일정',
			text: '진료 결과와 다음 방문·관리 일정을 안내받고 귀가합니다.',
		},
	];
}

export function buildHowToNode(input: {
	canonicalUrl: string;
	siteName: string;
	steps?: HowToStepSpec[];
}): Record<string, unknown> | null {
	const site = compact(input.siteName) || '웹사이트';
	const steps = (input.steps || []).filter((step) => compact(step.name) && compact(step.text));
	if (!steps.length) return null;
	return {
		'@type': 'HowTo',
		'@id': `${input.canonicalUrl}#howto`,
		name: `${site} 예약 및 이용 절차`,
		step: steps.map((step) => ({
			'@type': 'HowToStep',
			position: step.position,
			name: step.name,
			text: step.text,
		})),
	};
}

export function buildFaqPageNode(input: {
	canonicalUrl: string;
	items: FaqQaItem[];
}): Record<string, unknown> | null {
	const entities = input.items
		.filter((item) => compact(item.q) && compact(item.a))
		.map((item) => ({
			'@type': 'Question',
			name: compact(item.q),
			acceptedAnswer: { '@type': 'Answer', text: compact(item.a) },
		}));
	if (!entities.length) return null;
	return {
		'@type': 'FAQPage',
		'@id': `${input.canonicalUrl}#faq`,
		url: input.canonicalUrl,
		mainEntity: entities,
	};
}

function pageHaystack(page: Pick<SolvePageMeta, 'urlPath' | 'title' | 'section' | 'menu1' | 'menu2' | 'h1'>): string {
	return [page.urlPath, page.title, page.section, page.menu1, page.menu2, page.h1]
		.filter((v) => typeof v === 'string' && v.trim() !== '')
		.join(' ');
}

export function isFaqGuidePage(page: Pick<SolvePageMeta, 'urlPath' | 'title' | 'section' | 'menu1' | 'menu2' | 'h1' | 'pageType' | 'extraTypes'>): boolean {
	if (page.pageType === 'FAQPage' || (page.extraTypes || []).includes('FAQPage')) return true;
	if (normalizeCitationPath(page.urlPath) === FAQ_VIRTUAL_PATH) return true;
	return FAQ_PAGE_RE.test(pageHaystack(page)) && !/board\.php/i.test(String(page.urlPath || ''));
}

export function isHowToGuidePage(page: Pick<SolvePageMeta, 'urlPath' | 'title' | 'section' | 'menu1' | 'menu2' | 'h1' | 'extraTypes'>): boolean {
	if ((page.extraTypes || []).includes('HowTo')) return true;
	if (normalizeCitationPath(page.urlPath) === HOWTO_VIRTUAL_PATH) return true;
	return HOWTO_PAGE_RE.test(pageHaystack(page));
}

export function isCitationVirtualPage(
	page: { urlPath?: string; virtual?: boolean },
): boolean {
	if (page.virtual) return true;
	const path = normalizeCitationPath(page.urlPath);
	return path === FAQ_VIRTUAL_PATH || path === HOWTO_VIRTUAL_PATH;
}

export function normalizeCitationPath(urlPath: string | undefined): string {
	const raw = String(urlPath || '')
		.trim()
		.split('#')[0]
		.split('?')[0]
		.replace(/\\/g, '/')
		.replace(/\/+$/, '')
		.toLowerCase();
	if (!raw || raw === '/') return '/';
	return raw.startsWith('/') ? raw : `/${raw}`;
}

function createCitationMenuRow(kind: CitationPageKind, siteName: string): SolvePageMeta {
	const site = compact(siteName) || '사이트';
	if (kind === 'faq') {
		return {
			urlPath: FAQ_VIRTUAL_PATH,
			title: FAQ_GUIDE_TITLE,
			description: `${site} 자주 묻는 질문·이용안내 (FAQPage AI 인용)`,
			h1: FAQ_GUIDE_TITLE,
			section: 'AI / 인용',
			menu1: '이용안내',
			pageType: 'FAQPage',
			extraTypes: ['FAQPage'],
			selected: true,
			virtual: true,
		};
	}
	return {
		urlPath: HOWTO_VIRTUAL_PATH,
		title: HOWTO_GUIDE_TITLE,
		description: `${site} 예약 및 이용 절차 (HowTo AI 인용)`,
		h1: HOWTO_GUIDE_TITLE,
		section: 'AI / 인용',
		menu1: '이용절차',
		pageType: 'WebPage',
		extraTypes: ['HowTo'],
		selected: true,
		virtual: true,
	};
}

/**
 * Ensure workspace page-structure rows for FAQ / HowTo exist and start Checked.
 * Reuses a real matching page when present; otherwise inserts a virtual entry.
 */
export function ensureCitationMenuRows(
	pages: SolvePageMeta[] | undefined,
	opts?: {
		siteName?: string;
		/** Opt-in only. Default false — never invent dummy FAQ/HowTo table rows. */
		allowVirtual?: boolean;
		hasFaqContent?: boolean;
		hasHowToContent?: boolean;
	},
): SolvePageMeta[] {
	const list = Array.isArray(pages) ? [...pages] : [];
	const siteName = opts?.siteName || '';
	const tagged = list.map((page) => {
		if (isFaqGuidePage(page)) {
			const extras = new Set([...(page.extraTypes || []), 'FAQPage']);
			return {
				...page,
				extraTypes: Array.from(extras),
				selected: page.selected !== false,
				title: page.virtual || page.title === FAQ_GUIDE_TITLE ? FAQ_GUIDE_TITLE : page.title,
			};
		}
		if (isHowToGuidePage(page) && !isFaqGuidePage(page)) {
			const extras = new Set([...(page.extraTypes || []), 'HowTo']);
			return {
				...page,
				extraTypes: Array.from(extras),
				selected: page.selected !== false,
				title: page.virtual || page.title === HOWTO_GUIDE_TITLE ? HOWTO_GUIDE_TITLE : page.title,
			};
		}
		return page;
	});

	const hasFaq = tagged.some((page) => isFaqGuidePage(page) && !isCitationVirtualPage(page));
	const hasHowTo = tagged.some((page) => isHowToGuidePage(page) && !isCitationVirtualPage(page));
	if (opts?.allowVirtual) {
		if (!hasFaq && opts.hasFaqContent) tagged.push(createCitationMenuRow('faq', siteName));
		if (!hasHowTo && opts.hasHowToContent) tagged.push(createCitationMenuRow('howto', siteName));
		return tagged;
	}
	return tagged.filter((page) => !isCitationVirtualPage(page));
}

export function excludeCitationVirtualFromSchemaPages<T extends { urlPath?: string; virtual?: boolean }>(
	pages: T[],
): T[] {
	return pages.filter((page) => !isCitationVirtualPage(page));
}

/** Merge virtual FAQ/HowTo extras onto the homepage so the header graph still emits them. */
export function applyCitationExtrasToMain(pages: SolvePageMeta[]): SolvePageMeta[] {
	const extras = new Set<string>();
	for (const page of pages) {
		if (!isCitationVirtualPage(page) && !isFaqGuidePage(page) && !isHowToGuidePage(page)) continue;
		for (const t of page.extraTypes || []) extras.add(t);
		if (page.pageType === 'FAQPage') extras.add('FAQPage');
	}
	if (!extras.size) return pages;
	return pages.map((page) => {
		const path = normalizeCitationPath(page.urlPath);
		if (path !== '/') return page;
		return { ...page, extraTypes: Array.from(new Set([...(page.extraTypes || []), ...extras])) };
	});
}

export const NAP_REGEX_HINTS = {
	telephone: TELEPHONE_BODY_RE.source,
	address: KR_STREET_ADDRESS_RE.source,
};

/** PHP: never unset telephone/address; fill from extractors + site identity. */
export function buildForceCompleteNapPhp(orgVar = 'org_node', opts?: { inventAddress?: boolean }): string {
	const invent = opts?.inventAddress !== false;
	const inventTail = invent
		? `
			if ( $_nap_addr === '' && isset($locality) && is_string($locality) && $locality !== '' ) { $_nap_addr = $locality; }
			if ( $_nap_addr === '' && isset($region) && is_string($region) && $region !== '' ) { $_nap_addr = $region; }
			if ( $_nap_addr === '' && isset($site_name) && is_string($site_name) && $site_name !== '' ) { $_nap_addr = $site_name . ' 소재지'; }`
		: '';
	const completeCall = invent
		? `
		if ( function_exists('redue_complete_postal_address') ) {
			$${orgVar}['address'] = redue_complete_postal_address(
				isset($${orgVar}['address']) && is_array($${orgVar}['address']) ? $${orgVar}['address'] : array(),
				isset($site_name) ? $site_name : '',
				isset($domain_host) ? $domain_host : '',
				isset($street_address) ? $street_address : '',
				isset($locality) ? $locality : '',
				isset($region) ? $region : ''
			);
		} else {
			if ( empty($${orgVar}['address']['addressLocality']) ) {
				$${orgVar}['address']['addressLocality'] = isset($site_name) && is_string($site_name) && $site_name !== '' ? $site_name : '대한민국';
			}
			if ( empty($${orgVar}['address']['addressRegion']) ) {
				$${orgVar}['address']['addressRegion'] = '대한민국';
			}
			if ( empty($${orgVar}['address']['streetAddress']) ) {
				$${orgVar}['address']['streetAddress'] = $${orgVar}['address']['addressLocality'] . ' 소재지';
			}
			$${orgVar}['address']['@type'] = 'PostalAddress';
			$${orgVar}['address']['addressCountry'] = 'KR';
		}`
		: `
		if ( empty($${orgVar}['address']['streetAddress']) ) {
			unset($${orgVar}['address']);
		} else {
			$${orgVar}['address']['@type'] = 'PostalAddress';
			$${orgVar}['address']['addressCountry'] = 'KR';
			if ( function_exists('redue_infer_kr_address_parts') ) {
				$_parts = redue_infer_kr_address_parts($${orgVar}['address']['streetAddress']);
				if ( empty($${orgVar}['address']['addressLocality']) && ! empty($_parts['locality']) ) {
					$${orgVar}['address']['addressLocality'] = $_parts['locality'];
				}
				if ( empty($${orgVar}['address']['addressRegion']) && ! empty($_parts['region']) ) {
					$${orgVar}['address']['addressRegion'] = $_parts['region'];
				}
			}
		}`;
	return `
		if ( empty($${orgVar}['telephone']) && isset($GLOBALS['redue_tel']) && is_string($GLOBALS['redue_tel']) && trim($GLOBALS['redue_tel']) !== '' ) {
			$_seed_tel = function_exists('redue_format_telephone') ? redue_format_telephone($GLOBALS['redue_tel']) : trim($GLOBALS['redue_tel']);
			if ( $_seed_tel !== '' ) { $${orgVar}['telephone'] = $_seed_tel; }
		}
		if ( empty($${orgVar}['telephone']) && isset($telephone) && is_string($telephone) && trim($telephone) !== '' ) {
			$${orgVar}['telephone'] = function_exists('redue_format_telephone') ? redue_format_telephone($telephone) : trim($telephone);
		}
		if ( empty($${orgVar}['telephone']) && function_exists('redue_resolve_universal_telephone') ) {
			$_uni_nap = redue_resolve_universal_telephone('');
			if ( $_uni_nap !== '' ) { $${orgVar}['telephone'] = $_uni_nap; }
		}
		if ( empty($${orgVar}['telephone']) && function_exists('redue_extract_telephone') ) {
			$_nap_blob = isset($_redue_cfg_blob) ? $_redue_cfg_blob : '';
			if ( $_nap_blob === '' && isset($config) && is_array($config) ) {
				foreach ( array('cf_tel', 'cf_phone', 'cf_add_script', 'cf_add_meta', 'cf_1', 'cf_2', 'cf_3') as $_ck ) {
					if ( ! empty($config[$_ck]) && is_string($config[$_ck]) ) { $_nap_blob .= ' ' . $config[$_ck]; }
				}
			}
			$_nap_tel = redue_extract_telephone($_nap_blob);
			if ( $_nap_tel !== '' ) { $${orgVar}['telephone'] = $_nap_tel; }
		}
		if ( ! isset($${orgVar}['address']) || ! is_array($${orgVar}['address']) ) {
			$${orgVar}['address'] = array('@type' => 'PostalAddress', 'addressCountry' => 'KR');
		}
		if ( empty($${orgVar}['address']['streetAddress']) ) {
			$_nap_addr = '';
			if ( isset($street_address) && is_string($street_address) && trim($street_address) !== '' ) {
				$_nap_addr = trim($street_address);
			} elseif ( function_exists('redue_extract_street_address') ) {
				$_nap_blob_addr = isset($_nap_blob) ? $_nap_blob : ( isset($_redue_cfg_blob) ? $_redue_cfg_blob : '' );
				$_nap_addr = redue_extract_street_address($_nap_blob_addr);
			}${inventTail}
			if ( $_nap_addr !== '' ) { $${orgVar}['address']['streetAddress'] = $_nap_addr; }
			$${orgVar}['address']['@type'] = 'PostalAddress';
			$${orgVar}['address']['addressCountry'] = 'KR';
		}
		if ( isset($locality) && is_string($locality) && $locality !== '' && empty($${orgVar}['address']['addressLocality']) ) {
			$${orgVar}['address']['addressLocality'] = $locality;
		}
		if ( isset($region) && is_string($region) && $region !== '' && empty($${orgVar}['address']['addressRegion']) ) {
			$${orgVar}['address']['addressRegion'] = $region;
		}
		if ( isset($postal_code) && is_string($postal_code) && $postal_code !== '' && empty($${orgVar}['address']['postalCode']) ) {
			$${orgVar}['address']['postalCode'] = $postal_code;
		}
${completeCall}
`
}

/** PHP: Organization.founder / employee @id → #person only when a real Person name exists. */
export function buildOrgFounderIdRefPhp(indent = '\t\t'): string {
	return `${indent}if ( function_exists('redue_has_real_person') ? redue_has_real_person() : ( isset($GLOBALS['redue_rep_name']) && trim((string) $GLOBALS['redue_rep_name']) !== '' ) ) {
${indent}	$org_node['founder'] = array('@id' => $origin . '/#person');
${indent}	$org_node['employee'] = array('@id' => $origin . '/#person');
${indent}	if ( isset($is_medical_org) && $is_medical_org ) {
${indent}		$org_node['physician'] = array('@id' => $origin . '/#person');
${indent}	}
${indent}}`;
}

/** PHP: independent Person node + alumniOf / knowsAbout. */
export function buildPersonEeatNodePhp(): string {
	return `		if ( function_exists('redue_resolve_rep_identity') ) {
			$_rep_id = redue_resolve_rep_identity();
			if ( ( ! isset($rep_name) || ! is_string($rep_name) || trim($rep_name) === '' ) && ! empty($_rep_id['name']) ) {
				$rep_name = $_rep_id['name'];
			}
			if ( ( ! isset($rep_title) || ! is_string($rep_title) || trim($rep_title) === '' ) && ! empty($_rep_id['title']) ) {
				$rep_title = $_rep_id['title'];
			}
		}
		if ( ! isset($rep_name) || ! is_string($rep_name) ) {
			$rep_name = isset($GLOBALS['redue_rep_name']) ? trim((string) $GLOBALS['redue_rep_name']) : '';
		}
		if ( ! isset($rep_title) || ! is_string($rep_title) ) {
			$rep_title = isset($GLOBALS['redue_rep_title']) ? trim((string) $GLOBALS['redue_rep_title']) : '';
		}
		$person = null;
		if ( isset($GLOBALS['schema_person']) && is_array($GLOBALS['schema_person']) ) {
			$person = $GLOBALS['schema_person'];
		} elseif ( isset($schema_person) && is_array($schema_person) ) {
			$person = $schema_person;
		}
		$person_eeat_name = ( is_string($rep_name) && $rep_name !== '' )
			? $rep_name
			: ( is_array($person) && ! empty($person['name']) ? trim((string) $person['name']) : '' );
		if ( $person_eeat_name !== '' ) {
		$person_eeat_title = ( is_string($rep_title) && $rep_title !== '' )
			? $rep_title
			: ( is_array($person) && ! empty($person['jobTitle']) ? trim((string) $person['jobTitle']) : '' );
		$person_url = ( is_array($person) && ! empty($person['url']) )
			? ( function_exists('redue_align_url_protocol') ? redue_align_url_protocol($person['url']) : $person['url'] )
			: ( rtrim($origin, '/') . '/' );
		$person_node = array(
			'@type' => 'Person',
			'@id' => $origin . '/#person',
			'name' => $person_eeat_name,
			'worksFor' => array('@id' => $origin . '/#organization'),
			'url' => $person_url,
		);
		if ( $person_eeat_title !== '' ) {
			$person_node['jobTitle'] = $person_eeat_title;
		}
		if ( is_array($person) && ! empty($person['image']) ) {
			$person_node['image'] = function_exists('redue_align_url_protocol')
				? redue_align_url_protocol($person['image'])
				: $person['image'];
		}
		if ( is_array($person) && ! empty($person['description']) ) { $person_node['description'] = $person['description']; }
		$_alumni = '';
		if ( is_array($person) && ! empty($person['alumniOf']) ) {
			$_alumni = is_array($person['alumniOf']) && ! empty($person['alumniOf']['name'])
				? (string) $person['alumniOf']['name']
				: ( is_string($person['alumniOf']) ? $person['alumniOf'] : '' );
		}
		if ( $_alumni !== '' ) {
			$person_node['alumniOf'] = array('@type' => 'EducationalOrganization', 'name' => $_alumni);
		}
		$_knows = array();
		if ( is_array($person) && ! empty($person['knowsAbout']) && is_array($person['knowsAbout']) ) {
			$_knows = $person['knowsAbout'];
		} elseif ( isset($knows_about) && is_array($knows_about) && count($knows_about) > 0 ) {
			$_knows = $knows_about;
		} elseif ( isset($medical_specialty) && is_array($medical_specialty) && count($medical_specialty) > 0 ) {
			$_knows = $medical_specialty;
		}
		if ( ( ! is_array($_knows) || count($_knows) === 0 ) && isset($available_services) && is_array($available_services) ) {
			foreach ( $available_services as $_ks ) {
				if ( is_array($_ks) && ! empty($_ks['name']) ) { $_knows[] = (string) $_ks['name']; }
			}
		}
		if ( is_array($_knows) && count($_knows) > 0 ) {
			$person_node['knowsAbout'] = array_values(array_filter(array_map('strval', $_knows)));
		}
		$graph[] = $person_node;
		}
`;
}

/** PHP: collect live page HTML from $view/$write/$co — never invent a fallback body. */
export function buildEvidenceFaqHowToHelpersPhp(): string {
	return `	if ( ! function_exists( 'redue_collect_page_body_html' ) ) {
		function redue_collect_page_body_html() {
			global $view, $write, $co;
			$html = '';
			if ( isset($view) && is_array($view) && ! empty($view['wr_content']) && is_string($view['wr_content']) ) {
				$html .= ' ' . $view['wr_content'];
			}
			if ( isset($write) && is_array($write) && ! empty($write['wr_content']) && is_string($write['wr_content']) ) {
				$html .= ' ' . $write['wr_content'];
			}
			if ( isset($co) && is_array($co) && ! empty($co['co_content']) && is_string($co['co_content']) ) {
				$html .= ' ' . $co['co_content'];
			}
			if ( isset($GLOBALS['schema_page_html']) && is_string($GLOBALS['schema_page_html']) ) {
				$html .= ' ' . $GLOBALS['schema_page_html'];
			}
			return $html;
		}
	}
	if ( ! function_exists( 'redue_extract_faq_items' ) ) {
		function redue_extract_faq_items( $html ) {
			$out = array();
			if ( ! is_string($html) || trim($html) === '' ) { return $out; }
			$seen = array();
			if ( preg_match_all('/<dt[^>]*>([\\s\\S]{4,160})<\\/dt>\\s*<dd[^>]*>([\\s\\S]{4,400})<\\/dd>/i', $html, $m, PREG_SET_ORDER) ) {
				foreach ( $m as $row ) {
					$q = function_exists('redue_plain_text') ? redue_plain_text($row[1]) : trim(strip_tags($row[1]));
					$a = function_exists('redue_plain_text') ? redue_plain_text($row[2]) : trim(strip_tags($row[2]));
					if ( $q === '' || $a === '' || isset($seen[$q]) ) { continue; }
					$seen[$q] = true;
					$out[] = array('q' => $q, 'a' => $a);
					if ( count($out) >= 8 ) { return $out; }
				}
			}
			if ( preg_match_all('/<details[^>]*>\\s*<summary[^>]*>([\\s\\S]{4,160})<\\/summary>([\\s\\S]{4,400})<\\/details>/i', $html, $m, PREG_SET_ORDER) ) {
				foreach ( $m as $row ) {
					$q = function_exists('redue_plain_text') ? redue_plain_text($row[1]) : trim(strip_tags($row[1]));
					$a = function_exists('redue_plain_text') ? redue_plain_text($row[2]) : trim(strip_tags($row[2]));
					if ( $q === '' || $a === '' || isset($seen[$q]) ) { continue; }
					$seen[$q] = true;
					$out[] = array('q' => $q, 'a' => $a);
					if ( count($out) >= 8 ) { return $out; }
				}
			}
			$plain = function_exists('redue_plain_text') ? redue_plain_text($html) : trim(strip_tags($html));
			if ( is_string($plain) && $plain !== '' && preg_match_all('/(?:Q|질문)\\s*[.).:]?\\s*(.{6,80}?)\\s*(?:A|답변)\\s*[.).:]?\\s*(.{8,200})/ui', $plain, $m, PREG_SET_ORDER) ) {
				foreach ( $m as $row ) {
					$q = trim($row[1]);
					$a = trim($row[2]);
					if ( $q === '' || $a === '' || isset($seen[$q]) ) { continue; }
					$seen[$q] = true;
					$out[] = array('q' => $q, 'a' => $a);
					if ( count($out) >= 8 ) { break; }
				}
			}
			return $out;
		}
	}
	if ( ! function_exists( 'redue_extract_howto_steps' ) ) {
		function redue_extract_howto_steps( $html ) {
			$steps = array();
			if ( ! is_string($html) || trim($html) === '' ) { return $steps; }
			if ( ! preg_match('/예약|내원|방문|접수|절차|단계|step|howto/ui', $html) ) { return $steps; }
			if ( preg_match_all('/<li[^>]*>([\\s\\S]{8,180})<\\/li>/i', $html, $m) ) {
				foreach ( $m[1] as $raw ) {
					$text = function_exists('redue_plain_text') ? redue_plain_text($raw) : trim(strip_tags($raw));
					if ( ! is_string($text) ) { continue; }
					$len = function_exists('mb_strlen') ? mb_strlen($text, 'UTF-8') : strlen($text);
					if ( $len < 6 || $len > 180 ) { continue; }
					$name = function_exists('mb_substr') ? mb_substr($text, 0, 40, 'UTF-8') : substr($text, 0, 40);
					$steps[] = array(
						'position' => count($steps) + 1,
						'name' => $name,
						'text' => $text,
					);
					if ( count($steps) >= 6 ) { break; }
				}
			}
			return $steps;
		}
	}
`;
}

/** PHP: HowTo from live globals or extracted page body only — never invent steps. */
export function buildHowToAutoInjectPhp(_opts?: { industryFallback?: boolean }): string {
	return `		$_howto_steps = isset($GLOBALS['schema_howto_steps']) && is_array($GLOBALS['schema_howto_steps'])
			? $GLOBALS['schema_howto_steps']
			: array();
		if ( ( ! is_array($_howto_steps) || count($_howto_steps) === 0 ) && function_exists('redue_extract_howto_steps') ) {
			$_howto_html = function_exists('redue_collect_page_body_html') ? redue_collect_page_body_html() : '';
			$_howto_steps = redue_extract_howto_steps($_howto_html);
		}
		$_howto_entities = array();
		if ( is_array($_howto_steps) ) {
			foreach ( $_howto_steps as $_hs ) {
				if ( ! is_array($_hs) ) { continue; }
				$_hn = isset($_hs['name']) ? trim((string) $_hs['name']) : '';
				$_ht = isset($_hs['text']) ? trim((string) $_hs['text']) : $_hn;
				if ( $_hn === '' || $_ht === '' ) { continue; }
				$_howto_entities[] = array(
					'@type' => 'HowToStep',
					'position' => isset($_hs['position']) ? (int) $_hs['position'] : ( count($_howto_entities) + 1 ),
					'name' => $_hn,
					'text' => $_ht,
				);
			}
		}
		if ( count($_howto_entities) > 0 ) {
			$_howto_url = isset($canonical_url) && is_string($canonical_url) && $canonical_url !== ''
				? $canonical_url
				: ( isset($page_url) && is_string($page_url) ? $page_url : ( $origin . '/' ) );
			$graph[] = array(
				'@type' => 'HowTo',
				'@id' => $_howto_url . '#howto',
				'name' => $site_name . ' 이용 절차',
				'step' => $_howto_entities,
			);
		}

`;
}

/** PHP: FAQPage from live globals or extracted page body only — skip entirely when empty. */
export function buildEvidenceFaqInjectPhp(urlVar = 'canonical_url'): string {
	return `			$faq_items = isset($GLOBALS['schema_faq_items']) && is_array($GLOBALS['schema_faq_items']) ? $GLOBALS['schema_faq_items'] : null;
			if ( ( ! is_array($faq_items) || count($faq_items) === 0 ) && isset($schema_faq_items) && is_array($schema_faq_items) && count($schema_faq_items) > 0 ) {
				$faq_items = $schema_faq_items;
			}
			if ( ( ! is_array($faq_items) || count($faq_items) === 0 ) && function_exists('redue_extract_faq_items') ) {
				$faq_items = redue_extract_faq_items( function_exists('redue_collect_page_body_html') ? redue_collect_page_body_html() : '' );
			}
			$faq_entities = array();
			if ( is_array($faq_items) ) {
				foreach ( $faq_items as $fi ) {
					if ( ! is_array($fi) ) { continue; }
					$q = '';
					$a = '';
					if ( isset($fi['q']) ) { $q = $fi['q']; }
					elseif ( isset($fi['question']) ) { $q = $fi['question']; }
					elseif ( isset($fi['name']) ) { $q = $fi['name']; }
					if ( isset($fi['a']) ) { $a = $fi['a']; }
					elseif ( isset($fi['answer']) ) { $a = $fi['answer']; }
					elseif ( isset($fi['text']) ) { $a = $fi['text']; }
					$q = is_string($q) ? trim($q) : '';
					$a = is_string($a) ? trim($a) : '';
					if ( $q === '' || $a === '' ) { continue; }
					$faq_entities[] = array(
						'@type' => 'Question',
						'name' => $q,
						'acceptedAnswer' => array('@type' => 'Answer', 'text' => $a),
					);
				}
			}
			if ( count($faq_entities) > 0 ) {
				$graph[] = array(
					'@type' => 'FAQPage',
					'@id' => $${urlVar} . '#faq',
					'url' => $${urlVar},
					'mainEntity' => $faq_entities,
				);
			}
`;
}

/** PHP: never invent FAQ Q&A — only live page content. */
export function buildDefaultFaqItemsPhp(): string {
	return `			/* evidence-only FAQ — skip when page body has no Q&A */\n`;
}

export function buildWebPageAuthorBindPhp(indent = '\t\t\t'): string {
	return `${indent}'author' => array('@id' => $origin . '/#person'),`;
}
