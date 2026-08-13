'use client';

import { useLocale, useTranslations } from 'next-intl';
import type { GeoNarrativeReport } from '@/lib/audit/geo-narrative';
import { resolveExternalReputation, type AiEngineExposure } from '@/lib/audit/geo-score';
import type { AuditReport } from '@/lib/site-auditor';

interface AiEngineExposurePanelProps {
	report: AuditReport;
	reportData?: GeoNarrativeReport | null;
}

function StarRow({ stars }: { stars: number }) {
	return (
		<span className="tracking-tight text-[#D4AF37]" aria-label={`${stars}/5`}>
			{'★'.repeat(stars)}
			<span className="text-white/15">{'★'.repeat(5 - stars)}</span>
		</span>
	);
}

function statusTone(stars: number): string {
	if (stars >= 4) return 'text-emerald-400';
	if (stars === 3) return 'text-amber-400';
	return 'text-rose-400';
}

function EngineCard({ engine }: { engine: AiEngineExposure }) {
	return (
		<div className="rounded-xl border border-white/[0.08] bg-black/20 p-4">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<p className="text-sm font-bold text-slate-100">{engine.engineLabel}</p>
				<StarRow stars={engine.stars} />
			</div>
			<p className={`mt-1 text-xs font-semibold ${statusTone(engine.stars)}`}>{engine.statusLabel}</p>
			<p className="mt-2 text-xs leading-relaxed text-slate-400">
				<span className="text-slate-500">└ </span>
				{engine.reason}
			</p>
		</div>
	);
}

export function AiEngineExposurePanel({ report, reportData }: AiEngineExposurePanelProps) {
	const t = useTranslations('audit.aiEngines');
	const locale = useLocale();
	const lang = locale === 'en' ? 'en' : 'ko';
	const { aiEngines } = resolveExternalReputation(report, reportData, lang);

	return (
		<section className="audit-report-section flex flex-col gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 sm:p-6">
			<div>
				<p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#D4AF37]">{t('subtitle')}</p>
				<h2 className="mt-1 text-lg font-extrabold text-white">{t('title')}</h2>
			</div>
			<div className="grid gap-3 sm:grid-cols-3">
				{aiEngines.map((engine) => (
					<EngineCard key={engine.engine} engine={engine} />
				))}
			</div>
		</section>
	);
}
