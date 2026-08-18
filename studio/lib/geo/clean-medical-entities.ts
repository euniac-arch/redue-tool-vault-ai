/**
 * Shared To-Be entity cleaner: drop GNB/UI chrome and leftover verticals
 * so JSON-LD / FAQ / engine queries stay bound to on-page specialties.
 */

const UI_STOPWORDS = [
	'원장소개',
	'병원소개',
	'의원소개',
	'오시는길',
	'오시는 길',
	'찾아오시는길',
	'찾아오시는 길',
	'진료시간',
	'비급여항목',
	'비급여',
	'공지사항',
	'온라인예약',
	'방송출연',
	'언론보도',
	'커뮤니티',
	'사이트맵',
	'로그인',
	'회원가입',
	'의료진',
	'상담문의',
	'게시판',
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
]);

const PLASTIC_LEFTOVER_RE = /성형외과|성형수술|성형시술|미용성형|plastic\s*surg/i;

export { UI_STOPWORDS };

function compact(value: string): string {
	return (value || '').replace(/\s+/g, ' ').trim();
}

export function isUiStopword(value: string): boolean {
	const v = compact(value);
	if (!v) return true;
	const folded = v.replace(/\s+/g, '').toLowerCase();
	if (UI_EXACT.has(folded) || UI_EXACT.has(v.toLowerCase())) return true;
	return UI_STOPWORDS.some((stop) => folded.includes(stop.replace(/\s+/g, '').toLowerCase()));
}

export function looksLikePlasticSpecialty(value: string): boolean {
	return PLASTIC_LEFTOVER_RE.test(value || '');
}

/** Drop GNB / common UI labels from raw crawl or leftover keyword lists. */
export const extractValidSpecialties = (rawKeywords: string[]): string[] => {
	return rawKeywords
		.map((k) => compact(k))
		.filter((k) => k.length > 1 && !isUiStopword(k));
};

const OTHER_MEDICAL_RE = /재활|아동|발달|정형|도수|통증|치과|한의|내과|임플란트|중입자|암치료|소아/;

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
