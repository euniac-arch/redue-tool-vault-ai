'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useResolvedReputation } from '@/components/audit/AuditDataContext';
import type { GeoNarrativeReport } from '@/lib/audit/geo-narrative';
import { MOUNT_AUDIT_RESULT_TABS_EVENT } from '@/lib/audit/scroll-to-category';
import type { AuditReport } from '@/lib/site-auditor';

export type DfTabId = 'df-google' | 'df-naver' | 'df-total';

interface DigitalFootprintReportTabsProps {
	report: AuditReport;
	reportData?: GeoNarrativeReport | null;
	activeTab?: DfTabId;
	onTabChange?: (tabId: DfTabId) => void;
}

const STATUS_BOX: Record<'warning' | 'danger' | 'ok', string> = {
	warning: 'border-amber-200 dark:border-amber-400/30 bg-amber-50 dark:bg-amber-500/[0.08] text-amber-800 dark:text-amber-100',
	danger: 'border-rose-200 dark:border-rose-400/30 bg-rose-50 dark:bg-rose-500/[0.08] text-rose-800 dark:text-rose-100',
	ok: 'border-emerald-200 dark:border-emerald-400/30 bg-emerald-50 dark:bg-emerald-500/[0.08] text-emerald-800 dark:text-emerald-100',
};

