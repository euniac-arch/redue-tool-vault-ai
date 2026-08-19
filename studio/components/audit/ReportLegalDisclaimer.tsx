'use client';

import { useTranslations } from 'next-intl';

export function ReportLegalDisclaimer() {
	const t = useTranslations('audit.reportLegalDisclaimer');

	return (
		<div className="mt-8 space-y-1 rounded-xl border border-slate-800 bg-slate-950/80 p-4 text-[11px] leading-relaxed text-slate-500">
			<p className="break-keep">{t('line1')}</p>
			<p className="break-keep">{t('line2')}</p>
		</div>
	);
}
