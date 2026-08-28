const SEO_KEYWORD_NOISE =
	/잘하는\s*곳|추천\s*병원|추천\s*업체|베스트|후기\s*좋은|과잉진료|비용|가격|예약|근교|근처|유명|인기|검색|정보|가이드/gi;

const BUSINESS_NAME_RE =
	/[A-Za-z0-9가-힣]{2,24}(?:치과의원|치과병원|피부과의원|성형외과|한의원|동물병원|치과|피부과|병원|의원|클리닉|Clinic|Hospital|Dental)/g;

const TITLE_SPLIT_RE = /\s*[|｜\-–—·•]\s*/;
const HANGUL_OFFICIAL_RE = /[가-힣0-9A-Za-z]{2,24}(?:치과의원|치과병원|피부과의원|성형외과|한의원|동물병원|치과|피부과|병원|의원|클리닉)$/;
const METRO_ONLY_RE = /^(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주|강남|서초|송파|센텀|해운대|서면|분당|일산)$/;
const SEO_HEAD_NOISE_RE = /잘하는|추천|임플란트|울쎄라|리프팅|보톡스|필러|베스트|후기|비용|가격/;

/**
 * Collapse consecutive repeated phrases into one.
 * e.g. "한국중입자 암치료연구소 한국중입자 암치료연구소" → "한국중입자 암치료연구소"
 * Also normalizes "Brand | Brand" after separator collapse.
 */
export function dedupeRepeatedPhrase(raw: string): string {
	let text = (raw || '').replace(/\s+/g, ' ').trim();
	if (!text) return '';

	// Title-style separators → spaces so "A | A" collapses like "A A"
	text = text.replace(/\s*[|｜\-–—·•]\s*/g, ' ').replace(/\s+/g, ' ').trim();

	const parts = text.split(' ').filter(Boolean);
	if (parts.length < 2) return text;

	for (let phraseLen = Math.floor(parts.length / 2); phraseLen >= 1; phraseLen--) {
		if (parts.length % phraseLen !== 0) continue;
		const repeats = parts.length / phraseLen;
		if (repeats < 2) continue;
		const phrase = parts.slice(0, phraseLen).join(' ');
		let allMatch = true;
		for (let i = 1; i < repeats; i++) {
			if (parts.slice(i * phraseLen, (i + 1) * phraseLen).join(' ') !== phrase) {
				allMatch = false;
				break;
			}
		}
		if (allMatch) return phrase;
	}

	return text;
}

function compactBrandKey(value: string): string {
	return String(value || '')
		.toLowerCase()
		.replace(/[^a-z0-9가-힣]/g, '');
}

/** First `|` / dash segment of `<title>` / og:title — the official site name. */
export function titleBrandHead(raw: string | undefined | null): string {
	const source = String(raw || '')
		.replace(/\s+/g, ' ')
		.trim();
	if (!source) return '';
	const first = (source.split(TITLE_SPLIT_RE)[0] || '').trim();
	if (first.length < 2 || first.length > 40) return '';
	if (SEO_HEAD_NOISE_RE.test(first) || METRO_ONLY_RE.test(first)) return '';
	return first;
}

/** True when a label is just the host slug (nineoneclinic.com → Nineoneclinic). */
export function looksLikeDomainBrand(name: string, domain: string): boolean {
	const n = compactBrandKey(name);
	if (!n) return false;
	const host = String(domain || '')
		.replace(/^www\./i, '')
		.split('/')[0]
		.split(':')[0];
	const head = compactBrandKey(host.split('.')[0] || host);
	if (!head || head.length < 3) return false;
	if (n === head || n === compactBrandKey(host.replace(/\./g, ''))) return true;
	const stripped = (s: string) => s.replace(/(clinic|hospital|dental|official)$/g, '');
	return stripped(n) === stripped(head) && stripped(n).length >= 4;
}

function isHangulOfficialName(value: string): boolean {
	const text = String(value || '').replace(/\s+/g, '').trim();
	if (text.length < 2 || text.length > 40) return false;
	if (!/[가-힣]{2,}/.test(text)) return false;
	if (METRO_ONLY_RE.test(text) || SEO_HEAD_NOISE_RE.test(text)) return false;
	HANGUL_OFFICIAL_RE.lastIndex = 0;
	return HANGUL_OFFICIAL_RE.test(text);
}

function titleSegments(raw: string): string[] {
	return String(raw || '')
		.split(TITLE_SPLIT_RE)
		.map((part) => part.replace(/\s+/g, ' ').trim())
		.filter((part) => part.length >= 2 && part.length <= 40);
}

