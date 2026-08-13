import * as cheerio from 'cheerio';

/**
 * Address-scoped location validation for crawl collection.
 *
 * Matches "부산 판매" style queries against the *company address*
 * (JSON-LD / <address> / footer / contact·about pages), not body copy.
 * A Seoul HQ that merely mentions 부산 in marketing text must not pass.
 */

export const KR_METRO_REGIONS = [
	'서울',
	'부산',
	'대구',
	'인천',
	'광주',
	'대전',
	'울산',
	'세종',
	'경기',
	'강원',
	'충북',
	'충남',
	'전북',
	'전남',
	'경북',
	'경남',
	'제주',
] as const;

export type KrMetroRegion = (typeof KR_METRO_REGIONS)[number];

export type LocationVerdict = 'in_region' | 'out_of_region' | 'unknown';

export type LocationEvaluation = {
	verdict: LocationVerdict;
	/** True when the site should stay collected but an admin should confirm the region. */
	checkLocationNeeded: boolean;
	parsedAddress: string | null;
	matchedMetros: KrMetroRegion[];
};

const METRO_ALIASES: Record<KrMetroRegion, string[]> = {
	서울: ['서울특별시', '서울시', '서울', 'seoul'],
	부산: ['부산광역시', '부산시', '부산', 'busan'],
	대구: ['대구광역시', '대구시', '대구', 'daegu'],
	인천: ['인천광역시', '인천시', '인천', 'incheon'],
	광주: ['광주광역시', '광주시', '광주', 'gwangju'],
	대전: ['대전광역시', '대전시', '대전', 'daejeon'],
	울산: ['울산광역시', '울산시', '울산', 'ulsan'],
	세종: ['세종특별자치시', '세종시', '세종', 'sejong'],
	경기: ['경기도', '경기', 'gyeonggi'],
	강원: ['강원특별자치도', '강원도', '강원', 'gangwon'],
	충북: ['충청북도', '충북', 'chungbuk'],
	충남: ['충청남도', '충남', 'chungnam'],
	전북: ['전북특별자치도', '전라북도', '전북', 'jeonbuk'],
	전남: ['전라남도', '전남', 'jeonnam'],
	경북: ['경상북도', '경북', 'gyeongbuk'],
	경남: ['경상남도', '경남', 'gyeongnam'],
	제주: ['제주특별자치도', '제주도', '제주', 'jeju'],
};

/** Districts unique enough to imply a metro when the city prefix is omitted. */
const METRO_DISTRICTS: Partial<Record<KrMetroRegion, string[]>> = {
	부산: [
		'해운대구',
		'부산진구',
		'기장군',
		'수영구',
		'연제구',
		'사상구',
		'사하구',
		'동래구',
		'금정구',
		'영도구',
		'남구',
		'북구',
		'동구',
		'중구',
		'강서구',
	],
	서울: [
		'강남구',
		'서초구',
		'송파구',
		'마포구',
		'영등포구',
		'종로구',
		'용산구',
		'성동구',
		'광진구',
		'동대문구',
		'중랑구',
		'성북구',
		'강북구',
		'도봉구',
		'노원구',
		'은평구',
		'양천구',
		'구로구',
		'금천구',
		'관악구',
		'동작구',
		'강동구',
	],
	경기: [
		'수원시',
		'성남시',
		'용인시',
		'고양시',
		'부천시',
		'안양시',
		'안산시',
		'화성시',
		'평택시',
		'의정부시',
		'시흥시',
		'파주시',
		'김포시',
		'광명시',
		'군포시',
		'하남시',
		'오산시',
		'이천시',
		'안성시',
		'의왕시',
		'양주시',
		'구리시',
		'남양주시',
		'광주시',
		'여주시',
		'동두천시',
		'과천시',
		'포천시',
		'가평군',
		'양평군',
		'연천군',
	],
};

const GENERIC_DISTRICTS = new Set(['중구', '동구', '서구', '남구', '북구', '강서구']);

const ADDRESS_LABEL_RE =
	/(?:주소|addr(?:ess)?|소재지|본사(?:\s*주소)?|사업장(?:\s*주소)?|오시는\s*길|찾아오시는\s*길)[:：\s]*([^\n]{6,90})/gi;

