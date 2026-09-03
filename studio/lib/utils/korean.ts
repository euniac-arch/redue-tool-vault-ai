import { getJosa, withJosa, type JosaType } from '@/lib/korean-josa';

export type { JosaType };
export { getJosa, withJosa };

/**
 * 마지막 글자 받침으로 조사를 고른다.
 * `getKoreanParticle('나인원의원', '은/는')` → `'은'`
 */
export function getKoreanParticle(word: string, pair: JosaType): string {
	return getJosa(word, pair);
}

/** `나인원의원` + 은/는 → `나인원의원은` */
export function withKoreanParticle(word: string, pair: JosaType): string {
	return withJosa(word, pair);
}

/** `A`, `B` → `A과 B` / `A와 B` */
export function joinKoreanAnd(items: string[]): string {
	const cleaned = items.map((item) => item.trim()).filter(Boolean);
	if (cleaned.length === 0) return '';
	if (cleaned.length === 1) return cleaned[0]!;
	if (cleaned.length === 2) return `${withJosa(cleaned[0]!, '과/와')} ${cleaned[1]}`;
	return `${cleaned.slice(0, -1).join(', ')}, ${cleaned[cleaned.length - 1]}`;
}
