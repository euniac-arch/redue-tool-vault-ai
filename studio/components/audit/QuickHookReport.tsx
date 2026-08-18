'use client';

import { useLocale } from 'next-intl';
import { businessImpactCopy } from '@/lib/audit/business-impact-copy';
import type { DiagnosticItem, QuickHookReportProps, SeverityLevel } from '@/types/quick-hook-report';

const SEVERITY_BADGE: Record<SeverityLevel, string> = {
	critical: 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-400/30',
	major: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-500/20 dark:text-amber-200 dark:border-amber-400/30',
	warning: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-400/30',
	info: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-400/30',
};

function emphasizePhrase(text: string, phrase: string | undefined, className: string) {
	if (!phrase) return text;
	const idx = text.indexOf(phrase);
	if (idx < 0) return text;
	return (
		<>
			{text.slice(0, idx)}
			<strong className={className}>{phrase}</strong>
			{text.slice(idx + phrase.length)}
		</>
	);
}

function DiagnosticRow({ item }: { item: DiagnosticItem }) {
	const locale = useLocale();
	const copy = businessImpactCopy(locale);
	const emphasisClass =
		item.severity === 'critical' ? 'text-rose-600 font-semibold dark:text-rose-400' : 'text-slate-900 font-semibold dark:text-white';

	return (
		<tr className="transition-colors hover:bg-slate-50/50 dark:hover:bg-white/[0.03]">
			<td className="px-4 py-3.5 align-top">
				<div className="mb-1 flex items-center gap-1.5">
					<span
						className={`rounded border px-2 py-0.5 text-[11px] font-extrabold ${SEVERITY_BADGE[item.severity]}`}
					>
						{copy.severity[item.severity]}
					</span>
				</div>
				<span className="text-sm font-bold text-slate-900 dark:text-slate-100">{item.title}</span>
			</td>
			<td className="px-4 py-3.5 align-top leading-relaxed text-slate-700 dark:text-slate-300">
				{emphasizePhrase(item.businessLoss, item.lossEmphasis, emphasisClass)}
			</td>
			<td className="px-4 py-3.5 align-top font-mono text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
				{item.technicalCause}
			</td>
			<td className="bg-emerald-50/30 px-4 py-3.5 align-top font-medium leading-relaxed text-slate-800 dark:bg-emerald-500/[0.07] dark:text-slate-200">
				<span className="font-bold text-emerald-600 dark:text-emerald-400">✓</span> {item.prescriptionEffect}
			</td>
		</tr>
	);
}

export function QuickHookReport({ diagnostics }: QuickHookReportProps) {
	const locale = useLocale();
	const copy = businessImpactCopy(locale);

	if (diagnostics.length === 0) {
		return (
			<p className="rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3 text-sm text-slate-500 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-400">
				{copy.empty}
			</p>
		);
	}

	return (
		<div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-white/10">
			<table className="w-full min-w-[40rem] border-collapse text-left text-xs">
				<thead>
					<tr className="border-b border-slate-200 bg-slate-50/80 font-bold text-slate-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-400">
						<th className="w-[22%] px-4 py-3">{copy.columns.impact}</th>
						<th className="w-[28%] px-4 py-3 text-rose-700 dark:text-rose-400">{copy.columns.loss}</th>
						<th className="w-[25%] px-4 py-3 text-slate-600 dark:text-slate-400">{copy.columns.cause}</th>
						<th className="w-[25%] px-4 py-3 text-emerald-700 dark:text-emerald-400">{copy.columns.rx}</th>
					</tr>
				</thead>
				<tbody className="divide-y divide-slate-100 dark:divide-white/10">
					{diagnostics.map((item) => (
						<DiagnosticRow key={item.id} item={item} />
					))}
				</tbody>
			</table>
		</div>
	);
}
