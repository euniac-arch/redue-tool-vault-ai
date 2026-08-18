'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { FreeAuditHero } from '@/components/FreeAuditHero';
import { GEOGuideHighlightCard } from '@/components/GEOGuideHighlightCard';
import { GEOGuideModal } from '@/components/GEOGuideModal';
import { AuditProcessFlow } from '@/components/landing/AuditProcessFlow';
import { ClosingCta } from '@/components/landing/ClosingCta';
import { ResultPreviewCard } from '@/components/landing/ResultPreviewCard';
import { scrollToAuditForm } from '@/components/landing/scroll-to-audit';
import { WhyDiagnose } from '@/components/landing/WhyDiagnose';
import { WhyGeoCards } from '@/components/landing/WhyGeoCards';

const ENGINE_PILLARS = [
	{ key: 'meta' as const, emoji: '🔍' },
	{ key: 'schema' as const, emoji: '🧩' },
	{ key: 'geo' as const, emoji: '🤖' },
];

/**
 * Landing: hero CTA → guidebook highlight → why diagnose → outcome cards → process → engine → preview → close.
 */
export default function DashboardPage() {
	const t = useTranslations('dashboard');
	const [isGuideModalOpen, setIsGuideModalOpen] = useState(false);

	return (
		<main className="flex flex-col gap-10 sm:gap-12">
			<div className="flex flex-col gap-4">
				<FreeAuditHero />
				<GEOGuideHighlightCard onOpen={() => setIsGuideModalOpen(true)} />
			</div>

			<WhyDiagnose />

			<section>
				<WhyGeoCards />
			</section>

			<AuditProcessFlow />

			<section className="rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.03] p-6 sm:p-8">
				<p className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300/90">{t('engineBadge')}</p>
				<h2 className="mt-2 text-xl font-extrabold text-slate-900 dark:text-white sm:text-2xl">{t('engineTitle')}</h2>
				<p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">{t('engineDescription')}</p>
				<ul className="mt-5 grid gap-3 sm:grid-cols-3">
					{ENGINE_PILLARS.map(({ key, emoji }) => (
						<li key={key} className="rounded-xl border border-slate-200 dark:border-white/[0.06] bg-slate-50 dark:bg-black/20 px-4 py-3">
							<p className="text-sm font-bold text-slate-900 dark:text-slate-100">
								{emoji} {t(`enginePillars.${key}.title`)}
							</p>
							<p className="mt-1 text-xs leading-relaxed text-slate-500">{t(`enginePillars.${key}.body`)}</p>
						</li>
					))}
				</ul>
				<div className="mt-6 flex flex-wrap gap-2">
					<Link
						href="/audit/history"
						className="rounded-xl bg-accent px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-accent/20 transition hover:bg-accent-light"
					>
						{t('engineHistoryCta')}
					</Link>
				</div>
			</section>

			<ResultPreviewCard />

			<ClosingCta />

			<GEOGuideModal
				open={isGuideModalOpen}
				onClose={() => setIsGuideModalOpen(false)}
				onStartDiagnose={() => {
					setIsGuideModalOpen(false);
					scrollToAuditForm();
				}}
			/>
		</main>
	);
}
