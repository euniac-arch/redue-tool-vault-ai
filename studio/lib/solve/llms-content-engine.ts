/**
 * Official /llms.txt + /llms-full.txt refinement engine.
 * Shared by Solve deploy (static upload) and the GnuBoard PHP runtime twin.
 * Never stringifies Object/Array/Class, never invents FAQ, never uses GNB chrome as a page title.
 */

import { extractStreetAddressFromText, extractTelephoneFromText } from '@/lib/solve/core/entity-patterns';
import { isUiStopword } from '@/lib/geo/clean-medical-entities';

export const LLMS_FILE_TITLE_MAP: Record<string, string> = {
	s101: '병원소개',
	'101': '병원소개',
	intro: '병원소개',
	about: '병원소개',
	company: '회사소개',
	s102: '의료진',
	'102': '의료진',
	staff: '의료진',
	doctor: '의료진',
	s103: '오시는길',
	'103': '오시는길',
	location: '오시는길',
	map: '오시는길',
	contact: '오시는길',
	s104: '둘러보기',
	'104': '둘러보기',
	tour: '둘러보기',
	facility: '시설안내',
	s201: '눈성형',
	'201': '눈성형',
	s202: '코성형',
	'202': '코성형',
	s203: '가슴성형',
	'203': '가슴성형',
	s204: '안면윤곽',
	'204': '안면윤곽',
	s301: '피부시술',
	'301': '피부시술',
};

const INFO_MENU_RE =
	/병원소개|의원소개|클리닉소개|회사소개|연구소소개|센터소개|장비소개|시설소개|시설안내|둘러보기|인사말|원장인사|연혁|조직도|층별안내|오시는\s*길|찾아오시는|찾아오는\s*길|진료시간|운영시간|비급여|공지사항|갤러리|커뮤니티|이용약관|개인정보|로그인|회원가입|상담문의|온라인\s*예약|의료진|원장소개|about|contact|location|directions|tour|greeting|privacy|sitemap/i;

const SERVICE_HINT_RE =
	/성형|시술|수술|진료|치료|클리닉|임플란트|교정|보톡스|필러|리프팅|피부|내과|외과|소아|산부|정형|재활|도수|통증|암|중입자|줄기세포|검진|케어|프로그램|상품|제품|서비스|상담(?!문의)/i;

const CHROME_TITLE_RE =
	/본점|지점|로고|logo|home|메인|홈으로|전체메뉴|닫기|열기|검색|zoom/i;

const UI_NOISE_RE =
	/로그인|로그아웃|회원가입|회원정보|비밀번호\s*찾기|글쓰기|비회원|아이디\s*찾기|Zoom|\+\s*-|게시판\s*검색|글쓴이|조회\s*\d*|날짜|Total\s*\d+\s*건|\d+\s*페이지|페이지\s*\d+|문의하기|진료시간|오시는길|찾아오시는\s*길|상담예약|온라인예약|더보기|바로가기|맨위로|TOP/gi;

