/**
 * Server-side live URL diagnostic: fetch HTML, parse meta/JSON-LD,
 * score GEO/SEO, and emit a prescription schema from extracted facts only.
 */
import * as cheerio from 'cheerio';
import { fetchPageResource } from '@/lib/audit/fetch-page';
import {
	extractJsonLdScriptBodies,
	parseJsonLdDocument,
	parseMeta,
} from '@/lib/audit/parser';
import { extractOnpageNap } from '@/lib/audit/extractors/nap';
import { extractCeoFromFooter } from '@/lib/audit/extractors/ceo-name';
import {
	harvestHttpUrls,
	validateChannelSignals,
} from '@/lib/audit/extractors/universal-same-as';
import {
	collectSameAsFromNodes,
	flattenJsonLd,
	hasAnyType,
	scoreLiveDiagnosticPage,
	typeList,
} from '@/lib/admin/live-diagnostic-scores';
import { isValidGroundTruthRepName } from '@/lib/solve/core/strict-schema-graph';
import { buildSchemaJsonLd, formatSchemaScriptTag, isValidSchemaUrl } from '@/lib/schema';
import type { SchemaJsonLdConfig } from '@/lib/schema';
import { UnsafeAuditUrlError } from '@/lib/ssrf-guard';
import {
	LIVE_INDUSTRY_LABEL,
	LIVE_INDUSTRY_OPTIONS,
	hostnameFromLiveUrl,
	normalizeLiveUrl,
	type LiveCrawlSnapshot,
	type LiveDetectedSchema,
	type LiveDiagnosticIndustry,
	type LiveDiagnosticOptions,
	type LiveDiagnosticResult,
	type LiveMetaSnapshot,
	type LiveScoreBreakdown,
} from './liveDiagnosticTypes';

export const INDUSTRY_ORG_TYPES: Record<LiveDiagnosticIndustry, string[]> = {
	medical: ['MedicalClinic', 'MedicalBusiness', 'Physician', 'LocalBusiness'],
	veterinary: ['VeterinaryCare', 'LocalBusiness'],
	ecommerce: ['OnlineStore', 'Store', 'LocalBusiness'],
	corporate: ['ProfessionalService', 'Organization', 'LocalBusiness'],
};

const INDUSTRY_JOB_TITLE: Record<LiveDiagnosticIndustry, string> = {
	medical: '대표원장',
	veterinary: '대표원장',
	ecommerce: '대표',
	corporate: '대표',
};

export type LiveDiagnosticEngineResult = LiveDiagnosticResult & {
	crawl: LiveCrawlSnapshot;
	meta: LiveMetaSnapshot;
	detected: LiveDetectedSchema;
	scoreBreakdown: LiveScoreBreakdown;
};

function compact(value: string | null | undefined): string {
	return String(value || '').replace(/\s+/g, ' ').trim();
}

function asIndustry(value: string | null | undefined): LiveDiagnosticIndustry {
	return LIVE_INDUSTRY_OPTIONS.some((item) => item.value === value) ? (value as LiveDiagnosticIndustry) : 'medical';
}

export function parseTargetFocus(raw: string): { region: string; keyword: string; locality: string; area: string } {
	const text = compact(raw);
	const [left = '', right = ''] = text.split('/').map((part) => part.trim());
	const region = left || '대한민국';
	const keyword = right || left || '핵심 서비스';
	const tokens = region.split(/\s+/).filter(Boolean);
	return {
		region,
		keyword,
		locality: tokens[0] || region,
		area: tokens.slice(1).join(' ') || tokens[0] || region,
	};
}

function siteNameFromHost(host: string): string {
	const stem = host.split('.')[0] || host;
	return stem
		.replace(/[-_]+/g, ' ')
		.replace(/\b\w/g, (ch) => ch.toUpperCase())
		.trim();
}

function formatStamp(now: Date): { id: string; scannedAt: string } {
	const y = now.getFullYear();
	const mo = String(now.getMonth() + 1).padStart(2, '0');
	const d = String(now.getDate()).padStart(2, '0');
	const h = String(now.getHours()).padStart(2, '0');
	const mi = String(now.getMinutes()).padStart(2, '0');
	const s = String(now.getSeconds()).padStart(2, '0');
	return { id: `LIVE-${y}${mo}${d}-${h}${mi}${s}`, scannedAt: `${y}-${mo}-${d} ${h}:${mi}` };
}

function crawlIssue(
	id: string,
	title: string,
	description: string,
	severity: 'critical' | 'warning' | 'good',
) {
	return { id, title, description, severity };
}

