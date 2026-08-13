/**
 * Ready-to-paste JSON-LD fix snippets — generated only for schemas that the
 * live crawl actually found missing or incomplete (same fail/warn filter as
 * `buildPrioritizedActions`). Placeholder values are filled from real
 * `report.siteMeta`/`report.metrics` signals wherever available; anything
 * the crawler can't know (a person's name, a FAQ answer…) is left as an
 * obvious `{{ }}`-style placeholder for the webmaster to replace.
 */

import type { AuditCheckItem, AuditLang, AuditReport } from '@/lib/site-auditor';

export type JsonLdSnippetSchema = 'organization' | 'article' | 'person' | 'faq';

export interface JsonLdFixSnippet {
	id: JsonLdSnippetSchema;
	schemaType: string;
	title: string;
	description: string;
	code: string;
}

function resolveStatus(check: AuditCheckItem): 'pass' | 'fail' | 'warning' {
	return check.status ?? (check.passed ? 'pass' : 'fail');
}

function findCheck(checks: AuditCheckItem[], id: string): AuditCheckItem | undefined {
	return checks.find((c) => c.id === id);
}

function needsFix(checks: AuditCheckItem[], id: string): boolean {
	const check = findCheck(checks, id);
	return check ? resolveStatus(check) !== 'pass' : false;
}

function domainFromUrl(raw: string): string {
	try {
		return new URL(raw).hostname.replace(/^www\./, '');
	} catch {
		return raw.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0] || raw;
	}
}

function pretty(obj: unknown): string {
	return JSON.stringify(obj, null, 2);
}

