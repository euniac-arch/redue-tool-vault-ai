'use client';

import { useEffect, useMemo, useState, type RefObject } from 'react';
import { ArrowUp } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { DEFAULT_AUDIT_RESULT_TAB, type AuditResultTabId } from '@/components/audit/AuditResultTabs';
import { FloatingTabIndicator } from '@/components/audit/FloatingTabIndicator';
import { useContentSideRailLeft } from '@/lib/use-content-side-rail';

export const AUDIT_TOP_ID = 'audit-top';

export type AuditScrollspySectionId =
	| 'two-track-diagnosis'
	| 'ai-sov-gap'
	| 'geo-score-summary'
	| 'ai-engine-status'
	| 'trigger-keyword-depth'
	| 'eeat-brand-trust'
	| 'geo-section-entity'
	| 'geo-section-bot'
	| 'geo-section-nap'
	| 'geo-section-authority'
	| 'digital-footprint'
	| 'action-plan-85'
	| 'technical-score-summary'
	| 'schema-structured-data'
	| 'cwv-score-summary'
	| 'pagespeed-vitals'
	| 'technical-evidence-jsonld'
	| 'rag-fact-density'
	| 'live-criteria-report'
	| 'ai-search-simulator'
	| 'detailed-checklist-22'
	| 'keyword-pipeline'
	| 'sec-business-hook'
	| 'exposure-simulator'
	| 'ai-timeline-forecast'
	| 'consulting-section'
	| 'official-validation-tools';

type NavItem = { id: AuditScrollspySectionId; label: string };


interface AuditScrollspyNavProps {
	/** Main content shell — used to pin the rail to the content's right edge (xl+). */
	contentRef?: RefObject<HTMLElement | null>;
	/** 1번 탭(geo) / 2번 탭(onpage) — 목차 배열을 전환한다. */
	activeTab?: AuditResultTabId;
	/** Floating tab switcher — keeps the rail in sync with the main tab bar. */
	onTabChange?: (tab: AuditResultTabId) => void;
	/** Re-bind IntersectionObserver when the report tab changes. */
	observeKey?: string | number;
}

function isElementVisible(el: HTMLElement): boolean {
	if (el.closest('.hidden')) return false;
	const style = window.getComputedStyle(el);
	return style.display !== 'none' && style.visibility !== 'hidden';
}

function defaultSectionForTab(activeTab: AuditResultTabId): AuditScrollspySectionId {
	if (activeTab === 'onpage') return 'technical-score-summary';
	if (activeTab === 'cwv') return 'cwv-score-summary';
	return 'ai-sov-gap';
}

function pickActiveSection(items: NavItem[]): AuditScrollspySectionId | null {
	const mid = window.innerHeight * 0.32;
	let nearest: AuditScrollspySectionId | null = null;
	let nearestDist = Number.POSITIVE_INFINITY;

	for (const { id } of items) {
		const el = document.getElementById(id);
		if (!el || !isElementVisible(el)) continue;
		const rect = el.getBoundingClientRect();
		if (rect.height <= 0) continue;
		const anchor = Math.min(Math.max(rect.top, mid - rect.height * 0.15), rect.bottom);
		const dist = Math.abs(anchor - mid);
		if (rect.top <= mid + 120 && dist < nearestDist) {
			nearestDist = dist;
			nearest = id;
		}
	}
	return nearest;
}

