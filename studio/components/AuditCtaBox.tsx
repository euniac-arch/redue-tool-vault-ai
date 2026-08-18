'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ExpertAgencyCta } from '@/components/audit/ExpertAgencyCta';
import { useAuditPayload } from '@/components/audit/AuditPayloadProvider';
import { businessConversionFromAudit } from '@/lib/audit/business-conversion';
import { resolveTargetBrandName } from '@/lib/audit/target-entity';
import type { AuditReport } from '@/lib/site-auditor';
import { buildSolveHref, stashSolvePayload } from '@/lib/solve/payload-bridge';

interface AuditCtaBoxProps {
	report?: AuditReport | null;
	auditId?: string | null;
}

/** Post-audit CTA focused on the precision diagnosis product — no WP inject pitch. */
export function AuditCtaBox({ report, auditId }: AuditCtaBoxProps) {
	const t = useTranslations('audit.cta');
	const { persistAudit } = useAuditPayload();

	function handleAdminSolveClick() {
		if (!report) return;
		// Soft session handoff; durable source is Firestore doc id in solveHref
		stashSolvePayload({
			auditId: auditId || null,
			report,
		});
		persistAudit(report, { auditId: auditId || null });
	}

	const solveHref = buildSolveHref(auditId);

	return (
		<div className="flex flex-col gap-4 rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-gradient-to-br from-white via-accent/10 to-cyan-50 dark:from-white/[0.04] dark:via-accent/10 dark:to-cyan-500/5 p-6">
			<div>
				<p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t('line1')}</p>
				<p className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
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
					className="rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-white/5 px-6 py-3 text-sm font-semibold text-slate-800 dark:text-slate-200 transition hover:bg-slate-50 dark:hover:bg-white/10"
				>
					{t('buttonRescan')}
				</Link>
			</div>

			{report ? (
				<div className="mt-1 flex w-full flex-col gap-4">
					<div className="flex w-full flex-col rounded-xl border border-amber-200 dark:border-amber-500/25 bg-amber-50 dark:bg-amber-500/10 p-4">
						<div className="min-w-0">
							<p className="text-sm font-semibold text-amber-800 dark:text-amber-100">{t('adminSolveTitle')}</p>
							<p className="mt-1 text-xs leading-relaxed text-amber-700 dark:text-amber-100/70">{t('adminSolveHint')}</p>
						</div>
						<div className="flex flex-col items-start gap-2 mt-3">
							<Link
								href={solveHref}
								onClick={handleAdminSolveClick}
								className="w-fit inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-slate-100 text-slate-900 transition hover:bg-white"
							>
								<span>{t('adminSolveButton')}</span>
								<span>{t('adminSolveButtonSub')}</span>
							</Link>
						</div>
					</div>
					<ExpertAgencyCta
						targetUrl={report.url}
						brandName={resolveTargetBrandName(report)}
						targetQuery={businessConversionFromAudit(report).targetQuery}
					/>
				</div>
			) : null}

			<p className="text-xs text-slate-500">{t('footnote')}</p>
		</div>
	);
}
