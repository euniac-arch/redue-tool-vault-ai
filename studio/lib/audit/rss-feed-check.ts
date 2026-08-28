/**
 * Checklist item — RSS 2.0 feed at `/rss.php` or a discoverable RSS/Atom link tag.
 * Missing feed → Warn (never Fail), matching `/llms.txt`.
 */

import { checklistWeightForEngineId } from '@/lib/audit/checklistDefinitions';
import type { AuditCheckItem, AuditCheckStatus, AuditLang, AuditMetrics, AuditReport } from '@/lib/site-auditor';

export const RSS_FEED_CHECK_ID = 'rss-feed' as const;

export const RSS_FEED_CHECK_WEIGHT = checklistWeightForEngineId(RSS_FEED_CHECK_ID) ?? 3;

const COPY: Record<
	AuditLang,
	{ label: string; why: string; passWhy: string; impact: string; missingEvidence: string; presentEvidence: string }
> = {
	ko: {
		label: 'RSS 피드 존재 여부 (/rss.php 또는 RSS 링크 태그)',
		why: '/rss.php가 없거나 RSS/Atom alternate 링크가 없어 네이버·구글·다음이 최신 게시글을 구독하기 어렵습니다. 루트 rss.php를 배포하세요.',
		passWhy: 'RSS 2.0 피드(/rss.php 또는 rel=alternate 링크)가 확인되어 검색엔진 구독 기준을 충족, 정상 통과되었습니다.',
		impact: 'RSS는 네이버 서치어드바이저·다음 웹마스터의 수집 진입점이며 최신 콘텐츠 색인을 가속합니다.',
		missingEvidence: 'GET /rss.php — 미구비 (200 + text/xml|application/rss+xml 아님, RSS 링크 태그 없음)',
		presentEvidence: 'GET /rss.php — 200 · RSS/XML Content-Type 확인',
	},
	en: {
		label: 'RSS feed present (/rss.php or RSS link tag)',
		why: '/rss.php is missing and no RSS/Atom alternate link was found, so search engines cannot subscribe to new posts. Publish a root rss.php.',
		passWhy: 'An RSS 2.0 feed (/rss.php or rel=alternate) is present, so the subscription bar is met and passed.',
		impact: 'RSS is an indexing entry point for Naver, Google, and Daum and speeds discovery of new content.',
		missingEvidence: 'GET /rss.php — missing (not 200 + text/xml|application/rss+xml, no RSS link tag)',
		presentEvidence: 'GET /rss.php — 200 · RSS/XML Content-Type confirmed',
	},
};

const RSS_CONTENT_TYPE_RE = /(?:application\/(?:rss|atom|rdf)\+xml|text\/xml|application\/xml)\b/i;
const HTML_BODY_RE = /^<!DOCTYPE|^<html[\s>]|^<head[\s>]|^<body[\s>]/i;
const RSS_BODY_RE = /<(?:rss|feed|rdf:RDF)\b/i;

export function isRssXmlContentType(contentType: string | null | undefined): boolean {
	return RSS_CONTENT_TYPE_RE.test(String(contentType || '').split(';')[0] || '');
}

export function isRssFeedDocument(
	text: string | null | undefined,
	status?: number | null,
	contentType?: string | null,
): boolean {
	if (status != null && status !== 200) return false;
	const body = String(text || '').trim();
	if (HTML_BODY_RE.test(body)) return false;
	const typeOk = isRssXmlContentType(contentType);
	if (body.length < 20) return typeOk;
	if (RSS_BODY_RE.test(body) || body.startsWith('<?xml')) return true;
	return typeOk && !/<[a-z][\s\S]*>/i.test(body.slice(0, 80));
}

export function extractRssAlternateHrefs(html: string, baseUrl?: string): string[] {
	const out: string[] = [];
	const seen = new Set<string>();
	const tags = String(html || '').match(/<link\b[^>]*>/gi) || [];
	for (const tag of tags) {
		const rel = (tag.match(/\brel\s*=\s*["']([^"']*)["']/i) || [])[1] || '';
		const type = (tag.match(/\btype\s*=\s*["']([^"']*)["']/i) || [])[1] || '';
		const href = (tag.match(/\bhref\s*=\s*["']([^"']+)["']/i) || [])[1] || '';
		if (!href.trim()) continue;
		const relOk = /\balternate\b/i.test(rel);
		const typeOk = /rss|atom/i.test(type) || /application\/(?:rss|atom)\+xml/i.test(type);
		const pathOk = /\/rss(?:\.php)?(?:$|[?#])/i.test(href) || /\/feed(?:\/|$)/i.test(href);
		if (!(relOk && (typeOk || pathOk)) && !typeOk) continue;
		let resolved = href.trim();
		if (baseUrl) {
			try {
				resolved = new URL(href, baseUrl).toString();
			} catch {
				resolved = href.trim();
			}
		}
		const key = resolved.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(resolved);
	}
	return out;
}

export function resolveHasRssFeed(
	report?: Partial<Pick<AuditReport, 'metrics' | 'collectedUrls' | 'url'>> | null,
): boolean {
	if (!report) return false;
	if (report.metrics?.hasRssFeed === true) return true;
	if (report.metrics?.hasRssFeed === false) return false;
	return (report.collectedUrls ?? []).some((href) => {
		try {
			const path = new URL(href, report.url || 'https://example.com').pathname.replace(/\/+$/, '');
			return path === '/rss.php' || path === '/rss' || path === '/feed';
		} catch {
			return /\/rss(?:\.php)?(?:$|[?#])|\/feed(?:\/|$)/i.test(href);
		}
	});
}

export function buildRssFeedCheckItem(args: {
	lang?: AuditLang | string | null;
	present: boolean;
	evidence?: string;
}): AuditCheckItem {
	const lang: AuditLang = args.lang === 'en' ? 'en' : 'ko';
	const copy = COPY[lang];
	const status: AuditCheckStatus = args.present ? 'pass' : 'warning';
	return {
		id: RSS_FEED_CHECK_ID,
		label: copy.label,
		status,
		passed: status === 'pass',
		weight: RSS_FEED_CHECK_WEIGHT,
		evidence: args.evidence || (args.present ? copy.presentEvidence : copy.missingEvidence),
		why: args.present ? copy.passWhy : copy.why,
		impact: copy.impact,
	};
}

/** Append the RSS row when a stored report is missing it. */
export function ensureRssFeedChecklistItem(
	checks: AuditCheckItem[],
	report?: Partial<Pick<AuditReport, 'metrics' | 'collectedUrls' | 'url' | 'lang'>> | null,
): AuditCheckItem[] {
	if (!checks.length) return checks;
	const existing = checks.find((item) => item.id === RSS_FEED_CHECK_ID);
	if (existing) {
		return checks.map((item) =>
			item.id === RSS_FEED_CHECK_ID
				? {
						...item,
						label:
							item.label ||
							buildRssFeedCheckItem({ lang: report?.lang, present: item.status === 'pass' }).label,
						weight: RSS_FEED_CHECK_WEIGHT,
						status: item.status ?? (item.passed ? 'pass' : 'warning'),
						passed: (item.status ?? (item.passed ? 'pass' : 'warning')) === 'pass',
					}
				: item,
		);
	}
	return [...checks, buildRssFeedCheckItem({ lang: report?.lang, present: resolveHasRssFeed(report) })];
}

export function withRssFeedMetric(
	metrics: AuditMetrics | undefined,
	hasRssFeed: boolean,
	evidence?: string,
): AuditMetrics | undefined {
	if (!metrics) return metrics;
	return { ...metrics, hasRssFeed, rssFeedEvidence: evidence };
}