export function AuditScrollspyNav({
	contentRef,
	activeTab = DEFAULT_AUDIT_RESULT_TAB,
	onTabChange,
	observeKey,
}: AuditScrollspyNavProps) {
	const t = useTranslations('audit.scrollspy');
	const [activeId, setActiveId] = useState<AuditScrollspySectionId>(
		defaultSectionForTab(activeTab),
	);

	useEffect(() => {
		setActiveId(defaultSectionForTab(activeTab));
	}, [activeTab]);
	/** gap -34 ≈ content right − 34px. minRailWidth covers the left-anchored tab card growing right. */
	const { left, isXl } = useContentSideRailLeft(contentRef, -34, 220);

	const preTabNavItems = useMemo<NavItem[]>(
		() => [{ id: 'two-track-diagnosis', label: t('twoTrackDiagnosis') }],
		[t],
	);

	/** Track 2 · GEO / citation panels. */
	const tab1NavItems = useMemo<NavItem[]>(
		() => [
			{ id: 'ai-sov-gap', label: t('sovLeaderboard') },
			{ id: 'geo-score-summary', label: t('geoScoreSummary') },
			{ id: 'ai-engine-status', label: t('aiEngineStatus') },
			{ id: 'trigger-keyword-depth', label: t('triggerKeywordDepth') },
			{ id: 'geo-section-entity', label: t('eeatBrandTrust') },
			{ id: 'geo-section-nap', label: t('geoLocalNap') },
			{ id: 'geo-section-authority', label: t('digitalFootprint') },
			{ id: 'geo-section-bot', label: t('geoBotIndex') },
			{ id: 'action-plan-85', label: t('actionPlan85') },
		],
		[t],
	);

	/** Track 1 · technical integrity / Schema panels. */
	const tab2NavItems = useMemo<NavItem[]>(
		() => [
			{ id: 'technical-score-summary', label: t('technicalScoreSummary') },
			{ id: 'schema-structured-data', label: t('schemaStructuredData') },
			{ id: 'technical-evidence-jsonld', label: t('technicalEvidenceJsonld') },
			{ id: 'rag-fact-density', label: t('ragFactDensity') },
			{ id: 'live-criteria-report', label: t('liveCriteriaReport') },
			{ id: 'ai-search-simulator', label: t('aiSearchSimulator') },
			{ id: 'keyword-pipeline', label: t('keywordPipeline') },
		],
		[t],
	);

	/** Track 3 · Core Web Vitals & live performance panels. */
	const tab3NavItems = useMemo<NavItem[]>(
		() => [
			{ id: 'cwv-score-summary', label: t('cwvScoreSummary') },
			{ id: 'pagespeed-vitals', label: t('pagespeedVitals') },
		],
		[t],
	);

	const postTabNavItems = useMemo<NavItem[]>(
		() => [
			{ id: 'sec-business-hook', label: t('businessImpact') },
			{ id: 'exposure-simulator', label: t('exposureSimulator') },
			{ id: 'ai-timeline-forecast', label: t('timelineForecast') },
			{ id: 'consulting-section', label: t('solutionPackages') },
			{ id: 'official-validation-tools', label: t('officialTools') },
		],
		[t],
	);

	const navItems = useMemo(() => {
		const activeNavItems =
			activeTab === 'onpage' ? tab2NavItems : activeTab === 'cwv' ? tab3NavItems : tab1NavItems;
		return preTabNavItems.concat(activeNavItems).concat(postTabNavItems);
	}, [activeTab, preTabNavItems, tab1NavItems, tab2NavItems, tab3NavItems, postTabNavItems]);

	useEffect(() => {
		const elements = navItems
			.map(({ id }) => document.getElementById(id))
			.filter((el): el is HTMLElement => Boolean(el));
		if (elements.length === 0) return;

		const syncActive = () => {
			const next = pickActiveSection(navItems);
			if (next) setActiveId(next);
		};

		const observer = new IntersectionObserver(
			() => {
				syncActive();
			},
			{
				root: null,
				rootMargin: '-10% 0px -55% 0px',
				threshold: [0, 0.08, 0.2, 0.4, 0.6, 1],
			},
		);

		for (const el of elements) observer.observe(el);
		syncActive();
		window.addEventListener('scroll', syncActive, { passive: true });
		window.addEventListener('resize', syncActive);

		return () => {
			observer.disconnect();
			window.removeEventListener('scroll', syncActive);
			window.removeEventListener('resize', syncActive);
		};
	}, [observeKey, navItems]);

	function handleClick(id: AuditScrollspySectionId) {
		const el = document.getElementById(id);
		if (!el) return;
		el.scrollIntoView({ behavior: 'smooth', block: 'start' });
		setActiveId(id);
	}

	function scrollToTop() {
		const header = document.getElementById(AUDIT_TOP_ID);
		if (header) {
			header.scrollIntoView({ behavior: 'smooth', block: 'start' });
			return;
		}
		window.scrollTo({ top: 0, behavior: 'smooth' });
	}

	const pinToContent = isXl && left != null;

	return (
		<nav
			aria-label={t('ariaLabel')}
			className={`print:hidden pointer-events-none top-1/2 z-40 hidden -translate-y-1/2 flex-col items-start lg:flex ${
				pinToContent ? 'fixed' : 'fixed right-4 -translate-x-[50px]'
			}`}
			style={pinToContent ? { left } : undefined}
		>
			{onTabChange ? (
				<FloatingTabIndicator
					activeTab={activeTab}
					onTabChange={onTabChange}
				/>
			) : null}
			<div className="pointer-events-auto flex w-full flex-col items-center justify-center">
				<ul className="audit-scrollspy-nav flex w-full flex-col items-center gap-1.5 bg-transparent p-0">
					{navItems.map((section) => {
						const isActive = activeId === section.id;
						return (
							<li key={section.id} className="group relative flex w-full items-center justify-center">
								<button
									type="button"
									onClick={() => handleClick(section.id)}
									aria-current={isActive ? 'true' : undefined}
									aria-label={section.label}
									className="relative flex items-center justify-center py-1.5"
								>
									<span
										className={`pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded-md border border-slate-200 dark:border-white/10 bg-white/95 dark:bg-slate-900/95 px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 shadow-xl transition-all duration-200 ${
											isActive
												? 'translate-x-0 opacity-100'
												: 'translate-x-[-8px] opacity-0 group-hover:translate-x-0 group-hover:opacity-100'
										}`}
									>
										{section.label}
									</span>
									<span className="relative flex h-2 w-2 shrink-0 items-center justify-center" aria-hidden>
										{isActive ? (
											<span className="absolute h-[18px] w-[18px] rounded-full bg-cyan-400/40 blur-[6px] dark:bg-cyan-300/35" />
										) : null}
										<span
											className={`relative h-2 w-2 rounded-full transition-all duration-300 ${
												isActive
													? 'scale-150 bg-cyan-400 dark:bg-cyan-300'
													: 'bg-slate-300 group-hover:bg-slate-400 dark:bg-slate-600/70 dark:group-hover:bg-slate-400'
											}`}
										/>
									</span>
								</button>
							</li>
						);
					})}
				</ul>
				<button
					type="button"
					onClick={scrollToTop}
					aria-label={t('scrollToTopAria')}
					className="group relative mx-auto mt-[calc(0.5rem*4/3)] flex h-7 w-7 items-center justify-center rounded-full border border-slate-200/80 bg-white/90 text-slate-500 shadow-lg backdrop-blur-md transition-all duration-200 hover:scale-110 hover:border-cyan-500 hover:bg-cyan-500 hover:text-slate-950 dark:border-slate-800 dark:bg-[#0B1120]/90 dark:text-slate-400 dark:hover:border-cyan-500 dark:hover:bg-cyan-500 dark:hover:text-slate-950"
				>
					<ArrowUp className="h-4 w-4 transition-transform duration-200 group-hover:-translate-y-0.5" aria-hidden />
					<span className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded-md border border-slate-200 bg-white/95 px-3 py-1.5 text-xs text-slate-900 opacity-0 shadow-xl transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100 translate-x-[-8px] dark:border-white/10 dark:bg-slate-900/95 dark:text-slate-100">
						{t('scrollToTop')}
					</span>
				</button>
			</div>
		</nav>
	);
}
