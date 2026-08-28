/**
 * 마일스톤(회차별 박제) 저장소 키를 만드는 "유일한" 도메인 정규화 함수.
 *
 * 프로토콜(`http://` / `https://`), `www.`, 끝 슬래시 이하의 경로/쿼리/해시를 모두
 * 제거하고 소문자로 통일한 순수 도메인 문자열을 반환한다. 클라이언트(localStorage)와
 * 서버(Firestore)가 각자 다른 정규화 로직을 쓰면 같은 사이트인데도 다른 키로
 * 저장/조회되어 "박제한 데이터가 사라지는" 버그가 재발하므로, 두 쪽 모두 반드시
 * 이 함수 하나만 참조해야 한다 (`milestone-storage.ts` / `milestone-snapshots.ts`).
 */
export function normalizeDomain(input: string | null | undefined): string {
	if (!input) return '';
	const trimmed = input.trim().toLowerCase();
	if (!trimmed) return '';
	const withoutProtocol = trimmed.replace(/^https?:\/\//, '');
	const withoutWww = withoutProtocol.replace(/^www\./, '');
	// Cut everything from the first path/query/hash separator — hostname only.
	const hostOnly = withoutWww.split(/[/?#]/, 1)[0] ?? '';
	// Strip a stray trailing dot (fully-qualified domain names) and port suffix.
	return hostOnly.replace(/\.$/, '').replace(/:\d+$/, '');
}
