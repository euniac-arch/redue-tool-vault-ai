import { useTranslations } from 'next-intl';
import type { AuditFinding } from '@/lib/site-auditor';

export function AuditFindingsList({ findings }: { findings: AuditFinding[] }) {
	const t = useTranslations('audit');

	if (findings.length === 0) {
		return (
			<div className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.06] p-4 text-sm text-emerald-300">
				{t('findingsEmpty')}
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-3">
			{findings.map((finding, index) => (
				<div key={`${finding.checkId ?? finding.title}-${index}`} className="flex gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
					<span
						className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
							finding.severity === 'critical' ? 'bg-rose-500 text-white' : 'bg-amber-500 text-black'
						}`}
					>
						{index + 1}
					</span>
					<div>
						<p className="text-sm font-bold text-white">
							{finding.severity === 'critical' ? '❌ ' : '⚠️ '}
							{finding.title}
						</p>
						<p className="mt-1 text-xs leading-relaxed text-slate-400">{finding.detail}</p>
					</div>
				</div>
			))}
		</div>
	);
}
