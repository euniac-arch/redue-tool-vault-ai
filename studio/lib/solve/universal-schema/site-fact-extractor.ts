/**
 * SiteFactExtractor — crawl/parse only what is actually on the site.
 * Never invents NAP, Person, FAQ, video, geo, or taxID placeholders.
 */

import { load } from 'cheerio';
import { extractFaqItemsFromHtml } from '@/lib/audit/extractors/faq-howto';
import { extractNapFromCorpus } from '@/lib/audit/extractors/nap';
import { extractRepresentative } from '@/lib/audit/extractors/entity';
import { filterOfficialSameAs } from '@/lib/audit/extractors/schema-entity-pack';
import { detectCmsType } from '@/lib/solve/adapters/detect-cms';
import { classifyIndustrySchema } from '@/lib/solve/core/industry-schema';
import {
	isDummyPhoneNumber,
	isDummyTaxId,
	isValidGroundTruthRepName,
	normalizeGroundTruthPhone,
	normalizeGroundTruthTaxId,
} from '@/lib/solve/core/strict-schema-graph';
import { extractOrgContactFromFooter } from '@/lib/solve/dynamic-php-schema';
import { GEO_FAX_RE, GEO_TAX_ID_RE } from '@/lib/solve/universal-geo-engine';
import { WP_FOOTER_FAX_RE, WP_FOOTER_TAX_ID_RE } from '@/lib/solve/wp-schema-engine';
import type {
	DetectedSiteCms,
	ExtractedSiteFacts,
	SiteFactExtractorInput,
	SiteFactMedicalAbout,
	SiteFactPage,
	SiteFactQa,
	SiteFactSourcePage,
	SiteFactVideo,
} from '@/lib/solve/universal-schema/types';

