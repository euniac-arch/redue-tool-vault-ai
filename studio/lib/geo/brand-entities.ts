/**
 * Brand / person entity stopwords vs category-service nouns.
 * Shared by the metatag parser, SoV query generator, and competitor matcher.
 */

export type BrandEntityLang = 'ko' | 'en';

export interface BrandEntitySeed {
	brandName?: string;
	name?: string;
	title?: string;
	ogTitle?: string;
	ogSiteName?: string;
	keywords?: string;
	keywordList?: readonly string[];
	description?: string;
	representativeName?: string;
	personNames?: readonly string[];
	domain?: string;
}

export interface BrandEntitySet {
	canonical: string;
	aliases: string[];
	personNames: string[];
	keys: string[];
}

export interface ClassifiedMetaKeywords {
	brandEntities: string[];
	personNames: string[];
	categoryNouns: string[];
}

const TITLE_SPLIT = /\s*[|\-–—·•\/,;]\s*/;
const KEYWORD_SPLIT = /[,|/·;]/;

const GENERIC_CATEGORY = new Set([
	'전문 서비스',
	'professional services',
	'서비스',
	'service',
	'services',
	'업체',
	'사이트',
	'홈페이지',
	'공식',
	'official',
	'welcome',
	'지역 비즈니스',
	'local business',
	'동네 추천',
	'local recommendation',
	'organization',
	'website',
	'home',
	'메인',
	'소개',
	'about',
	'contact',
	'문의',
]);

const SERVICE_NOUN_RE =
	/섭외|행사|에이전시|기획|대행|운영|연예인|현장|이벤트|상담|치료|의원|병원|치과|피부과|클리닉|학원|법률|세무|마케팅|제조|임플란트|중입자|정형|재활|도수|추나|통증|암치료|피부|교정|agency|event|booking|clinic|dental|therapy|implant|ortho|rehab/i;

const KOREAN_SURNAMES =
	'김이박최정강조윤장임한오서신권황안송전홍유고문양손배백허남심노하곽성차주우구신임나전민유진엄채원천방공현함변염여추도소석선설마길위표명기반왕금옥육인맹제탁국';

const EN_KO_WORDS: Record<string, string> = {
	made: '메이드',
	in: '인',
	heaven: '헤븐',
	star: '스타',
	event: '이벤트',
	agency: '에이전시',
	lee: '이',
	kim: '김',
	park: '박',
	choi: '최',
	jung: '정',
	kang: '강',
	dabin: '다빈',
};

const KO_EN_SURNAMES: Record<string, string[]> = {
	김: ['kim'],
	이: ['lee', 'yi', 'rhee'],
	박: ['park', 'pak'],
	최: ['choi', 'chae'],
	정: ['jung', 'jeong', 'chung'],
	강: ['kang'],
	조: ['cho', 'jo'],
	윤: ['yoon', 'yun'],
	장: ['jang', 'chang'],
	임: ['lim', 'im'],
	한: ['han'],
	오: ['oh', 'o'],
	서: ['seo'],
	신: ['shin'],
	권: ['kwon'],
	황: ['hwang'],
	안: ['ahn', 'an'],
	송: ['song'],
	전: ['jeon', 'jun'],
	홍: ['hong'],
};

const CHO = ['g', 'kk', 'n', 'd', 'tt', 'r', 'm', 'b', 'pp', 's', 'ss', '', 'j', 'jj', 'ch', 'k', 't', 'p', 'h'];
const JUNG = [
	'a',
	'ae',
	'ya',
	'yae',
	'eo',
	'e',
	'yeo',
	'ye',
	'o',
	'wa',
	'wae',
	'oe',
	'yo',
	'u',
	'wo',
	'we',
	'wi',
	'yu',
	'eu',
	'ui',
	'i',
];
const JONG = [
	'',
	'g',
	'kk',
	'gs',
	'n',
	'nj',
	'nh',
	'd',
	'l',
	'lg',
	'lm',
	'lb',
	'ls',
	'lt',
	'lp',
	'lh',
	'm',
	'b',
	'bs',
	's',
	'ss',
	'ng',
	'j',
	'ch',
	'k',
	't',
	'p',
	'h',
];

