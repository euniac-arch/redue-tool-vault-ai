/**
 * Map a live `AuditReport` (or stored `audit_projects` doc) onto the admin
 * diagnostics record used by `/admin/diagnostics`.
 */
import { computeEntityDisambiguation, computeShareOfVoice } from '@/lib/audit/advancedGeoMetrics';
import { buildDiagnosisScoreSnapshot } from '@/lib/audit/diagnosis-scores';
import { resolveReportTrack3Score } from '@/lib/audit/pagespeed';
import { resolveProjectSiteName } from '@/lib/audit/project-site-name';
import type { AuditProjectDoc } from '@/lib/firebase/audit-projects-types';
import type { AuditReport } from '@/lib/site-auditor';
import {
	clampScore,
	formatDisplayDateTime,
	scoreToStatus,
	type DiagnosticCategory,
	type DiagnosticDetail,
	type DiagnosticRecommendation,
	type DiagnosticReportData,
	type DiagnosticStatus,
} from './diagnostic-management';

const PET_SIGNAL =
	/VeterinaryCare|동물병원|반려동물|수의사|veterinary|animal\s*hospital|pet\s*clinic|\bvet\b/i;
const COMMERCE_SIGNAL =
	/\bProduct\b|\bOffer\b|\bStore\b|YoungCart|카페24|쇼핑몰|커머스|스토어|mall|shop/i;

