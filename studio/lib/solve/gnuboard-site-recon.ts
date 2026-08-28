/**
 * GnuBoard / YoungCart filesystem recon — extract real NAP from the live site tree.
 * Never invents dummy addresses, phones, coords, or representative names.
 */

import { extractGeoRepName, extractGeoTaxId, classifyGeoLink, dedupeSameAs } from '@/lib/solve/universal-geo-engine';
import { extractRepresentative, isNoiseRepresentativeName } from '@/lib/audit/extractors/entity';
import { extractNapFromCorpus } from '@/lib/audit/extractors/nap';
import {
	extractEntitySameAsLinks,
	extractOpeningHours,
	extractPostalCode,
} from '@/lib/audit/extractors/geo-aeo-site-data';
import { extractGeoFromMapScripts } from '@/lib/audit/extractors/schema-entity-pack';
import { extractStreetAddressFromText } from '@/lib/solve/core/entity-patterns';
import { bindTelephone, extractTelephoneFromText, formatKoreanTelephone } from '@/lib/solve/core/telephone';
import { inferKrPostalAddressFromIdentity } from '@/lib/solve/core/eeat-citation';
import { parseCfThemeFromConfig, analyzeGnuboardThemeUsage } from '@/lib/solve/source-mapping';
import { GNUBOARD_EXTEND_ENGINE_RELATIVE_PATH } from '@/lib/solve/adapters/gnuboard';

export const GNUBOARD_EXTEND_ENGINE_PATH = GNUBOARD_EXTEND_ENGINE_RELATIVE_PATH;

const LEGAL_NAME_RE =
	/(?:상호(?:명)?|법인명|사업자명|병원명|의원명)\s*[:：]\s*([가-힣A-Za-z0-9()（）·]{2,40})/u;
