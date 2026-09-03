/**
 * Scheduler hook. Agent cron calls this.
 * Due job → remesasure same query panel → store → compare → alert.
 * Empty queue is a no-op. One provider failure does not fail the job.
 */
import { runAsiVisibility } from '@/lib/ai-search-intelligence/visibility/run';
import { dueVisibilityJobs, markVisibilityJobRun, readVisibilityPanel } from '@/lib/ai-search-intelligence/visibility/schedule';
import type { AsiVisibilityRemeasureComparison } from '@/lib/ai-search-intelligence/types';

export type AsiVisibilityTickResult = {
	ran: number;
	skipped: number;
	domains: string[];
	comparisons: AsiVisibilityRemeasureComparison[];
};

export async function runDueAsiVisibilityJobs(now = new Date()): Promise<AsiVisibilityTickResult> {
	const due = dueVisibilityJobs(now);
	let ran = 0;
	let skipped = 0;
	const domains: string[] = [];
	const comparisons: AsiVisibilityRemeasureComparison[] = [];
	for (const job of due) {
		const snapshot = await runAsiVisibility({
			url: job.url,
			queries: readVisibilityPanel(job.domain),
			remeasure: true,
		});
		if (!snapshot || snapshot.reused) {
			skipped += 1;
			continue;
		}
		markVisibilityJobRun(job.domain, now);
		ran += 1;
		domains.push(job.domain);
		if (snapshot.comparison) comparisons.push(snapshot.comparison);
	}
	return { ran, skipped, domains, comparisons };
}
