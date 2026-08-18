'use client';

import { useTranslations } from 'next-intl';
import { EntityIdentificationGauge } from '@/components/audit/EntityIdentificationGauge';
import { GeoMeasuredCardHeader } from '@/components/audit/GeoMeasuredCardHeader';
import { SchemaCompletenessChecklist } from '@/components/geo/SchemaCompletenessChecklist';
import type { EntityDisambiguationResult } from '@/lib/audit/advancedGeoMetrics';
import type { IndustryConfig } from '@/lib/registry/universalIndustryRegistry';
import type { SchemaPropertyCheck } from '@/types/geo-diagnostic';

export interface EeatAndEntityDisambiguationSectionProps {
	entity: EntityDisambiguationResult;
	industry: Pick<IndustryConfig, 'defaultCategory'> | null;
	personName: string;
	personJobTitle: string;
	recommendedSchema: string;
	industryCategory: string;
	keywords: readonly string[];
	missingKeyword?: string | null;
	schemaProperties: readonly SchemaPropertyCheck[];
}

function EeatActionGuideCard() {
	const t = useTranslations('audit.brandTrust');

	return (
		<div className="flex h-full flex-col justify-between space-y-2 rounded-xl border border-indigo-500/30 bg-indigo-950/60 p-4">
			<div className="flex items-center justify-between gap-2">
				<span className="flex items-center gap-1.5 text-xs font-bold text-indigo-300">
					<span aria-hidden>💡</span>
					<span>{t('actionGuideTitle')}</span>
				</span>
				<span className="rounded border border-indigo-500/30 bg-indigo-500/20 px-2 py-0.5 text-[10px] font-extrabold text-indigo-300">
					{t('actionGuideBadge')}
				</span>
			</div>
			<p className="break-keep pt-1 text-xs leading-relaxed text-slate-300">{t('actionGuideBody')}</p>
			<div className="flex items-center gap-1 font-mono text-[11px] text-indigo-400">
				<span aria-hidden>➔</span>
				<span>{t('actionGuideHint')}</span>
			</div>
		</div>
	);
}

function EntityMetadataBars({
	personName,
	personJobTitle,
	recommendedSchema,
	industryCategory,
	keywords,
	missingKeyword,
}: Pick<
	EeatAndEntityDisambiguationSectionProps,
	'personName' | 'personJobTitle' | 'recommendedSchema' | 'industryCategory' | 'keywords' | 'missingKeyword'
>) {
	const t = useTranslations('audit.brandTrust');

	return (
		<div className="grid grid-cols-1 gap-3 pt-1 sm:grid-cols-3">
			<div className="space-y-1 rounded-xl border border-slate-200 bg-white/80 px-3.5 py-3.5 dark:border-white/[0.08] dark:bg-black/25">
				<div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{t('personLabel')}</div>
				<div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-white">
					<span>{personName}</span>
					{personJobTitle ? (
						<span className="rounded border border-indigo-500/30 bg-indigo-500/20 px-1.5 py-0.5 text-[10px] font-extrabold text-indigo-700 dark:text-indigo-300">
							{personJobTitle}
						</span>
					) : null}
				</div>
				<p className="truncate text-[10px] leading-tight text-slate-500">{t('personHint')}</p>
			</div>

			<div className="space-y-1 rounded-xl border border-slate-200 bg-white/80 px-3.5 py-3.5 dark:border-white/[0.08] dark:bg-black/25">
				<div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{t('recommendedSchema')}</div>
				<div className="font-mono text-xs font-bold text-indigo-700 dark:text-indigo-300">{recommendedSchema}</div>
				<p className="text-[10px] leading-tight text-slate-500">
					{t('recommendedSchemaHint', { category: industryCategory })}
				</p>
			</div>

			<div className="space-y-1 rounded-xl border border-slate-200 bg-white/80 px-3.5 py-3.5 dark:border-white/[0.08] dark:bg-black/25">
				<div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{t('keywordsLabel')}</div>
				<div className="flex flex-wrap gap-1">
					{keywords.map((kw) => (
						<span
							key={kw}
							className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[10px] text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
						>
							#{kw}
						</span>
					))}
					{missingKeyword ? (
						<span className="rounded border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
							{t('missingKeywordLabel')} &lsquo;{missingKeyword}&rsquo;
						</span>
					) : null}
				</div>
			</div>
		</div>
	);
}

export function EeatAndEntityDisambiguationSection({
	entity,
	industry,
	personName,
	personJobTitle,
	recommendedSchema,
	industryCategory,
	keywords,
	missingKeyword,
	schemaProperties,
}: EeatAndEntityDisambiguationSectionProps) {
	const t = useTranslations('audit.brandTrust');

	return (
		<div className="space-y-6">
			{/* 1. 상단: AI 브랜드 인식 & E-E-A-T (2열 2x2 그리드) */}
			<div className="space-y-1">
				<GeoMeasuredCardHeader
					pillarId="entity"
					columns={2}
					evidenceWrap
					trailingItem={<EeatActionGuideCard />}
					title={<h2 className="text-lg font-extrabold text-slate-900 dark:text-white">{t('title')}</h2>}
					subtitle={<p className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{t('subtitle')}</p>}
				/>
			</div>

			{/* 2. 중단: Entity Disambiguation (4대 지표 · With/Without · 메타데이터 3종) */}
			<EntityIdentificationGauge entity={entity} industryConfig={industry}>
				<EntityMetadataBars
					personName={personName}
					personJobTitle={personJobTitle}
					recommendedSchema={recommendedSchema}
					industryCategory={industryCategory}
					keywords={keywords}
					missingKeyword={missingKeyword}
				/>
			</EntityIdentificationGauge>

			{/* 3. 하단: LLM 구조화 데이터 충실도 (온페이지 JSON-LD 5항목 2열) */}
			<SchemaCompletenessChecklist properties={schemaProperties} />
		</div>
	);
}
