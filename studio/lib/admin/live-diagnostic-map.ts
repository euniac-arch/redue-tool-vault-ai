/**
 * Live diagnostic → persist payload mapping.
 * Pure function. No Firebase / server-only imports.
 */

import {
	scoreToStatus,
	type DiagnosticCategory,
	type DiagnosticRecommendation,
	type DiagnosticReportData,
	type DiagnosticStatus,
} from './diagnostic-management';
import type { LiveDiagnosticIndustry, LiveDiagnosticResult } from './liveDiagnosticTypes';

const INDUSTRY_TO_CATEGORY: Record<LiveDiagnosticIndustry, DiagnosticCategory> = {
	medical: 'Medical',
	veterinary: 'Pet',
	ecommerce: 'Commerce',
	corporate: 'Corporate',
};

export type LiveDiagnosticPersistInput = {
	siteName: string;
	domain: string;
	url?: string;
	category: DiagnosticCategory;
	totalScore: number;
	geoScore: number;
	schemaScore: number;
	status: DiagnosticStatus;
	issues: string[];
	reportData: DiagnosticReportData;
	requestedBy: string;
	userId?: string | null;
	userType?: string | null;
};

export function liveResultToDiagnosticInput(
	result: LiveDiagnosticResult,
	requestedBy: string,
	userId?: string | null,
): LiveDiagnosticPersistInput {
	const recommendations: DiagnosticRecommendation[] = result.issues
		.filter((issue) => issue.severity !== 'good')
		.slice(0, 6)
		.map((issue, index) => ({
			title: issue.title,
			description: issue.description,
			priority: issue.severity === 'critical' ? 'high' : index < 3 ? 'medium' : 'low',
		}));

	return {
		siteName: result.siteName,
		domain: result.domain,
		url: result.canonicalUrl || result.url,
		category: INDUSTRY_TO_CATEGORY[result.industry],
		totalScore: result.scores.overall,
		geoScore: result.scores.geo,
		schemaScore: result.scores.schema,
		status: scoreToStatus(result.scores.overall),
		issues: result.issues.filter((issue) => issue.severity !== 'good').map((issue) => issue.title),
		reportData: {
			url: result.canonicalUrl || result.url,
			knowledgeGraphScore: result.scores.knowledgeGraph,
			localSovScore: result.scores.geo,
			schemaTypes: result.detected?.types ?? [],
			jsonLdBlockCount: result.detected?.blockCount ?? 0,
			recommendations,
			summary: result.summary,
			prescriptionIssued: Boolean(result.jsonLdPretty),
		},
		requestedBy: requestedBy || 'Admin',
		userId: userId ?? null,
		userType: 'admin',
	};
}
