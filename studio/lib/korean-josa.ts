export type JosaType = '이/가' | '을/를' | '은/는' | '으로/로' | '과/와';

/**
 * 마지막 글자의 받침 유무를 확인하여 적절한 조사를 반환하거나 결합합니다.
 */
export const getJosa = (word: string, josaType: JosaType): string => {
	if (!word) return '';

	const lastChar = word.trim().slice(-1);
	const charCode = lastChar.charCodeAt(0);

	// 한글 유니코드 범위 체크 (가: 0xAC00 ~ 힣: 0xD7A3)
	if (charCode >= 0xac00 && charCode <= 0xd7a3) {
		const hasJongsung = (charCode - 0xac00) % 28 > 0;

		switch (josaType) {
			case '이/가':
				return hasJongsung ? '이' : '가';
			case '을/를':
				return hasJongsung ? '을' : '를';
			case '은/는':
				return hasJongsung ? '은' : '는';
			case '과/와':
				return hasJongsung ? '과' : '와';
			case '으로/로':
				// 'ㄹ' 받침(종성 인덱스 8)일 때는 '로'
				return hasJongsung && (charCode - 0xac00) % 28 !== 8 ? '으로' : '로';
		}
	}

	// 한글이 아니거나(숫자, 영어 등) 기본 Fallback
	return josaType.split('/')[0];
};

/** `안성` + 은/는 → `안성은`, `스포츠재활` + 을/를 → `스포츠재활을`. */
export const withJosa = (word: string, josaType: JosaType): string => {
	const trimmed = (word || '').trim();
	if (!trimmed) return '';
	return `${trimmed}${getJosa(trimmed, josaType)}`;
};

/** Korean honorific `님` — no-op in English, skipped if already present. */
export const withHonorific = (name: string, lang: string = 'ko'): string => {
	const trimmed = (name || '').trim();
	if (!trimmed || lang === 'en') return trimmed;
	return /님$/.test(trimmed) ? trimmed : `${trimmed}님`;
};

/**
 * 단어 뒤에 조사 '이' 또는 '가'를 붙여 '...이/가 원인입니다.' 문장을 생성
 */
export const attachCauseReason = (reasonText: string): string => {
	const trimmed = reasonText.trim();
	const josa = getJosa(trimmed, '이/가');
	return `${trimmed}${josa} 원인입니다.`;
};
