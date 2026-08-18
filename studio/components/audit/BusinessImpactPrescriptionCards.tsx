'use client';

import { useMemo } from 'react';
import { useLocale } from 'next-intl';
import { QuickHookReport } from '@/components/audit/QuickHookReport';
import { businessImpactCopy, businessImpactHeading } from '@/lib/audit/business-impact-copy';
import {
	buildBusinessImpactCards,
	toSeverityLevel,
	type BusinessImpactOverrides,
} from '@/lib/audit/business-impact-cards';
import type { GeoNarrativeReport } from '@/lib/audit/geo-narrative';
import type { IndustryConfig } from '@/lib/registry/universalIndustryRegistry';
import type { AuditReport } from '@/lib/site-auditor';
import type { DiagnosticItem } from '@/types/quick-hook-report';

export interface BusinessImpactPrescriptionCardsProps {
	report: AuditReport;
	reportData?: GeoNarrativeReport | null;
	/** Client brief overrides — hospital name, region, specialty keyword. */
	impactContext?: BusinessImpactOverrides | null;
	/** Optional pre-resolved registry snapshot. Live site data is used when omitted. */
	industryConfig?: IndustryConfig | null;
}

export function BusinessImpactPrescriptionCards({
	report,
	reportData,
	impactContext,
}: BusinessImpactPrescriptionCardsProps) {
	const locale = useLocale();
	const lang = locale === 'en' ? 'en' : 'ko';
	const copy = businessImpactCopy(lang);

	const model = useMemo(
		() => buildBusinessImpactCards(report, reportData, lang, impactContext),
		[report, reportData, lang, impactContext],
	);

	const diagnostics = useMemo<DiagnosticItem[]>(
		() =>
			model.cards.map((card) => {
				const cardCopy = copy.cards[card.id];
				return {
					id: card.id,
					severity: toSeverityLevel(card.severity, card.tone),
					title: cardCopy.title,
					businessLoss: cardCopy.loss[card.tone],
					lossEmphasis: cardCopy.lossEmphasis[card.tone],
					technicalCause: cardCopy.cause[card.tone],
					prescriptionEffect: cardCopy.rx[card.tone],
				};
			}),
		[model.cards, copy],
	);

	return (
		<section
			id="sec-business-hook"
			aria-labelledby="business-impact-heading"
		>
			<div className="mb-4">
				<h3 id="business-impact-heading" className="text-lg font-extrabold text-slate-900 dark:text-white">
					{businessImpactHeading(lang)}
				</h3>
				<p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{copy.subtitle}</p>
			</div>

			<QuickHookReport diagnostics={diagnostics} />
		</section>
	);
}