function buildOrganizationSnippet(report: AuditReport, domain: string, lang: AuditLang): JsonLdFixSnippet {
	const brand = report.siteMeta?.brandName || domain;
	const missing = report.metrics?.organizationMissing;

	const code = `<script type="application/ld+json">\n${pretty({
		'@context': 'https://schema.org',
		'@type': 'Organization',
		name: brand,
		url: `https://${domain}`,
		logo: `https://${domain}/logo.png`,
		sameAs: [`https://${domain}`, `https://blog.naver.com/${domain}`],
	})}\n</script>`;

	return {
		id: 'organization',
		schemaType: 'Organization',
		title: lang === 'en' ? 'Organization' : 'Organization (상호/기업 정보)',
		description:
			lang === 'en'
				? missing?.length
					? `Currently missing: ${missing.join(', ')}`
					: 'No Organization schema was detected on the page.'
				: missing?.length
					? `현재 누락된 필드: ${missing.join(', ')}`
					: '페이지에서 Organization 스키마가 감지되지 않았습니다.',
		code,
	};
}

function buildArticleSnippet(report: AuditReport, domain: string, lang: AuditLang): JsonLdFixSnippet {
	const brand = report.siteMeta?.brandName || domain;
	const missing = report.metrics?.articleMissing;
	const authorName = lang === 'en' ? '{{ Author name }}' : '{{ 작성자명 }}';
	const headline = report.metrics?.pageTitle || (lang === 'en' ? '{{ Content headline }}' : '{{ 콘텐츠 제목 }}');

	const code = `<script type="application/ld+json">\n${pretty({
		'@context': 'https://schema.org',
		'@type': 'Article',
		headline,
		author: { '@type': 'Person', name: authorName },
		datePublished: '{{ YYYY-MM-DD }}',
		publisher: {
			'@type': 'Organization',
			name: brand,
			logo: { '@type': 'ImageObject', url: `https://${domain}/logo.png` },
		},
	})}\n</script>`;

	return {
		id: 'article',
		schemaType: 'Article / NewsArticle',
		title: lang === 'en' ? 'Article / NewsArticle' : 'Article / NewsArticle (기사·발행물)',
		description:
			lang === 'en'
				? missing?.length
					? `Currently missing: ${missing.join(', ')}`
					: 'No Article/NewsArticle schema was detected.'
				: missing?.length
					? `현재 누락된 필드: ${missing.join(', ')}`
					: '페이지에서 Article/NewsArticle 스키마가 감지되지 않았습니다.',
		code,
	};
}

function buildPersonSnippet(report: AuditReport, domain: string, lang: AuditLang): JsonLdFixSnippet {
	const brand = report.siteMeta?.brandName || domain;
	const missing = report.metrics?.personMissing;

	const code = `<script type="application/ld+json">\n${pretty({
		'@context': 'https://schema.org',
		'@type': 'Person',
		'@id': `https://${domain}/#person`,
		name: lang === 'en' ? `${brand} Medical / Research Team` : `${brand} 의료진/연구팀`,
		jobTitle: lang === 'en' ? 'Medical Coordinator / Research Team' : '의료 코디네이터 / 전문 연구팀',
		worksFor: { '@id': `https://${domain}/#organization` },
	})}\n</script>`;

	return {
		id: 'person',
		schemaType: 'Person',
		title: lang === 'en' ? 'Person (E-E-A-T author profile)' : 'Person (E-E-A-T 대표/저자 프로필)',
		description:
			lang === 'en'
				? missing?.length
					? `Currently missing: ${missing.join(', ')}`
					: 'No Person schema was detected.'
				: missing?.length
					? `현재 누락된 필드: ${missing.join(', ')}`
					: '페이지에서 Person 스키마가 감지되지 않았습니다.',
		code,
	};
}

function buildFaqSnippet(report: AuditReport, lang: AuditLang): JsonLdFixSnippet {
	const topic = report.siteMeta?.primaryKeyword || report.siteMeta?.category || (lang === 'en' ? 'this service' : '이 서비스');
	const location = report.siteMeta?.broadLocation ? `${report.siteMeta.broadLocation} ` : '';
	const question =
		lang === 'en' ? `What should I know before choosing ${topic}?` : `${location}${topic} 선택 전 꼭 알아야 할 점은 무엇인가요?`;

	const code = `<script type="application/ld+json">\n${pretty({
		'@context': 'https://schema.org',
		'@type': 'FAQPage',
		mainEntity: [
			{
				'@type': 'Question',
				name: question,
				acceptedAnswer: {
					'@type': 'Answer',
					text: lang === 'en' ? '{{ Answer content }}' : '{{ 답변 내용 }}',
				},
			},
		],
	})}\n</script>`;

	return {
		id: 'faq',
		schemaType: 'FAQPage / HowTo',
		title: lang === 'en' ? 'FAQPage / HowTo' : 'FAQPage / HowTo (AI 인용 최우선 스키마)',
		description:
			lang === 'en'
				? 'No FAQPage / HowTo schema was detected — this is the schema AI engines cite most often.'
				: 'FAQPage / HowTo 스키마가 감지되지 않았습니다 — AI 검색엔진이 가장 우선적으로 인용하는 구조입니다.',
		code,
	};
}

/** Only returns snippets for schemas whose corresponding checklist item is fail/warning. */
export function buildJsonLdFixSnippets(report: AuditReport, lang: AuditLang = 'ko'): JsonLdFixSnippet[] {
	const checks = report.checklist?.length ? report.checklist : report.categories.flatMap((c) => c.checks);
	const domain = report.siteMeta?.domain || domainFromUrl(report.url);

	const snippets: JsonLdFixSnippet[] = [];
	if (needsFix(checks, 'organization')) snippets.push(buildOrganizationSnippet(report, domain, lang));
	if (needsFix(checks, 'article-fields')) snippets.push(buildArticleSnippet(report, domain, lang));
	if (needsFix(checks, 'person-eeat')) snippets.push(buildPersonSnippet(report, domain, lang));
	if (needsFix(checks, 'faq-howto-schema')) snippets.push(buildFaqSnippet(report, lang));
	return snippets;
}
