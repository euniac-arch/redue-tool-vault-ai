'use client';

import { useTranslations } from 'next-intl';
import { useOptionalAuditData } from '@/components/audit/AuditDataContext';
import { GeoPillarScoreBadge } from '@/components/audit/GeoPillarScoreBadge';
import { GeoWeightCaption } from '@/components/audit/GeoWeightCaption';
import {
	GEO_SCHEMA_ANCHOR_ID,
	type GeoPillarId,
	type GeoPillarScore,
} from '@/lib/audit/geoScoreCalculator';
import { scrollToGeoPillar } from '@/lib/audit/scroll-to-geo-pillar';
import { schemaCompletenessScore } from '@/lib/geo/precision-diagnostics';

type FiveDomainId = GeoPillarId | 'schema';

interface FiveDomainCard {
	id: FiveDomainId;
	name: string;
	description: string;
	icon: string;
	targetAnchorId: string;
	percentage: number;
	pillar?: GeoPillarScore;
	schemaScore?: { percent: number; completeCount: number; total: number };
}

function barTone(percentage: number, allPassed?: boolean): string {
	if (allPassed && percentage >= 80) return 'bg-emerald-500';
	if (percentage < 50) return 'bg-rose-500';
	return 'bg-amber-500';
}

function schemaCompactTone(percent: number, completeCount: number, total: number): string {
	if (completeCount === total && percent >= 80) {
		return 'bg-emerald-50 text-emerald-800 ring-emerald-300/80 dark:bg-emerald-500/15 dark:text-emerald-200 dark:ring-emerald-400/35';
	}
	if (percent < 50) {
		return 'bg-rose-50 text-rose-800 ring-rose-300/80 dark:bg-rose-500/15 dark:text-rose-200 dark:ring-rose-400/35';
	}
	return 'bg-amber-50 text-amber-900 ring-amber-300/80 dark:bg-amber-500/15 dark:text-amber-200 dark:ring-amber-400/35';
}

function DomainAxisCard({ domain }: { domain: FiveDomainCard }) {
	const t = useTranslations('audit.geoScore');
	const schema = domain.schemaScore;
	const pillar = domain.pillar;
	const allPassed = pillar ? pillar.items.every((item) => item.passed) : schema ? schema.completeCount === schema.total : false;

	return (
		<button
			type="button"
			data-geo-pillar-axis={domain.id}
			onClick={() => scrollToGeoPillar(domain.targetAnchorId)}
			aria-label={t('pillarJump', { name: domain.name })}
			className="group flex h-full flex-col justify-between rounded-xl border border-indigo-200/70 bg-white/80 p-4 text-left shadow-sm transition hover:border-indigo-400 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 dark:border-indigo-400/20 dark:bg-white/[0.04] dark:hover:border-indigo-300/50 print:pointer-events-none"
		>
			<div className="mb-2.5 flex items-start justify-between gap-2">
				<div
					className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200/80 bg-slate-100 text-lg transition-transform group-hover:scale-110 dark:border-slate-700/60 dark:bg-slate-800/80"
					aria-hidden
				>
					{domain.icon}
				</div>
				{pillar ? (
					<GeoPillarScoreBadge pillar={pillar} size="sm" />
				) : schema ? (
					<span className="inline-flex shrink-0 flex-col">
						<span className={`inline-flex items-baseline gap-0.5 rounded-full px-2.5 py-1 text-[10px] font-extrabold tabular-nums ring-1 ${schemaCompactTone(schema.percent, schema.completeCount, schema.total)}`}>
							<span>{schema.percent}%</span>
							<span className="font-semibold opacity-70">
								({schema.completeCount}/{schema.total})
							</span>
						</span>
						<GeoWeightCaption score={schema.completeCount} maxScore={schema.total} />
					</span>
				) : null}
			</div>

			<div className="my-1 flex-1 space-y-1.5">
				<p className="text-sm font-extrabold tracking-tight text-slate-800 transition-colors group-hover:text-indigo-600 dark:text-white dark:group-hover:text-indigo-300">
					{domain.name}
				</p>
				<p className="break-keep text-[12px] leading-relaxed text-slate-500 dark:text-slate-400">
					{domain.description}
				</p>
			</div>

			<div className="mt-2 border-t border-slate-200/70 pt-3 dark:border-slate-800/60">
				<div className="mb-2 h-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
					<div
						className={`h-full rounded-full transition-all duration-500 ${barTone(domain.percentage, allPassed)}`}
						style={{ width: `${domain.percentage}%` }}
					/>
				</div>
				<span className="flex items-center justify-between text-[10px] font-bold text-slate-500 transition-colors group-hover:text-indigo-600 dark:text-slate-400 dark:group-hover:text-indigo-300">
					<span>{t('pillarJumpHint')}</span>
					<span className="transition-transform group-hover:translate-x-0.5" aria-hidden>
						↗
					</span>
				</span>
			</div>
		</button>
	);
}

export function GeoPillarScoreTable() {
	const tBrand = useTranslations('audit.brandTrust');
	const tSchema = useTranslations('audit.brandTrust.schema');
	const tNap = useTranslations('audit.geoNap');
	const tFoot = useTranslations('audit.digitalFootprint');
	const tLlms = useTranslations('audit.advancedGeo.llms');
	const snapshot = useOptionalAuditData()?.snapshot;
	const pillarList = snapshot?.geoComprehensive.pillarList;
	if (!pillarList?.length) return null;

	const pillars = Object.fromEntries(pillarList.map((pillar) => [pillar.id, pillar])) as Partial<
		Record<GeoPillarId, GeoPillarScore>
	>;
	if (!pillars.entity || !pillars.local_nap || !pillars.rag_authority || !pillars.bot_index) return null;
	const schema = schemaCompletenessScore(snapshot?.reputation.brandTrust.schemaProperties ?? []);

	const domains: FiveDomainCard[] = [
		{
			id: 'entity',
			name: tBrand('title'),
			description: pillars.entity.description,
			icon: pillars.entity.icon,
			targetAnchorId: pillars.entity.targetAnchorId,
			percentage: pillars.entity.percentage,
			pillar: pillars.entity,
		},
		{
			id: 'schema',
			name: tSchema('scoreLabel'),
			description: tSchema('subtitle'),
			icon: '⚙️',
			targetAnchorId: GEO_SCHEMA_ANCHOR_ID,
			percentage: schema.percent,
			schemaScore: schema,
		},
		{
			id: 'local_nap',
			name: tNap('title'),
			description: pillars.local_nap.description,
			icon: pillars.local_nap.icon,
			targetAnchorId: pillars.local_nap.targetAnchorId,
			percentage: pillars.local_nap.percentage,
			pillar: pillars.local_nap,
		},
		{
			id: 'rag_authority',
			name: tFoot('title'),
			description: pillars.rag_authority.description,
			icon: pillars.rag_authority.icon,
			targetAnchorId: pillars.rag_authority.targetAnchorId,
			percentage: pillars.rag_authority.percentage,
			pillar: pillars.rag_authority,
		},
		{
			id: 'bot_index',
			name: tLlms('title'),
			description: pillars.bot_index.description,
			icon: pillars.bot_index.icon,
			targetAnchorId: pillars.bot_index.targetAnchorId,
			percentage: pillars.bot_index.percentage,
			pillar: pillars.bot_index,
		},
	];

	return (
		<div className="relative grid grid-cols-1 items-stretch gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
			{domains.map((domain) => (
				<DomainAxisCard key={domain.id} domain={domain} />
			))}
		</div>
	);
}
