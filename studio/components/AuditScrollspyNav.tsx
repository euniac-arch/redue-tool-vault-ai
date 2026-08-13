'use client';

import { useEffect, useState, type RefObject } from 'react';
import { useTranslations } from 'next-intl';
import { useContentSideRailLeft } from '@/lib/use-content-side-rail';

export type AuditScrollspySectionId =
	| 'sec-summary'
	| 'sec-scores'
	| 'sec-pagespeed'
	| 'sec-evidence'
	| 'sec-live-criteria'
	| 'sec-geo-algorithm'
	| 'sec-ai-simulator'
	| 'sec-jsonld-code'
	| 'sec-checklist'
	| 'sec-actionable'
	| 'sec-keyword-recommend'
	| 'sec-official-tools';

const SECTIONS: { id: AuditScrollspySectionId; labelKey: string; tab?: 'onpage' }[] = [
	{ id: 'sec-summary', labelKey: 'summary' },
	{ id: 'sec-scores', labelKey: 'scores', tab: 'onpage' },
	{ id: 'sec-pagespeed', labelKey: 'pagespeed', tab: 'onpage' },
	{ id: 'sec-evidence', labelKey: 'evidence', tab: 'onpage' },
	{ id: 'sec-live-criteria', labelKey: 'liveCriteria', tab: 'onpage' },
	{ id: 'sec-geo-algorithm', labelKey: 'geoAlgorithm', tab: 'onpage' },
	{ id: 'sec-ai-simulator', labelKey: 'aiSimulator', tab: 'onpage' },
	{ id: 'sec-jsonld-code', labelKey: 'jsonldCode', tab: 'onpage' },
	{ id: 'sec-checklist', labelKey: 'checklist', tab: 'onpage' },
	{ id: 'sec-actionable', labelKey: 'actionable', tab: 'onpage' },
	{ id: 'sec-keyword-recommend', labelKey: 'keywordRecommend', tab: 'onpage' },
	{ id: 'sec-official-tools', labelKey: 'officialTools' },
];

interface AuditScrollspyNavProps {
	/** Main content shell — used to pin the rail to the content's right edge (xl+). */
	contentRef?: RefObject<HTMLElement | null>;
	/** Ensure on-page sections are visible before scrolling into them. */
	onEnsureOnpageTab?: () => void;
	/** Re-bind IntersectionObserver when the report tab changes. */
	observeKey?: string | number;
}

function isElementVisible(el: HTMLElement): boolean {
	if (el.closest('.hidden')) return false;
	const style = window.getComputedStyle(el);
	return style.display !== 'none' && style.visibility !== 'hidden';
}

function pickActiveSection(): AuditScrollspySectionId | null {
	const mid = window.innerHeight * 0.32;
	let nearest: AuditScrollspySectionId | null = null;
	let nearestDist = Number.POSITIVE_INFINITY;

	for (const { id } of SECTIONS) {
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
	onEnsureOnpageTab,
	observeKey,
}: AuditScrollspyNavProps) {
	const t = useTranslations('audit.scrollspy');
	const [activeId, setActiveId] = useState<AuditScrollspySectionId>('sec-summary');
	/** gap -34 ≈ content right − 34px (≈50px left of prior +16px rail). */
	const { left, isXl } = useContentSideRailLeft(contentRef, -34, 72);

	useEffect(() => {
		const elements = SECTIONS.map(({ id }) => document.getElementById(id)).filter(
			(el): el is HTMLElement => Boolean(el),
		);
		if (elements.length === 0) return;

		const syncActive = () => {
			const next = pickActiveSection();
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
	}, [observeKey]);

	function handleClick(id: AuditScrollspySectionId, needsOnpage?: boolean) {
		if (needsOnpage) onEnsureOnpageTab?.();

		const scroll = () => {
			const el = document.getElementById(id);
			if (!el) return;
			el.scrollIntoView({ behavior: 'smooth', block: 'start' });
			setActiveId(id);
		};

		if (needsOnpage) {
			window.setTimeout(scroll, 90);
		} else {
			scroll();
		}
	}

	const pinToContent = isXl && left != null;

	return (
		<nav
			aria-label={t('ariaLabel')}
			className={`print:hidden pointer-events-none top-1/2 z-40 hidden -translate-y-1/2 flex-col lg:flex ${
				pinToContent ? 'fixed' : 'fixed right-4 -translate-x-[50px]'
			}`}
			style={pinToContent ? { left } : undefined}
		>
			<ul className="audit-scrollspy-nav pointer-events-auto flex flex-col items-end gap-4 bg-transparent p-0">
				{SECTIONS.map((section) => {
					const isActive = activeId === section.id;
					const label = t(section.labelKey);
					return (
						<li key={section.id} className="group relative flex items-center justify-end">
							<button
								type="button"
								onClick={() => handleClick(section.id, section.tab === 'onpage')}
								aria-current={isActive ? 'true' : undefined}
								aria-label={label}
								className="relative flex items-center justify-end py-0"
							>
								<span
									className={`pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded-md border border-white/10 bg-slate-900/95 px-3 py-1.5 text-xs text-slate-100 shadow-xl transition-all duration-200 ${
										isActive
											? 'translate-x-0 opacity-100'
											: 'translate-x-[-8px] opacity-0 group-hover:translate-x-0 group-hover:opacity-100'
									}`}
								>
									{label}
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
		</nav>
	);
}
