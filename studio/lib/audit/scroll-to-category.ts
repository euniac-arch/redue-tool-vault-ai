/**
 * QuickJumpToFail — scroll from a 5-category card to the matching
 * detailed-checklist section (Tab 2).
 */

export const SWITCH_AUDIT_RESULT_TAB_EVENT = 'redue:switch-audit-result-tab';
export const OPEN_DETAILED_CHECKLIST_EVENT = 'redue:open-detailed-checklist';
export const JUMP_TO_CHECKLIST_CATEGORY_EVENT = 'redue:jump-to-checklist-category';
/** Mount inactive tabs / print-only / accordion bodies before PDF capture. */
export const MOUNT_AUDIT_RESULT_TABS_EVENT = 'redue:mount-audit-result-tabs';

export function requestFullReportMount() {
	if (typeof window === 'undefined') return;
	window.dispatchEvent(new Event(MOUNT_AUDIT_RESULT_TABS_EVENT));
}

/** Canonical DOM id prefix: `#audit-section-security` … `#audit-section-geo`. */
export const AUDIT_SECTION_ID_PREFIX = 'audit-section-';
/** @deprecated Use AUDIT_SECTION_ID_PREFIX — kept so older selectors still resolve. */
export const CHECKLIST_CATEGORY_ANCHOR_PREFIX = AUDIT_SECTION_ID_PREFIX;
export const CHECKLIST_SCROLL_MARGIN_PX = 100;

/**
 * Card / event aliases → canonical section suffix.
 * `seo-basic` → `#audit-section-seo`, `geo-signal` → `#audit-section-geo`.
 */
const CATEGORY_ID_ALIASES: Record<string, string> = {
	security: 'security',
	security_infra: 'security',
	'security-infra': 'security',
	performance: 'performance',
	web_perf_access: 'performance',
	'web-perf-access': 'performance',
	'web-perf': 'performance',
	seo: 'seo',
	'seo-basic': 'seo',
	basic_seo: 'seo',
	'basic-seo': 'seo',
	schema: 'schema',
	schema_data: 'schema',
	'schema-data': 'schema',
	geo: 'geo',
	'geo-signal': 'geo',
	geo_ai_signals: 'geo',
	'geo-ai-signals': 'geo',
	geoSignal: 'geo',
};

export function normalizeAuditCategoryId(categoryId: string): string {
	const key = categoryId.trim();
	if (!key) return key;
	return CATEGORY_ID_ALIASES[key] ?? CATEGORY_ID_ALIASES[key.replace(/_/g, '-')] ?? key;
}

export function auditSectionId(categoryId: string): string {
	return `${AUDIT_SECTION_ID_PREFIX}${normalizeAuditCategoryId(categoryId)}`;
}

export function checklistCategoryAnchorId(categoryId: string): string {
	return auditSectionId(categoryId);
}

export interface SwitchAuditResultTabDetail {
	tab: 'geo' | 'onpage';
}

export interface JumpToChecklistCategoryDetail {
	categoryId: string;
}

function prefersReducedMotion(): boolean {
	return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function findCategoryTarget(categoryId: string): HTMLElement | null {
	const id = normalizeAuditCategoryId(categoryId);
	if (!id) return null;
	return (
		document.getElementById(auditSectionId(id)) ??
		document.getElementById(`checklist-cat-${id}`)
	);
}

function isReadyTarget(el: HTMLElement): boolean {
	if (el.closest('[inert]')) return false;
	const panel = el.closest('.audit-result-tab-panel');
	if (panel && !panel.classList.contains('is-active')) return false;
	if (el.getBoundingClientRect().height < 4) return false;
	const style = window.getComputedStyle(el);
	return style.display !== 'none' && style.visibility !== 'hidden';
}

function scrollToTarget(categoryId: string): boolean {
	const target = findCategoryTarget(categoryId);
	if (!target || !isReadyTarget(target)) return false;
	target.scrollIntoView({
		behavior: prefersReducedMotion() ? 'auto' : 'smooth',
		block: 'start',
	});
	return true;
}

function dispatchJumpEvents(categoryId: string) {
	window.dispatchEvent(
		new CustomEvent<SwitchAuditResultTabDetail>(SWITCH_AUDIT_RESULT_TAB_EVENT, {
			detail: { tab: 'onpage' },
		}),
	);
	window.dispatchEvent(
		new CustomEvent<JumpToChecklistCategoryDetail>(OPEN_DETAILED_CHECKLIST_EVENT, {
			detail: { categoryId },
		}),
	);
	window.dispatchEvent(
		new CustomEvent<JumpToChecklistCategoryDetail>(JUMP_TO_CHECKLIST_CATEGORY_EVENT, {
			detail: { categoryId },
		}),
	);
}

/**
 * Switch to Tab 2 if needed, expand the detailed checklist, then smooth-scroll
 * to `#audit-section-${categoryId}`.
 */
export function scrollToCategory(categoryId: string) {
	if (typeof window === 'undefined' || !categoryId) return;
	const id = normalizeAuditCategoryId(categoryId);
	if (!id) return;

	dispatchJumpEvents(id);

	const attempt = (triesLeft: number) => {
		if (scrollToTarget(id)) return;
		if (triesLeft <= 0) return;
		window.setTimeout(() => attempt(triesLeft - 1), 160);
	};

	// Accordion expand is 300ms; tab panel must paint before getBoundingClientRect works.
	window.setTimeout(() => attempt(4), 80);
}

/** @deprecated Use scrollToCategory */
export function scrollToCategoryIssue(categoryId: string) {
	scrollToCategory(categoryId);
}
