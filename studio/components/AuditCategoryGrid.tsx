import type { AuditCategory } from '@/lib/site-auditor';

const CATEGORY_ICON: Record<string, string> = {
	seo: '🔎',
	performance: '⚡',
	schema: '🧩',
	accessibility: '♿',
	geo: '🤖',
};

export function AuditCategoryGrid({ categories }: { categories: AuditCategory[] }) {
	return (
		<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
			{categories.map((category) => {
				const pass = category.status === 'PASS';
				const failCount = category.checks.filter((c) => (c.status ?? (c.passed ? 'pass' : 'fail')) === 'fail').length;
				const warnCount = category.checks.filter((c) => c.status === 'warning').length;
				return (
					<div
						key={category.id}
						className={`flex flex-col gap-2 rounded-xl border p-4 ${
							pass ? 'border-emerald-500/30 bg-emerald-500/[0.06]' : 'border-rose-500/30 bg-rose-500/[0.06]'
						}`}
					>
						<div className="flex items-center justify-between">
							<span className="text-xl">{CATEGORY_ICON[category.id] ?? '•'}</span>
							<span
								className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
									pass ? 'bg-emerald-500 text-black' : 'bg-rose-500 text-white'
								}`}
							>
								{pass ? 'Pass' : 'Fail'}
							</span>
						</div>
						<p className="text-sm font-bold text-white">{category.label}</p>
						<p className={`text-xs ${pass ? 'text-emerald-300' : 'text-rose-300'}`}>{category.statusNote}</p>
						<p className="mt-auto text-xs text-slate-500">
							{category.score}/{category.maxScore}
							{(failCount > 0 || warnCount > 0) && (
								<span className="ml-1 text-slate-600">
									· {failCount}F/{warnCount}W
								</span>
							)}
						</p>
					</div>
				);
			})}
		</div>
	);
}
