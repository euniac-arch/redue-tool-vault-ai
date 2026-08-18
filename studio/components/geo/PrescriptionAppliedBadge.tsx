'use client';

import { CheckCircle2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

/** Shown next to after-prescription section titles so scroll position stays obvious. */
export function PrescriptionAppliedBadge() {
	const t = useTranslations('audit.aiEngineCards');

	return (
		<span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-extrabold text-emerald-800 ring-1 ring-emerald-400/40 dark:bg-emerald-500/15 dark:text-emerald-200 dark:ring-emerald-400/35">
			<CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
			{t('appliedStatusBadge')}
		</span>
	);
}