export function hostnameFromUrl(raw: string): string {
	try {
		return new URL(raw).hostname.replace(/^www\./i, '').toLowerCase() || raw;
	} catch {
		return raw
			.replace(/^https?:\/\//i, '')
			.replace(/^www\./i, '')
			.split('/')[0]
			.toLowerCase();
	}
}

export function inferDiagnosticCategory(report: AuditReport): DiagnosticCategory {
	const schemaTypes = report.metrics?.schemaTypes ?? [];
	const corpus = [
		report.siteMeta?.brandName,
		report.siteMeta?.category,
		report.metrics?.pageTitle,
		schemaTypes.join(' '),
		report.url,
	]
		.filter(Boolean)
		.join(' ');

	if (PET_SIGNAL.test(corpus)) return 'Pet';
	if (report.siteMeta?.industryType === 'MEDICAL') return 'Medical';
	if (report.siteMeta?.industryType === 'LOCAL_STORE' || COMMERCE_SIGNAL.test(corpus)) return 'Commerce';
	return 'Corporate';
}

export function extractDiagnosticIssues(report: AuditReport): string[] {
	const labels: string[] = [];
	const seen = new Set<string>();
	const push = (label: string) => {
		const next = label.replace(/\s+/g, ' ').trim();
		if (!next || seen.has(next)) return;
		seen.add(next);
		labels.push(next);
	};

	for (const cat of report.categories || []) {
		for (const check of cat.checks || []) {
			if (check.status === 'pass' || check.passed) continue;
			push(check.label || check.id);
		}
	}
	if (labels.length === 0) {
		for (const check of report.checklist || []) {
			if (check.status === 'pass' || check.passed) continue;
			push(check.label || check.id);
		}
	}
	return labels.slice(0, 12);
}

function buildRecommendations(issues: string[]): DiagnosticRecommendation[] {
	return issues.slice(0, 5).map((issue, index) => ({
		title: issue,
		description: `${issue} 항목을 보완하면 AI 인용·스키마 완성도가 함께 올라갑니다.`,
		priority: index === 0 ? 'high' : index < 3 ? 'medium' : 'low',
	}));
}

function buildSummary(input: {
	siteName: string;
	totalScore: number;
	status: DiagnosticStatus;
	issueCount: number;
}): string {
	if (input.status === 'good') {
		return `${input.siteName}은(는) 종합 ${input.totalScore}점으로 AI 검색 인용 기반이 양호합니다.`;
	}
	if (input.status === 'warning') {
		return `${input.siteName}은(는) 종합 ${input.totalScore}점입니다. 주요 감점 ${input.issueCount}건을 처방하면 GEO 노출이 안정됩니다.`;
	}
	return `${input.siteName}은(는) 종합 ${input.totalScore}점으로 위험 구간입니다. 스키마·지식그래프 누락을 우선 조치하세요.`;
}

function knowledgeGraphScoreFromReport(report: AuditReport): number {
	try {
		const snippets = report.metrics?.jsonLdFullCorpus || report.metrics?.jsonLdSnippets?.join('\n') || '';
		const result = computeEntityDisambiguation({
			jsonLdCorpus: snippets,
			html: report.metrics?.pageTitle || '',
			sameAs: report.metrics?.schemaTypes?.length ?? 0,
		});
		return clampScore(result.score);
	} catch {
		return clampScore(report.schemaCoverage ?? 0);
	}
}

function localSovScoreFromReport(report: AuditReport): number {
	try {
		const result = computeShareOfVoice({
			brandName: report.siteMeta?.brandName,
			location: report.siteMeta?.location || report.siteMeta?.broadLocation,
			industryType: report.siteMeta?.industryType,
			title: report.metrics?.pageTitle,
			description: report.metrics?.metaDescription,
			primaryKeyword: report.siteMeta?.primaryKeyword,
		});
		return clampScore(result.asIsShare);
	} catch {
		return clampScore(typeof report.geoCitationScore === 'number' ? report.geoCitationScore : 0);
	}
}

export function requestedByFromActor(input: {
	email?: string | null;
	userType?: string | null;
}): string {
	const email = input.email?.trim();
	if (email) return email;
	return 'Guest';
}

export function reportShareUrlFor(id: string): string {
	return `/audit/result?id=${encodeURIComponent(id)}`;
}

export function buildDiagnosticFromReport(
	report: AuditReport,
	opts?: {
		id?: string;
		requestedBy?: string;
		createdAt?: string;
	},
): DiagnosticDetail {
	const lang = report.lang === 'en' ? 'en' : 'ko';
	const snapshot = buildDiagnosisScoreSnapshot(report, null, lang, {
		coreWebVitalsScore100: resolveReportTrack3Score(report),
	});
	const totalScore = clampScore(snapshot.measuredScore);
	const geoScore = clampScore(snapshot.externalTrustScore);
	const schemaScore = clampScore(
		snapshot.onpage.categories.find((category) => category.id === 'schema')?.score100 ??
			report.schemaCoverage ??
			0,
	);
	const status = scoreToStatus(totalScore);
	const issues = extractDiagnosticIssues(report);
	const siteName = resolveProjectSiteName(report);
	const knowledgeGraphScore = knowledgeGraphScoreFromReport(report);
	const localSovScore = localSovScoreFromReport(report);
	const recommendations = buildRecommendations(issues);
	const summary = buildSummary({ siteName, totalScore, status, issueCount: issues.length });
	const id = opts?.id || '';
	const reportData: DiagnosticReportData = {
		url: report.url,
		knowledgeGraphScore,
		localSovScore,
		schemaTypes: report.metrics?.schemaTypes ?? [],
		jsonLdBlockCount: report.metrics?.jsonLdBlockCount ?? 0,
		recommendations,
		summary,
		prescriptionIssued: Boolean(report.isPrescriptionApplied),
	};

	return {
		id,
		siteName,
		domain: hostnameFromUrl(report.url),
		category: inferDiagnosticCategory(report),
		totalScore,
		geoScore,
		schemaScore,
		status,
		issues,
		requestedBy: opts?.requestedBy || 'Guest',
		createdAt: opts?.createdAt || new Date().toISOString(),
		reportShareUrl: id ? reportShareUrlFor(id) : '/audit/result',
		knowledgeGraphScore,
		localSovScore,
		recommendations,
		summary,
		prescriptionIssued: reportData.prescriptionIssued,
		reportData,
		url: report.url,
	};
}

export function mapAuditProjectToDiagnostic(
	doc: AuditProjectDoc,
	requestedBy?: string,
): DiagnosticDetail {
	const detail = buildDiagnosticFromReport(doc.auditPayload.report, {
		id: doc.id,
		requestedBy: requestedBy || (doc.userType === 'guest' || !doc.userId ? 'Guest' : 'Guest'),
		createdAt: doc.createdAt,
	});
	return {
		...detail,
		createdAt: formatDisplayDateTime(doc.createdAt),
		reportShareUrl: reportShareUrlFor(doc.id),
	};
}
