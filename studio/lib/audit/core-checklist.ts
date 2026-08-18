/**
 * Fixed SEO/GEO essential checklist (6 items) mapped 1:1 to live AuditReport checks.
 */

import { schemaMappingFromReport } from '@/lib/audit/live-criteria';
import {
	coreArticleIssueLabel,
	coreArticleItemCopy,
	coreSuccessSummaryCopy,
	detectSchemaVertical,
	hasPageSchemaAlternative,
	isNewsMediaVertical,
	type SchemaVertical,
} from '@/lib/audit/recommended-schemas';
import { getJosa } from '@/lib/korean-josa';
import type { AuditCheckItem, AuditCheckStatus, AuditReport } from '@/lib/site-auditor';

export type CoreChecklistId =
	| 'canonical'
	| 'heading-hierarchy'
	| 'render-blocking'
	| 'article-schema'
	| 'faq-schema'
	| 'image-alt';

export type CoreChecklistTone = 'ok' | 'needs_work';

export interface CoreChecklistItem {
	id: CoreChecklistId;
	/** Live aggregate status from audit engine checks. */
	status: AuditCheckStatus;
	/** UI tone: pass → ok (green); fail/warning → needs_work (red). */
	tone: CoreChecklistTone;
	/** Underlying check ids used for aggregation. */
	checkIds: string[];
	evidence?: string;
	/** Vertical-aware label (article-schema differs for clinic vs press). */
	label?: string;
	why?: string;
}

function collectChecks(report: AuditReport | null | undefined): AuditCheckItem[] {
	if (!report) return [];
	if (report.checklist?.length) return report.checklist;
	return report.categories?.flatMap((c) => c.checks) ?? [];
}

function statusOf(check: AuditCheckItem | undefined): AuditCheckStatus {
	if (!check) return 'fail';
	if (check.status) return check.status;
	return check.passed ? 'pass' : 'fail';
}

function findCheck(checks: AuditCheckItem[], id: string): AuditCheckItem | undefined {
	return checks.find((c) => c.id === id);
}

/** Worst-of aggregation: fail > warning > pass. */
function aggregateStatus(statuses: AuditCheckStatus[]): AuditCheckStatus {
	if (statuses.some((s) => s === 'fail')) return 'fail';
	if (statuses.some((s) => s === 'warning')) return 'warning';
	if (statuses.length === 0) return 'fail';
	return 'pass';
}

function toTone(status: AuditCheckStatus): CoreChecklistTone {
	return status === 'pass' ? 'ok' : 'needs_work';
}

function resolveVertical(report: AuditReport | null | undefined): SchemaVertical {
	return detectSchemaVertical(schemaMappingFromReport(report));
}

/**
 * Always returns the 6 essential SEO/GEO guide items with live status badges.
 * When no report is available, items default to needs_work (fail).
 * NewsArticle is ignored for non-press verticals; AboutPage/MedicalWebPage substitutes.
 */
