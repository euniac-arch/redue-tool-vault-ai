/**
 * Universal GEO Engine — CMS-agnostic client SDK source of truth.
 *
 * Unlike the PHP hybrid engine in `dynamic-php-schema.ts` (requires server-file access),
 * this builds a single dependency-free vanilla-JS file (`public/universal-geo-engine.js`)
 * and a copy-paste `<script>` snippet for Cafe24 / Imweb / Godomall / Makeshop / static HTML.
 * The browser runtime crawls the footer DOM, omits empty keys (No-Fake-Data), and injects
 * a Schema.org `@graph` (Organization + WebSite + WebPage + BreadcrumbList + Person).
 *
 * Regex constants below are real `RegExp` objects so the Node-side pure functions (used by
 * `scripts/test-universal-geo-engine.ts`) and the emitted browser JS
 * (`buildUniversalGeoEngineJs()`, which interpolates `.source`/`.flags`) can never drift —
 * there is exactly one definition per pattern.
 */

import { SERVICE_CATALOG_NAME, normalizeServiceCatalog } from '@/lib/solve/core/service-catalog';

export const UNIVERSAL_GEO_ENGINE_VERSION = 'v3';

/** 사업자등록번호 — labeled, `000-00-00000` or 10 digits. */
export const GEO_TAX_ID_RE =
	/(?:사업자\s*(?:등록)?\s*번호|사업자번호|등록번호|사업자)\s*[:：]?\s*([0-9]{3}-[0-9]{2}-[0-9]{5}|[0-9]{10})/i;

/** 팩스번호 — labeled. */
export const GEO_FAX_RE = /(?:팩스|FAX|Fax|F\.)\s*[:：]?\s*([0-9]{2,4}-[0-9]{3,4}-[0-9]{4})/i;

/** 대표자명 — labeled, Korean 2–4 syllables or Latin 2–20 chars. */
export const GEO_REP_NAME_RE =
	/(?:대표자|대표원장|대표이사|원장|대표(?!번호|전화|제품))\s*[:：]?\s*([가-힣]{2,4}|[A-Za-z\s]{2,20})(?=\s|<|$|\||\/)/i;

/** Non-name captures the label regex commonly false-positives on. */
export const GEO_REP_NAME_HALLUCINATION_RE =
	/^(?:인사말|안내|고객센터|오시는길|바로가기|더보기|자세히보기|이사회|이사|제품으로|제품|대표|문의|상담|진료|정보)$/;

/** 대표전화 — labeled, `02-1234-5678` / `010-1234-5678` / `1588-1234` style. */
export const GEO_TELEPHONE_RE =
	/(?:대표번호|대표전화|전화번호|고객센터|TEL|Tel|T\.?)\s*[:：]?\s*([0-9]{2,4}-[0-9]{3,4}-[0-9]{4}|1[568][0-9]{2}-[0-9]{4})/i;

/** 사업장 주소 — optional 주소|위치|소재지 label → 시/도 → 로|길|동|빌딩|호텔. */
export const GEO_STREET_ADDRESS_RE =
	/(?:주소|위치|소재지)?\s*[:：]?\s*([가-힣]+(?:특별시|광역시|도|시|군|구)\s+[가-힣0-9\s·\-\(\),]+(?:로|길|동|리|가|번지|호|층|관|빌딩|호텔)[가-힣0-9\s·\-\(\),]*)/i;

/** Naver Place/Map, Kakao Map, Google Maps link hosts. */
export const GEO_MAP_HOST_RE =
	/m\.place\.naver\.com|place\.naver\.com|map\.naver\.com|place\.map\.kakao\.com|maps\.google\.com|goo\.gl\/maps/i;

/** Official SNS channel hosts. */
export const GEO_SNS_HOST_RE =
	/blog\.naver\.com|cafe\.naver\.com|post\.naver\.com|in\.naver\.com|instagram\.com|youtube\.com|facebook\.com|tiktok\.com|twitter\.com|x\.com|linkedin\.com/i;

/** Share-widget URLs to exclude from SNS collection (share buttons ≠ official channel links). */
export const GEO_SHARE_LINK_EXCLUDE_RE = new RegExp(
	'sharer\\.php|\\/share(?:r)?(?:[?/]|$)|intent\\/tweet|[?&](?:u|url)=',
	'i',
);

export const GEO_MEDICAL_ORG_TYPES = [
	'MedicalClinic',
	'Physician',
	'Hospital',
	'Dentist',
	'VeterinaryCare',
	'Pharmacy',
	'MedicalBusiness',
] as const;

