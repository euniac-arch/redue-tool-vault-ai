import { Sparkles } from 'lucide-react';
import type { PortalHubTip } from '@/lib/admin/portal-hub/types';

interface OptimizationTipsProps {
	title?: string;
	tips: PortalHubTip[];
}

export function OptimizationTips({ title = '최적화 가이드', tips }: OptimizationTipsProps) {
	return (
		<section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
			<h3 className="flex items-center gap-1.5 text-sm font-bold text-slate-900 dark:text-slate-100">
				<Sparkles className="h-4 w-4 text-amber-500" />
				{title}
			</h3>
			<ul className="mt-3 flex flex-col gap-2.5">
				{tips.map((tip) => (
					<li key={tip.title} className="rounded-lg bg-slate-50 px-3 py-2.5 dark:bg-slate-900/40">
						<p className="text-xs font-bold text-slate-800 dark:text-slate-100">{tip.title}</p>
						<p className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{tip.detail}</p>
					</li>
				))}
			</ul>
		</section>
	);
}