function buildPrescription(input: {
	url: string;
	siteName: string;
	industry: LiveDiagnosticIndustry;
	focus: ReturnType<typeof parseTargetFocus>;
	meta: LiveMetaSnapshot;
	nap: { name: string; telephone: string; streetAddress: string; addressLocality: string; addressRegion: string };
	sameAs: string[];
	founderName: string;
	founderTitle: string;
}): { jsonLd: unknown; jsonLdPretty: string; headInjectSnippet: string } {
	const origin = new URL(input.url).origin;
	const description =
		input.meta.description ||
		`${input.focus.region} ${LIVE_INDUSTRY_LABEL[input.industry]} · ${input.focus.keyword} — ${input.siteName}`;
	const channels = validateChannelSignals(input.sameAs);
	const config: SchemaJsonLdConfig = {
		name: input.nap.name || input.siteName,
		url: origin,
		logo: isValidSchemaUrl(input.meta.ogImage) ? input.meta.ogImage : undefined,
		description,
		telephone: input.nap.telephone || undefined,
		address:
			input.nap.streetAddress || input.nap.addressRegion
				? {
						streetAddress: input.nap.streetAddress || undefined,
						addressLocality: input.nap.addressLocality || input.focus.area || undefined,
						addressRegion: input.nap.addressRegion || input.focus.locality || undefined,
						addressCountry: 'KR',
					}
				: input.focus.region
					? {
							addressLocality: input.focus.area || input.focus.locality,
							addressRegion: input.focus.locality,
							addressCountry: 'KR',
						}
					: undefined,
		orgTypes: INDUSTRY_ORG_TYPES[input.industry],
		inLanguage: 'ko-KR',
		pageUrl: input.url,
		pageName: input.meta.title || `${input.siteName} | ${input.focus.keyword}`,
		sameAs: input.sameAs,
		channels: {
			naverBlog: channels.naverBlogUrls[0],
			naverPlace: channels.naverPlaceUrls[0],
			instagram: input.sameAs.find((url) => /instagram\.com/i.test(url)),
			youtube: input.sameAs.find((url) => /youtube\.com|youtu\.be/i.test(url)),
			facebook: input.sameAs.find((url) => /facebook\.com/i.test(url)),
		},
		founder: input.founderName
			? {
					name: input.founderName,
					jobTitle: input.founderTitle || INDUSTRY_JOB_TITLE[input.industry],
					knowsAbout: [input.focus.keyword].filter(Boolean),
				}
			: undefined,
	};

	const jsonLd = buildSchemaJsonLd(config);
	const jsonLdPretty = JSON.stringify(jsonLd, null, 2);
	return { jsonLd, jsonLdPretty, headInjectSnippet: formatSchemaScriptTag(jsonLd) };
}

