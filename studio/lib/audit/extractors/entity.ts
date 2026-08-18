/**
 * Footer / HTML / JSON-LD Person extractor for entity-disambiguation diagnostics.
 * Parses representative legal name + jobTitle so the UI can show both.
 */

export interface ExtractedRepresentative {
	name: string;
	jobTitle: string;
	isExtracted: boolean;
}

export type RepresentativeLang = 'ko' | 'en';

const MISSING_NAME: Record<RepresentativeLang, string> = {
	ko: '미검출 (수동 입력 필요)',
	en: 'Not detected (manual input required)',
};

/** Longest titles first so "대표이사 홍길동" does not capture "이사" as the name. */
const TITLE_ALTS =
	'대표공인중개사|대표변호사|대표세무사|대표이사|대표원장|대표자명|대표자|원장|C\\.E\\.O\\.?|CEO|대표';

const NAME_GROUP = '([가-힣]{2,4}|[A-Za-z][A-Za-z.\\s-]{1,28})';

const FOOTER_REP_RE = new RegExp(`(${TITLE_ALTS})\\s*[:：|]?\\s*${NAME_GROUP}`, 'i');

const TITLE_AS_NAME = /^(대표자명?|대표이사|대표원장|대표자|원장|이사|CEO|C\.E\.O\.?)$/i;

const NOISE_NAME = /^(상호|사업자|등록|번호|전화|주소|이메일|copyright|rights|reserved)$/i;

function compact(value: string | null | undefined): string {
	return String(value || '')
		.replace(/\s+/g, ' ')
		.trim();
}

function normalizeJobTitle(raw: string | null | undefined): string {
	const title = compact(raw).replace(/\.$/, '');
	if (!title) return '';
	if (/^c\.?e\.?o\.?$/i.test(title)) return 'CEO';
	if (title === '대표자명') return '대표자';
	return title;
}

function looksLikePersonName(raw: string | null | undefined): boolean {
	const name = compact(raw);
	if (!name) return false;
	if (TITLE_AS_NAME.test(name) || NOISE_NAME.test(name)) return false;
	if (/^[가-힣]{2,4}$/.test(name)) return true;
	if (/^[A-Za-z][A-Za-z.\s-]{1,28}$/.test(name) && name.replace(/[^A-Za-z]/g, '').length >= 2) {
		return true;
	}
	return false;
}

function inferJobTitle(htmlText: string, matchedTitle?: string): string {
	const fromMatch = normalizeJobTitle(matchedTitle);
	if (fromMatch) return fromMatch;
	if (/대표이사/.test(htmlText)) return '대표이사';
	if (/원장/.test(htmlText)) return '원장';
	return '대표';
}

function extractFromJsonLdPerson(htmlText: string): { name: string | null; jobTitle: string | null } {
	const windows: string[] = [];
	for (const match of htmlText.matchAll(/"@type"\s*:\s*"Person"/gi)) {
		const at = match.index ?? 0;
		windows.push(htmlText.slice(Math.max(0, at - 400), at + 800));
	}
	for (const chunk of windows) {
		const name = compact(chunk.match(/"name"\s*:\s*"([^"]{2,40})"/i)?.[1]);
		const jobTitle = compact(chunk.match(/"jobTitle"\s*:\s*"([^"]{1,40})"/i)?.[1]);
		if (looksLikePersonName(name)) {
			return { name, jobTitle: normalizeJobTitle(jobTitle) || null };
		}
	}
	return { name: null, jobTitle: null };
}

/**
 * Parse representative name + jobTitle from webpage HTML / footer / JSON-LD.
 * Examples: "대표 : 홍길동", "대표자: 홍길동", "대표이사 홍길동", "CEO John Doe"
 */
export function extractRepresentative(
	htmlText: string,
	lang: RepresentativeLang = 'ko',
): ExtractedRepresentative {
	const text = compact(htmlText);
	const jsonLd = extractFromJsonLdPerson(text);
	const match = text.match(FOOTER_REP_RE);
	const footerName = looksLikePersonName(match?.[2]) ? compact(match?.[2]) : null;
	const footerTitle = normalizeJobTitle(match?.[1]);

	const repName = jsonLd.name || footerName;
	const jobTitle = jsonLd.jobTitle || inferJobTitle(text, footerTitle);

	return {
		name: repName || MISSING_NAME[lang] || MISSING_NAME.ko,
		jobTitle,
		isExtracted: Boolean(repName),
	};
}

/** UI label: "홍길동 대표" — always shows name and jobTitle together. */
export function formatRepresentativeLabel(
	name: string | null | undefined,
	jobTitle: string | null | undefined,
	lang: RepresentativeLang = 'ko',
): string {
	const title = compact(jobTitle) || '대표';
	const person = compact(name) || MISSING_NAME[lang];
	return `${person} ${title}`;
}
