const SEO_KEYWORD_NOISE =
	/잘하는\s*곳|추천\s*병원|추천\s*업체|베스트|후기\s*좋은|과잉진료|비용|가격|예약|근교|근처|유명|인기|검색|정보|가이드/gi;

const BUSINESS_NAME_RE =
	/[A-Za-z0-9가-힣]{2,24}(?:치과의원|치과병원|피부과의원|성형외과|한의원|동물병원|치과|피부과|병원|의원|클리닉|Clinic|Hospital|Dental)/g;

/**
 * Extract the official brand from a noisy SEO title.
 * e.g. "부산 임플란트 잘하는 곳 365드림치과의원" → "365드림치과의원"
 */
export function extractOfficialBrandName(siteTitle: string, domain: string, hint?: string): string {
	const title = (siteTitle || '').replace(/\s+/g, ' ').trim();
	if (hint) {
		const cleanedHint = hint.replace(SEO_KEYWORD_NOISE, '').replace(/\s+/g, ' ').trim();
		if (
			cleanedHint.length >= 2 &&
			cleanedHint.length <= 40 &&
			!/잘하는|추천|임플란트|울쎄라|리프팅/.test(cleanedHint)
		) {
			BUSINESS_NAME_RE.lastIndex = 0;
			if (
				(BUSINESS_NAME_RE.test(cleanedHint) || /[가-힣]{2,}/.test(cleanedHint)) &&
				!/^(부산|서울|대구|인천|광주|대전|울산|강남|센텀|해운대)$/.test(cleanedHint)
			) {
				return cleanedHint.slice(0, 40);
			}
		}
	}

	BUSINESS_NAME_RE.lastIndex = 0;
	const named = title.match(BUSINESS_NAME_RE);
	if (named?.length) {
		return named[named.length - 1]!.slice(0, 40);
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

	stripped = stripped
		.replace(/^(임플란트|울쎄라|리프팅|보톡스|필러|교정|라미네이트|피부과|치과)\s+/i, '')
		.trim();

	if (stripped.length >= 2 && stripped.length <= 40 && !/잘하는|추천/.test(stripped)) {
		return stripped;
	}

	const host = domain.replace(/^www\./, '').split('.')[0] || domain;
	return host.charAt(0).toUpperCase() + host.slice(1);
}

export function looksLikeKeywordBrand(name: string): boolean {
	return /잘하는|추천|임플란트\s*잘하는|울쎄라\s*잘하는|베스트|후기\s*좋은|비용|가격/.test(name);
}
