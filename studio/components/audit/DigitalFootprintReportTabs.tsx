'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { GeoNarrativeReport } from '@/lib/audit/geo-narrative';
import { resolveExternalReputation } from '@/lib/audit/geo-score';
import type { AuditReport } from '@/lib/site-auditor';

export type DfTabId = 'df-google' | 'df-naver' | 'df-bing';

interface DigitalFootprintReportTabsProps {
	report: AuditReport;
	reportData?: GeoNarrativeReport | null;
	activeTab?: DfTabId;
	onTabChange?: (tabId: DfTabId) => void;
}

const STATUS_BOX: Record<'warning' | 'danger' | 'ok', string> = {
	warning: 'border-amber-400/30 bg-amber-500/[0.08] text-amber-100',
	danger: 'border-rose-400/30 bg-rose-500/[0.08] text-rose-100',
	ok: 'border-emerald-400/30 bg-emerald-500/[0.08] text-emerald-100',
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
	const { digitalFootprint } = resolveExternalReputation(report, reportData, lang);
	const [internalActiveTab, setInternalActiveTab] = useState<DfTabId>('df-google');
	const activeTab = controlledActiveTab ?? internalActiveTab;

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
	const bingRegistered = digitalFootprint.bingPlacesRegistered;
	const googleBelowAvg = googleCount < googleAvg;
	const naverIssue = Boolean(digitalFootprint.naverMentionIssue) || naverCount < 20;
	const bingStatusText = bingRegistered ? t('bingRegistered') : t('bingNotRegistered');

	const tabs: Array<{ id: DfTabId; label: string }> = [
		{ id: 'df-google', label: t('tabGoogle', { count: googleCount }) },
		{ id: 'df-naver', label: t('tabNaver', { count: naverCount }) },
		{ id: 'df-bing', label: t('tabBing', { status: bingStatusText }) },
	];

	return (
		<section className="digital-footprint-report audit-report-section flex flex-col gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 sm:p-6">
			<nav className="df-tab-nav print:hidden grid w-full grid-cols-1 gap-2 sm:grid-cols-3" role="tablist" aria-label={t('navLabel')}>
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
									? 'active border-cyan-400/60 bg-cyan-500/15 text-white'
									: 'border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/20 hover:bg-white/[0.07] hover:text-slate-200'
							}`}
						>
							{tab.label}
						</button>
					);
				})}
			</nav>

			{/* Google */}
			<div
				id="df-google"
				role="tabpanel"
				className={`df-tab-content flex flex-col gap-4 ${
					activeTab === 'df-google' ? 'active' : 'hidden print:flex print:flex-col'
				}`}
			>
				<div className={`df-status-box rounded-xl border px-4 py-3 ${STATUS_BOX[googleBelowAvg ? 'warning' : 'ok']}`}>
					<strong className="block text-sm font-extrabold">
						{googleBelowAvg
							? t('google.statusWarning', { count: googleCount, avg: googleAvg })
							: t('google.statusOk', { count: googleCount, avg: googleAvg })}
					</strong>
					<p className="mt-2 text-xs leading-relaxed text-slate-300">
						{googleBelowAvg ? t('google.statusBodyWarn') : t('google.statusBodyOk')}
					</p>
				</div>
				<div className="df-solution-title text-sm font-extrabold text-slate-100">{t('howtoTitle')}</div>
				<ul className="df-solution-list flex list-disc flex-col gap-2 pl-5 text-xs leading-relaxed text-slate-300">
					<li>
						<strong className="text-slate-100">{t('google.howto1Title')}</strong> {t('google.howto1Body')}
					</li>
					<li>
						<strong className="text-slate-100">{t('google.howto2Title')}</strong> {t('google.howto2Body')}
					</li>
					<li>
						<strong className="text-slate-100">{t('google.howto3Title')}</strong> {t('google.howto3Body')}
					</li>
				</ul>
			</div>

			{/* Naver */}
			<div
				id="df-naver"
				role="tabpanel"
				className={`df-tab-content flex flex-col gap-4 ${
					activeTab === 'df-naver' ? 'active' : 'hidden print:flex print:flex-col'
				}`}
			>
				<div className={`df-status-box rounded-xl border px-4 py-3 ${STATUS_BOX[naverIssue ? 'danger' : 'ok']}`}>
					<strong className="block text-sm font-extrabold">
						{naverIssue
							? t('naver.statusDanger', { count: naverCount })
							: t('naver.statusOk', { count: naverCount })}
					</strong>
					<p className="mt-2 text-xs leading-relaxed text-slate-300">
						{naverIssue
							? t.rich('naver.statusBodyWarn', {
									strong: (chunks) => <strong className="text-slate-100">{chunks}</strong>,
								})
							: t('naver.statusBodyOk')}
					</p>
				</div>
				<div className="df-solution-title text-sm font-extrabold text-slate-100">{t('howtoTitle')}</div>
				<ul className="df-solution-list flex list-disc flex-col gap-2 pl-5 text-xs leading-relaxed text-slate-300">
					<li>
						<strong className="text-slate-100">{t('naver.howto1Title')}</strong> {t('naver.howto1Body')}
					</li>
					<li>
						<strong className="text-slate-100">{t('naver.howto2Title')}</strong> {t('naver.howto2Body')}
					</li>
					<li>
						<strong className="text-slate-100">{t('naver.howto3Title')}</strong> {t('naver.howto3Body')}
					</li>
				</ul>
			</div>

			{/* Bing Places */}
			<div
				id="df-bing"
				role="tabpanel"
				className={`df-tab-content flex flex-col gap-4 ${
					activeTab === 'df-bing' ? 'active' : 'hidden print:flex print:flex-col'
				}`}
			>
				<div
					className={`df-status-box rounded-xl border px-4 py-3 ${STATUS_BOX[bingRegistered ? 'ok' : 'danger']}`}
				>
					<strong className="block text-sm font-extrabold">
						{bingRegistered ? t('bing.statusOk') : t('bing.statusDanger')}
					</strong>
					<p className="mt-2 text-xs leading-relaxed text-slate-300">
						{bingRegistered ? t('bing.statusBodyOk') : t('bing.statusBodyWarn')}
					</p>
				</div>
				<div className="df-solution-title text-sm font-extrabold text-slate-100">{t('howtoTitle')}</div>
				<ul className="df-solution-list flex list-disc flex-col gap-2 pl-5 text-xs leading-relaxed text-slate-300">
					<li>
						<strong className="text-slate-100">{t('bing.howto1Title')}</strong> {t('bing.howto1Body')}
					</li>
					<li>
						<strong className="text-slate-100">{t('bing.howto2Title')}</strong> {t('bing.howto2Body')}
					</li>
					<li>
						<strong className="text-slate-100">{t('bing.howto3Title')}</strong> {t('bing.howto3Body')}
					</li>
				</ul>
			</div>
		</section>
	);
}
