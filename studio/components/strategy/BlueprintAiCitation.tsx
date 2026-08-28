'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { StrategyCopyButton } from '@/components/strategy/StrategyCopyButton';
import { META_LABEL, MODULE_TITLE, STUDIO_MODULE } from '@/components/strategy/strategy-ui';
import type {
	BlueprintDecisionMatrix,
	BlueprintInformationGain,
	BlueprintLlmsTxt,
	BlueprintRagChunk,
	BlueprintSafetySignals,
} from '@/lib/strategy/types';

function downloadTextFile(filename: string, content: string) {
	const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = filename;
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
	URL.revokeObjectURL(url);
}

export function BlueprintRagChunks({ chunks }: { chunks: BlueprintRagChunk[] }) {
	const t = useTranslations('strategyStudio');
	return (
		<div>
			<p className={MODULE_TITLE}>{t('blueprintRagTitle')}</p>
			<p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-slate-500">{t('blueprintRagHint')}</p>
			<ol className="mt-6 space-y-4">
				{chunks.map((chunk, index) => (
					<li key={chunk.id} className={STUDIO_MODULE}>
						<div className="flex flex-wrap items-center justify-between gap-3">
							<div>
								<p className={META_LABEL}>
									{String(index + 1).padStart(2, '0')} {chunk.title}
								</p>
								<p className="mt-1 font-mono text-[11px] tracking-wide text-slate-400">
									{t('blueprintTokenEstimate', { count: chunk.tokenEstimate })}
								</p>
							</div>
							<StrategyCopyButton text={chunk.text} />
						</div>
						<p className="mt-4 whitespace-pre-wrap break-keep text-[15px] leading-7 text-slate-800 dark:text-slate-100">{chunk.text}</p>
					</li>
				))}
			</ol>
		</div>
	);
}

