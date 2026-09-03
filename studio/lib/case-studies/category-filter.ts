/**
 * 도입사례 상단 필터 — 카드 뱃지(진단 카테고리 전문)와 분리된 표준 대분류 탭.
 * 예: 뱃지 "의료 / 피부시술" → 탭 "의료 / 병원·클리닉" (대분류 '의료' 매칭).
 */

export const CASE_STUDY_FILTER_TABS = [
	{ id: 'all', label: '전체', keys: [] as readonly string[] },
	{ id: 'medical', label: '의료 / 병원·클리닉', keys: ['의료', '병원', '클리닉', '피부', 'medical', 'derma'] },
	{ id: 'lodging', label: '숙박 / 한옥·스테이', keys: ['숙박', '한옥', '스테이', '호텔', 'lodging'] },
	{ id: 'legal', label: '법률 / 법무법인', keys: ['법률', '법무', '로펌', 'legal'] },
	{ id: 'commerce', label: '이커머스 / 쇼핑몰', keys: ['이커머스', '쇼핑몰', '커머스', 'ecommerce', 'commerce'] },
	{ id: 'education', label: '교육 / 학원', keys: ['교육', '학원', 'education'] },
] as const;

export type CaseStudyFilterTabId = (typeof CASE_STUDY_FILTER_TABS)[number]['id'];

function compact(value: string): string {
	return value.replace(/\s+/g, '').toLowerCase();
}

/** Leading major-class token: "의료 / 피부시술" → "의료", "medical/derma" → "medical". */
export function categoryMajorHead(category: string): string {
	const raw = (category || '').trim();
	if (!raw) return '';
	return raw.split(/[/／|·,]/)[0]?.trim() || raw;
}

export function matchesCaseStudyFilter(category: string, tabId: string): boolean {
	if (!tabId || tabId === 'all') return true;
	const tab = CASE_STUDY_FILTER_TABS.find((item) => item.id === tabId);
	if (!tab || tab.id === 'all') return true;

	const hay = compact(category);
	const head = compact(categoryMajorHead(category));
	if (!hay) return false;
	return tab.keys.some((key) => {
		const needle = compact(key);
		if (!needle) return false;
		return hay.includes(needle) || (Boolean(head) && (head.includes(needle) || needle.includes(head)));
	});
}