const YOUTUBE_ID_RE = /(?:youtube\.com\/(?:embed\/|watch\?v=|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/i;
const MEDICAL_HEADING_RE = /(시술|치료|수술|요법|장비|기기|레이저|초음파|CT|MRI|임플란트|교정)/;
const INVENTED_SITE_NAMES = ['사이트', '본원', '본 기관', '웹사이트', '상호명'];

function compact(value: string | null | undefined): string {
	return String(value || '')
		.replace(/\s+/g, ' ')
		.trim();
}

function originOf(raw: string): string {
	const value = compact(raw);
	try {
		return new URL(value).origin.replace(/\/+$/, '');
	} catch {
		return value.replace(/\/+$/, '');
	}
}

function normalizePath(raw: string): string {
	const value = compact(raw).split('#')[0].split('?')[0].replace(/\\/g, '/');
	if (!value || value === '/') return '/';
	return value.startsWith('/') ? value : `/${value}`;
}

function isUsableSiteName(value: string | null | undefined): string {
	const name = compact(value);
	if (!name || name.length < 2) return '';
	if ((INVENTED_SITE_NAMES as readonly string[]).includes(name)) return '';
	return name;
}

function labeledTaxId(corpus: string): { taxId: string; labeled: boolean } {
	const labeled =
		corpus.match(WP_FOOTER_TAX_ID_RE)?.[1] ||
		corpus.match(GEO_TAX_ID_RE)?.[1] ||
		'';
	const taxId = normalizeGroundTruthTaxId(labeled, { labeled: Boolean(labeled) });
	if (taxId) return { taxId, labeled: true };
	return { taxId: '', labeled: false };
}

function labeledFax(corpus: string): string {
	const hit = corpus.match(WP_FOOTER_FAX_RE)?.[1] || corpus.match(GEO_FAX_RE)?.[1] || '';
	return normalizeGroundTruthPhone(hit);
}

function extractSameAs(html: string, origin: string): string[] {
	const $ = load(html || '');
	const urls: string[] = [];
	$('a[href]').each((_, el) => {
		const href = compact($(el).attr('href'));
		if (href) urls.push(href);
	});
	const rawMatches = html.match(/https?:\/\/[^\s"'<>]+/gi) || [];
	urls.push(...rawMatches);
	return filterOfficialSameAs(urls, origin);
}

function extractHeadings($: ReturnType<typeof load>): { h1?: string; h2: string[]; h3: string[] } {
	const h1 = compact($('h1').first().text());
	const h2 = $('h2')
		.toArray()
		.map((el) => compact($(el).text()))
		.filter(Boolean)
		.slice(0, 12);
	const h3 = $('h3')
		.toArray()
		.map((el) => compact($(el).text()))
		.filter(Boolean)
		.slice(0, 12);
	return { h1: h1 || undefined, h2, h3 };
}

function extractVideos(html: string, $: ReturnType<typeof load>): SiteFactVideo[] {
	const out: SiteFactVideo[] = [];
	const seen = new Set<string>();

	const push = (urlRaw: string, name?: string, thumb?: string) => {
		const url = compact(urlRaw);
		if (!url || seen.has(url)) return;
		const yt = url.match(YOUTUBE_ID_RE);
		const youtubeId = yt?.[1];
		const embedUrl = youtubeId ? `https://www.youtube.com/embed/${youtubeId}` : /iframe|embed|\.mp4|\.webm|vimeo/i.test(url) ? url : '';
		if (!youtubeId && !embedUrl && !/\.(mp4|webm|ogg)(\?|$)/i.test(url)) return;
		seen.add(url);
		const video: SiteFactVideo = { url: youtubeId ? `https://www.youtube.com/watch?v=${youtubeId}` : url };
		if (embedUrl) video.embedUrl = embedUrl;
		if (youtubeId) {
			video.youtubeId = youtubeId;
			video.thumbnailUrl = `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`;
		} else if (compact(thumb)) {
			video.thumbnailUrl = compact(thumb);
		}
		if (compact(name)) video.name = compact(name);
		out.push(video);
	};

	$('iframe[src], video source[src], video[src], a[href]').each((_, el) => {
		const src = compact($(el).attr('src') || $(el).attr('href'));
		const name = compact($(el).attr('title') || $(el).attr('aria-label'));
		const thumb = compact($(el).attr('poster') || $(el).closest('[data-thumb]').attr('data-thumb'));
		if (/youtube|youtu\.be|vimeo|\.mp4|\.webm|embed/i.test(src)) push(src, name, thumb);
	});

	return out.slice(0, 8);
}

function extractMedicalAbout(page: { h1?: string; h2: string[]; h3: string[] }, bodyText: string): SiteFactMedicalAbout[] {
	const body = compact(bodyText);
	if (!body) return [];
	const candidates = [page.h1, ...page.h2, ...page.h3].filter((name): name is string => Boolean(compact(name)));
	const out: SiteFactMedicalAbout[] = [];
	const seen = new Set<string>();
	for (const raw of candidates) {
		const name = compact(raw);
		if (!name || name.length < 2 || name.length > 40) continue;
		if (!MEDICAL_HEADING_RE.test(name)) continue;
		if (!body.includes(name)) continue;
		const key = name.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		const type: SiteFactMedicalAbout['type'] = /장비|기기|레이저|초음파|CT|MRI/i.test(name)
			? 'MedicalDevice'
			: 'MedicalTherapy';
		out.push({ type, name });
	}
	return out.slice(0, 8);
}

function parsePage(source: SiteFactSourcePage): SiteFactPage {
	const html = source.html || '';
	const $ = load(html);
	const headings = extractHeadings($);
	const title = compact(source.title) || compact($('title').first().text()) || compact($('meta[property="og:title"]').attr('content'));
	const description =
		compact(source.description) ||
		compact($('meta[name="description"]').attr('content')) ||
		compact($('meta[property="og:description"]').attr('content'));
	const faq: SiteFactQa[] = extractFaqItemsFromHtml($, html).filter((item) => compact(item.q) && compact(item.a));
	const videos = extractVideos(html, $);
	const bodyText = compact($('body').text() || html.replace(/<[^>]+>/g, ' '));
	return {
		path: normalizePath(source.path),
		filePath: source.filePath,
		title: title || undefined,
		description: description || undefined,
		h1: headings.h1,
		h2: headings.h2,
		h3: headings.h3,
		faq,
		videos,
		medicalAbout: extractMedicalAbout(headings, bodyText),
	};
}

export function detectSiteCms(input: {
	filePaths?: string[];
	html?: string;
}): { cms: DetectedSiteCms; signals: string[] } {
	const paths = (input.filePaths || []).map((p) => p.replace(/\\/g, '/'));
	const html = input.html || '';
	const signals: string[] = [];

	if (/_GNUBOARD_/.test(html) || paths.some((p) => /(^|\/)common\.php$/i.test(p))) {
		signals.push('_GNUBOARD_/common.php');
	}
	if (paths.some((p) => /(^|\/)wp-load\.php$/i.test(p) || /(^|\/)wp-config\.php$/i.test(p))) {
		signals.push('wp-load.php');
	}
	if (/wp_head\s*\(|wp-content|wp-includes/i.test(html)) {
		signals.push('wp_head');
	}

	const detected = detectCmsType({ paths, html });
	signals.push(...detected.signals);

	if (detected.id === 'gnuboard' || signals.some((s) => /_GNUBOARD_|common\.php|g5_url/i.test(s))) {
		return { cms: 'gnuboard', signals: [...new Set(signals)] };
	}
	if (detected.id === 'wordpress' || signals.some((s) => /wp-load|wp_head|wp-content/i.test(s))) {
		return { cms: 'wordpress', signals: [...new Set(signals)] };
	}

	const hasPhp = paths.some((p) => /\.php$/i.test(p)) || /<\?php/i.test(html);
	const htmlOnly =
		paths.length > 0 &&
		paths.every((p) => /\.(html?|htm)$/i.test(p) || /(^|\/)(css|js|images|img|assets)\//i.test(p)) &&
		!hasPhp;
	if (htmlOnly || (!hasPhp && /<\/html>/i.test(html) && !/<\?php/i.test(html))) {
		signals.push('static-html');
		return { cms: 'static-html', signals: [...new Set(signals)] };
	}
	signals.push('php-header');
	return { cms: 'php', signals: [...new Set(signals)] };
}

export function extractSiteFacts(input: SiteFactExtractorInput): ExtractedSiteFacts {
	const origin = originOf(input.origin);
	const pages = (input.pages || []).map(parsePage);
	const htmlBlob = [
		input.htmlCorpus,
		input.footerHtml,
		input.footerText,
		input.audit?.footerText,
		...((input.pages || []).map((p) => p.html || '')),
	]
		.filter(Boolean)
		.join('\n');

	const cms = detectSiteCms({ filePaths: input.filePaths, html: htmlBlob });
	const footerContact = extractOrgContactFromFooter(htmlBlob);
	const napCorpus = extractNapFromCorpus(htmlBlob);
	const tax = labeledTaxId(htmlBlob);
	const fax = labeledFax(htmlBlob);
	const rep = extractRepresentative(htmlBlob);
	const hint = input.audit || {};

	const hintName = isValidGroundTruthRepName(hint.ceoName || hint.representativeName)
		? compact(hint.ceoName || hint.representativeName)
		: '';
	const extractedName = isValidGroundTruthRepName(rep.name) ? compact(rep.name) : '';

	const telephone = normalizeGroundTruthPhone(hint.telephone || footerContact.telephone || napCorpus.telephone);
	const faxNumber = normalizeGroundTruthPhone(hint.fax || fax);
	const taxId = normalizeGroundTruthTaxId(hint.taxId || tax.taxId, { labeled: tax.labeled || Boolean(hint.taxId) });
	const streetAddress = compact(hint.streetAddress || footerContact.address?.streetAddress || napCorpus.streetAddress);
	const addressLocality = compact(hint.addressLocality || footerContact.address?.addressLocality || napCorpus.addressLocality);
	const addressRegion = compact(hint.addressRegion || footerContact.address?.addressRegion || napCorpus.addressRegion);
	const postalCode = compact(hint.postalCode || footerContact.address?.postalCode);

	const $home = load((input.pages || []).find((p) => normalizePath(p.path) === '/')?.html || input.footerHtml || '');
	const ogSite = isUsableSiteName($home('meta[property="og:site_name"]').attr('content'));
	const siteName = isUsableSiteName(hint.siteName) || ogSite || '';

	const sameAs = filterOfficialSameAs([...(hint.sameAs || []), ...extractSameAs(htmlBlob, origin)], origin);

	const lat = compact(hint.latitude);
	const lng = compact(hint.longitude);
	const geoOk =
		lat &&
		lng &&
		Number.isFinite(Number(lat)) &&
		Number.isFinite(Number(lng)) &&
		!(lat === '0' && lng === '0');

	if (hint.faqItems?.length && pages[0] && pages[0].faq.length === 0) {
		const realFaq = hint.faqItems.filter((item) => compact(item.q) && compact(item.a));
		if (realFaq.length) pages[0].faq = realFaq;
	}

	const industry = classifyIndustrySchema({
		industryType: hint.industryType,
		siteName,
		title: pages[0]?.title,
		description: pages[0]?.description,
		menuTexts: pages.flatMap((p) => [p.h1, ...(p.h2 || [])]).filter(Boolean) as string[],
		body: htmlBlob.slice(0, 8000),
		footerText: input.footerText || hint.footerText,
	});

	return {
		origin,
		cms: cms.cms,
		cmsSignals: cms.signals,
		orgTypes: industry.orgTypes,
		nap: {
			siteName: siteName || undefined,
			repName: hintName || extractedName || undefined,
			repTitle: compact(hint.representativeTitle || (extractedName ? rep.jobTitle : '')) || undefined,
			telephone: telephone && !isDummyPhoneNumber(telephone) ? telephone : undefined,
			faxNumber: faxNumber && !isDummyPhoneNumber(faxNumber) ? faxNumber : undefined,
			taxId: taxId && !isDummyTaxId(taxId) ? taxId : undefined,
			taxIdLabeled: tax.labeled || Boolean(hint.taxId) || undefined,
			streetAddress: streetAddress || undefined,
			addressLocality: addressLocality || undefined,
			addressRegion: addressRegion || undefined,
			postalCode: postalCode || undefined,
			latitude: geoOk ? lat : undefined,
			longitude: geoOk ? lng : undefined,
			sameAs,
		},
		pages,
	};
}