export const GEO_REP_NAME_STOPWORDS = [
	'인사말',
	'안내',
	'고객센터',
	'오시는길',
	'바로가기',
	'더보기',
	'자세히보기',
	'이사회',
	'이사',
	'제품으로',
	'제품',
	'대표',
	'문의',
	'상담',
	'진료',
	'정보',
] as const;

/** Global-flag mirror of a regex, used for iterative `exec()` scans. */
function toGlobalRegex(re: RegExp): RegExp {
	return new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`);
}

/** Render a `RegExp` back into a literal-safe `/pattern/flags` string for JS interpolation. */
function toRegexLiteral(re: RegExp): string {
	return `/${re.source}/${re.flags.replace(/u/g, '')}`;
}

function compact(value: string | null | undefined): string {
	return String(value || '')
		.replace(/\s+/g, ' ')
		.trim();
}

export function extractGeoTaxId(text: string): string {
	const m = GEO_TAX_ID_RE.exec(String(text || ''));
	return m ? compact(m[1]) : '';
}

export function extractGeoFax(text: string): string {
	const m = GEO_FAX_RE.exec(String(text || ''));
	return m ? compact(m[1]) : '';
}

export function extractGeoTelephone(text: string): string {
	const m = GEO_TELEPHONE_RE.exec(String(text || ''));
	return m ? compact(m[1]) : '';
}

export function extractGeoStreetAddress(text: string): string {
	const m = GEO_STREET_ADDRESS_RE.exec(String(text || ''));
	if (!m) return '';
	return compact(m[1]).replace(/^(?:주소|위치|소재지)\s*[:：]?\s*/i, '');
}

/** Scans all label matches and skips hallucinated (non-name) captures, returning the first valid name. */
export function extractGeoRepName(text: string): string {
	const src = String(text || '');
	const re = toGlobalRegex(GEO_REP_NAME_RE);
	let match: RegExpExecArray | null;
	while ((match = re.exec(src))) {
		const candidate = compact(match[1]);
		if (candidate && !GEO_REP_NAME_HALLUCINATION_RE.test(candidate)) {
			return candidate;
		}
		if (match[0].length === 0) re.lastIndex += 1;
	}
	return '';
}

/** Classifies a raw `<a href>` value as an official map link, official SNS link, or neither. */
export function classifyGeoLink(href: string | null | undefined): 'map' | 'sns' | null {
	const url = String(href || '');
	if (!url || GEO_SHARE_LINK_EXCLUDE_RE.test(url)) return null;
	if (GEO_MAP_HOST_RE.test(url)) return 'map';
	if (GEO_SNS_HOST_RE.test(url)) return 'sns';
	return null;
}

/** De-dupes a `sameAs` URL list (trailing-slash / case insensitive), preserving first-seen order. */
export function dedupeSameAs(urls: Array<string | null | undefined>): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const raw of urls) {
		const url = compact(raw);
		if (!url) continue;
		const key = url.replace(/\/+$/, '').toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(url);
	}
	return out;
}

export function isHomePath(pathname: string): boolean {
	const path = String(pathname || '').split('?')[0].split('#')[0] || '/';
	return path === '/' || path === '' || /\/index\.(html?|php|asp|aspx)$/i.test(path);
}

export function normalizeCanonicalUrl(origin: string, pathname: string, search?: string): string {
	const host = String(origin || '').replace(/\/+$/, '');
	const path = String(pathname || '') || '/';
	const query = String(search || '');
	return `${host}${path}${query}`;
}

export type GeoBreadcrumbItem = { name: string; item?: string };

export function fallbackBreadcrumbItems(opts: {
	isHome: boolean;
	origin: string;
	pageUrl: string;
	homeName: string;
	pageName: string;
}): GeoBreadcrumbItem[] {
	const origin = String(opts.origin || '').replace(/\/+$/, '');
	const homeName = compact(opts.homeName) || '홈';
	if (opts.isHome) {
		return [{ name: homeName, item: `${origin}/` }];
	}
	const pageName = compact(opts.pageName) || homeName;
	return [
		{ name: '홈', item: `${origin}/` },
		{ name: pageName, item: opts.pageUrl },
	];
}

export type GeoServiceSeed = string | { name: string; url?: string; type?: string; category?: string; description?: string };

export type NormalizedGeoService = { '@type': string; name: string; url?: string; category?: string; description?: string };

export function isMedicalOrgType(types: readonly string[] | null | undefined): boolean {
	const list = types || [];
	for (const type of list) {
		if ((GEO_MEDICAL_ORG_TYPES as readonly string[]).indexOf(String(type || '')) !== -1) {
			return true;
		}
	}
	return false;
}

export function normalizeGeoServices(
	raw: readonly GeoServiceSeed[] | null | undefined,
	orgTypes?: readonly string[],
): NormalizedGeoService[] {
	return normalizeServiceCatalog(raw, orgTypes);
}

export function isSaasCmsType(cmsType?: string | null): boolean {
	const raw = String(cmsType || '');
	const lower = raw.toLowerCase();
	return (
		/cafe24|카페24|imweb|아임웹|makeshop|메이크샵|godomall|고도몰|doothost|saas/.test(lower) ||
		raw.includes('카페24') ||
		raw.includes('아임웹') ||
		raw.includes('고도몰') ||
		raw.includes('메이크샵')
	);
}

export interface UniversalGeoConfig {
	/** Schema.org `@type` list, e.g. `['VeterinaryCare','MedicalClinic','Organization','LocalBusiness']`. */
	orgType: string[];
	/** Organization name. Leave empty to use `<title>` / og:site_name. */
	name: string;
	/** Logo URL. Leave empty to use og:image. */
	logo: string;
	/** 사업자등록번호. Leave empty to auto-extract from the footer. */
	taxId: string;
	/** 대표자명. Leave empty to auto-extract from the footer. */
	repName: string;
	/** 대표자 직함, e.g. '대표원장'. */
	repTitle: string;
	/** 대표전화. Leave empty to auto-extract. */
	telephone: string;
	/** 팩스번호. Leave empty to auto-extract. */
	faxNumber: string;
	/** 도로명 주소. Leave empty to auto-extract. */
	streetAddress: string;
	addressLocality: string;
	addressRegion: string;
	postalCode: string;
	addressCountry: string;
	latitude: string;
	longitude: string;
	/** Naver Place / Kakao Map / Google Maps URL. Leave empty to auto-extract. */
	placeUrl: string;
	/** Official sameAs URLs (SNS + maps). Merged with auto-detected links. */
	sameAs: string[];
	/** Additional official SNS URLs to force-include (merged with auto-detected links). */
	snsUrls: string[];
	/** 시술/서비스 카탈로그 — 있을 때만 availableService + hasOfferCatalog. */
	services: GeoServiceSeed[];
	/** Standardized catalog slot (`name` / `category` / `description` / `type`). Preferred over `services`. */
	serviceCatalog: GeoServiceSeed[];
	/** Override WebPage @type (`MedicalWebPage` / `WebPage`). */
	pageType: string;
	/** Master switch for DOM auto-extraction (footer text + page-wide link scan). */
	enableAutoDetect: boolean;
}

export const DEFAULT_UNIVERSAL_GEO_CONFIG: UniversalGeoConfig = {
	orgType: ['Organization', 'LocalBusiness'],
	name: '',
	logo: '',
	taxId: '',
	repName: '',
	repTitle: '',
	telephone: '',
	faxNumber: '',
	streetAddress: '',
	addressLocality: '',
	addressRegion: '',
	postalCode: '',
	addressCountry: 'KR',
	latitude: '',
	longitude: '',
	placeUrl: '',
	sameAs: [],
	snsUrls: [],
	services: [],
	serviceCatalog: [],
	pageType: '',
	enableAutoDetect: true,
};

export type SaasInjectorConfigOverrides = Partial<UniversalGeoConfig> & {
	/** Alias accepted by the copy-paste `window.REDUE_CONFIG` block. */
	taxID?: string;
};

function resolveSnippetConfig(overrides?: SaasInjectorConfigOverrides): Record<string, unknown> {
	const taxId = compact(overrides?.taxID) || compact(overrides?.taxId);
	return {
		orgType:
			overrides?.orgType && overrides.orgType.length
				? overrides.orgType
				: DEFAULT_UNIVERSAL_GEO_CONFIG.orgType,
		name: compact(overrides?.name),
		logo: compact(overrides?.logo),
		telephone: compact(overrides?.telephone),
		taxID: taxId,
		faxNumber: compact(overrides?.faxNumber),
		streetAddress: compact(overrides?.streetAddress),
		addressLocality: compact(overrides?.addressLocality),
		addressRegion: compact(overrides?.addressRegion),
		postalCode: compact(overrides?.postalCode),
		latitude: compact(overrides?.latitude),
		longitude: compact(overrides?.longitude),
		sameAs: Array.isArray(overrides?.sameAs)
			? overrides.sameAs.filter(Boolean)
			: Array.isArray(overrides?.snsUrls)
				? overrides.snsUrls.filter(Boolean)
				: [],
		services: Array.isArray(overrides?.services) ? overrides.services : [],
		serviceCatalog: Array.isArray(overrides?.serviceCatalog) ? overrides.serviceCatalog : [],
		repName: compact(overrides?.repName),
		repTitle: compact(overrides?.repTitle),
		pageType: compact(overrides?.pageType),
		enableAutoDetect: overrides?.enableAutoDetect !== false,
	};
}

/**
 * Builds the full standalone browser engine as a vanilla-JS (ES5 / IE11+, zero-dependency) IIFE string.
 * Regex/default-config literals are interpolated from the constants above so the shipped JS and
 * the TS-side test assertions are always exactly in sync.
 */
export function buildUniversalGeoEngineJs(): string {
	const taxIdRe = toRegexLiteral(GEO_TAX_ID_RE);
	const faxRe = toRegexLiteral(GEO_FAX_RE);
	const repNameRe = toRegexLiteral(GEO_REP_NAME_RE);
	const hallucinationRe = toRegexLiteral(GEO_REP_NAME_HALLUCINATION_RE);
	const telRe = toRegexLiteral(GEO_TELEPHONE_RE);
	const streetRe = toRegexLiteral(GEO_STREET_ADDRESS_RE);
	const mapHostRe = toRegexLiteral(GEO_MAP_HOST_RE);
	const snsHostRe = toRegexLiteral(GEO_SNS_HOST_RE);
	const shareExcludeRe = toRegexLiteral(GEO_SHARE_LINK_EXCLUDE_RE);
	const defaultsJson = JSON.stringify(DEFAULT_UNIVERSAL_GEO_CONFIG);
	const medicalJson = JSON.stringify(GEO_MEDICAL_ORG_TYPES);
	const catalogNameJson = JSON.stringify(SERVICE_CATALOG_NAME);

	return `(function () {
  'use strict';
  try {
    if (window.__REDUE_SCHEMA_INJECTED__) { return; }
    window.__REDUE_SCHEMA_INJECTED__ = true;
    if (document.getElementById('redue-universal-schema')) { return; }

    var TAX_ID_RE = ${taxIdRe};
    var FAX_RE = ${faxRe};
    var REP_NAME_RE = ${repNameRe};
    var REP_NAME_HALLUCINATION_RE = ${hallucinationRe};
    var TEL_RE = ${telRe};
    var STREET_RE = ${streetRe};
    var MAP_HOST_RE = ${mapHostRe};
    var SNS_HOST_RE = ${snsHostRe};
    var SHARE_EXCLUDE_RE = ${shareExcludeRe};
    var DEFAULTS = ${defaultsJson};
    var MEDICAL_ORG = ${medicalJson};
    var CATALOG_NAME = ${catalogNameJson};

    function isObj(v) { return v && typeof v === 'object'; }
    function trim(s) { return String(s == null ? '' : s).replace(/^\\s+|\\s+$/g, ''); }
    function copy(dst, src) {
      if (!isObj(src)) return dst;
      for (var k in src) {
        if (Object.prototype.hasOwnProperty.call(src, k)) dst[k] = src[k];
      }
      return dst;
    }
    function pick(obj, keys) {
      for (var i = 0; i < keys.length; i++) {
        var v = obj[keys[i]];
        if (v !== undefined && v !== null && v !== '') return v;
      }
      return '';
    }
    function setIf(obj, key, val) {
      if (val === undefined || val === null) return;
      if (typeof val === 'string') {
        val = trim(val);
        if (!val) return;
      } else if (Object.prototype.toString.call(val) === '[object Array]' && val.length === 0) {
        return;
      }
      obj[key] = val;
    }
    function firstRe(re, text) {
      var m = re.exec(String(text || ''));
      return m ? trim(m[1]) : '';
    }
    function inList(list, value) {
      for (var i = 0; i < list.length; i++) { if (list[i] === value) return true; }
      return false;
    }
    function isMedical(types) {
      if (!types) return false;
      for (var i = 0; i < types.length; i++) { if (inList(MEDICAL_ORG, types[i])) return true; }
      return false;
    }

    var userCfg = {};
    if (isObj(window.__REDUE_GEO_CONFIG__)) copy(userCfg, window.__REDUE_GEO_CONFIG__);
    if (isObj(window.REDUE_CONFIG)) copy(userCfg, window.REDUE_CONFIG);

    var cfg = {};
    copy(cfg, DEFAULTS);
    copy(cfg, userCfg);
    if (!cfg.taxId) cfg.taxId = pick(userCfg, ['taxID', 'taxId']);
    if (!cfg.telephone) cfg.telephone = pick(userCfg, ['telephone', 'tel']);
    if (!cfg.faxNumber) cfg.faxNumber = pick(userCfg, ['faxNumber', 'fax']);
    if (!cfg.streetAddress) cfg.streetAddress = pick(userCfg, ['streetAddress', 'address']);
    if (!cfg.latitude) cfg.latitude = pick(userCfg, ['latitude', 'lat']);
    if (!cfg.longitude) cfg.longitude = pick(userCfg, ['longitude', 'lng']);
    if (!cfg.logo) cfg.logo = pick(userCfg, ['logo', 'logoUrl']);
    if (!cfg.name) cfg.name = pick(userCfg, ['name', 'siteName', 'legalName']);
    if ((!cfg.sameAs || !cfg.sameAs.length) && userCfg.snsUrls && userCfg.snsUrls.length) {
      cfg.sameAs = userCfg.snsUrls;
    }
    if (cfg.enableAutoDetect === undefined || cfg.enableAutoDetect === null) cfg.enableAutoDetect = true;

    function textOf(el) {
      try { return (el && (el.innerText || el.textContent)) || ''; } catch (e) { return ''; }
    }

    function footerScopeText() {
      var selectors = ['footer', '.footer', '#footer', '[class*="footer"]', '[id*="footer"]', 'address'];
      var text = '';
      var seen = [];
      for (var i = 0; i < selectors.length; i++) {
        var nodes;
        try { nodes = document.querySelectorAll(selectors[i]); } catch (e1) { continue; }
        for (var j = 0; j < nodes.length; j++) {
          var node = nodes[j];
          if (inList(seen, node)) continue;
          seen.push(node);
          text += ' ' + textOf(node);
        }
      }
      if (!trim(text) && document.body) text = textOf(document.body);
      return text;
    }

    function extractRepName(text) {
      var re = new RegExp(REP_NAME_RE.source, 'gi');
      var m;
      while ((m = re.exec(text))) {
        var candidate = trim(m[1] || '');
        if (candidate && !REP_NAME_HALLUCINATION_RE.test(candidate)) { return candidate; }
        if (m[0].length === 0) { re.lastIndex += 1; }
      }
      return '';
    }

    function classifyLink(href) {
      var url = String(href || '');
      if (!url || SHARE_EXCLUDE_RE.test(url)) { return null; }
      if (MAP_HOST_RE.test(url)) { return 'map'; }
      if (SNS_HOST_RE.test(url)) { return 'sns'; }
      return null;
    }

    function dedupe(urls) {
      var seen = {};
      var out = [];
      for (var i = 0; i < urls.length; i++) {
        var u = trim(urls[i] || '');
        if (!u) continue;
        var key = u.replace(/\\/+$/, '').toLowerCase();
        if (seen[key]) continue;
        seen[key] = true;
        out.push(u);
      }
      return out;
    }

    function absUrl(href, origin) {
      var h = trim(href);
      if (!h || h.charAt(0) === '#') return '';
      if (/^https?:\\/\\//i.test(h)) return h.replace(/#.*$/, '');
      if (h.indexOf('//') === 0) return (location.protocol || 'https:') + h.replace(/#.*$/, '');
      if (h.charAt(0) === '/') return origin + h.replace(/#.*$/, '');
      var path = location.pathname || '/';
      var dir = origin + path.replace(/\\/[^\\/]*$/, '/');
      return (dir + h.replace(/^\\.\\//, '')).replace(/#.*$/, '');
    }

    function mergeExistingOrganization(orgNode) {
      var scripts = document.querySelectorAll('script[type="application/ld+json"]');
      for (var s = 0; s < scripts.length; s++) {
        if (scripts[s].id === 'redue-universal-schema') continue;
        try {
          var parsed = JSON.parse(scripts[s].textContent || '{}');
          var nodes = parsed['@graph'] ? parsed['@graph'] : [parsed];
          if (Object.prototype.toString.call(nodes) !== '[object Array]') nodes = [nodes];
          for (var n = 0; n < nodes.length; n++) {
            var node = nodes[n];
            if (!isObj(node)) continue;
            var types = node['@type'];
            types = Object.prototype.toString.call(types) === '[object Array]' ? types : [types];
            if (!inList(types, 'Organization') && !inList(types, 'LocalBusiness') && !inList(types, 'MedicalClinic')) continue;
            for (var key in node) {
              if (Object.prototype.hasOwnProperty.call(node, key) && orgNode[key] === undefined) {
                orgNode[key] = node[key];
              }
            }
          }
        } catch (e2) { /* ignore malformed existing JSON-LD */ }
      }
    }

    function injectLlmsHelpLink() {
      var exist = document.querySelector('link[rel="help"][title="LLMs Context"], link[rel="help"][href*="llms.txt"]');
      if (exist) return;
      var link = document.createElement('link');
      link.rel = 'help';
      link.href = '/llms.txt';
      link.title = 'LLMs Context';
      (document.head || document.documentElement).appendChild(link);
    }

    function parseBreadcrumbDom(origin, pageUrl, pageName) {
      var selectors = ['.breadcrumb', '#breadcrumb', '.location', '.path', '[class*="breadcrumb"]', '[class*="location"]', 'nav[aria-label="breadcrumb"]'];
      var root = null;
      for (var i = 0; i < selectors.length; i++) {
        try { root = document.querySelector(selectors[i]); } catch (e3) { root = null; }
        if (root) break;
      }
      if (!root) return [];
      var items = [];
      var links = root.getElementsByTagName('a');
      for (var j = 0; j < links.length; j++) {
        var name = trim(textOf(links[j]).replace(/\\s+/g, ' ')).replace(/^[>\\/\\|\\s]+|[>\\/\\|\\s]+$/g, '');
        if (!name) continue;
        var href = absUrl(links[j].getAttribute('href') || '', origin);
        var crumb = { '@type': 'ListItem', position: items.length + 1, name: name };
        if (href) crumb.item = href;
        items.push(crumb);
      }
      if (items.length && pageName && items[items.length - 1].name !== pageName) {
        items.push({ '@type': 'ListItem', position: items.length + 1, name: pageName, item: pageUrl });
      }
      return items;
    }

    function fallbackCrumbs(isHome, origin, pageUrl, homeName, pageName) {
      if (isHome) {
        return [{ '@type': 'ListItem', position: 1, name: homeName || '홈', item: origin + '/' }];
      }
      return [
        { '@type': 'ListItem', position: 1, name: '홈', item: origin + '/' },
        { '@type': 'ListItem', position: 2, name: pageName || homeName || '홈', item: pageUrl }
      ];
    }

    function normalizeServices(raw, orgTypes) {
      var fallbackType = isMedical(orgTypes) ? 'MedicalProcedure' : 'Service';
      var out = [];
      if (!raw || !raw.length) return out;
      var seen = {};
      for (var i = 0; i < raw.length; i++) {
        var item = raw[i];
        var n = '';
        var explicit = '';
        if (typeof item === 'string') {
          n = trim(item);
        } else if (isObj(item)) {
          n = trim(item.name);
          explicit = trim(item.type) || trim(item['@type']);
        }
        if (!n) continue;
        var key = n.toLowerCase();
        if (seen[key]) continue;
        seen[key] = 1;
        var node = {
          '@type': (explicit === 'MedicalProcedure' || explicit === 'Service') ? explicit : fallbackType,
          name: n
        };
        if (isObj(item)) {
          if (item.category) node.category = trim(item.category);
          if (item.description) node.description = trim(item.description);
          if (item.url) node.url = trim(item.url);
        }
        out.push(node);
      }
      return out;
    }

    function run() {
      if (document.getElementById('redue-universal-schema')) { return; }

      var footerText = footerScopeText();
      var auto = cfg.enableAutoDetect !== false;

      function isDummyDigits(raw) {
        var digits = String(raw || '').replace(/\\D/g, '');
        if (!digits) return true;
        if (/^0+$/.test(digits) || /^(\\d)\\1+$/.test(digits)) return true;
        var hyphen = String(raw || '').replace(/\\s+/g, '');
        return hyphen === '050-0000-0000' || hyphen === '02-0000-0000' || hyphen === '000-00-00000' || hyphen === '111-11-11111';
      }
      function acceptTaxId(raw) {
        var v = trim(raw);
        if (!v || isDummyDigits(v)) return '';
        var digits = v.replace(/\\D/g, '');
        if (digits.length !== 10) return '';
        return digits.slice(0, 3) + '-' + digits.slice(3, 5) + '-' + digits.slice(5);
      }
      var taxId = acceptTaxId(trim(cfg.taxId) || (auto ? firstRe(TAX_ID_RE, footerText) : ''));
      var faxNumber = trim(cfg.faxNumber) || (auto ? firstRe(FAX_RE, footerText) : '');
      if (faxNumber && isDummyDigits(faxNumber)) faxNumber = '';
      var telephone = trim(cfg.telephone) || (auto ? firstRe(TEL_RE, footerText) : '');
      if (telephone && isDummyDigits(telephone)) telephone = '';
      var streetAddress = trim(cfg.streetAddress) || (auto ? firstRe(STREET_RE, footerText) : '');
      var repName = trim(cfg.repName) || (auto ? extractRepName(footerText) : '');
      if (repName === '대표자명' || /^(대표원장|대표자|원장|대표이사|대표)$/.test(repName)) repName = '';

      var mapUrl = trim(cfg.placeUrl);
      var snsUrls = (cfg.snsUrls && cfg.snsUrls.length) ? cfg.snsUrls.slice() : [];
      var sameAsSeed = (cfg.sameAs && cfg.sameAs.length) ? cfg.sameAs.slice() : [];
      if (auto) {
        var anchors = document.querySelectorAll('a[href]');
        for (var j = 0; j < anchors.length; j++) {
          var href = anchors[j].getAttribute('href') || '';
          var kind = classifyLink(href);
          if (kind === 'map' && !mapUrl) { mapUrl = href; }
          else if (kind === 'sns') { snsUrls.push(href); }
        }
      }
      var sameAs = dedupe(sameAsSeed.concat(mapUrl ? [mapUrl] : []).concat(snsUrls));

      var titleEl = document.querySelector('title');
      var descEl = document.querySelector('meta[name="description"]');
      var ogImageEl = document.querySelector('meta[property="og:image"]');
      var ogSiteEl = document.querySelector('meta[property="og:site_name"]');
      var origin = (window.location && window.location.origin) || '';
      if (!origin && window.location) {
        origin = (location.protocol || 'https:') + '//' + (location.host || '');
      }
      var pageUrl = origin + (location.pathname || '/') + (location.search || '');
      var siteTitle = trim(cfg.name) || (ogSiteEl && ogSiteEl.getAttribute('content')) || (titleEl && titleEl.textContent) || document.title || origin;
      var description = (descEl && descEl.getAttribute('content')) || '';
      var ogImage = trim(cfg.logo) || (ogImageEl && ogImageEl.getAttribute('content')) || '';
      var path = location.pathname || '/';
      var home = path === '/' || path === '' || /\\/index\\.(html?|php|asp|aspx)$/i.test(path);
      var orgTypes = (cfg.orgType && cfg.orgType.length) ? cfg.orgType : DEFAULTS.orgType;
      var pageType = trim(cfg.pageType) || (home && isMedical(orgTypes) ? 'MedicalWebPage' : 'WebPage');

      injectLlmsHelpLink();

      var orgId = origin + '/#organization';
      var websiteId = origin + '/#website';
      var personId = origin + '/#person';
      var pageId = pageUrl + '#webpage';
      var crumbId = pageUrl + '#breadcrumb';

      var orgNode = { '@type': orgTypes, '@id': orgId };
      setIf(orgNode, 'name', siteTitle);
      setIf(orgNode, 'url', origin);
      setIf(orgNode, 'logo', ogImage);
      setIf(orgNode, 'telephone', telephone);
      setIf(orgNode, 'taxID', taxId);
      setIf(orgNode, 'faxNumber', faxNumber);

      if (streetAddress) {
        var addr = { '@type': 'PostalAddress' };
        setIf(addr, 'streetAddress', streetAddress);
        setIf(addr, 'addressLocality', cfg.addressLocality);
        setIf(addr, 'addressRegion', cfg.addressRegion);
        setIf(addr, 'postalCode', cfg.postalCode);
        setIf(addr, 'addressCountry', cfg.addressCountry || 'KR');
        orgNode.address = addr;
      }
      if (trim(cfg.latitude) && trim(cfg.longitude)) {
        orgNode.geo = { '@type': 'GeoCoordinates', latitude: trim(cfg.latitude), longitude: trim(cfg.longitude) };
      }
      if (sameAs.length) orgNode.sameAs = sameAs;

      var catalogRaw = (cfg.serviceCatalog && cfg.serviceCatalog.length) ? cfg.serviceCatalog : cfg.services;
      var services = normalizeServices(catalogRaw, orgTypes);
      if (!services.length && auto) {
        var navSel = ['header nav a', 'header .gnb a', '#gnb a', '.gnb a', 'nav[class*="gnb"] a', '.header nav a'];
        var navRaw = [];
        var navStops = { '홈': 1, '메인': 1, 'home': 1, '소개': 1, 'about': 1, 'contact': 1, '문의': 1, '예약': 1, '로그인': 1, '회원가입': 1, '사이트맵': 1, '이용약관': 1, '더보기': 1, '바로가기': 1, '오시는길': 1, '인사말': 1, '공지사항': 1, '게시판': 1 };
        for (var ni = 0; ni < navSel.length; ni++) {
          var navNodes;
          try { navNodes = document.querySelectorAll(navSel[ni]); } catch (eNav) { continue; }
          for (var nj = 0; nj < navNodes.length; nj++) {
            var nName = trim(textOf(navNodes[nj]).replace(/\\s+/g, ' '));
            if (!nName || navStops[nName]) continue;
            var nHref = absUrl(navNodes[nj].getAttribute('href') || '', origin);
            navRaw.push(nHref ? { name: nName, url: nHref } : nName);
          }
        }
        services = normalizeServices(navRaw, orgTypes);
      }
      if (services.length) {
        orgNode.availableService = services;
        var offers = [];
        for (var si = 0; si < services.length; si++) {
          offers.push({
            '@type': 'Offer',
            itemOffered: services[si]
          });
        }
        orgNode.hasOfferCatalog = {
          '@type': 'OfferCatalog',
          name: CATALOG_NAME,
          itemListElement: offers
        };
      }

      mergeExistingOrganization(orgNode);

      var websiteNode = { '@type': 'WebSite', '@id': websiteId };
      setIf(websiteNode, 'name', siteTitle);
      setIf(websiteNode, 'url', origin);
      websiteNode.publisher = { '@id': orgId };

      var crumbItems = parseBreadcrumbDom(origin, pageUrl, document.title || siteTitle);
      if (!crumbItems.length) {
        crumbItems = fallbackCrumbs(home, origin, pageUrl, siteTitle, document.title || siteTitle);
      }
      var breadcrumbNode = {
        '@type': 'BreadcrumbList',
        '@id': crumbId,
        itemListElement: crumbItems
      };

      var webpageNode = { '@type': pageType, '@id': pageId };
      setIf(webpageNode, 'name', document.title || siteTitle);
      setIf(webpageNode, 'url', pageUrl);
      setIf(webpageNode, 'description', description);
      webpageNode.isPartOf = { '@id': websiteId };
      webpageNode.about = { '@id': orgId };
      webpageNode.breadcrumb = { '@id': crumbId };

      var graph = [orgNode, websiteNode, webpageNode, breadcrumbNode];
      if (repName) {
        var personNode = { '@type': 'Person', '@id': personId };
        setIf(personNode, 'name', repName);
        setIf(personNode, 'jobTitle', cfg.repTitle);
        personNode.worksFor = { '@id': orgId };
        graph.push(personNode);
        if (!orgNode.founder) orgNode.founder = { '@id': personId };
        if (!orgNode.employee) orgNode.employee = { '@id': personId };
      }

      var script = document.createElement('script');
      script.type = 'application/ld+json';
      script.id = 'redue-universal-schema';
      script.text = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph });
      (document.head || document.documentElement).appendChild(script);
    }

    if (document.readyState === 'loading') {
      if (document.addEventListener) {
        document.addEventListener('DOMContentLoaded', run);
      } else {
        run();
      }
    } else {
      run();
    }
  } catch (e) { /* never break the host page */ }
})();
`;
}

/**
 * Cafe24 / Imweb / Godomall / Makeshop / static HTML — one `<script>` block for the
 * hosting panel Header Code / Custom Code field. `window.REDUE_CONFIG` sits at the top
 * so site owners can override lat/lng, SNS, and the service catalog without editing the engine.
 */
export function buildSaasSchemaInjectorSnippet(overrides?: SaasInjectorConfigOverrides): string {
	const cfg = resolveSnippetConfig(overrides);
	const cfgJson = JSON.stringify(cfg, null, 2);
	return `<!-- REDUE Client-side Schema Injector ${UNIVERSAL_GEO_ENGINE_VERSION}
     카페24 / 아임웹 / 고도몰 / 메이크샵 / 일반 HTML
     관리자 → 공통 헤더(Header Code / Custom Code / 하단 스크립트)에 그대로 붙여넣으세요.
     값이 있는 키만 JSON-LD에 출력됩니다(No-Fake-Data). 비워 두면 푸터 DOM에서 자동 추출합니다. -->
<script>
window.REDUE_CONFIG = ${cfgJson};
${buildUniversalGeoEngineJs()}
</script>`;
}