export function cleanEntityPhrase(value: unknown, max = 80): string {
	if (typeof value !== 'string') return '';
	return value.replace(/\s+/g, ' ').trim().slice(0, max);
}

export function foldEntityKey(value: string): string {
	return cleanEntityPhrase(value)
		.replace(/[^\p{L}\p{N}]+/gu, '')
		.toLowerCase();
}

function uniqPhrases(items: readonly string[], limit = 24): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const raw of items) {
		const v = cleanEntityPhrase(raw, 60);
		if (!v || v.length < 2) continue;
		const key = foldEntityKey(v);
		if (!key || seen.has(key)) continue;
		seen.add(key);
		out.push(v);
		if (out.length >= limit) break;
	}
	return out;
}

function splitKeywordList(raw: string | undefined | null): string[] {
	if (!raw) return [];
	return raw
		.split(KEYWORD_SPLIT)
		.map((part) => cleanEntityPhrase(part, 40))
		.filter(Boolean);
}

function titleHead(text: string | undefined): string {
	const source = cleanEntityPhrase(text, 160);
	if (!source) return '';
	const first = source.split(TITLE_SPLIT)[0] || '';
	if (first.length >= 2 && first.length <= 40 && !/추천|잘하는|베스트|best|official/i.test(first)) {
		return first;
	}
	return '';
}

function romanizeHangul(text: string): string {
	let out = '';
	for (const ch of text) {
		const code = ch.codePointAt(0) ?? 0;
		if (code < 0xac00 || code > 0xd7a3) {
			out += ch;
			continue;
		}
		const syl = code - 0xac00;
		const cho = Math.floor(syl / 588);
		const jung = Math.floor((syl % 588) / 28);
		const jong = syl % 28;
		out += `${CHO[cho] ?? ''}${JUNG[jung] ?? ''}${JONG[jong] ?? ''}`;
	}
	return out;
}

function englishWordToHangul(word: string): string {
	const key = word.toLowerCase();
	if (EN_KO_WORDS[key]) return EN_KO_WORDS[key]!;
	if (key.length <= 1) return '';
	const chunks = key.match(/[^aeiouy]*[aeiouy]+[^aeiouy]*/g) ?? [key];
	const map: Record<string, string> = {
		a: '아',
		e: '에',
		i: '이',
		o: '오',
		u: '우',
		y: '이',
		ae: '애',
		ee: '이',
		oo: '우',
		da: '다',
		ba: '바',
		bi: '비',
		bin: '빈',
		vin: '빈',
		he: '헤',
		ven: '븐',
		venn: '븐',
		ma: '마',
		me: '메',
		de: '드',
		id: '이드',
	};
	return chunks.map((chunk) => map[chunk] || '').join('');
}

function latinToHangulPhrase(text: string): string {
	const words = text
		.replace(/[^A-Za-z\s]/g, ' ')
		.split(/\s+/)
		.filter(Boolean);
	if (!words.length) return '';
	const hangul = words.map(englishWordToHangul).join('');
	return hangul.length >= 2 ? hangul : '';
}

function hangulPersonToLatin(name: string): string[] {
	if (!/^[가-힣]{2,4}$/.test(name)) return [];
	const surname = name[0]!;
	const given = name.slice(1);
	const romanGiven = romanizeHangul(given);
	const surnames = KO_EN_SURNAMES[surname] ?? [romanizeHangul(surname)];
	const out: string[] = [];
	for (const sur of surnames) {
		if (romanGiven) {
			out.push(`${sur} ${romanGiven}`);
			out.push(`${romanGiven} ${sur}`);
		}
	}
	return out;
}

