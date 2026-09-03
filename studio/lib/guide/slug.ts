/**
 * 업종 접미사(의원/병원/치과 등)만 영문으로 치환하는 범용 규칙이다.
 * 특정 업체의 상호명을 여기에 매핑하지 말 것 — 브랜드명 자체는
 * `slugifyGuide`의 NFKD 정규화·라틴 변환 경로가 처리한다.
 */
const HANGUL_TO_LATIN: Record<string, string> = {
	의원: 'clinic',
	병원: 'hospital',
	치과: 'dental',
	피부과: 'dermatology',
	한의원: 'oriental',
};

export function slugifyGuide(raw: string): string {
	const trimmed = raw.trim();
	if (!trimmed) return '';

	let next = trimmed;
	for (const [ko, en] of Object.entries(HANGUL_TO_LATIN)) {
		next = next.split(ko).join(en);
	}

	return next
		.normalize('NFKD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 48);
}

export function suggestGuideSlug(brandNameEng: string, brandName: string, fallback?: string): string {
	return slugifyGuide(brandNameEng) || slugifyGuide(brandName) || slugifyGuide(fallback || '') || 'brand';
}

export function createGuideId(): string {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID();
	}
	return `guide-${Date.now().toString(36)}`;
}
