/**
 * Shared To-Be entity cleaner: drop GNB/UI chrome and leftover verticals
 * so JSON-LD / FAQ / engine queries stay bound to on-page specialties.
 */

/** Multi-word / compound navigation labels — matched after whitespace folding. */
const UI_STOPWORDS = [
	'원장소개',
	'병원소개',
	'의원소개',
	'클리닉소개',
	'병원장',
	'인사말',
	'원장인사',
	'병원장인사말',
	'둘러보기',
	'병원둘러보기',
	'시설둘러보기',
	'오시는길',
	'오시는 길',
	'찾아오시는길',
	'찾아오시는 길',
	'운영시스템',
	'운영 시스템',
	'운영시스템안내',
	'진료시간',
	'비급여항목',
	'비급여',
	'공지사항',
	'의료진소개',
	'의료진 소개',
	'층별안내',
	'층별 안내',
	'시설안내',
	'시설 안내',
	'온라인예약',
	'온라인 예약',
	'방송출연',
	'언론보도',
	'커뮤니티',
	'갤러리',
	'사이트맵',
	'이용약관',
	'개인정보처리방침',
	'개인정보취급방침',
	'홈으로',
	'더보기',
	'바로가기',
	'로그인',
	'회원가입',
	'의료진',
	'상담문의',
	'게시판',
	'about us',
	'directions',
	'privacy policy',
	'terms of service',
	'read more',
] as const;

const UI_EXACT = new Set([
	'home',
	'메인',
	'홈',
	'소개',
	'about',
	'contact',
	'문의',
	'예약',
	'공지',
	'블로그',
	'sns',
	'instagram',
	'youtube',
	'카카오',
	'위치',
	'안내',
	'인사말',
	'병원장',
	'둘러보기',
	'갤러리',
	'사이트맵',
	'커뮤니티',
	'이용약관',
	'홈으로',
	'더보기',
	'바로가기',
	'오시는',
	'greeting',
	'gallery',
	'sitemap',
	'community',
	'notice',
	'login',
	'signup',
]);

/** Tokens stripped from mixed phrases (never includes industry nouns like 병원). */
const UI_STOP_TOKENS = new Set([
	...UI_EXACT,
	'병원장',
	'인사말',
	'둘러보기',
	'공지사항',
	'커뮤니티',
	'갤러리',
	'사이트맵',
	'이용약관',
	'개인정보처리방침',
	'홈으로',
	'더보기',
	'바로가기',
	'온라인예약',
	'의료진',
	'층별',
	'시설안내',
	'운영시스템',
	'오시는길',
	'찾아오시는길',
	'원장소개',
	'병원소개',
	'의원소개',
]);

const PLASTIC_LEFTOVER_RE = /성형외과|성형수술|성형시술|미용성형|plastic\s*surg/i;

export { UI_STOPWORDS };

function compact(value: string): string {
	return (value || '').replace(/\s+/g, ' ').trim();
}

function foldUi(value: string): string {
	return value.replace(/\s+/g, '').toLowerCase();
}

const UI_STOP_PHRASES_FOLDED = [...new Set([...UI_STOPWORDS].map((stop) => foldUi(stop)))]
	.filter((stop) => stop.length >= 3)
	.sort((a, b) => b.length - a.length);

const UI_PEEL_FRAGMENTS = [...new Set([...UI_STOP_PHRASES_FOLDED, ...UI_STOP_TOKENS])]
	.filter((stop) => stop.length >= 2)
	.sort((a, b) => b.length - a.length);

function tokenizeUi(value: string): string[] {
	return compact(value)
		.split(/[\s|/·,;•]+/)
		.map((token) => token.trim())
		.filter((token) => token.length >= 2);
}

function isStopToken(folded: string): boolean {
	return UI_STOP_TOKENS.has(folded) || UI_EXACT.has(folded);
}

function isStopPhrase(folded: string): boolean {
	return UI_STOP_PHRASES_FOLDED.some((stop) => folded === stop);
}

function peelUiFragments(folded: string): string {
	let next = folded;
	for (const fragment of UI_PEEL_FRAGMENTS) {
		if (!next.includes(fragment) || next === fragment) continue;
		next = next.split(fragment).join('');
	}
	return next;
}

/**
 * Remove GNB / admin chrome from a phrase and keep leftover service tokens.
 * `병원 둘러보기` → `병원`, `병원장 인사말` → ``.
 */
export function stripUiStopwords(value: string): string {
	const source = compact(value);
	if (!source) return '';
	if (isStopPhrase(foldUi(source)) || isStopToken(foldUi(source))) return '';

	const kept: string[] = [];
	for (const token of tokenizeUi(source)) {
		const folded = foldUi(token);
		if (isStopToken(folded) || isStopPhrase(folded)) continue;
		const peeled = peelUiFragments(folded);
		if (!peeled || isStopToken(peeled) || isStopPhrase(peeled) || peeled.length < 2) continue;
		kept.push(peeled === folded ? token : peeled);
	}

	const joined = compact(kept.join(' '));
	if (!joined) return '';
	if (isStopPhrase(foldUi(joined)) || isStopToken(foldUi(joined))) return '';
	return joined;
}

export function isUiStopword(value: string): boolean {
	const v = compact(value);
	if (!v) return true;
	const folded = foldUi(v);
	if (UI_EXACT.has(folded) || UI_EXACT.has(v.toLowerCase())) return true;
	if (isStopPhrase(folded) || isStopToken(folded)) return true;
	return !stripUiStopwords(v);
}

export function looksLikePlasticSpecialty(value: string): boolean {
	return PLASTIC_LEFTOVER_RE.test(value || '');
}

/** Drop GNB / common UI labels from raw crawl or leftover keyword lists. */
export const extractValidSpecialties = (rawKeywords: string[]): string[] => {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const raw of rawKeywords) {
		const stripped = stripUiStopwords(compact(raw));
		if (stripped.length < 2 || isUiStopword(stripped)) continue;
		const key = foldUi(stripped);
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(stripped);
	}
	return out;
};

const OTHER_MEDICAL_RE = /재활|아동|발달|정형|도수|통증|치과|한의|내과|임플란트|중입자|암치료|소아|비뇨|슬개|동물병원|건강검진/;

/** Drop leftover 성형외과 when a different on-page medical cluster already won. */
export function dropLeftoverPlastic(specialties: readonly string[]): string[] {
	const cleaned = extractValidSpecialties([...specialties]);
	if (cleaned.some((s) => OTHER_MEDICAL_RE.test(s))) {
		return cleaned.filter((s) => !looksLikePlasticSpecialty(s));
	}
	return cleaned;
}

export function cleanMedicalEntities(
	rawKeywords: readonly string[] | undefined | null,
	opts?: { plasticOk?: boolean; limit?: number },
): string[] {
	const limit = opts?.limit ?? 8;
	const plasticOk = Boolean(opts?.plasticOk);
	const seen = new Set<string>();
	const out: string[] = [];
	for (const raw of dropLeftoverPlastic(extractValidSpecialties([...(rawKeywords ?? [])]))) {
		if (!plasticOk && looksLikePlasticSpecialty(raw)) continue;
		const key = raw.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(raw);
		if (out.length >= limit) break;
	}
	return out;
}