function looksLikeEnglishPersonName(value: string): boolean {
	const v = cleanEntityPhrase(value, 40);
	if (!/^[A-Za-z][A-Za-z.\s-]{2,28}$/.test(v)) return false;
	if (SERVICE_NOUN_RE.test(v) || GENERIC_CATEGORY.has(v.toLowerCase())) return false;
	const words = v.split(/\s+/).filter(Boolean);
	return words.length >= 2 && words.length <= 3 && words.every((w) => w.length >= 2);
}

function looksLikeKoreanPersonName(value: string): boolean {
	const v = cleanEntityPhrase(value, 20);
	if (!/^[가-힣]{3,4}$/.test(v)) return false;
	if (SERVICE_NOUN_RE.test(v)) return false;
	return KOREAN_SURNAMES.includes(v[0] ?? '');
}

export function looksLikePersonName(value: string): boolean {
	return looksLikeKoreanPersonName(value) || looksLikeEnglishPersonName(value);
}

/** Expand a brand / person label into script + spacing aliases. */
export function expandBrandAliases(name: string): string[] {
	const base = cleanEntityPhrase(name, 60);
	if (!base) return [];
	const aliases = [base, base.replace(/\s+/g, ''), base.toLowerCase(), base.toUpperCase()];
	const hangul = latinToHangulPhrase(base);
	if (hangul) aliases.push(hangul);
	const roman = romanizeHangul(base.replace(/\s+/g, ''));
	if (roman && /[a-z]/i.test(roman)) aliases.push(roman);
	if (looksLikeKoreanPersonName(base)) aliases.push(...hangulPersonToLatin(base));
	if (looksLikeEnglishPersonName(base)) {
		const words = base.split(/\s+/);
		const last = words[words.length - 1] || '';
		const given = words.slice(0, -1).join(' ');
		const koLast = EN_KO_WORDS[last.toLowerCase()] || latinToHangulPhrase(last);
		const koGiven = latinToHangulPhrase(given);
		if (koLast && koGiven) aliases.push(`${koLast}${koGiven}`, `${koGiven}${koLast}`);
	}
	return uniqPhrases(aliases, 16);
}

function domainHead(domain?: string): string {
	if (!domain) return '';
	const host = domain.replace(/^www\./i, '').split('.')[0] || '';
	return host.length >= 3 ? host : '';
}

/** Collect brand + person stopwords from title / name / keywords / representative. */
export function collectBrandEntities(seed: BrandEntitySeed | null | undefined): BrandEntitySet {
	const brandName = cleanEntityPhrase(seed?.brandName || seed?.name, 80);
	const people = uniqPhrases(
		[
			cleanEntityPhrase(seed?.representativeName, 40),
			...(seed?.personNames ?? []),
			...splitKeywordList(seed?.keywords).filter(looksLikePersonName),
			...(seed?.keywordList ?? []).filter(looksLikePersonName),
		],
		8,
	);
	const seeds = uniqPhrases(
		[
			brandName,
			cleanEntityPhrase(seed?.ogSiteName, 80),
			titleHead(seed?.title),
			titleHead(seed?.ogTitle),
			domainHead(seed?.domain),
			...people,
		],
		12,
	);
	const aliases = uniqPhrases(seeds.flatMap(expandBrandAliases), 32);
	const keys = [...new Set(aliases.map(foldEntityKey).filter((k) => k.length >= 2))];
	return {
		canonical: brandName || seeds[0] || '',
		aliases,
		personNames: people,
		keys,
	};
}

function significantContainment(a: string, b: string): boolean {
	if (!a || !b || a === b) return a === b;
	const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
	const minLen = /[가-힣]/.test(shorter) ? 3 : 5;
	if (shorter.length < minLen) return false;
	return longer.includes(shorter);
}

