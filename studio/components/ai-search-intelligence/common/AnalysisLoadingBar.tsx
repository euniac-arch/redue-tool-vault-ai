export function AnalysisLoadingBar({ className = '' }: { className?: string }) {
	return (
		<div className={`h-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800 ${className}`.trim()}>
			<div className="asi-loading-bar h-full w-1/3 rounded-full bg-gradient-to-r from-cyan-500 via-violet-500 to-cyan-400" />
		</div>
	);
}

export function IndeterminateTimer({
	seconds,
	label,
}: {
	seconds: number;
	label?: string;
}) {
	const time = Math.max(0, seconds).toFixed(1);
	return (
		<p className="text-xs font-semibold tabular-nums text-cyan-700 dark:text-cyan-300">
			{label ? `${label} (${time}s)` : `${time}s`}
		</p>
	);
}