const SERIALIZED_JUNK_RE =
	/^(Array|Object|stdClass)\b|^Class\s*\(|\[object Object\]|^\{["'@]|PostalAddress|__PHP_Incomplete_Class/i;

export type LlmsMenuItem = {
	name: string;
	url: string;
	description?: string;
	h2?: string;
	fileStem?: string;
};

export type LlmsFaqItem = {
	question: string;
	answer: string;
};

export type LlmsOfficialSnapshot = {
	siteName: string;
	origin: string;
	industry?: string;
	representativeName?: string;
	telephone?: string;
	address?: string;
	openingHours?: string;
	intro?: string;
	menus?: LlmsMenuItem[];
	faqs?: LlmsFaqItem[];
};

function compact(value: string): string {
	return value.replace(/\s+/gu, ' ').trim();
}

function decodeEntities(value: string): string {
	return value
		.replace(/&nbsp;/gi, ' ')
		.replace(/&amp;/gi, '&')
		.replace(/&lt;/gi, '<')
		.replace(/&gt;/gi, '>')
		.replace(/&quot;/gi, '"')
		.replace(/&#39;/gi, "'")
		.replace(/&#(\d+);/g, (_, n) => {
			const code = Number(n);
			return Number.isFinite(code) ? String.fromCharCode(code) : '';
		});
}

/** Reject Object/Array/Class dumps. Only a real plain string may pass. */
export function toLlmsPlainString(value: unknown): string {
	if (typeof value !== 'string') return '';
	let text = decodeEntities(value).replace(/<[^>]+>/g, ' ');
	text = compact(text);
	if (!text) return '';
	if (SERIALIZED_JUNK_RE.test(text)) return '';
	if (/^Array\s*\(/i.test(text) || /^Object\s*\(/i.test(text)) return '';
	return text;
}

export function extractKoreanStreetAddress(value: unknown): string {
	const text = toLlmsPlainString(value);
	if (!text) return '';
	return toLlmsPlainString(extractStreetAddressFromText(text));
}

export function extractLlmsTelephone(value: unknown): string {
	const text = toLlmsPlainString(value);
	if (!text) return '';
	return toLlmsPlainString(extractTelephoneFromText(text));
}

export function isLlmsChromeTitle(title: unknown, siteName?: string): boolean {
	const name = toLlmsPlainString(title);
	if (!name) return true;
	const brand = toLlmsPlainString(siteName);
	const folded = name.replace(/\s+/g, '').toLowerCase();
	const brandFolded = brand.replace(/\s+/g, '').toLowerCase();
	if (brandFolded && (folded === brandFolded || folded === `${brandFolded}본점`)) return true;
	if (CHROME_TITLE_RE.test(name) && (!SERVICE_HINT_RE.test(name) || folded === brandFolded)) {
		if (folded === brandFolded || /본점|로고|logo|home|메인/.test(name)) return true;
	}
	if (/본점$/.test(name) && brandFolded && folded.startsWith(brandFolded)) return true;
	return false;
}

export function titleFromLlmsFileStem(stem: unknown): string {
	const raw = toLlmsPlainString(stem)
		.replace(/\.(php|html?|htm|phtml)$/i, '')
		.toLowerCase();
	if (!raw) return '';
	return LLMS_FILE_TITLE_MAP[raw] || '';
}

export function stripSiteNameFromTitle(title: unknown, siteName?: string): string {
	let name = toLlmsPlainString(title);
	const brand = toLlmsPlainString(siteName);
	if (!name) return '';
	if (brand) {
		name = name
			.replace(new RegExp(`\\s*[|\\-–—:>]\\s*${escapeRegExp(brand)}\\s*$`, 'u'), '')
			.replace(new RegExp(`^${escapeRegExp(brand)}\\s*[|\\-–—:>]\\s*`, 'u'), '')
			.replace(new RegExp(escapeRegExp(brand), 'u'), ' ');
	}
	return compact(name);
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Page title priority:
 * 1) g5_menu me_name matching the link
 * 2) in-body h2 / h3 / .sub_title
 * 3) $g5_head_title minus $config['cf_title']
 * 4) filename map (s101 → 병원소개)
 */
export function resolveLlmsPageTitle(input: {
	menuName?: unknown;
	heading?: unknown;
	headTitle?: unknown;
	fileStem?: unknown;
	siteName?: string;
}): string {
	const site = toLlmsPlainString(input.siteName);
	const candidates = [
		toLlmsPlainString(input.menuName),
		toLlmsPlainString(input.heading),
		stripSiteNameFromTitle(input.headTitle, site),
		titleFromLlmsFileStem(input.fileStem),
	];
	for (const candidate of candidates) {
		if (!candidate || isLlmsChromeTitle(candidate, site)) continue;
		if (site && candidate.replace(/\s+/g, '') === site.replace(/\s+/g, '')) continue;
		return candidate;
	}
	return '';
}

export function cleanLlmsBodyText(value: unknown, extraStopwords: string[] = []): string {
	let text = toLlmsPlainString(value);
	if (!text) return '';
	text = text.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ');
	text = text.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ');
	text = decodeEntities(text.replace(/<[^>]+>/g, ' '));
	text = text.replace(UI_NOISE_RE, ' ');
	for (const stop of extraStopwords) {
		const plain = toLlmsPlainString(stop);
		if (plain.length >= 2) text = text.split(plain).join(' ');
	}
	text = compact(text.replace(/[+]{1,2}|[-]{1,2}(?=\s|$)/g, ' '));
	if (!text) return '';
	const sentences = text
		.split(/(?<=[.!?다요음니다])\s+/u)
		.map((part) => compact(part))
		.filter((part) => part.length >= 8 && !/^(home|메인|메뉴)$/i.test(part));
	const picked = (sentences.length ? sentences.slice(0, 2) : [text]).join(' ');
	return compact(picked).slice(0, 280);
}

export function isLlmsInfoMenu(name: unknown): boolean {
	const label = toLlmsPlainString(name);
	if (!label) return false;
	if (INFO_MENU_RE.test(label)) return true;
	return isUiStopword(label);
}

export function isLlmsServiceMenu(name: unknown): boolean {
	const label = toLlmsPlainString(name);
	if (!label || isLlmsInfoMenu(label)) return false;
	if (SERVICE_HINT_RE.test(label)) return true;
	return label.length >= 2 && label.length <= 24 && !/메뉴|게시판|검색/.test(label);
}

export function classifyLlmsMenuItems(items: LlmsMenuItem[], siteName?: string): {
	services: LlmsMenuItem[];
	info: LlmsMenuItem[];
} {
	const services: LlmsMenuItem[] = [];
	const info: LlmsMenuItem[] = [];
	const seen = new Set<string>();
	for (const item of items || []) {
		const name = resolveLlmsPageTitle({
			menuName: item.name,
			heading: item.h2,
			fileStem: item.fileStem || stemFromUrl(item.url),
			siteName,
		});
		if (!name) continue;
		const key = name.replace(/\s+/g, '').toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		const row = { ...item, name };
		if (isLlmsInfoMenu(name)) info.push(row);
		else if (isLlmsServiceMenu(name)) services.push(row);
		else info.push(row);
	}
	return { services, info };
}

export function realLlmsFaqs(faqs: LlmsFaqItem[] | undefined): LlmsFaqItem[] {
	const out: LlmsFaqItem[] = [];
	const seen = new Set<string>();
	for (const faq of faqs || []) {
		const question = toLlmsPlainString(faq.question);
		const answer = toLlmsPlainString(faq.answer);
		if (!question || !answer) continue;
		if (/어디서 받나요|실비보험|가상|템플릿/.test(question)) continue;
		if (question.length < 6 || answer.length < 8) continue;
		const key = question.replace(/\s+/g, '').toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		out.push({ question, answer });
		if (out.length >= 8) break;
	}
	return out;
}

function stemFromUrl(url: string): string {
	const path = String(url || '')
		.split('#')[0]
		.split('?')[0]
		.replace(/\\/g, '/');
	const base = path.split('/').pop() || '';
	return base.replace(/\.(php|html?|htm|phtml)$/i, '');
}

function absoluteUrl(url: string, origin: string): string {
	const href = toLlmsPlainString(url);
	const root = toLlmsPlainString(origin).replace(/\/+$/, '');
	if (/^https?:\/\//i.test(href)) return href;
	if (!href || href === '/') return `${root}/`;
	return `${root}/${href.replace(/^\/+/, '')}`;
}

function industryLabel(value: unknown): string {
	const raw = toLlmsPlainString(value);
	if (!raw) return '';
	if (/MedicalClinic|Physician|Hospital|병의원|병원|의원|클리닉/i.test(raw)) return '병의원';
	if (/Veterinary|동물병원/i.test(raw)) return '동물병원';
	if (/Dentist|치과/i.test(raw)) return '치과';
	if (/OnlineStore|Store|쇼핑몰|영카트/i.test(raw)) return '쇼핑몰';
	if (/LegalService|법률|법무/i.test(raw)) return '법률';
	if (/Educational|학원|교육/i.test(raw)) return '교육';
	if (/Accounting|세무|회계/i.test(raw)) return '세무·회계';
	return raw;
}

export function buildOfficialLlmsTxt(input: LlmsOfficialSnapshot): string {
	const site = toLlmsPlainString(input.siteName) || '웹사이트';
	const origin = toLlmsPlainString(input.origin).replace(/\/+$/, '') || '';
	const address = extractKoreanStreetAddress(input.address) || toLlmsPlainString(input.address);
	const telephone = extractLlmsTelephone(input.telephone) || toLlmsPlainString(input.telephone);
	const representative = toLlmsPlainString(input.representativeName);
	const hours = toLlmsPlainString(input.openingHours);
	const industry = industryLabel(input.industry);
	const { services, info } = classifyLlmsMenuItems(input.menus || [], site);
	const intro =
		cleanLlmsBodyText(input.intro, services.concat(info).map((item) => item.name)) ||
		`${site} 공식 웹사이트입니다.`;
	const serviceLines = services.slice(0, 8).map((item) => `- ${item.name}`);
	const linkItems = [...info, ...services].slice(0, 16);
	const linkLines = linkItems.map((item) => `- [${item.name}](${absoluteUrl(item.url, origin)})`);
	const faqs = realLlmsFaqs(input.faqs);

	const lines = [
		`# ${site}`,
		'',
		intro,
		'',
		'## 핵심 정보',
		'',
		industry ? `- 업종: ${industry}` : '',
		representative ? `- 대표자: ${representative}` : '',
		telephone ? `- 연락처: ${telephone}` : '',
		address ? `- 주소: ${address}` : '',
		hours ? `- 운영시간: ${hours}` : '',
		origin ? `- 공식 도메인: ${origin}` : '',
		'',
		serviceLines.length ? '## 주요 서비스 및 진료과목' : '',
		serviceLines.length ? '' : '',
		...serviceLines,
		serviceLines.length ? '' : '',
		linkLines.length ? '## 주요 안내 링크' : '',
		linkLines.length ? '' : '',
		...linkLines,
	];

	if (faqs.length) {
		lines.push('', '## FAQ', '');
		for (const faq of faqs) {
			lines.push(`### ${faq.question}`, '', faq.answer, '');
		}
	}

	return `${lines.filter((line, idx, all) => !(line === '' && all[idx - 1] === '')).join('\n').replace(/\n{3,}/g, '\n\n').trim()}\n`;
}

export function buildOfficialLlmsFullTxt(input: LlmsOfficialSnapshot): string {
	const site = toLlmsPlainString(input.siteName) || '웹사이트';
	const origin = toLlmsPlainString(input.origin).replace(/\/+$/, '') || '';
	const address = extractKoreanStreetAddress(input.address) || toLlmsPlainString(input.address);
	const telephone = extractLlmsTelephone(input.telephone) || toLlmsPlainString(input.telephone);
	const representative = toLlmsPlainString(input.representativeName);
	const hours = toLlmsPlainString(input.openingHours);
	const industry = industryLabel(input.industry);
	const { services, info } = classifyLlmsMenuItems(input.menus || [], site);
	const intro =
		cleanLlmsBodyText(input.intro, services.concat(info).map((item) => item.name)) ||
		`${site} 공식 웹사이트 엔티티 개요입니다.`;
	const detailPages = [...services, ...info];
	const detailBlocks = detailPages.map((item) => {
		const desc =
			cleanLlmsBodyText(item.description, [item.name, site]) ||
			`${site} ${item.name} 안내 페이지입니다.`;
		return `### ${item.name}\n\n${desc}\n\n- URL: ${absoluteUrl(item.url, origin)}`;
	});
	const navLines = (input.menus || [])
		.map((item) => {
			const name = resolveLlmsPageTitle({
				menuName: item.name,
				heading: item.h2,
				fileStem: item.fileStem || stemFromUrl(item.url),
				siteName: site,
			});
			if (!name) return '';
			return `- [${name}](${absoluteUrl(item.url, origin)})`;
		})
		.filter(Boolean);
	const faqs = realLlmsFaqs(input.faqs);

	const lines = [
		`# ${site} — 심층 인용 전문 (llms-full)`,
		'',
		'## 상세 소개 및 엔티티 개요',
		'',
		intro,
		industry ? `\n업종: ${industry}` : '',
		'',
		'## 운영 정보',
		'',
		representative ? `- 대표자: ${representative}` : '',
		telephone ? `- 연락처: ${telephone}` : '',
		address ? `- 주소: ${address}` : '',
		hours ? `- 운영시간: ${hours}` : '',
		origin ? `- 공식 도메인: ${origin}` : '',
		'',
		'## 서비스 및 안내 상세',
		'',
		detailBlocks.length ? detailBlocks.join('\n\n') : `${site}의 상세 안내는 공식 홈페이지를 확인해 주세요.`,
		'',
		navLines.length ? '## 사이트 전체 메뉴 구조' : '',
		navLines.length ? '' : '',
		...navLines,
		navLines.length ? '' : '',
	];

	if (faqs.length) {
		lines.push('## FAQ', '', ...faqs.flatMap((faq) => [`### ${faq.question}`, '', faq.answer, '']));
	}

	if (origin) {
		lines.push(
			'## 관련 표준 파일',
			'',
			`- ${origin}/llms.txt`,
			`- ${origin}/llms-full.txt`,
			`- ${origin}/sitemap.xml`,
			`- ${origin}/robots.txt`,
		);
	}

	return `${lines.filter((line, idx, all) => !(line === '' && all[idx - 1] === '')).join('\n').replace(/\n{3,}/g, '\n\n').trim()}\n`;
}