export function isSameBrandEntity(
	left: string,
	right: string,
	extraAliases: readonly string[] = [],
): boolean {
	const a = foldEntityKey(left);
	const b = foldEntityKey(right);
	if (!a || !b) return false;
	if (a === b || significantContainment(a, b)) return true;
	const leftKeys = expandBrandAliases(left).map(foldEntityKey).filter((k) => k.length >= 2);
	const rightKeys = [...expandBrandAliases(right), ...extraAliases]
		.map(foldEntityKey)
		.filter((k) => k.length >= 2);
	return leftKeys.some((lk) => rightKeys.some((rk) => lk === rk || significantContainment(lk, rk)));
}

export function isBrandStopword(token: string, entities: BrandEntitySet): boolean {
	const key = foldEntityKey(token);
	if (!key || key.length < 2) return false;
	if (SERVICE_NOUN_RE.test(token) && !entities.personNames.some((person) => foldEntityKey(person) === key)) {
		return false;
	}
	if (entities.keys.includes(key)) return true;
	if (entities.personNames.some((person) => isSameBrandEntity(token, person))) return true;
	if (entities.aliases.some((alias) => isSameBrandEntity(token, alias))) return true;
	return entities.keys.some((brandKey) => {
		if (brandKey.length < 6) return false;
		return brandKey.includes(key) && key.length >= 4 && !SERVICE_NOUN_RE.test(token);
	});
}

const SERVICE_PHRASE_RES: RegExp[] = [
	/연예인\s*섭외/g,
	/행사\s*섭외/g,
	/행사\s*기획/g,
	/행사\s*대행/g,
	/현장\s*운영/g,
	/이벤트\s*기획/g,
	/이벤트\s*대행/g,
	/섭외\s*에이전시/g,
	/행사\s*에이전시/g,
];

export function extractServicePhrases(text: string | undefined | null): string[] {
	const source = cleanEntityPhrase(text, 400);
	if (!source) return [];
	const hits: string[] = [];
	for (const re of SERVICE_PHRASE_RES) {
		re.lastIndex = 0;
		let match: RegExpExecArray | null;
		while ((match = re.exec(source))) {
			hits.push(match[0].replace(/\s+/g, ' ').trim());
		}
	}
	return uniqPhrases(hits, 8);
}

function isGenericCategory(value: string): boolean {
	return GENERIC_CATEGORY.has(value.toLowerCase()) || GENERIC_CATEGORY.has(foldEntityKey(value));
}

/**
 * Split title / name / keywords / description into brand-person stopwords
 * and remaining category / service nouns.
 */
export function classifyMetaKeywords(seed: BrandEntitySeed | null | undefined): ClassifiedMetaKeywords {
	const entities = collectBrandEntities(seed);
	const rawTokens = [
		...splitKeywordList(seed?.keywords),
		...(seed?.keywordList ?? []),
		...extractServicePhrases(seed?.description),
		...extractServicePhrases(seed?.keywords),
		...cleanEntityPhrase(seed?.title, 160)
			.split(TITLE_SPLIT)
			.flatMap((seg) => seg.split(/\s+/)),
	];
	const brandEntities = uniqPhrases(
		[entities.canonical, ...entities.aliases.filter((alias) => /[가-힣]{2,}|[A-Za-z]{3,}/.test(alias))],
		12,
	);
	const personNames = entities.personNames;
	const categoryNouns: string[] = [];
	const seen = new Set<string>();
	for (const raw of rawTokens) {
		const token = cleanEntityPhrase(raw, 40);
		if (!token || token.length < 2 || isGenericCategory(token)) continue;
		if (isBrandStopword(token, entities)) continue;
		if (!/[가-힣]{2,}/.test(token) && !/^[A-Za-z][A-Za-z0-9 &\-/]{2,30}$/.test(token)) continue;
		if (/추천|잘하는|베스트|best|official|welcome/i.test(token) && !SERVICE_NOUN_RE.test(token)) continue;
		const key = foldEntityKey(token);
		if (seen.has(key)) continue;
		seen.add(key);
		categoryNouns.push(token);
	}
	return { brandEntities, personNames, categoryNouns };
}
