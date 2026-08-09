import type { DiagnosticCheck } from '@/lib/types';

interface ChecklistProps {
	checks: DiagnosticCheck[];
}

export function Checklist({ checks }: ChecklistProps) {
	return (
		<ul className="flex flex-col gap-2">
			{checks.map((check) => (
				<li
					key={check.id}
					className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm ${
						check.passed ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-300' : 'border-rose-500/20 bg-rose-500/5 text-rose-300'
					}`}
				>
					<span className="flex items-center gap-2">
						<span aria-hidden>{check.passed ? '✅' : '❌'}</span>
						{check.label}
					</span>
					<span className="text-xs text-slate-400">{check.weight}점</span>
				</li>
			))}
		</ul>
	);
}
