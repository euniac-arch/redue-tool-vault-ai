import { AnalysisLoadingBar, IndeterminateTimer } from '@/components/ai-search-intelligence/common/AnalysisLoadingBar';

export function diagnosticStepMessage(
	elapsedSeconds: number,
	copy: { parse: string; estimate: string; wait: string },
): string {
	if (elapsedSeconds < 2) return copy.parse;
	if (elapsedSeconds < 6) return copy.estimate;
	return copy.wait;
}

export function DiagnosticStepBanner({
	elapsedSeconds,
	parse,
	estimate,
	wait,
}: {
	elapsedSeconds: number;
	parse: string;
	estimate: string;
	wait: string;
}) {
	return (
		<div className="flex flex-col gap-1.5" aria-live="polite">
			<AnalysisLoadingBar />
			<div className="flex flex-wrap items-center justify-between gap-2">
				<p className="text-xs font-semibold text-cyan-700 dark:text-cyan-300">
					{diagnosticStepMessage(elapsedSeconds, { parse, estimate, wait })}
				</p>
				<IndeterminateTimer seconds={elapsedSeconds} />
			</div>
		</div>
	);
}
