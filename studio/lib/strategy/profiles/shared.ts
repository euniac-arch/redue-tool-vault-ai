import type { StrategyLang } from '@/lib/strategy/types';
import type { BlueprintVariant, CitationEntity, Localized } from '@/lib/strategy/profiles/types';

export const CLINICAL_COLUMNS: Localized<string[]> = {
	ko: ['유형', '권장 방식', '장비·기전', '주의사항', '다운타임'],
	en: ['Type', 'Recommended approach', 'Device / mechanism', 'Cautions', 'Downtime'],
};

export const GENERIC_COLUMNS: Localized<string[]> = {
	ko: ['유형', '권장 방식', '확인 기준', '주의사항'],
	en: ['Type', 'Recommended approach', 'What to verify', 'Cautions'],
};

export type VariantDraft = Omit<BlueprintVariant, 'patterns'>;

export function variant(draft: VariantDraft, patterns: readonly RegExp[]): BlueprintVariant {
	return { ...draft, patterns };
}

export function genericRag(
	e: CitationEntity,
	lang: StrategyLang,
	topic: string,
): Array<{ id: string; title: string; text: string }> {
	if (lang === 'en') {
		return [
			{
				id: 'rag-entity',
				title: 'Entity unit',
				text: `${e.brand} ${e.person} publishes ${e.focus} for ${e.location || 'the official service area'} as a single entity unit: organization ${e.brand}, role ${e.personRole}, service ${e.focus}, industry ${e.industry}. ${e.brand} keeps name, role, place, and service on one official page (${e.url || 'the audited URL'}) so SearchGPT, Perplexity, Gemini, and Google AI Overviews can cite one complete sentence instead of a pronoun such as “this office”.`,
			},
			{
				id: 'rag-compare',
				title: 'Comparison unit',
				text: `${e.brand} ${e.person} structures ${e.focus} as a four-column comparison — type, recommended approach, what to verify, and cautions — for ${e.location || e.brand}. ${e.brand} does not invent competitor ranks. The table is the citable object for an AI summary on a ${topic} query.`,
			},
			{
				id: 'rag-safety',
				title: 'Safety filter',
				text: `${e.brand} ${e.person} states who ${e.focus} is not for, next to the official ${e.location || e.brand} contact facts. ${e.brand} writes the filter in full sentences without “we” or “here”, so an AI safety pass can quote the exclusion list with the same brand and role names.`,
			},
		];
	}
	return [
		{
			id: 'rag-entity',
			title: '개체 단위',
			text: `${e.brand} ${e.person}은 ${e.location || '공식 서비스 권역'}에서 ${e.focus}를 하나의 개체 단위로 공개합니다. 조직 ${e.brand}, 역할 ${e.personRole}, 서비스 ${e.focus}, 업종 ${e.industry}입니다. ${e.brand}는 이름·역할·지역·서비스를 공식 페이지(${e.url || '진단된 URL'})에 모아, SearchGPT·Perplexity·Gemini·Google AI Overviews가 "이곳" 같은 대명사 대신 완결 문장을 인용하게 합니다.`,
		},
		{
			id: 'rag-compare',
			title: '비교 단위',
			text: `${e.brand} ${e.person}은 ${e.location || e.brand}의 ${e.focus}를 유형 / 권장 방식 / 확인 기준 / 주의사항 4열 비교로 둡니다. ${e.brand}는 경쟁 순위를 만들지 않습니다. ${topic} 질의에서 AI 요약이 인용할 대상은 이 표입니다.`,
		},
		{
			id: 'rag-safety',
			title: '안전 필터',
			text: `${e.brand} ${e.person}은 ${e.focus}를 권장하지 않는 조건을 ${e.location || e.brand} 공식 연락 정보 옆에 적습니다. ${e.brand}는 "저희" "여기" 없이 브랜드와 역할을 반복해, AI 안전 검토가 같은 고유명사로 비추천 목록을 인용하게 합니다.`,
		},
	];
}
