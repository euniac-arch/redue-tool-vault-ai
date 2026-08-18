'use client';

import { useEffect, useMemo, useState, type RefObject } from 'react';
import { ArrowUp } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { AuditResultTabId } from '@/components/audit/AuditResultTabs';
import { FloatingTabIndicator } from '@/components/audit/FloatingTabIndicator';
import { useContentSideRailLeft } from '@/lib/use-content-side-rail';

export const AUDIT_TOP_ID = 'audit-top';

export type AuditScrollspySectionId =
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
	| 'pagespeed-vitals'
	| 'technical-evidence-jsonld'
	| 'live-criteria-report'
	| 'ai-search-simulator'
	| 'detailed-checklist-22'
	| 'keyword-pipeline'
	| 'ai-timeline-forecast'
	| 'official-validation-tools';

type NavItem = { id: AuditScrollspySectionId; label: string };

const PRE_TAB_NAV_ITEM_ID = 'ai-timeline-forecast' as const;
const POST_TAB_NAV_ITEM_ID = 'official-validation-tools' as const;

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
	activeTab = 'geo',
	onTabChange,
	observeKey,
}: AuditScrollspyNavProps) {
	const t = useTranslations('audit.scrollspy');
	const [activeId, setActiveId] = useState<AuditScrollspySectionId>(
		activeTab === 'onpage' ? 'technical-score-summary' : 'geo-score-summary',
	);
	/** gap -34 ≈ content right − 34px. minRailWidth covers the left-anchored tab card growing right. */
	const { left, isXl } = useContentSideRailLeft(contentRef, -34, 220);

	const tab1NavItems = useMemo<NavItem[]>(
		() => [
			{ id: 'geo-score-summary', label: t('geoScoreSummary') },
			{ id: 'ai-engine-status', label: t('aiEngineStatus') },
			{ id: 'trigger-keyword-depth', label: t('triggerKeywordDepth') },
			{ id: 'geo-section-entity', label: t('eeatBrandTrust') },
			{ id: 'geo-section-bot', label: t('geoBotIndex') },
			{ id: 'geo-section-nap', label: t('geoLocalNap') },
			{ id: 'geo-section-authority', label: t('digitalFootprint') },
			{ id: 'action-plan-85', label: t('actionPlan85') },
		],
		[t],
	);

	const tab2NavItems = useMemo<NavItem[]>(
		() => [
			{ id: 'technical-score-summary', label: t('technicalScoreSummary') },
			{ id: 'pagespeed-vitals', label: t('pagespeedVitals') },
			{ id: 'technical-evidence-jsonld', label: t('technicalEvidenceJsonld') },
			{ id: 'live-criteria-report', label: t('liveCriteriaReport') },
			{ id: 'ai-search-simulator', label: t('aiSearchSimulator') },
			{ id: 'detailed-checklist-22', label: t('detailedChecklist22') },
			{ id: 'keyword-pipeline', label: t('keywordPipeline') },
		],
		[t],
	);

	const preTabNavItem = useMemo<NavItem>(
		() => ({ id: PRE_TAB_NAV_ITEM_ID, label: t('timelineForecast') }),
		[t],
	);
	const postTabNavItem = useMemo<NavItem>(
		() => ({ id: POST_TAB_NAV_ITEM_ID, label: t('officialTools') }),
		[t],
	);

	const navItems = useMemo(
		() =>
			[preTabNavItem]
				.concat(activeTab === 'onpage' ? tab2NavItems : tab1NavItems)
				.concat(postTabNavItem),
		[activeTab, tab1NavItems, tab2NavItems, preTabNavItem, postTabNavItem],
	);

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
									<span
										className={`h-2 w-2 shrink-0 rounded-full bg-slate-600/70 transition-all duration-300 ${
											isActive
												? 'scale-150 bg-indigo-500 ring-4 ring-indigo-500/20'
												: 'group-hover:bg-slate-400'
										}`}
										aria-hidden
									/>
								</button>
							</li>
						);
					})}
				</ul>
				<button
					type="button"
					onClick={scrollToTop}
					aria-label={t('scrollToTopAria')}
					className="group relative mx-auto mt-2 flex h-7 w-7 items-center justify-center rounded-full border border-slate-200/80 bg-white/90 text-slate-500 shadow-lg backdrop-blur-md transition-all duration-200 hover:scale-110 hover:bg-indigo-50 hover:text-indigo-600 dark:border-slate-800 dark:bg-slate-900/90 dark:text-slate-400 dark:hover:bg-indigo-950/60 dark:hover:text-indigo-400"
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
