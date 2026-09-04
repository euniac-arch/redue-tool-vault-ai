'use client';

import { useTranslations } from 'next-intl';

export function ReportLegalDisclaimer() {
	const t = useTranslations('audit.reportLegalDisclaimer');

	return (
		<div className="mt-8 space-y-1 rounded-xl border border-slate-200 bg-slate-50 p-4 text-[11px] leading-relaxed text-slate-500 dark:border-slate-800 dark:bg-slate-950/80 dark:text-slate-400">
			<p className="break-keep">{t('line1')}</p>
			<p className="break-keep">{t('line2')}</p>
		</div>
	);
}