export function DigitalFootprintReportTabs({
	report,
	reportData,
	activeTab: controlledActiveTab,
	onTabChange,
}: DigitalFootprintReportTabsProps) {
	const t = useTranslations('audit.digitalFootprintReport');
	const locale = useLocale();
	const lang = locale === 'en' ? 'en' : 'ko';
	const reputation = useResolvedReputation(report, reportData, lang);
	const digitalFootprint = reputation?.digitalFootprint;
	const [internalActiveTab, setInternalActiveTab] = useState<DfTabId>('df-google');
	const [printMounted, setPrintMounted] = useState(false);
	const activeTab = controlledActiveTab ?? internalActiveTab;

	useEffect(() => {
		const mount = () => setPrintMounted(true);
		window.addEventListener('beforeprint', mount);
		window.addEventListener(MOUNT_AUDIT_RESULT_TABS_EVENT, mount);
		return () => {
			window.removeEventListener('beforeprint', mount);
			window.removeEventListener(MOUNT_AUDIT_RESULT_TABS_EVENT, mount);
		};
	}, []);

	if (!digitalFootprint) return null;

	const switchDfTab = (tabId: DfTabId) => {
		if (onTabChange) {
			onTabChange(tabId);
		} else {
			setInternalActiveTab(tabId);
		}
	};

	const googleCount = digitalFootprint.googleMentionCount;
	const googleAvg = digitalFootprint.googleMentionBenchmark;
	const naverCount = digitalFootprint.naverMentionCount;
	const totalCount = googleCount + naverCount;
	const googleBelowAvg = googleCount < googleAvg;
	const naverIssue = Boolean(digitalFootprint.naverMentionIssue) || naverCount < 20;
	const howto = digitalFootprint.howtoGuides;

	const googleHowto = howto?.google?.length
		? howto.google
		: [
				{ title: t('google.howto1Title'), body: t('google.howto1Body') },
				{ title: t('google.howto2Title'), body: t('google.howto2Body') },
				{ title: t('google.howto3Title'), body: t('google.howto3Body') },
			];
	const showGoogle = printMounted || activeTab === 'df-google';
	const showNaver = printMounted || activeTab === 'df-naver';
	const showTotal = printMounted || activeTab === 'df-total';

	const tabs: Array<{ id: DfTabId; label: string }> = [
		{ id: 'df-google', label: t('tabGoogle', { count: googleCount }) },
		{ id: 'df-naver', label: t('tabNaver', { count: naverCount }) },
		{ id: 'df-total', label: t('tabTotal', { count: totalCount }) },
	];

	return (
		<section className="digital-footprint-report pdf-page-item audit-report-section flex flex-col gap-4 rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.03] p-5 sm:p-6">
			<nav className="df-tab-nav print:hidden pdf-screen-only grid w-full grid-cols-1 gap-2 sm:grid-cols-3" role="tablist" aria-label={t('navLabel')}>
				{tabs.map((tab) => {
					const isActive = activeTab === tab.id;
					return (
						<button
							key={tab.id}
							type="button"
							role="tab"
							data-target={tab.id}
							aria-selected={isActive}
							onClick={() => switchDfTab(tab.id)}
							className={`df-tab-link flex w-full items-center justify-center rounded-xl border px-3 py-3 text-center text-xs font-extrabold transition sm:text-sm ${
								isActive
									? 'active border-cyan-400/60 bg-cyan-50 dark:bg-cyan-500/15 text-cyan-800 dark:text-white'
									: 'border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.03] text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-white/20 hover:bg-slate-50 dark:hover:bg-white/[0.07] hover:text-slate-800 dark:hover:text-slate-200'
							}`}
						>
							{tab.label}
						</button>
					);
				})}
			</nav>

			<div
				id="df-google"
				role="tabpanel"
				className={`df-tab-content audit-result-tab-panel flex flex-col gap-4 ${
					activeTab === 'df-google' ? 'is-active active' : ''
				}`}
			>
				{showGoogle ? (
					<>
				<div className={`df-status-box rounded-xl border px-4 py-3 ${STATUS_BOX[googleBelowAvg ? 'warning' : 'ok']}`}>
					<strong className="block text-sm font-extrabold">
						{googleBelowAvg
							? t('google.statusWarning', { count: googleCount, avg: googleAvg })
							: t('google.statusOk', { count: googleCount, avg: googleAvg })}
					</strong>
					<p className="mt-2 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
						{googleBelowAvg ? t('google.statusBodyWarn') : t('google.statusBodyOk')}
					</p>
				</div>
				<div className="df-solution-title text-sm font-extrabold text-slate-900 dark:text-slate-100">{t('howtoTitle')}</div>
				<ul className="df-solution-list flex list-disc flex-col gap-2 pl-5 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
					{googleHowto.map((step) => (
						<li key={step.title}>
							<strong className="text-slate-900 dark:text-slate-100">{step.title}</strong> {step.body}
						</li>
					))}
				</ul>
					</>
				) : null}
			</div>

			<div
				id="df-naver"
				role="tabpanel"
				className={`df-tab-content audit-result-tab-panel flex flex-col gap-4 ${
					activeTab === 'df-naver' ? 'is-active active' : ''
				}`}
			>
				{showNaver ? (
					<>
				<div className={`df-status-box rounded-xl border px-4 py-3 ${STATUS_BOX[naverIssue ? 'danger' : 'ok']}`}>
					<strong className="block text-sm font-extrabold">
						{naverIssue
							? t('naver.statusDanger', { count: naverCount })
							: t('naver.statusOk', { count: naverCount })}
					</strong>
					<p className="mt-2 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
						{naverIssue
							? t.rich('naver.statusBodyWarn', {
									strong: (chunks) => <strong className="text-slate-900 dark:text-slate-100">{chunks}</strong>,
								})
							: t('naver.statusBodyOk')}
					</p>
				</div>
				<div className="df-solution-title text-sm font-extrabold text-slate-900 dark:text-slate-100">{t('howtoTitle')}</div>
				<ul className="df-solution-list flex list-disc flex-col gap-2 pl-5 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
					{(howto?.naver?.length
						? howto.naver
						: [
								{ title: t('naver.howto1Title'), body: t('naver.howto1Body') },
								{ title: t('naver.howto2Title'), body: t('naver.howto2Body') },
								{ title: t('naver.howto3Title'), body: t('naver.howto3Body') },
							]
					).map((step) => (
						<li key={step.title}>
							<strong className="text-slate-900 dark:text-slate-100">{step.title}</strong> {step.body}
						</li>
					))}
				</ul>
					</>
				) : null}
			</div>

			<div
				id="df-total"
				role="tabpanel"
				className={`df-tab-content audit-result-tab-panel flex flex-col gap-4 ${
					activeTab === 'df-total' ? 'is-active active' : ''
				}`}
			>
				{showTotal ? (
					<>
				<div className={`df-status-box rounded-xl border px-4 py-3 ${STATUS_BOX[googleBelowAvg ? 'warning' : 'ok']}`}>
					<strong className="block text-sm font-extrabold">
						{googleBelowAvg
							? t('total.statusWarning', { count: googleCount, avg: googleAvg, total: totalCount })
							: t('total.statusOk', { count: googleCount, avg: googleAvg, total: totalCount })}
					</strong>
					<p className="mt-2 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
						{googleBelowAvg ? t('google.statusBodyWarn') : t('google.statusBodyOk')}
					</p>
				</div>
				<div className="df-solution-title text-sm font-extrabold text-slate-900 dark:text-slate-100">{t('howtoTitle')}</div>
				<ul className="df-solution-list flex list-disc flex-col gap-2 pl-5 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
					{googleHowto.map((step) => (
						<li key={step.title}>
							<strong className="text-slate-900 dark:text-slate-100">{step.title}</strong> {step.body}
						</li>
					))}
				</ul>
					</>
				) : null}
			</div>
		</section>
	);
}
