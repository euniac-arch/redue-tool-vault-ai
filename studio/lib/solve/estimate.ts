import type { SolveIssue } from './types';

export interface ClientEstimate {
	estimatedHours: number;
	totalEstimateKRW: number;
	issueCount: number;
	failCount: number;
}

/** Ported from inspector `calculateClientEstimate` in public/js/app.js */
export function calculateClientEstimate(issues: SolveIssue[] | undefined, hourlyRate = 50000): ClientEstimate {
	const actionable = (issues || []).filter((i) => i.severity !== 'PASS');
	const totalMinutes = actionable.reduce((sum, i) => sum + (i.estMinutes || 15), 0);
	const estimatedHours = Math.round((totalMinutes / 60) * 10) / 10;
	const totalEstimateKRW = Math.round(estimatedHours * hourlyRate);
	return {
		estimatedHours,
		totalEstimateKRW,
		issueCount: actionable.length,
		failCount: actionable.filter((i) => i.severity === 'FAIL').length,
	};
}

export function formatKrw(amount: number): string {
	return `₩${amount.toLocaleString('ko-KR')}`;
}