const CF_TITLE_RE = /\$config\s*\[\s*['"]cf_title['"]\s*\]\s*=\s*['"]([^'"]+)['"]/i;
const FAX_RE = /(?:FAX|Fax|팩스)\s*[:：]?\s*((?:0\d{1,2}|070)[-\s.]?\d{3,4}[-\s.]?\d{4})/i;
const CONSULT_TEL_RE =
	/(?:상담(?:전화|번호)|예약(?:전화|번호)|문의(?:전화|번호))\s*[:：]?\s*((?:02|0[3-6][1-5]|010|050[0-9]|070|080|15[0-9]{2}|16[0-9]{2}|18[0-9]{2})[-\s.]?[0-9]{3,4}[-\s.]?[0-9]{4})/i;
const MAIL_ORDER_RE = /(?:통신판매업|통신판매)\s*(?:신고)?(?:번호)?\s*[:：]?\s*([가-힣A-Za-z0-9\-]+)/i;
const JIBUN_RE = /((?:서울|경기|인천|부산|대구|광주|대전|울산|세종|강원|충북|충남|전북|전남|경북|경남|제주)[가-힣\d\s,·]+(?:동|가|읍|면|리)\s*\d[\d\-]*(?:번지)?(?:\s*[0-9호동층]+)?)/u;
const TRANSIT_RE =
	/(?:(?:지하철|버스|오시는\s*길|찾아오시는\s*길|교통편)[^\n]{8,220})/gi;
const FAQ_PAIR_RE = /(?:Q|질문)\s*[.).:]?\s*([^\n]{6,80})\s*(?:A|답변)\s*[.).:]?\s*([^\n]{8,200})/gi;
const HOWTO_OL_RE = /<li[^>]*>([\s\S]{8,160})<\/li>/gi;

export type GnuboardReconFaq = { q: string; a: string };
export type GnuboardReconHowTo = { position: number; name: string; text: string };

export type GnuboardSiteRecon = {
	themeName: string | null;
	themeActive: boolean;
	headSubPath: string;
	enginePath: string;
	legalName: string;
	brandName: string;
	representativeName: string;
	representativeTitle: string;
	streetAddress: string;
	jibunAddress: string;
	addressDetail: string;
	postalCode: string;
	addressLocality: string;
	addressRegion: string;
	telephone: string;
	consultTelephone: string;
	fax: string;
	taxId: string;
	mailOrderNumber: string;
	openingHoursOpens: string;
	openingHoursCloses: string;
	hoursDetected: boolean;
	medicalSpecialty: string[];
	services: string[];
	transitText: string;
	sameAs: string[];
	latitude: string;
	longitude: string;
	faqItems: GnuboardReconFaq[];
	howtoSteps: GnuboardReconHowTo[];
	sources: string[];
	corpus: string;
};

function normalizeRel(path: string): string {
	return String(path || '')
		.replace(/\\/g, '/')
		.replace(/^\/+/, '');
}

function compact(value: string | null | undefined): string {
	return String(value || '')
		.replace(/\s+/g, ' ')
		.trim();
}

function plainFromPhp(source: string): string {
	return compact(
		String(source || '')
			.replace(/<\?(?:php)?[\s\S]*?\?>/gi, ' ')
			.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
			.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
			.replace(/<[^>]+>/g, ' '),
	);
}

function findRootFile(paths: string[], name: string): string | null {
	const lower = name.toLowerCase();
	return paths.find((p) => p.toLowerCase() === lower) || null;
}

function findThemeFile(paths: string[], themeName: string, name: string): string | null {
	const needle = `theme/${themeName}/${name}`.toLowerCase();
	return paths.find((p) => p.toLowerCase() === needle) || null;
}

/** Paths that carry NAP / theme / location copy — never guessed from ghost folders. */
export function isGnuboardReconPath(relativePath: string): boolean {
	const p = normalizeRel(relativePath).toLowerCase();
	if (p === 'config.php' || p === 'common.php') return true;
	if (p === 'head.sub.php' || p === 'head.php' || p === 'tail.php' || p === 'tail.sub.php') return true;
	if (/(^|\/)data\/content\//i.test(p)) return true;
	if (/(^|\/)bbs\/content\.php$/i.test(p)) return true;
	if (/(^|\/)theme\/[^/]+\/(head|head\.sub|tail|tail\.sub)\.php$/i.test(p)) return true;
	if (/(^|\/)theme\/[^/]+\/(sub|page|skin|contents)\/[^/]+\.(php|html|htm)$/i.test(p)) return true;
	if (/(오시는|찾아오시는|contact|location|intro|about|greeting|인사말|병원소개)/i.test(p)) return true;
	return false;
}

export function pickGnuboardReconPaths(relativePaths: string[], limit = 48): string[] {
	const paths = relativePaths.map(normalizeRel);
	const scored = paths.map((p) => {
		let s = 0;
		const lower = p.toLowerCase();
		if (lower === 'config.php') s = 200;
		else if (lower === 'tail.php' || lower === 'tail.sub.php') s = 180;
		else if (/^theme\/[^/]+\/tail(\.sub)?\.php$/i.test(p)) s = 170;
		else if (lower === 'head.sub.php' || lower === 'head.php') s = 140;
		else if (/^theme\/[^/]+\/head(\.sub)?\.php$/i.test(p)) s = 130;
		else if (/data\/content\//i.test(p)) s = 120;
		else if (isGnuboardReconPath(p)) s = 90;
		return { p, s };
	});
	return scored
		.filter((x) => x.s > 0)
		.sort((a, b) => b.s - a.s || a.p.length - b.p.length)
		.slice(0, limit)
		.map((x) => x.p);
}

export function resolveGnuboardHeadSubPath(opts: {
	relativePaths: string[];
	themeName: string | null;
}): string {
	const paths = opts.relativePaths.map(normalizeRel);
	const theme = compact(opts.themeName || '');
	if (theme) {
		const headSub = findThemeFile(paths, theme, 'head.sub.php');
		if (headSub) return headSub;
		const headPhp = findThemeFile(paths, theme, 'head.php');
		if (headPhp) return headPhp;
	}
	return findRootFile(paths, 'head.sub.php') || findRootFile(paths, 'head.php') || 'head.sub.php';
}

function contentOf(contents: Record<string, string>, path: string | null): string {
	if (!path) return '';
	return contents[path] || contents[normalizeRel(path)] || '';
}

function extractLegalName(corpus: string, configSource: string): string {
	const labeled = corpus.match(LEGAL_NAME_RE)?.[1];
	if (labeled && !/copyright|rights|reserved/i.test(labeled)) return compact(labeled);
	const title = configSource.match(CF_TITLE_RE)?.[1];
	return compact(title || '');
}

function extractFax(corpus: string): string {
	const hit = corpus.match(FAX_RE)?.[1] || '';
	return bindTelephone(hit);
}

function extractConsultTel(corpus: string): string {
	const hit = corpus.match(CONSULT_TEL_RE)?.[1] || '';
	return bindTelephone(hit);
}

function extractJibun(corpus: string): string {
	const hit = corpus.match(JIBUN_RE)?.[1] || '';
	return compact(hit);
}

function extractTransit(corpus: string): string {
	const hits: string[] = [];
	const re = new RegExp(TRANSIT_RE.source, TRANSIT_RE.flags);
	let m: RegExpExecArray | null;
	while ((m = re.exec(corpus))) {
		const text = compact(m[0]);
		if (text.length >= 10 && !hits.includes(text)) hits.push(text);
		if (hits.length >= 3) break;
	}
	return hits.join(' ');
}

function extractFaqFromCorpus(corpus: string): GnuboardReconFaq[] {
	const out: GnuboardReconFaq[] = [];
	const seen = new Set<string>();
	const re = new RegExp(FAQ_PAIR_RE.source, FAQ_PAIR_RE.flags);
	let m: RegExpExecArray | null;
	while ((m = re.exec(corpus))) {
		const q = compact(m[1]);
		const a = compact(m[2]);
		if (q.length < 4 || a.length < 4) continue;
		const key = q.slice(0, 60);
		if (seen.has(key)) continue;
		seen.add(key);
		out.push({ q, a });
		if (out.length >= 6) break;
	}
	return out;
}

function extractHowToFromHtml(html: string): GnuboardReconHowTo[] {
	if (!/(예약|내원|방문|접수|절차|step)/i.test(html)) return [];
	const steps: GnuboardReconHowTo[] = [];
	const re = new RegExp(HOWTO_OL_RE.source, HOWTO_OL_RE.flags);
	let m: RegExpExecArray | null;
	while ((m = re.exec(html))) {
		const text = compact(m[1].replace(/<[^>]+>/g, ' '));
		if (text.length < 6 || text.length > 160) continue;
		steps.push({
			position: steps.length + 1,
			name: text.slice(0, 40),
			text,
		});
		if (steps.length >= 4) break;
	}
	return steps;
}

function extractSpecialties(corpus: string): string[] {
	const map: Array<{ test: RegExp; id: string }> = [
		{ test: /내과/, id: '내과' },
		{ test: /외과/, id: '외과' },
		{ test: /치과|임플란트/, id: '치과' },
		{ test: /피부/, id: '피부과' },
		{ test: /정형/, id: '정형외과' },
		{ test: /재활|도수/, id: '재활의학' },
		{ test: /소아|아동/, id: '소아과' },
		{ test: /산부|산과/, id: '산부인과' },
		{ test: /한의|추나/, id: '한방' },
		{ test: /동물|수의|펫/, id: '수의진료' },
		{ test: /암|종양|중입자|양성자/, id: '종양치료' },
	];
	const out: string[] = [];
	for (const row of map) {
		if (row.test.test(corpus) && !out.includes(row.id)) out.push(row.id);
	}
	return out;
}

/**
 * Deep-recon a local GnuBoard / YoungCart tree.
 * Only values that appear in the supplied files are returned — empty string otherwise.
 */
export function reconGnuboardSite(opts: {
	relativePaths: string[];
	fileContents: Record<string, string>;
	urlPaths?: string[];
}): GnuboardSiteRecon {
	const paths = (opts.relativePaths || []).map(normalizeRel);
	const contents: Record<string, string> = {};
	for (const [key, value] of Object.entries(opts.fileContents || {})) {
		contents[normalizeRel(key)] = String(value || '');
	}

	const themeUsage = analyzeGnuboardThemeUsage({
		relativePaths: paths,
		fileContents: contents,
		urlPaths: opts.urlPaths,
	});
	const configPath = findRootFile(paths, 'config.php');
	const configSource = contentOf(contents, configPath);
	const themeName = themeUsage.themeName || parseCfThemeFromConfig(configSource);
	const headSubPath = resolveGnuboardHeadSubPath({ relativePaths: paths, themeName });

	const sourcePaths = pickGnuboardReconPaths(paths);
	const htmlBlob = sourcePaths.map((p) => contentOf(contents, p)).filter(Boolean).join('\n');
	const corpus = compact(
		sourcePaths
			.map((p) => plainFromPhp(contentOf(contents, p)))
			.filter(Boolean)
			.join(' '),
	);

	const nap = extractNapFromCorpus(corpus);
	const street = extractStreetAddressFromText(corpus) || compact(nap.streetAddress) || '';
	const inferred = street
		? inferKrPostalAddressFromIdentity({
				streetAddress: street,
				corpus,
			})
		: { streetAddress: '', addressLocality: '', addressRegion: '', addressCountry: 'KR' as const };

	const hours = extractOpeningHours(corpus);
	const geo = extractGeoFromMapScripts(htmlBlob);
	const tel = bindTelephone(nap.telephone || extractTelephoneFromText(corpus) || '');
	const consult = extractConsultTel(corpus);
	const repFromFooter = extractGeoRepName(corpus);
	const rep = extractRepresentative(corpus);
	const representativeName = !isNoiseRepresentativeName(repFromFooter)
		? compact(repFromFooter)
		: rep.isExtracted && !isNoiseRepresentativeName(rep.name)
			? compact(rep.name)
			: '';
	const representativeTitle = compact(
		rep.isExtracted ? rep.jobTitle : representativeName ? '대표' : '',
	);

	const brandName = compact(configSource.match(CF_TITLE_RE)?.[1] || '');
	const legalName = extractLegalName(corpus, configSource) || brandName;
	const sameAs = dedupeSameAs([
		...extractEntitySameAsLinks(htmlBlob),
		...((htmlBlob.match(/https?:\/\/[^\s"'<>]+/gi) || [])
			.map((href) => (classifyGeoLink(href) ? href : ''))
			.filter(Boolean) as string[]),
	]);

	const faqItems = extractFaqFromCorpus(corpus);
	const howtoSteps = extractHowToFromHtml(htmlBlob);
	const services = extractSpecialties(corpus).slice(0, 8);

	return {
		themeName,
		themeActive: Boolean(themeName),
		headSubPath,
		enginePath: GNUBOARD_EXTEND_ENGINE_PATH,
		legalName,
		brandName,
		representativeName,
		representativeTitle,
		streetAddress: street,
		jibunAddress: extractJibun(corpus),
		addressDetail: '',
		postalCode: extractPostalCode(corpus) || '',
		addressLocality: street ? inferred.addressLocality : '',
		addressRegion: street ? inferred.addressRegion : '',
		telephone: tel || formatKoreanTelephone(nap.telephone) || '',
		consultTelephone: consult && consult !== tel ? consult : '',
		fax: extractFax(corpus),
		taxId: extractGeoTaxId(corpus),
		mailOrderNumber: compact(corpus.match(MAIL_ORDER_RE)?.[1] || ''),
		openingHoursOpens: hours.detected ? hours.opens : '',
		openingHoursCloses: hours.detected ? hours.closes : '',
		hoursDetected: hours.detected,
		medicalSpecialty: extractSpecialties(corpus),
		services,
		transitText: extractTransit(corpus),
		sameAs,
		latitude: geo ? String(geo.latitude) : '',
		longitude: geo ? String(geo.longitude) : '',
		faqItems,
		howtoSteps,
		sources: sourcePaths.filter((p) => contentOf(contents, p)),
		corpus,
	};
}

export function summarizeGnuboardRecon(recon: GnuboardSiteRecon): string[] {
	const lines: string[] = [];
	lines.push(
		recon.themeActive
			? `활성 테마: theme/${recon.themeName}/ → head 타겟 ${recon.headSubPath}`
			: `테마 미사용(cf_theme 비어있음) → head 타겟 ${recon.headSubPath}`,
	);
	lines.push(`엔진 경로: /${recon.enginePath}`);
	if (recon.legalName) lines.push(`상호: ${recon.legalName}`);
	if (recon.representativeName) {
		lines.push(`대표자: ${recon.representativeName}${recon.representativeTitle ? ` (${recon.representativeTitle})` : ''}`);
	}
	if (recon.streetAddress) lines.push(`주소: ${recon.streetAddress}`);
	if (recon.telephone) lines.push(`전화: ${recon.telephone}`);
	if (recon.fax) lines.push(`팩스: ${recon.fax}`);
	if (recon.taxId) lines.push(`사업자번호: ${recon.taxId}`);
	if (recon.hoursDetected) lines.push(`영업시간: ${recon.openingHoursOpens}–${recon.openingHoursCloses}`);
	if (recon.transitText) lines.push(`오시는 길: ${recon.transitText.slice(0, 80)}`);
	if (!recon.streetAddress && !recon.telephone && !recon.legalName) {
		lines.push('NAP 미검출 — 푸터/소개 페이지에 기재된 실데이터만 사용합니다 (더미 주소 생성 안 함)');
	}
	return lines;
}
