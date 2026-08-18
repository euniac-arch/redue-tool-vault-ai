'use client';

import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { schemaCompletenessScore } from '@/lib/geo/precision-diagnostics';
import type { SchemaPropertyCheck, SchemaPropertyId } from '@/types/geo-diagnostic';

interface SchemaCompletenessChecklistProps {
	properties: readonly SchemaPropertyCheck[];
}

/** UI 노출 순서: 완비 항목(@type, sameAs)을 먼저, 누락 항목을 뒤에 배치. */
const SCHEMA_DISPLAY_ORDER: readonly SchemaPropertyId[] = [
	'entityType',
	'sameAs',
	'geoCoordinates',
	'openingHours',
	'hasOfferCatalog',
];

function schemaTone(percent: number): string {
	if (percent >= 90) return 'bg-emerald-500';
	if (percent >= 70) return 'bg-amber-500';
	return 'bg-rose-500';
}

/** 뱃지와 겹치는 상태 접미어를 제거해 상세 텍스트만 남긴다. */
function cleanSchemaDetail(detail: string): string {
	return detail
		.replace(
			/\s*[\(（](?:정상\s*\/\s*완비|누락\s*\/\s*보강 필요|complete\s*\/\s*OK|missing\s*\/\s*needs work)[\)）]\s*$/i,
			'',
		)
		.trim();
}

function orderSchemaProperties(properties: readonly SchemaPropertyCheck[]): SchemaPropertyCheck[] {
	return [...properties].sort((a, b) => {
		const ai = SCHEMA_DISPLAY_ORDER.indexOf(a.id);
		const bi = SCHEMA_DISPLAY_ORDER.indexOf(b.id);
		return (ai === -1 ? SCHEMA_DISPLAY_ORDER.length : ai) - (bi === -1 ? SCHEMA_DISPLAY_ORDER.length : bi);
	});
}

export function SchemaCompletenessChecklist({ properties }: SchemaCompletenessChecklistProps) {
	const t = useTranslations('audit.brandTrust.schema');
	if (!properties.length) return null;

	const { completeCount, total, percent } = schemaCompletenessScore(properties);
	const ordered = orderSchemaProperties(properties);

	return (
		<div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-white/[0.08] dark:bg-black/20 sm:p-5">
			<div className="flex flex-col gap-3 border-b border-slate-200 pb-3 dark:border-white/[0.08] sm:flex-row sm:items-center sm:justify-between">
				<div className="min-w-0">
					<p className="text-xs font-bold text-indigo-600 dark:text-indigo-400">{t('kicker')}</p>
					<h4 className="mt-0.5 flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
						<span aria-hidden>⚙️</span>
						<span>{t('scoreLabel')}</span>
					</h4>
					<p className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{t('subtitle')}</p>
				</div>
				<div className="shrink-0 self-start rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 font-sans text-xs font-black text-amber-700 dark:text-amber-400 sm:self-auto">
					{percent}% {t('scoreHint', { complete: completeCount, total })}
				</div>
			</div>

			<div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-white/[0.08]">
				<div
					className={`h-full rounded-full ${schemaTone(percent)}`}
					style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
				/>
			</div>

			<ul className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs">
				{ordered.map((item, index) => {
					const isLastOdd = ordered.length % 2 === 1 && index === ordered.length - 1;
					return (
						<li
							key={item.id}
							className={`flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-3 dark:border-white/[0.08] dark:bg-black/25 ${
								isLastOdd ? 'md:col-span-2' : ''
							}`}
						>
							<div className="min-w-0 space-y-0.5">
								<div className="flex items-center gap-1.5">
									{item.complete ? (
										<CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
									) : (
										<AlertTriangle className="h-3.5 w-3.5 shrink-0 text-rose-600 dark:text-rose-400" aria-hidden />
									)}
									<p className="font-mono font-bold text-slate-800 dark:text-slate-200">{item.label}</p>
								</div>
								<p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
									{cleanSchemaDetail(item.detail)}
								</p>
							</div>
							<span
								className={`shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-bold ${
									item.complete
										? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
										: 'border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-400'
								}`}
							>
								{item.complete ? t('complete') : t('needsWork')}
							</span>
						</li>
					);
				})}
			</ul>
		</div>
	);
}