export function buildCoreSeoGeoChecklist(report: AuditReport | null | undefined): CoreChecklistItem[] {
	const checks = collectChecks(report);
	const m = report?.metrics;
	const vertical = resolveVertical(report);
	const newsVertical = isNewsMediaVertical(schemaMappingFromReport(report));
	const pageAltOk = hasPageSchemaAlternative(m?.schemaTypes, vertical);

	const canonical = findCheck(checks, 'canonical');
	const singleH1 = findCheck(checks, 'single-h1');
	const headingSkip = findCheck(checks, 'heading-skip');
	const headingStructure = findCheck(checks, 'heading-structure');
	const renderBlocking = findCheck(checks, 'render-blocking');
	const articleFields = findCheck(checks, 'article-fields');
	const newsArticle = findCheck(checks, 'news-article');
	const faq = findCheck(checks, 'faq-howto-schema');
	const imageAlt = findCheck(checks, 'image-alt');

	const headingStatus = aggregateStatus([
		statusOf(singleH1),
		statusOf(headingSkip),
		statusOf(headingStructure),
	]);

	const articleStatus = ((): AuditCheckStatus => {
		if (!newsVertical) {
			if (pageAltOk) return 'pass';
			const a = statusOf(articleFields);
			if (a === 'pass') return 'pass';
			if (a === 'warning') return 'warning';
			return 'fail';
		}
		const a = statusOf(articleFields);
		const n = statusOf(newsArticle);
		if (a === 'pass' || n === 'pass') return 'pass';
		if (a === 'warning' || n === 'warning') return 'warning';
		return 'fail';
	})();

	const headingEvidence =
		headingStructure?.evidence ||
		headingSkip?.evidence ||
		singleH1?.evidence ||
		(m
			? `H1=${m.h1Count}${m.headingSkipDetected ? ' · skip detected' : ''}`
			: undefined);

	const articleCopy = coreArticleItemCopy(vertical, 'ko');
	const articleEvidence = newsVertical
		? newsArticle?.status === 'pass'
			? newsArticle.evidence
			: articleFields?.evidence || newsArticle?.evidence
		: pageAltOk
			? `page schema: ${(m?.schemaTypes ?? []).filter((t) => /AboutPage|MedicalWebPage/i.test(t)).join(', ') || 'AboutPage/MedicalWebPage'}`
			: articleFields?.evidence;

	return [
		{
			id: 'canonical',
			status: statusOf(canonical),
			tone: toTone(statusOf(canonical)),
			checkIds: ['canonical'],
			evidence: canonical?.evidence,
		},
		{
			id: 'heading-hierarchy',
			status: headingStatus,
			tone: toTone(headingStatus),
			checkIds: ['single-h1', 'heading-skip', 'heading-structure'],
			evidence: headingEvidence,
		},
		{
			id: 'render-blocking',
			status: statusOf(renderBlocking),
			tone: toTone(statusOf(renderBlocking)),
			checkIds: ['render-blocking'],
			evidence:
				renderBlocking?.evidence ||
				(typeof m?.renderBlockingScripts === 'number'
					? `${m.renderBlockingScripts} sync scripts`
					: undefined),
		},
		{
			id: 'article-schema',
			status: articleStatus,
			tone: toTone(articleStatus),
			checkIds: newsVertical ? ['article-fields', 'news-article'] : ['article-fields'],
			evidence: articleEvidence,
			label: articleCopy.label,
			why: articleCopy.why,
		},
		{
			id: 'faq-schema',
			status: statusOf(faq),
			tone: toTone(statusOf(faq)),
			checkIds: ['faq-howto-schema'],
			evidence: faq?.evidence,
		},
		{
			id: 'image-alt',
			status: statusOf(imageAlt),
			tone: toTone(statusOf(imageAlt)),
			checkIds: ['image-alt'],
			evidence:
				imageAlt?.evidence ||
				(typeof m?.imageAltCoveragePct === 'number'
					? `alt coverage ${m.imageAltCoveragePct}%`
					: undefined),
		},
	];
}

/** Items currently failing/warning — After gains are driven by these (to-be-fixed → green). */
export function getCoreItemsNeedingWork(items: CoreChecklistItem[]): CoreChecklistItem[] {
	return items.filter((item) => item.tone === 'needs_work');
}

/** Items already healthy (pass). */
export function getCoreItemsHealthy(items: CoreChecklistItem[]): CoreChecklistItem[] {
	return items.filter((item) => item.tone === 'ok');
}

/** Human-readable issue phrases for 🔴 core items only (used in Before summary + GEO prompts). */
const CORE_ISSUE_LABELS: Record<CoreChecklistId, { ko: string; en: string }> = {
	canonical: {
		ko: 'Canonical URL 불일치',
		en: 'Canonical URL mismatch',
	},
	'heading-hierarchy': {
		ko: '헤딩 계층 구조 미흡',
		en: 'Heading hierarchy gaps',
	},
	'render-blocking': {
		ko: '렌더링 차단 스크립트 존재',
		en: 'Render-blocking scripts present',
	},
	'article-schema': {
		ko: 'NewsArticle/Article 스키마 미흡',
		en: 'NewsArticle/Article schema incomplete',
	},
	'faq-schema': {
		ko: 'FAQPage 인용 스키마 누락',
		en: 'FAQPage citation schema missing',
	},
	'image-alt': {
		ko: '이미지 alt 텍스트 미흡',
		en: 'Image alt text incomplete',
	},
};

