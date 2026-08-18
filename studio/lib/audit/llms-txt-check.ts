/**
 * Checklist item — `/llms.txt` AI index file (GEO standard).
 * Official 6-point GEO slot inside the dynamic on-page total.
 * Missing file → Warn (never Fail).
 */

import { checklistWeightForEngineId } from '@/lib/audit/checklistDefinitions';
import type { AuditCheckItem, AuditCheckStatus, AuditLang, AuditMetrics, AuditReport } from '@/lib/site-auditor';

export const LLMS_TXT_CHECK_ID = 'llms-txt' as const;

export const LLMS_TXT_CHECK_WEIGHT = checklistWeightForEngineId(LLMS_TXT_CHECK_ID) ?? 6;

const COPY: Record<
	AuditLang,
	{ label: string; why: string; passWhy: string; impact: string; missingEvidence: string; presentEvidence: string }
> = {
	ko: {
		label: '[GEO 표준] /llms.txt AI 전용 인덱스 파일 구비 여부',
		why: '/llms.txt가 사이트 루트에 없어 GPTBot·Perplexity 등 AI 크롤러가 공식 사실 인덱스를 읽지 못합니다. 루트에 표준 마크다운을 배포하세요.',
		passWhy: '/llms.txt가 사이트 루트에서 확인되어 AI 전용 인덱스 기준을 충족, 정상 통과되었습니다.',
		impact: '/llms.txt는 상호·NAP·핵심 FAQ를 AI가 우선 인용하는 표준 진입점입니다.',
		missingEvidence: 'GET /llms.txt — 미구비 (HTML 오류 페이지이거나 200이 아님)',
		presentEvidence: 'GET /llms.txt — 200 · AI 전용 마크다운 인덱스 확인',
	},
	en: {
		label: '[GEO standard] /llms.txt AI-only index file present',
		why: '/llms.txt is missing at the site root, so GPTBot and Perplexity cannot read an official fact index. Publish the standard markdown at the origin root.',
		passWhy: '/llms.txt is present at the site root, so the AI index bar is met and passed.',
		impact: '/llms.txt is the standard entry point for brand, NAP, and core FAQ citation.',
		missingEvidence: 'GET /llms.txt — missing (HTML error page or non-200)',
		presentEvidence: 'GET /llms.txt — 200 · AI markdown index confirmed',
	},
};

export function isLlmsTxtDocument(text: string | null | undefined, status?: number | null): boolean {
	if (status != null && status !== 200) return false;
	const body = (text || '').trim();
	if (body.length < 20) return false;
	if (/^<!DOCTYPE|^<html[\s>]|^<head[\s>]|^<body[\s>]/i.test(body)) return false;
	return /(?:^|\n)\s*#\s+\S+|llms\.txt|##\s*(?:NAP|FAQ|Services|서비스)/i.test(body) || !/<[a-z][\s\S]*>/i.test(body);
}

export function resolveHasLlmsTxt(
	report?: Pick<AuditReport, 'metrics' | 'collectedUrls' | 'url'> | null,
): boolean {
	if (!report) return false;
	if (report.metrics?.hasLlmsTxt === true) return true;
	if (report.metrics?.hasLlmsTxt === false) return false;
	return (report.collectedUrls ?? []).some((href) => {
		try {
			return new URL(href, report.url || 'https://example.com').pathname.replace(/\/+$/, '') === '/llms.txt';
		} catch {
			return /\/llms\.txt(?:$|[?#])/i.test(href);
		}
	});
}

export function buildLlmsTxtCheckItem(args: {
	lang?: AuditLang | string | null;
	present: boolean;
	evidence?: string;
}): AuditCheckItem {
	const lang: AuditLang = args.lang === 'en' ? 'en' : 'ko';
	const copy = COPY[lang];
	const status: AuditCheckStatus = args.present ? 'pass' : 'warning';
	return {
		id: LLMS_TXT_CHECK_ID,
		label: copy.label,
		status,
		passed: status === 'pass',
		weight: LLMS_TXT_CHECK_WEIGHT,
		evidence: args.evidence || (args.present ? copy.presentEvidence : copy.missingEvidence),
		why: args.present ? copy.passWhy : copy.why,
		impact: copy.impact,
	};
}

/** Append the `/llms.txt` row when a stored report is missing it. */
export function ensureLlmsTxtChecklistItem(
	checks: AuditCheckItem[],
	report?: Pick<AuditReport, 'metrics' | 'collectedUrls' | 'url' | 'lang'> | null,
): AuditCheckItem[] {
	if (!checks.length) return checks;
	const existing = checks.find((item) => item.id === LLMS_TXT_CHECK_ID);
	if (existing) {
		return checks.map((item) =>
			item.id === LLMS_TXT_CHECK_ID
				? {
						...item,
						label: item.label || buildLlmsTxtCheckItem({ lang: report?.lang, present: item.status === 'pass' }).label,
						weight: LLMS_TXT_CHECK_WEIGHT,
						status: item.status ?? (item.passed ? 'pass' : 'warning'),
						passed: (item.status ?? (item.passed ? 'pass' : 'warning')) === 'pass',
					}
				: item,
		);
	}
	return [...checks, buildLlmsTxtCheckItem({ lang: report?.lang, present: resolveHasLlmsTxt(report) })];
}

export function withLlmsTxtMetric(
	metrics: AuditMetrics | undefined,
	hasLlmsTxt: boolean,
	evidence?: string,
): AuditMetrics | undefined {
	if (!metrics) return metrics;
	return { ...metrics, hasLlmsTxt, llmsTxtEvidence: evidence };
}
