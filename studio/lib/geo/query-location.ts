/**
 * Colloquial Korean location formatting for AI-search trigger queries.
 *
 * Formal admin names (서울특별시, 부산광역시…) are stripped so generated
 * queries match what people actually type: 서울, 부산, 서울 서초구.
 */

export type ToBeQueryPattern = 'local' | 'metro' | 'nationwide';

export type ExpandedTriggerEngineId =
	| 'chatgpt'
	| 'gemini'
	| 'claude'
	| 'perplexity'
	| 'copilot'
	| 'clova';

export interface QueryLocationParts {
	/** Metro / province short form (서울, 부산, 경기). */
	metro: string;
	/** District / neighborhood (서초구, 해운대). */
	district: string;
	/** Spoken search form: "서울 서초구" or "부산". */
	colloquial: string;
	/** District when present, otherwise metro. */
	localFocus: string;
}

/**
 * Backend generation rules for `expanded_trigger_query`.
 * Also injected into the GEO narrative LLM system prompt.
 */
export const EXPANDED_TRIGGER_QUERY_RULES = `[expanded_trigger_query 생성 지침]
- 지역명 생성 시 '특별시/광역시' 접미사를 자동 제거하고 실제 구어체 검색어로 포맷팅할 것. (서울특별시→서울, 부산광역시→부산, 서초구 서울특별시→서울 서초구)
- 6개 엔진에 걸쳐 단일 키워드 템플릿을 복사하지 말고, 로컬형 / 광역전문형 / 무지역 대화형 추천 쿼리를 엔진별 특성에 맞게 고르게 분산 배치할 것.
  · 패턴 1 세부 로컬형: [단축지역] + [세부지역] + [서비스/클리닉]
  · 패턴 2 광역 전문형: [광역/중심지] + [핵심 기술/기관]
  · 패턴 3 전국/대화형 추천: [핵심 서비스] + [추천/상담/잘하는곳]`;

const FORMAL_TO_SHORT: Array<[RegExp, string]> = [
	[/서울특별시|서울시/g, '서울'],
	[/부산광역시|부산시/g, '부산'],
	[/대구광역시|대구시/g, '대구'],
	[/인천광역시|인천시/g, '인천'],
	[/광주광역시/g, '광주'],
	[/대전광역시|대전시/g, '대전'],
	[/울산광역시|울산시/g, '울산'],
	[/세종특별자치시|세종시/g, '세종'],
	[/제주특별자치도|제주도/g, '제주'],
	[/강원특별자치도|강원도/g, '강원'],
	[/전북특별자치도|전라북도/g, '전북'],
	[/전라남도/g, '전남'],
	[/충청북도/g, '충북'],
	[/충청남도/g, '충남'],
	[/경상북도/g, '경북'],
	[/경상남도/g, '경남'],
	[/경기도/g, '경기'],
];

const LEFTOVER_ADMIN_SUFFIX = /특별자치시|특별자치도|광역시|특별시/g;