export function BlueprintDecisionMatrixPanel({ matrix }: { matrix: BlueprintDecisionMatrix }) {
	const t = useTranslations('strategyStudio');
	const hasDowntime = matrix.columns.length >= 5 && matrix.rows.some((row) => Boolean(row.downtime));
	const headers = hasDowntime ? matrix.columns : matrix.columns.slice(0, 4);
	const cells = (row: (typeof matrix.rows)[number]) => {
		const base = [row.type, row.recommended, row.device, row.caution];
		return hasDowntime ? [...base, row.downtime || '—'] : base;
	};

	return (
		<div>
			<p className={MODULE_TITLE}>{t('blueprintMatrixTitle')}</p>
			<p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-slate-500">{matrix.caption}</p>
			<div className="mt-4 flex flex-wrap gap-2">
				<StrategyCopyButton text={matrix.markdown} label={t('blueprintCopyMarkdown')} />
				<StrategyCopyButton text={matrix.html} label={t('blueprintCopyHtml')} />
			</div>
			<div className="mt-6 overflow-x-auto border border-slate-200/90 dark:border-white/10">
				<table className="min-w-full border-collapse text-left text-[13px]">
					<caption className="sr-only">{matrix.title}</caption>
					<thead>
						<tr className="border-b border-slate-200/90 dark:border-white/10">
							{headers.map((header) => (
								<th key={header} scope="col" className={`${META_LABEL} px-3 py-3 font-semibold`}>
									{header}
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{matrix.rows.map((row) => (
							<tr key={row.type} className="border-b border-slate-200/70 last:border-0 dark:border-white/10">
								{cells(row).map((cell, index) => (
									<td
										key={`${row.type}-${headers[index]}`}
										className={`px-3 py-3 align-top leading-6 text-slate-800 dark:text-slate-100 ${index === 0 ? 'font-semibold' : ''}`}
									>
										{cell}
									</td>
								))}
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}

export function BlueprintInformationGainPanel({ gain }: { gain: BlueprintInformationGain }) {
	const t = useTranslations('strategyStudio');
	return (
		<div>
			<p className={MODULE_TITLE}>{t('blueprintGainTitle')}</p>
			<p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-slate-500">{gain.caption}</p>
			<div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
				{gain.items.map((item) => (
					<div key={item.id} className="border border-slate-200/90 px-4 py-4 dark:border-white/10">
						<p className={META_LABEL}>{item.label}</p>
						<p className="mt-2 text-[28px] font-semibold tracking-tight text-slate-900 dark:text-white">
							{item.value}
							{item.unit ? <span className="ml-1 text-[13px] font-medium text-slate-500">{item.unit}</span> : null}
						</p>
						{item.note ? <p className="mt-2 text-[12px] leading-5 text-slate-500">{item.note}</p> : null}
					</div>
				))}
			</div>
		</div>
	);
}

export function BlueprintSafetySignalsPanel({ safety }: { safety: BlueprintSafetySignals }) {
	const t = useTranslations('strategyStudio');
	return (
		<div>
			<p className={MODULE_TITLE}>{t('blueprintSafetyTitle')}</p>
			<p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-slate-500">{t('blueprintSafetyHint')}</p>
			<div className="mt-6 border border-slate-200/90 px-5 py-5 dark:border-white/10">
				<div className="flex items-start justify-between gap-3">
					<p className="text-[16px] font-semibold text-slate-900 dark:text-white">{safety.heading}</p>
					<StrategyCopyButton text={[safety.heading, ...safety.notRecommended.map((item) => `- ${item}`)].join('\n')} />
				</div>
				<ul className="mt-4 space-y-2">
					{safety.notRecommended.map((item) => (
						<li key={item} className="text-[14px] leading-6 text-slate-700 dark:text-slate-200">
							<span className="mr-2 font-mono text-[12px] text-slate-400">—</span>
							{item}
						</li>
					))}
				</ul>
			</div>
			<div className="mt-6 grid gap-6 md:grid-cols-2">
				<div>
					<p className={META_LABEL}>{t('blueprintSideEffects')}</p>
					<ul className="mt-3 space-y-2">
						{safety.sideEffects.map((item) => (
							<li key={item} className="text-[14px] text-slate-700 dark:text-slate-200">
								{item}
							</li>
						))}
					</ul>
				</div>
				<div>
					<p className={META_LABEL}>{t('blueprintContraindications')}</p>
					<ul className="mt-3 space-y-2">
						{safety.contraindications.map((item) => (
							<li key={item} className="text-[14px] text-slate-700 dark:text-slate-200">
								{item}
							</li>
						))}
					</ul>
				</div>
			</div>
			<p className="mt-6 text-[12px] leading-6 text-slate-500">{safety.disclaimer}</p>
		</div>
	);
}

export function BlueprintLlmsTxtExport({ llms }: { llms: BlueprintLlmsTxt }) {
	const t = useTranslations('strategyStudio');
	const [downloaded, setDownloaded] = useState(false);

	function handleDownload() {
		downloadTextFile(llms.filename, llms.markdown);
		setDownloaded(true);
		window.setTimeout(() => setDownloaded(false), 1500);
	}

	return (
		<div>
			<p className={MODULE_TITLE}>{t('blueprintLlmsTitle')}</p>
			<p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-slate-500">{t('blueprintLlmsHint', { path: llms.deployPath })}</p>
			<div className="mt-4 flex flex-wrap gap-2">
				<StrategyCopyButton text={llms.markdown} label={t('blueprintCopyAll')} />
				<button
					type="button"
					onClick={handleDownload}
					className="rounded-md border border-slate-300 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-slate-600 transition hover:border-slate-900 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/50 dark:border-white/20 dark:text-slate-300 dark:hover:border-white dark:hover:text-white"
				>
					{downloaded ? t('blueprintDownloaded') : t('blueprintDownloadLlms')}
				</button>
			</div>
			<pre className="mt-6 max-h-[28rem] overflow-auto border border-slate-200/90 bg-slate-50/80 p-4 font-mono text-[12px] leading-6 text-slate-800 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-100">
				{llms.markdown}
			</pre>
		</div>
	);
}
