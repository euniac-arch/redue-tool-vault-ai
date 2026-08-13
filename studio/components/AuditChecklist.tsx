'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { AuditCheckItem, AuditCheckStatus } from '@/lib/site-auditor';

const STATUS_UI: Record<
	AuditCheckStatus,
	{ badge: string; border: string; labelKey: 'pass' | 'fail' | 'warning' }
> = {
	pass: { badge: 'bg-emerald-500 text-black', border: 'border-emerald-500/25', labelKey: 'pass' },
	fail: { badge: 'bg-rose-500 text-white', border: 'border-rose-500/30', labelKey: 'fail' },
	warning: { badge: 'bg-amber-500 text-black', border: 'border-amber-500/30', labelKey: 'warning' },
};

interface AuditChecklistProps {
	checks: AuditCheckItem[];
}

export function AuditChecklist({ checks }: AuditChecklistProps) {
	const t = useTranslations('audit.checklist');
	const [filter, setFilter] = useState<'all' | AuditCheckStatus>('all');

	const filtered = useMemo(() => {
		if (filter === 'all') return checks;
		return checks.filter((c) => (c.status ?? (c.passed ? 'pass' : 'fail')) === filter);
	}, [checks, filter]);

	const counts = useMemo(
		() => ({
			pass: checks.filter((c) => (c.status ?? (c.passed ? 'pass' : 'fail')) === 'pass').length,
			fail: checks.filter((c) => (c.status ?? (c.passed ? 'pass' : 'fail')) === 'fail').length,
			warning: checks.filter((c) => c.status === 'warning').length,
		}),
		[checks],
	);

	if (checks.length === 0) {
		return (
			<div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 text-sm text-slate-500">
				{t('empty')}
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-3">
			<div className="flex flex-wrap gap-2">
				{(
					[
						['all', t('filterAll', { count: checks.length })],
						['fail', t('filterFail', { count: counts.fail })],
						['warning', t('filterWarning', { count: counts.warning })],
						['pass', t('filterPass', { count: counts.pass })],
					] as const
				).map(([value, label]) => (
					<button
						key={value}
						type="button"
						onClick={() => setFilter(value)}
						className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
							filter === value
								? 'bg-accent text-white'
								: 'border border-white/[0.08] bg-white/5 text-slate-400 hover:text-white'
						}`}
					>
						{label}
					</button>
				))}
			</div>

			<ul className="flex flex-col gap-2">
				{filtered.map((item) => {
					const status = item.status ?? (item.passed ? 'pass' : 'fail');
					const ui = STATUS_UI[status] ?? STATUS_UI.fail;
					const hasDetail = Boolean(item.why || item.impact || item.evidence);

					return (
						<li key={item.id} className={`rounded-xl border bg-white/[0.03] ${ui.border}`}>
							<div className="flex w-full items-start gap-3 px-4 py-3 text-left">
								<span
									className={`mt-0.5 shrink-0 rounded-md px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${ui.badge}`}
								>
									{t(ui.labelKey)}
								</span>
								<div className="min-w-0 flex-1">
									<p className="text-sm font-semibold text-slate-100">{item.label}</p>
									{item.evidence && (
										<p className="mt-1 break-all font-mono text-[11px] text-slate-500">{item.evidence}</p>
									)}
								</div>
							</div>

							{hasDetail && (
								<div className="space-y-3 border-t border-white/[0.06] px-4 py-3 text-xs text-slate-400">
									{item.evidence && (
										<div>
											<p className="mb-1 font-bold uppercase tracking-wide text-slate-500">{t('evidence')}</p>
											<pre className="overflow-x-auto whitespace-pre-wrap rounded-lg bg-black/40 px-3 py-2 font-mono text-[11px] text-cyan-200/90">
												{item.evidence}
											</pre>
										</div>
									)}
									{item.why && (
										<div>
											<p className="mb-1 font-bold uppercase tracking-wide text-slate-500">{t('why')}</p>
											<p className="leading-relaxed text-slate-300">{item.why}</p>
										</div>
									)}
									{item.impact && (
										<div>
											<p className="mb-1 font-bold uppercase tracking-wide text-slate-500">{t('impact')}</p>
											<p className="leading-relaxed text-slate-300">{item.impact}</p>
										</div>
									)}
								</div>
							)}
						</li>
					);
				})}
			</ul>
		</div>
	);
}