const METROS = [
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

const DISTRICT_TO_METRO: Record<string, string> = {
	강남: '서울',
	강남구: '서울',
	서초: '서울',
	서초구: '서울',
	송파: '서울',
	송파구: '서울',
	마포: '서울',
	마포구: '서울',
	여의도: '서울',
	홍대: '서울',
	잠실: '서울',
	종로: '서울',
	종로구: '서울',
	중구: '서울',
	영등포: '서울',
	영등포구: '서울',
	노원: '서울',
	노원구: '서울',
	강서: '서울',
	강서구: '서울',
	관악: '서울',
	관악구: '서울',
	동작: '서울',
	동작구: '서울',
	성동: '서울',
	성동구: '서울',
	광진: '서울',
	광진구: '서울',
	용산: '서울',
	용산구: '서울',
	은평: '서울',
	은평구: '서울',
	양천: '서울',
	양천구: '서울',
	구로: '서울',
	구로구: '서울',
	금천: '서울',
	금천구: '서울',
	동대문: '서울',
	동대문구: '서울',
	중랑: '서울',
	중랑구: '서울',
	성북: '서울',
	성북구: '서울',
	강북: '서울',
	강북구: '서울',
	도봉: '서울',
	도봉구: '서울',
	강동: '서울',
	강동구: '서울',
	센텀: '부산',
	해운대: '부산',
	해운대구: '부산',
	광안리: '부산',
	서면: '부산',
	연산: '부산',
	동래: '부산',
	동래구: '부산',
	남포: '부산',
	기장: '부산',
	기장군: '부산',
	수영: '부산',
	수영구: '부산',
	사상: '부산',
	사상구: '부산',
	사하: '부산',
	사하구: '부산',
	부산진구: '부산',
	연제구: '부산',
	금정구: '부산',
	영도구: '부산',
	분당: '경기',
	판교: '경기',
	일산: '경기',
	동탄: '경기',
	수원: '경기',
	수원시: '경기',
	성남: '경기',
	성남시: '경기',
	용인: '경기',
	용인시: '경기',
	고양: '경기',
	고양시: '경기',
	평택: '경기',
	평택시: '경기',
	안산: '경기',
	안산시: '경기',
	안양: '경기',
	안양시: '경기',
	부천: '경기',
	부천시: '경기',
	남양주: '경기',
	남양주시: '경기',
	화성: '경기',
	화성시: '경기',
	시흥: '경기',
	시흥시: '경기',
	파주: '경기',
	파주시: '경기',
	의정부: '경기',
	의정부시: '경기',
	김포: '경기',
	김포시: '경기',
	광명: '경기',
	광명시: '경기',
	군포: '경기',
	군포시: '경기',
	하남: '경기',
	하남시: '경기',
	오산: '경기',
	오산시: '경기',
	이천: '경기',
	이천시: '경기',
	양주: '경기',
	양주시: '경기',
	구리: '경기',
	구리시: '경기',
	안성: '경기',
	안성시: '경기',
	여주: '경기',
	여주시: '경기',
	창원: '경남',
	창원시: '경남',
	김해: '경남',
	김해시: '경남',
	청주: '충북',
	청주시: '충북',
	천안: '충남',
	천안시: '충남',
	전주: '전북',
	전주시: '전북',
	포항: '경북',
	포항시: '경북',
};

/** City-level names people already type — do not prefix with 경기/경남. */
const STANDALONE_CITIES = new Set([
	'수원',
	'수원시',
	'성남',
	'성남시',
	'용인',
	'용인시',
	'고양',
	'고양시',
	'평택',
	'평택시',
	'안산',
	'안산시',
	'안양',
	'안양시',
	'부천',
	'부천시',
	'남양주',
	'남양주시',
	'화성',
	'화성시',
	'시흥',
	'시흥시',
	'파주',
	'파주시',
	'의정부',
	'의정부시',
	'김포',
	'김포시',
	'광명',
	'광명시',
	'군포',
	'군포시',
	'하남',
	'하남시',
	'오산',
	'오산시',
	'이천',
	'이천시',
	'양주',
	'양주시',
	'구리',
	'구리시',
	'안성',
	'안성시',
	'여주',
	'여주시',
	'창원',
	'창원시',
	'김해',
	'김해시',
	'청주',
	'청주시',
	'천안',
	'천안시',
	'전주',
	'전주시',
	'포항',
	'포항시',
]);

const SEOUL_SHORT_DISTRICTS = new Set([
	'강남',
	'서초',
	'송파',
	'마포',
	'종로',
	'영등포',
	'노원',
	'강서',
	'관악',
	'동작',
	'성동',
	'광진',
	'용산',
	'은평',
	'양천',
	'구로',
	'금천',
	'동대문',
	'중랑',
	'성북',
	'강북',
	'도봉',
	'강동',
]);

const METRO_SET = new Set<string>(METROS);

/** Gemini/Clova → local, Claude/Copilot → metro, ChatGPT/Perplexity → nationwide. */
export const ENGINE_EXPANDED_PATTERN: Record<
	ExpandedTriggerEngineId,
	{ pattern: ToBeQueryPattern; slot: number }
> = {
	gemini: { pattern: 'local', slot: 0 },
	clova: { pattern: 'local', slot: 1 },
	claude: { pattern: 'metro', slot: 0 },
	copilot: { pattern: 'metro', slot: 1 },
	chatgpt: { pattern: 'nationwide', slot: 0 },
	perplexity: { pattern: 'nationwide', slot: 1 },
};

export function hasFormalAdminRegion(value: string): boolean {
	return /특별시|광역시|특별자치시|특별자치도/.test(value || '');
}

/** Strip 특별시/광역시/도 formal suffixes to spoken city names. */
export function stripAdminRegionSuffix(raw: string): string {
	let text = (raw || '').replace(/\s+/g, ' ').trim();
	if (!text) return '';
	for (const [pattern, short] of FORMAL_TO_SHORT) {
		text = text.replace(pattern, short);
	}
	return text.replace(LEFTOVER_ADMIN_SUFFIX, '').replace(/\s+/g, ' ').trim();
}

function preferDistrictLabel(token: string): string {
	if (SEOUL_SHORT_DISTRICTS.has(token)) return `${token}구`;
	return token;
}

function isMetroToken(token: string): boolean {
	return METRO_SET.has(token);
}

/**
 * Parse a mixed location string into metro + district and a colloquial phrase.
 * "서초구 서울특별시" / "서울특별시 서초구" → { metro: 서울, district: 서초구, colloquial: 서울 서초구 }
 */
export function parseQueryLocation(raw: string): QueryLocationParts {
	const stripped = stripAdminRegionSuffix(raw);
	if (!stripped) {
		return { metro: '', district: '', colloquial: '', localFocus: '' };
	}

	let metro = '';
	for (const city of METROS) {
		if (stripped === city || stripped.startsWith(`${city} `) || stripped.endsWith(` ${city}`) || stripped.includes(` ${city} `)) {
			metro = city;
			break;
		}
	}

	const tokens = stripped.split(' ').filter(Boolean);
	let district = '';
	const districtKeys = Object.keys(DISTRICT_TO_METRO).sort((a, b) => b.length - a.length);
	for (const token of tokens) {
		if (isMetroToken(token)) continue;
		const mapped = DISTRICT_TO_METRO[token];
		if (mapped) {
			district = preferDistrictLabel(token);
			if (!metro) metro = mapped;
			break;
		}
	}
	if (!district) {
		for (const key of districtKeys) {
			if (stripped.includes(key) && !isMetroToken(key)) {
				district = preferDistrictLabel(key);
				if (!metro) metro = DISTRICT_TO_METRO[key] || '';
				break;
			}
		}
	}
	if (!district) {
		for (const gu of stripped.matchAll(/([가-힣]{1,6}(?:구|군))/g)) {
			const token = gu[1];
			if (!token || isMetroToken(token)) continue;
			district = token;
			if (!metro) metro = DISTRICT_TO_METRO[token] || DISTRICT_TO_METRO[token.replace(/[구군]$/, '')] || '';
			break;
		}
	}

	if (!metro) {
		const leftover = tokens.find((t) => !isMetroToken(t) && t !== district);
		metro = leftover && leftover.length <= 6 ? leftover : tokens[0] || '';
		if (metro === district) metro = DISTRICT_TO_METRO[district] || '';
	}

	const colloquial =
		metro && district && district !== metro
			? STANDALONE_CITIES.has(district)
				? district.replace(/시$/, '')
				: `${metro} ${district}`
			: metro || district || stripped;
	const localFocus = district || metro || stripped;
	return { metro, district, colloquial, localFocus };
}

/** Format any location blob as a spoken search phrase (no 특별시/광역시). */
export function formatColloquialLocation(raw: string): string {
	return parseQueryLocation(raw).colloquial;
}

export interface ToBeKeywordPack {
	local: string[];
	metro: string[];
	nationwide: string[];
	all: string[];
}

export function flattenToBeKeywordPack(pack: ToBeKeywordPack, limit = 8): string[] {
	return uniqQueryPhrases([...pack.local, ...pack.metro, ...pack.nationwide], limit);
}

export function pickExpandedTriggerQuery(
	engineId: string,
	pack: ToBeKeywordPack,
	fallback = '',
): string {
	const assignment = ENGINE_EXPANDED_PATTERN[engineId as ExpandedTriggerEngineId];
	const pattern = assignment?.pattern ?? 'nationwide';
	const slot = assignment?.slot ?? 0;
	const list = pack[pattern];
	return list[slot] || list[0] || pack.nationwide[0] || pack.local[0] || pack.metro[0] || fallback;
}

export function uniqQueryPhrases(items: string[], limit = 8): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const raw of items) {
		const v = (raw || '').replace(/\s+/g, ' ').trim();
		if (!v || v.length < 2) continue;
		if (hasFormalAdminRegion(v)) continue;
		const key = v.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(v);
		if (out.length >= limit) break;
	}
	return out;
}
