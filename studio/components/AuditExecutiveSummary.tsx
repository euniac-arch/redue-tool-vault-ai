'use client';

import { useTranslations } from 'next-intl';
import type { AuditCheckItem, AuditReport } from '@/lib/site-auditor';

function defectCount(checks: AuditCheckItem[]): { fail: number; warning: number } {
	return {
		fail: checks.filter((c) => (c.status ?? (c.passed ? 'pass' : 'fail')) === 'fail').length,
		warning: checks.filter((c) => c.status === 'warning').length,
	};
}

interface AuditExecutiveSummaryProps {
	report: AuditReport;
}

export function AuditExecutiveSummary({ report }: AuditExecutiveSummaryProps) {
	const t = useTranslations('audit.b2b');
	const checks = report.checklist?.length ? report.checklist : report.categories.flatMap((c) => c.checks);
	const { fail, warning } = defectCount(checks);
	const geo = report.geoCitationScore ?? 0;
	const schema = report.schemaCoverage ?? 0;
	const pct = report.maxScore > 0 ? Math.round((report.score / report.maxScore) * 100) : 0;

	const losses = [
		t('loss.ai'),
		t('loss.ctr'),
		t('loss.eeat'),
		geo < 40 ? t('loss.geoCritical') : t('loss.geoWarn'),
	];

	return (
		<section className="audit-report-section overflow-hidden rounded-2xl border border-[#C9A227]/25 bg-gradient-to-br from-[#0B1C2C] via-[#102338] to-[#0C0D0E]">
			<div className="border-b border-[#C9A227]/20 px-5 py-4 sm:px-6">
				<p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#D4AF37]">{t('execBadge')}</p>
				<h2 className="mt-1 text-xl font-extrabold text-white sm:text-2xl">{t('execTitle')}</h2>
				<p className="mt-1 text-sm text-slate-400">{t('execSubtitle')}</p>
			</div>

			<div className="grid gap-3 p-5 sm:grid-cols-3 sm:p-6">
				<div className="rounded-xl border border-white/10 bg-black/25 p-4">
					<p className="text-[10px] uppercase tracking-wide text-slate-500">{t('metricScore')}</p>
					<p className="mt-1 text-3xl font-extrabold tabular-nums text-white">
						{report.score.toFixed(1)}
						<span className="text-base font-semibold text-slate-500"> / {report.maxScore}</span>
					</p>
					<p className="mt-1 text-xs text-[#D4AF37]">{report.statusLabel} · {pct}%</p>
				</div>
				<div className="rounded-xl border border-white/10 bg-black/25 p-4">
					<p className="text-[10px] uppercase tracking-wide text-slate-500">{t('metricGeo')}</p>
					<p
						className={`mt-1 text-3xl font-extrabold tabular-nums ${
							geo >= 70 ? 'text-emerald-400' : geo >= 40 ? 'text-amber-400' : 'text-rose-400'
						}`}
					>
						{geo}
					</p>
					<p className="mt-1 text-xs text-slate-500">{t('metricGeoHint')}</p>
				</div>
				<div className="rounded-xl border border-white/10 bg-black/25 p-4">
					<p className="text-[10px] uppercase tracking-wide text-slate-500">{t('metricDefects')}</p>
					<p className="mt-1 text-3xl font-extrabold tabular-nums text-rose-400">{fail + warning}</p>
					<p className="mt-1 text-xs text-slate-500">
						{t('metricDefectsHint', { fail, warning })} · {t('metricSchema', { schema })}
					</p>
				</div>
			</div>

			<div className="border-t border-white/[0.06] px-5 py-5 sm:px-6">
				<p className="text-sm font-bold text-[#D4AF37]">{t('lossTitle')}</p>
				<ul className="mt-3 space-y-2">
					{losses.map((item) => (
						<li key={item} className="flex gap-2 text-sm leading-relaxed text-slate-300">
							<span className="mt-0.5 shrink-0 text-rose-400">▸</span>
							<span>{item}</span>
						</li>
					))}
				</ul>
			</div>
		</section>
	);
}