function issueLabelFor(
	item: CoreChecklistItem,
	lang: 'ko' | 'en',
	vertical?: SchemaVertical,
): string {
	if (item.id === 'article-schema' && vertical) {
		return coreArticleIssueLabel(vertical, lang);
	}
	return CORE_ISSUE_LABELS[item.id][lang];
}

/** Collect issue labels for core items that are 🔴 (needs_work). */
export function getCoreFailIssueLabels(
	items: CoreChecklistItem[],
	lang: 'ko' | 'en' = 'ko',
	vertical?: SchemaVertical,
): string[] {
	return getCoreItemsNeedingWork(items).map((item) => issueLabelFor(item, lang, vertical));
}

/**
 * Evidence lines for GEO narrative / LLM — strictly 1:1 with the live 6-core checklist.
 * Never invents stale fails (e.g. "JSON-LD blocks = 0") when the corresponding badge is 🟢.
 * Never lists NewsArticle missing for clinic/business verticals.
 */
export function buildCoreTechnicalFailsFromReport(
	report: AuditReport | null | undefined,
	lang: 'ko' | 'en' = 'ko',
): string[] {
	const items = buildCoreSeoGeoChecklist(report);
	return getCoreFailIssueLabels(items, lang, resolveVertical(report));
}

export interface CoreChecklistSummaryArgs {
	items: CoreChecklistItem[];
	brandName: string;
	industry?: string;
	lang?: 'ko' | 'en';
	vertical?: SchemaVertical;
}

/**
 * Before-panel summary bound to live 🔴/🟢 core checklist status.
 * - All 🟢 → After success copy (no legacy fail phrases).
 * - Any 🔴 → only detected failing items are named in the sentence.
 */
export function buildCoreChecklistSummaryText(args: CoreChecklistSummaryArgs): string {
	const lang = args.lang === 'en' ? 'en' : 'ko';
	const brand = args.brandName.trim() || (lang === 'en' ? 'this brand' : '해당 브랜드');
	const industry =
		args.industry?.trim() ||
		(lang === 'en' ? 'services and offerings' : '서비스/클리닉 정보');
	const vertical = args.vertical ?? detectSchemaVertical({ industry, category: industry });
	const issues = getCoreFailIssueLabels(args.items, lang, vertical);

	if (issues.length === 0) {
		return coreSuccessSummaryCopy(brand, lang, vertical);
	}

	const issueList = issues.join(', ');
	return lang === 'en'
		? `Live audit found ${issueList}, which constrains AI search engines from fully collecting and citing ${brand}'s ${industry}. Strengthening the weak items is needed to improve top answer-card exposure and inquiry inflow.`
		: `실측 진단에서 ${issueList} 항목이 확인되어 AI 검색엔진이 ${brand}의 ${industry}${getJosa(industry, '을/를')} 완벽히 수집·인용하는 데 제약이 있습니다. 미흡한 항목을 보완하여 AI 상단 정답 카드 노출 및 상담 유입을 강화할 필요가 있습니다.`;
}

export function coreItemPresentation(
	item: CoreChecklistItem,
	lang: 'ko' | 'en',
	vertical?: SchemaVertical,
): { label: string; why: string } {
	if (item.id === 'article-schema') {
		const copy = coreArticleItemCopy(vertical ?? 'general', lang);
		return { label: item.label && lang === 'ko' ? item.label : copy.label, why: copy.why };
	}
	return { label: item.label || '', why: item.why || '' };
}