/**
 * Extract the official brand from a noisy SEO title.
 * Title / og:title head wins over English schema or domain slugs.
 * e.g. "나인원의원 | 대구 여의사 피부·성형 리프팅" → "나인원의원"
 */
export function extractOfficialBrandName(siteTitle: string, domain: string, hint?: string): string {
	const title = dedupeRepeatedPhrase((siteTitle || '').replace(/\s+/g, ' ').trim());
	const hangulFromTitle = [titleBrandHead(siteTitle), ...titleSegments(siteTitle)].find(isHangulOfficialName);
	if (hangulFromTitle) return hangulFromTitle.slice(0, 40);

	if (hint && !looksLikeDomainBrand(hint, domain)) {
		const cleanedHint = dedupeRepeatedPhrase(
			hint.replace(SEO_KEYWORD_NOISE, '').replace(/\s+/g, ' ').trim(),
		);
		if (isHangulOfficialName(cleanedHint) || titleBrandHead(cleanedHint) === cleanedHint) {
			if (
				cleanedHint.length >= 2 &&
				cleanedHint.length <= 40 &&
				!SEO_HEAD_NOISE_RE.test(cleanedHint) &&
				!METRO_ONLY_RE.test(cleanedHint)
			) {
				return cleanedHint.slice(0, 40);
			}
		}
		if (
			cleanedHint.length >= 2 &&
			cleanedHint.length <= 40 &&
			!SEO_HEAD_NOISE_RE.test(cleanedHint)
		) {
			BUSINESS_NAME_RE.lastIndex = 0;
			if (
				(BUSINESS_NAME_RE.test(cleanedHint) || /[가-힣]{2,}/.test(cleanedHint)) &&
				!METRO_ONLY_RE.test(cleanedHint)
			) {
				return cleanedHint.slice(0, 40);
			}
		}
	}

	BUSINESS_NAME_RE.lastIndex = 0;
	const named = title.match(BUSINESS_NAME_RE);
	if (named?.length) {
		return dedupeRepeatedPhrase(named[named.length - 1]!).slice(0, 40);
	}

	let stripped = title
		.replace(
			/^(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주|강남|서초|송파|센텀|해운대|서면|분당|일산)\s*/g,
			'',
		)
		.replace(SEO_KEYWORD_NOISE, ' ')
		.replace(/\s*[|\-–—·•]\s*/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();

	stripped = dedupeRepeatedPhrase(
		stripped
			.replace(/^(임플란트|울쎄라|리프팅|보톡스|필러|교정|라미네이트|피부과|치과)\s+/i, '')
			.trim(),
	);

	if (stripped.length >= 2 && stripped.length <= 40 && !/잘하는|추천/.test(stripped)) {
		return stripped;
	}

	const host = domain.replace(/^www\./, '').split('.')[0] || domain;
	return host.charAt(0).toUpperCase() + host.slice(1);
}

export function looksLikeKeywordBrand(name: string): boolean {
	return /잘하는|추천|임플란트\s*잘하는|울쎄라\s*잘하는|베스트|후기\s*좋은|비용|가격/.test(name);
}

/**
 * Display-ready site name: drop `|` / dash subtitles, collapse repeats, strip wrapping junk.
 * Does not fall back to a domain — callers decide that.
 */
export function cleanSiteName(raw: string | undefined | null): string {
	let text = String(raw || '')
		.replace(/[\u0000-\u001F\u007F]/g, '')
		.replace(/\s+/g, ' ')
		.trim();
	if (!text) return '';

	text = text.replace(/^["'`“”‘’\[\](){}<>]+|["'`“”‘’\[\](){}<>]+$/g, '').trim();
	const pipeHead = (text.split(/\s*[|｜]\s+/)[0] || text).trim();
	if (pipeHead) text = pipeHead;
	const head = titleBrandHead(text);
	text = dedupeRepeatedPhrase(head || text);
	text = text.replace(/\s*[|｜]+\s*$/g, '').trim();
	if (text.length < 2) return '';
	return text.slice(0, 40);
}

/** True when the label is a hostname / domain slug, not a brand. */
export function isDomainLikeSiteName(name: string, domain: string): boolean {
	const cleaned = String(name || '')
		.replace(/\s+/g, ' ')
		.trim();
	if (!cleaned) return true;
	const host = String(domain || '')
		.replace(/^www\./i, '')
		.split('/')[0]
		.split(':')[0]
		.toLowerCase();
	if (cleaned.toLowerCase() === host) return true;
	if (/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(cleaned)) return true;
	return looksLikeDomainBrand(cleaned, domain || host);
}
