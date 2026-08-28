'use client';

import { useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { UrlAuditForm } from '@/components/landing/UrlAuditForm';
import { AuditHistoryWorkbench } from '@/components/audit/AuditHistoryWorkbench';
import { PageSubTabs } from '@/components/nav/PageSubTabs';
import {
	INDUSTRY_PRESET_STORAGE_KEY,
	buildAuditEngineHref,
	parseIndustryPreset,
} from '@/lib/audit/industry-preset';

type EngineTab = 'live' | 'history';

const KICKER =
	'inline-flex w-fit items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-cyan-700 dark:border-[#1f3a5a] dark:bg-[#0b1726] dark:text-[#4fd1d9]';
const GRADIENT_TEXT = 'bg-gradient-to-r from-[#5565C7] to-[#0C9AA7] bg-clip-text text-transparent';

export function AuditEnginePageClient() {
	const t = useTranslations('audit.engine');
	const locale = useLocale();
	const lang = locale === 'en' ? 'en' : 'ko';
	const searchParams = useSearchParams();
	const tab: EngineTab = searchParams.get('tab') === 'history' ? 'history' : 'live';
	const preset = useMemo(() => parseIndustryPreset(searchParams.get('industry')), [searchParams]);

	useEffect(() => {
		if (!preset) return;
		try {
			sessionStorage.setItem(INDUSTRY_PRESET_STORAGE_KEY, preset.slug);
		} catch {
			/* ignore quota / private mode */
		}
	}, [preset]);

	const extraQuery = useMemo(() => (preset ? { industry: preset.slug } : undefined), [preset]);

	const title = t('title');
	const titleParts = title.trim().split(/\s+/);
	const titleLead = titleParts.length > 1 ? titleParts.slice(0, -1).join(' ') : '';
	const titleAccent = titleParts.length > 1 ? titleParts[titleParts.length - 1] : title;

	return (
		<main className="flex flex-col gap-8">
			<header className="flex flex-col gap-4">
				<span className={KICKER}>
					<span className="h-1.5 w-1.5 rounded-full bg-gradient-to-r from-[#5565C7] to-[#0C9AA7]" aria-hidden />
					{t('kicker')}
				</span>
				<h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
					{titleLead ? (
						<>
							{titleLead} <span className={GRADIENT_TEXT}>{titleAccent}</span>
						</>
					) : (
						<span className={GRADIENT_TEXT}>{titleAccent}</span>
					)}
				</h1>
				<p className="max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-300/80">
					{t('description')}
				</p>
			</header>

			<PageSubTabs
				tone="navy"
				ariaLabel={t('tabsAria')}
				activeId={tab}
				tabs={[
					{ id: 'live', href: buildAuditEngineHref({ industry: preset?.slug }), label: t('liveTab') },
					{ id: 'history', href: buildAuditEngineHref({ tab: 'history', industry: preset?.slug }), label: t('historyTab') },
				]}
			/>

			{tab === 'history' ? (
				<AuditHistoryWorkbench compact />
			) : (
				<section className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-xl backdrop-blur-md dark:border-slate-800/80 dark:bg-[#0c1425]/90 sm:p-8">
					<div className="relative">
						{preset ? (
							<div className="mb-4 inline-flex flex-wrap items-center gap-2 rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500 dark:border-slate-700/50 dark:bg-slate-800/80 dark:text-slate-300">
								<span className="font-mono text-[10px] font-bold uppercase tracking-wide">{preset.code}</span>
								<span>{t('presetApplied', { industry: preset.label[lang] })}</span>
							</div>
						) : null}
						<UrlAuditForm extraQuery={extraQuery} variant="engine" />
					</div>
				</section>
			)}
		</main>
	);
}
