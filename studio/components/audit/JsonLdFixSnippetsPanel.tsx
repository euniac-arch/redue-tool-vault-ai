'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { AuditSectionAccordion } from '@/components/audit/AuditSectionAccordion';
import { buildJsonLdFixSnippets } from '@/lib/audit/jsonld-snippets';
import type { AuditReport } from '@/lib/site-auditor';

interface JsonLdFixSnippetsPanelProps {
	report: AuditReport;
}

function CopyButton({ code, copyLabel, copiedLabel }: { code: string; copyLabel: string; copiedLabel: string }) {
	const [copied, setCopied] = useState(false);

	async function handleCopy() {
		try {
			await navigator.clipboard.writeText(code);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch {
			/* clipboard unavailable — no-op */
		}
	}

	return (
		<button
			type="button"
			onClick={handleCopy}
			className="print:hidden shrink-0 rounded-lg border border-[#D4AF37]/40 bg-[#D4AF37]/10 px-3 py-1.5 text-xs font-bold text-[#D4AF37] transition hover:bg-[#D4AF37]/20"
		>
			{copied ? copiedLabel : copyLabel}
		</button>
	);
}

export function JsonLdFixSnippetsPanel({ report }: JsonLdFixSnippetsPanelProps) {
	const t = useTranslations('audit.jsonldSnippets');
	const toggleT = useTranslations('audit.sectionToggle');
	const locale = useLocale();
	const lang = locale === 'en' ? 'en' : 'ko';
	const snippets = buildJsonLdFixSnippets(report, lang);
	const [isReadyCodeOpen, setIsReadyCodeOpen] = useState(false);

	return (
		<AuditSectionAccordion
			id="sec-jsonld-code"
			panelId="sec-jsonld-code-panel"
			isOpen={isReadyCodeOpen}
			onToggle={() => setIsReadyCodeOpen((open) => !open)}
			collapseLabel={toggleT('collapse')}
			expandLabel={toggleT('expand')}
			className="pdf-page-item audit-report-section scroll-mt-24 flex flex-col rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.03] p-5 sm:p-6"
			header={
				<>
					<span className="block text-[11px] font-bold uppercase tracking-[0.18em] text-[#D4AF37]">{t('badge')}</span>
					<span className="mt-1 block text-lg font-extrabold text-slate-900 dark:text-white">{t('title')}</span>
					<p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{t('subtitle')}</p>
				</>
			}
		>
			{snippets.length === 0 ? (
				<div className="rounded-xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 px-4 py-5 text-sm text-emerald-700 dark:text-emerald-300">
					{t('empty')}
				</div>
			) : (
				<div className="flex flex-col gap-4">
					{snippets.map((snippet) => (
						<div key={snippet.id} className="rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-black/20 p-4">
							<div className="flex flex-wrap items-start justify-between gap-2">
								<div>
									<p className="text-sm font-bold text-slate-900 dark:text-slate-100">{snippet.title}</p>
									<p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">{snippet.description}</p>
								</div>
								<CopyButton code={snippet.code} copyLabel={t('copy')} copiedLabel={t('copied')} />
							</div>
							<pre className="mt-3 max-w-full overflow-x-auto whitespace-pre rounded-lg bg-slate-100 dark:bg-black/40 px-3 py-2.5 font-mono text-[11px] leading-relaxed text-cyan-800 dark:text-cyan-200/90">
								{snippet.code}
							</pre>
						</div>
					))}
				</div>
			)}
		</AuditSectionAccordion>
	);
}
