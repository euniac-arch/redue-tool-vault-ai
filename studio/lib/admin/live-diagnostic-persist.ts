import {
	addDiagnostic,
	findLatestDiagnosticByDomain,
	updateDiagnostic,
	type DiagnosticDocInput,
} from '@/lib/firebase/diagnostics';
import { isFirebaseAdminConfigured } from '@/lib/firebase/admin';
import { scoreToStatus, type DiagnosticCategory, type DiagnosticRecommendation } from './diagnostic-management';
import type { LiveDiagnosticIndustry, LiveDiagnosticResult } from './liveDiagnosticTypes';

const INDUSTRY_TO_CATEGORY: Record<LiveDiagnosticIndustry, DiagnosticCategory> = {
	medical: 'Medical',
	veterinary: 'Pet',
	ecommerce: 'Commerce',
	corporate: 'Corporate',
};

export function liveResultToDiagnosticInput(
	result: LiveDiagnosticResult,
	requestedBy: string,
	userId?: string | null,
): DiagnosticDocInput {
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

export async function persistLiveDiagnosticResult(
	result: LiveDiagnosticResult,
	opts: { requestedBy: string; userId?: string | null },
): Promise<{ id: string }> {
	if (!isFirebaseAdminConfigured()) {
		throw new Error('Firebase가 설정되지 않아 진단 이력을 저장할 수 없습니다.');
	}
	const payload = liveResultToDiagnosticInput(result, opts.requestedBy, opts.userId);
	const latest = await findLatestDiagnosticByDomain(result.domain);
	if (latest) {
		await updateDiagnostic(latest.id, payload, { refreshCreatedAt: true });
		return { id: latest.id };
	}
	return addDiagnostic(payload);
}