const METRO_STREET_RE =
	/(서울특별시|서울시|부산광역시|부산시|대구광역시|대구시|인천광역시|인천시|광주광역시|광주시|대전광역시|대전시|울산광역시|울산시|세종특별자치시|세종시|경기도|강원특별자치도|강원도|충청북도|충청남도|전북특별자치도|전라북도|전라남도|경상북도|경상남도|제주특별자치도|제주도|(?:서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)(?:특별시|광역시|특별자치시|특별자치도|도|시)?)\s+[가-힣0-9()[\]\-.,·\s]{2,70}(?:구|군|시|읍|면|동|로|길|가)/g;

const POSTAL_ADDRESS_RE =
	/(?:^|[^\d])(\d{5})\s*((?:서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)[가-힣0-9()[\]\-.,·\s]{4,70})/g;

const MAX_ADDRESS_LEN = 120;

function cleanSnippet(raw: string): string {
	return raw.replace(/\s+/g, ' ').trim().slice(0, MAX_ADDRESS_LEN);
}

function uniqueSnippets(values: string[]): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const value of values) {
		const cleaned = cleanSnippet(value);
		if (cleaned.length < 6) continue;
		const key = cleaned.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(cleaned);
	}
	return out;
}

function pushJsonLdAddress(node: unknown, into: string[]): void {
	if (!node) return;
	if (Array.isArray(node)) {
		for (const item of node) pushJsonLdAddress(item, into);
		return;
	}
	if (typeof node !== 'object') return;
	const obj = node as Record<string, unknown>;
	if (obj['@graph']) pushJsonLdAddress(obj['@graph'], into);
	if (Array.isArray(obj['@type']) || typeof obj['@type'] === 'string') {
		const address = obj.address;
		if (typeof address === 'string') into.push(address);
		else if (address && typeof address === 'object') {
			const a = address as Record<string, unknown>;
			const parts = [a.addressRegion, a.addressLocality, a.streetAddress, a.postalCode]
				.filter((part): part is string => typeof part === 'string' && part.trim().length > 0);
			if (parts.length > 0) into.push(parts.join(' '));
			if (typeof a.name === 'string') into.push(a.name);
		}
		if (typeof obj.addressRegion === 'string') into.push(String(obj.addressRegion));
		if (typeof obj.streetAddress === 'string') {
			into.push(
				[obj.addressRegion, obj.addressLocality, obj.streetAddress]
					.filter((part): part is string => typeof part === 'string')
					.join(' '),
			);
		}
	}
	for (const value of Object.values(obj)) {
		if (value && typeof value === 'object') pushJsonLdAddress(value, into);
	}
}

function extractJsonLdAddresses(html: string): string[] {
	if (!html) return [];
	const $ = cheerio.load(html);
	const found: string[] = [];
	$('script[type="application/ld+json"]').each((_, el) => {
		const raw = $(el).contents().text() || $(el).html() || '';
		if (!raw.trim()) return;
		try {
			pushJsonLdAddress(JSON.parse(raw), found);
		} catch {
			/* ignore invalid JSON-LD */
		}
	});
	return found;
}

function extractLabeledAndPatternAddresses(text: string): string[] {
	if (!text) return [];
	const found: string[] = [];
	const labeled = text.matchAll(new RegExp(ADDRESS_LABEL_RE.source, ADDRESS_LABEL_RE.flags));
	for (const match of labeled) {
		if (match[1]) found.push(match[1]);
	}
	const streets = text.matchAll(new RegExp(METRO_STREET_RE.source, METRO_STREET_RE.flags));
	for (const match of streets) {
		if (match[0]) found.push(match[0]);
	}
	const postal = text.matchAll(new RegExp(POSTAL_ADDRESS_RE.source, POSTAL_ADDRESS_RE.flags));
	for (const match of postal) {
		if (match[2]) found.push(match[2]);
	}
	return found;
}

function scopedDomText($: cheerio.CheerioAPI): string[] {
	const chunks: string[] = [];
	const selectors = [
		'address',
		'footer',
		'#footer',
		'.footer',
		'[class*="footer"]',
		'[id*="footer"]',
		'[class*="address"]',
		'[id*="address"]',
		'[class*="addr"]',
		'[id*="addr"]',
		'[itemprop="address"]',
		'[itemprop="streetAddress"]',
		'[class*="location"]',
		'[id*="location"]',
		'[class*="contact"]',
		'[id*="contact"]',
		'[class*="회사"]',
		'[class*="주소"]',
		'[id*="주소"]',
	].join(', ');

	$(selectors).each((_, el) => {
		const text = $(el).text().replace(/\s+/g, ' ').trim();
		if (text.length >= 6 && text.length <= 2000) chunks.push(text);
	});
	return chunks;
}

