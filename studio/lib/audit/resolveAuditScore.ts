/**
 * Hydrate `ComprehensiveAuditScore` from a live/stored AuditReport or a
 * history row. Always goes through `buildOnPageDiagnostic` when a report is
 * present so HTTPS / llms.txt injection and checklist remaps stay identical
 * to the result-detail page.
 */

import {
	calculateComprehensiveAuditScore,
	calculateComprehensiveAuditScoreFromOnpage,
	storedStatusToCounts,
	type ComprehensiveAuditScore,
} from '@/lib/audit/auditScoreCalculator';
import { buildOnPageDiagnostic } from '@/lib/audit/onpage-diagnostic';
import { resolveIsHttps } from '@/lib/audit/scoreCalculator';
import type { AuditReport } from '@/lib/site-auditor';

type ReportLike = Pick<AuditReport, 'url' | 'hasSsl' | 'lang' | 'score' | 'maxScore' | 'categories' | 'checklist'> &
	Partial<Pick<AuditReport, 'siteMeta' | 'metrics' | 'collectedUrls'>>;

export interface HistoryScoreSource {
	score?: number;
	maxScore?: number;
	url?: string;
	categories?: Array<{
		id: string;
		label?: string;
		score: number;
		maxScore: number;
		status?: string;
	}>;
	report?: ReportLike | null;
}

export function resolveAuditScoreFromReport(report: ReportLike): ComprehensiveAuditScore {
	const onpage = buildOnPageDiagnostic(report);
	const lang = report.lang === 'en' ? 'en' : 'ko';
	const isHttps = resolveIsHttps({ url: report.url, hasSsl: report.hasSsl });
	return calculateComprehensiveAuditScoreFromOnpage(onpage, { isHttps, lang });
}

/**
 * History / localStorage replay. Prefer the stored report (same pipeline as
 * result detail). Fall back to persisted raw totals + category rows.
 */
export function resolveAuditScoreFromHistory(item: HistoryScoreSource): ComprehensiveAuditScore {
	if (item.report) {
		try {
			return resolveAuditScoreFromReport(item.report);
		} catch {
			// Fall through to lightweight fields.
		}
	}

	const lang = item.report?.lang === 'en' ? 'en' : 'ko';
	const isHttps = item.report
		? resolveIsHttps({ url: item.report.url, hasSsl: item.report.hasSsl })
		: item.url
			? resolveIsHttps({ url: item.url })
			: true;

	return calculateComprehensiveAuditScore({
		totalEarnedScore: item.score,
		totalMaxScore: item.maxScore,
		categoryList: item.categories?.map((cat) => {
			const counts = storedStatusToCounts(cat.status);
			return {
				id: cat.id,
				name: cat.label,
				score: cat.score,
				maxScore: cat.maxScore,
				defectCount: counts.defectCount,
				warningCount: counts.warningCount,
			};
		}),
		isHttps,
		lang,
	});
}
