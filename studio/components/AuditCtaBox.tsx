'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';

/** Post-audit CTA focused on the precision diagnosis product — no WP inject pitch. */
export function AuditCtaBox() {
	const t = useTranslations('audit.cta');

	return (
		<div className="flex flex-col gap-4 rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] via-accent/10 to-cyan-500/5 p-6">
			<div>
				<p className="text-sm font-semibold text-slate-300">{t('line1')}</p>
				<p className="mt-1 text-lg font-bold text-white">
					{t('line2Pre')} <span className="text-accent-light">{t('line2Highlight')}</span> {t('line2Post')}
				</p>
			</div>
			<div className="flex flex-wrap gap-2">
				<Link
					href="/audit/history"
					className="rounded-xl bg-accent px-6 py-3 text-sm font-bold text-white shadow-lg shadow-accent/30 transition hover:bg-accent-light"
				>
					{t('buttonHistory')}
				</Link>
				<Link
					href="/"
					className="rounded-xl border border-white/[0.08] bg-white/5 px-6 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
				>
					{t('buttonRescan')}
				</Link>
			</div>
			<p className="text-xs text-slate-500">{t('footnote')}</p>
		</div>
	);
}