/**
 * Pull address-like snippets from a page. Body marketing copy is ignored
 * unless it sits in footer / <address> / JSON-LD / labeled "주소" lines.
 */
export function extractAddressesFromHtml(html: string): string[] {
	if (!html) return [];
	const $ = cheerio.load(html);
	const raw: string[] = [...extractJsonLdAddresses(html)];

	$('address').each((_, el) => {
		raw.push($(el).text());
	});

	for (const chunk of scopedDomText($)) {
		raw.push(...extractLabeledAndPatternAddresses(chunk));
	}

	return uniqueSnippets(raw);
}

export function extractAddressesFromPages(
	pages: Array<{ html: string }>,
): string[] {
	const all: string[] = [];
	for (const page of pages) {
		all.push(...extractAddressesFromHtml(page.html));
	}
	return uniqueSnippets(all);
}

function aliasHitsMetro(haystack: string, metro: KrMetroRegion): boolean {
	const aliases = METRO_ALIASES[metro] || [metro];
	const lower = haystack.toLowerCase();
	for (const alias of aliases) {
		if (/^[a-z]+$/i.test(alias)) {
			if (new RegExp(`\\b${alias}\\b`, 'i').test(lower)) return true;
			continue;
		}
		if (haystack.includes(alias)) return true;
	}
	const districts = METRO_DISTRICTS[metro] || [];
	for (const district of districts) {
		if (GENERIC_DISTRICTS.has(district)) continue;
		if (haystack.includes(district)) return true;
	}
	return false;
}

export function metrosMentionedInAddress(address: string): KrMetroRegion[] {
	if (!address) return [];
	const hits: KrMetroRegion[] = [];
	for (const metro of KR_METRO_REGIONS) {
		if (aliasHitsMetro(address, metro) && !hits.includes(metro)) hits.push(metro);
	}
	return hits;
}

export function isKrMetroRegion(value: string): value is KrMetroRegion {
	return (KR_METRO_REGIONS as readonly string[]).includes(value);
}

/**
 * Detect the collection target metro from a search keyword ("부산 판매" → 부산).
 */
export function targetRegionFromKeyword(keyword: string): KrMetroRegion | null {
	const trimmed = typeof keyword === 'string' ? keyword.trim() : '';
	if (!trimmed) return null;
	for (const metro of KR_METRO_REGIONS) {
		const re = new RegExp(`^${metro}(광역시|특별시|특별자치시|특별자치도|시|도)?(\\s+|$)`);
		if (re.test(trimmed)) return metro;
	}
	return null;
}

export function evaluateLocation(
	addresses: string[],
	targetRegion: string | null | undefined,
): LocationEvaluation {
	const target =
		typeof targetRegion === 'string' && isKrMetroRegion(targetRegion.trim())
			? (targetRegion.trim() as KrMetroRegion)
			: null;

	const snippets = uniqueSnippets(addresses);
	const parsedAddress = snippets[0] ?? null;
	const matchedMetros = uniqueSnippets(snippets).flatMap(metrosMentionedInAddress);
	const uniqueMetros = Array.from(new Set(matchedMetros));

	if (!target) {
		return {
			verdict: 'unknown',
			checkLocationNeeded: false,
			parsedAddress,
			matchedMetros: uniqueMetros,
		};
	}

	if (snippets.length === 0 || uniqueMetros.length === 0) {
		return {
			verdict: 'unknown',
			checkLocationNeeded: true,
			parsedAddress,
			matchedMetros: uniqueMetros,
		};
	}

	if (uniqueMetros.includes(target)) {
		return {
			verdict: 'in_region',
			checkLocationNeeded: false,
			parsedAddress,
			matchedMetros: uniqueMetros,
		};
	}

	return {
		verdict: 'out_of_region',
		checkLocationNeeded: false,
		parsedAddress,
		matchedMetros: uniqueMetros,
	};
}

export function evaluatePagesLocation(
	pages: Array<{ html: string }>,
	targetRegion: string | null | undefined,
): LocationEvaluation {
	return evaluateLocation(extractAddressesFromPages(pages), targetRegion);
}