export async function executeLiveUrlDiagnostic(
	rawUrl: string,
	options: LiveDiagnosticOptions,
): Promise<LiveDiagnosticEngineResult> {
	const industry = asIndustry(options.industry);
	const requestedUrl = normalizeLiveUrl(rawUrl);
	const focus = parseTargetFocus(options.targetFocus || '');

	let page;
	try {
		page = await fetchPageResource(requestedUrl, { forceRefresh: true, timeoutMs: 12_000 });
	} catch (error) {
		if (error instanceof UnsafeAuditUrlError) throw error;
		throw new Error(error instanceof Error ? error.message : '대상 사이트를 가져오지 못했습니다.');
	}

	const finalUrl = page.finalUrl || requestedUrl;
	const https = finalUrl.startsWith('https:');
	const html = page.text || '';
	const $ = cheerio.load(html || '<html></html>');
	const parsedMeta = parseMeta($);
	const nap = extractOnpageNap($, html, finalUrl);
	const bodies = extractJsonLdScriptBodies(html);
	const nodes: Record<string, unknown>[] = [];
	for (const body of bodies) {
		flattenJsonLd(parseJsonLdDocument(body), nodes);
	}

	const types = new Set<string>();
	for (const node of nodes) typeList(node).forEach((type) => types.add(type));
	const sameAs = collectSameAsFromNodes(nodes);
	const extraChannels = validateChannelSignals(harvestHttpUrls(html));
	const mergedSameAs = Array.from(
		new Set([
			...sameAs,
			...extraChannels.naverBlogUrls,
			...extraChannels.naverPlaceUrls,
			...extraChannels.googleMapsUrls,
			...extraChannels.kakaoUrls,
		]),
	);

	const detected: LiveDetectedSchema = {
		types: Array.from(types).sort(),
		blockCount: bodies.length,
		hasMedicalBusiness: hasAnyType(types, ['MedicalBusiness', 'MedicalClinic', 'Physician', 'Dentist', 'Hospital']),
		hasPhysician: hasAnyType(types, ['Physician']),
		hasOrganization: hasAnyType(types, [
			'Organization',
			'LocalBusiness',
			'MedicalClinic',
			'MedicalBusiness',
			'VeterinaryCare',
			'OnlineStore',
			'ProfessionalService',
		]),
		sameAs: mergedSameAs,
	};

	const meta: LiveMetaSnapshot = {
		title: parsedMeta.title,
		description: parsedMeta.metaDescription,
		ogTitle: parsedMeta.ogTitle || '',
		ogImage: parsedMeta.ogImage || '',
		canonical: parsedMeta.canonical || '',
		canonicalHrefs: parsedMeta.canonicalHrefs,
		ogUrl: parsedMeta.ogUrl || undefined,
	};

	const scored = scoreLiveDiagnosticPage({
		industry,
		meta,
		detected,
		nodes,
		html,
		requestUrl: finalUrl,
	});

	if (!https) {
		scored.issues.unshift(
			crawlIssue('https-missing', 'SSL(HTTPS) 미적용', '최종 URL이 http입니다. 검색·브라우저 모두에서 신뢰 시그널이 깎입니다.', 'critical'),
		);
	} else {
		scored.issues.push(crawlIssue('https-ok', 'HTTPS 적용', '최종 응답이 HTTPS로 확인되었습니다.', 'good'));
	}

	if (page.status != null && page.status >= 400) {
		scored.issues.unshift(
			crawlIssue('http-status', `응답 상태 ${page.status}`, '대상 URL이 정상 200 OK를 반환하지 않았습니다. 크롤 결과가 불완전할 수 있습니다.', 'critical'),
		);
	} else if (page.ok || page.status === 200) {
		scored.issues.push(crawlIssue('http-ok', '응답 200 OK', `상태코드 ${page.status ?? 200}으로 HTML을 수신했습니다.`, 'good'));
	}

	if (page.botChallenge) {
		scored.issues.unshift(
			crawlIssue('bot-challenge', '봇 챌린지 페이지', 'WAF/챌린지 HTML이 반환되어 실제 본문·스키마를 읽지 못했을 수 있습니다.', 'warning'),
		);
	}

	const issues = scored.issues;
	const { overall, schema, knowledgeGraph, geo } = scored.scores;

	const domain = hostnameFromLiveUrl(finalUrl);
	const siteName =
		compact(nap.name) ||
		compact(parsedMeta.ogTitle) ||
		compact(parsedMeta.pageTitle) ||
		compact(parsedMeta.title) ||
		siteNameFromHost(domain);

	const ceo = extractCeoFromFooter({ html, $ });
	const founderName = ceo?.isExtracted && isValidGroundTruthRepName(ceo.name) ? ceo.name : '';

	const schemaPack = buildPrescription({
		url: finalUrl,
		siteName,
		industry,
		focus,
		meta,
		nap: {
			name: nap.name,
			telephone: nap.telephone,
			streetAddress: nap.streetAddress,
			addressLocality: nap.addressLocality,
			addressRegion: nap.addressRegion,
		},
		sameAs: mergedSameAs,
		founderName,
		founderTitle: ceo?.jobTitle || INDUSTRY_JOB_TITLE[industry],
	});

	const { id, scannedAt } = formatStamp(new Date());
	const summary = `${siteName}(${domain}) ${LIVE_INDUSTRY_LABEL[industry]} 실시간 진단 — HTTPS ${https ? '적용' : '미적용'}, HTTP ${page.status ?? 'N/A'}, 메타 ${scored.scoreBreakdown.meta}/30 · 스키마 ${scored.scoreBreakdown.jsonLd}/40 · 지식그래프 ${scored.scoreBreakdown.knowledgeGraph}/30 (종합 ${overall}점).`;

	return {
		id,
		url: requestedUrl,
		canonicalUrl: finalUrl,
		siteName,
		domain,
		industry,
		targetFocus: `${focus.region} / ${focus.keyword}`,
		scannedAt,
		scores: { overall, schema, knowledgeGraph, geo },
		issues,
		...schemaPack,
		summary,
		crawl: {
			https,
			status: page.status,
			ok: page.ok,
			finalUrl,
			elapsedMs: page.elapsedMs,
			botChallenge: page.botChallenge,
		},
		meta,
		detected,
		scoreBreakdown: scored.scoreBreakdown,
	};
}
