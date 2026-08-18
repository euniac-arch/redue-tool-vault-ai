/**
 * One-click jump from the GEO 4-pillar score table to the matching
 * measured card on Tab 1.
 */

import { GEO_PILLAR_ANCHOR_IDS, type GeoPillarId } from '@/lib/audit/geoScoreCalculator';
import { SWITCH_AUDIT_RESULT_TAB_EVENT, type SwitchAuditResultTabDetail } from '@/lib/audit/scroll-to-category';

export const GEO_PILLAR_SCROLL_MARGIN_PX = 100;
export const GEO_PILLAR_HIGHLIGHT_MS = 1500;

export const GEO_PILLAR_JUMP_HIGHLIGHT_CLASSES = [
	'ring-2',
	'ring-indigo-500',
	'ring-offset-2',
	'animate-pulse',
	'transition-all',
	'duration-300',
] as const;

function prefersReducedMotion(): boolean {
	return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function applyHighlight(el: HTMLElement) {
	el.classList.add('geo-pillar-jump-highlight', ...GEO_PILLAR_JUMP_HIGHLIGHT_CLASSES);
	window.setTimeout(() => {
		el.classList.remove('geo-pillar-jump-highlight', ...GEO_PILLAR_JUMP_HIGHLIGHT_CLASSES);
	}, GEO_PILLAR_HIGHLIGHT_MS);
}

function isReadyTarget(el: HTMLElement): boolean {
	if (el.closest('[inert]')) return false;
	const panel = el.closest('.audit-result-tab-panel');
	if (panel && !panel.classList.contains('is-active')) return false;
	if (el.getBoundingClientRect().height < 4) return false;
	const style = window.getComputedStyle(el);
	return style.display !== 'none' && style.visibility !== 'hidden';
}

function scrollAndHighlight(targetAnchorId: string): boolean {
	const target = document.getElementById(targetAnchorId);
	if (!target || !isReadyTarget(target)) return false;
	target.scrollIntoView({
		behavior: prefersReducedMotion() ? 'auto' : 'smooth',
		block: 'start',
	});
	applyHighlight(target);
	return true;
}

export function resolveGeoPillarAnchorId(target: GeoPillarId | string): string {
	if (target in GEO_PILLAR_ANCHOR_IDS) {
		return GEO_PILLAR_ANCHOR_IDS[target as GeoPillarId];
	}
	return target;
}

/** Switch to Tab 1 if needed, then smooth-scroll to the measured GEO card. */
export function scrollToGeoPillar(target: GeoPillarId | string) {
	if (typeof window === 'undefined' || !target) return;
	const targetAnchorId = resolveGeoPillarAnchorId(target);

	window.dispatchEvent(
		new CustomEvent<SwitchAuditResultTabDetail>(SWITCH_AUDIT_RESULT_TAB_EVENT, {
			detail: { tab: 'geo' },
		}),
	);

	const attempt = (triesLeft: number) => {
		if (scrollAndHighlight(targetAnchorId)) return;
		if (triesLeft <= 0) return;
		window.setTimeout(() => attempt(triesLeft - 1), 160);
	};

	window.setTimeout(() => attempt(4), 80);
}
