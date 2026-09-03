'use client';

import { useLayoutEffect, useRef, type RefObject } from 'react';

const FOCUSABLE =
	'a[href], button:not([disabled]), textarea, input, select, iframe, [tabindex]:not([tabindex="-1"])';

type InertRecord = { el: HTMLElement; hadInert: boolean; ariaHidden: string | null };

export function isVisibleFocusable(el: HTMLElement): boolean {
	if (el.tabIndex < 0 || el.hasAttribute('disabled') || el.getAttribute('aria-hidden') === 'true') {
		return false;
	}
	if (el.closest('[inert], [aria-hidden="true"]')) return false;
	const style = typeof window !== 'undefined' ? window.getComputedStyle(el) : null;
	if (style && (style.visibility === 'hidden' || style.display === 'none')) return false;
	return el.getClientRects().length > 0;
}

export function focusableIn(root: HTMLElement): HTMLElement[] {
	return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(isVisibleFocusable);
}

/** Hide every sibling branch from the overlay root up to `document.body`. */
export function lockBackground(root: HTMLElement): () => void {
	const records: InertRecord[] = [];
	let node: HTMLElement | null = root;
	while (node && node !== document.body) {
		const parent: HTMLElement | null = node.parentElement;
		if (!parent) break;
		for (const sibling of Array.from(parent.children)) {
			if (sibling === node || !(sibling instanceof HTMLElement)) continue;
			const tag = sibling.tagName;
			if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'LINK' || tag === 'NOSCRIPT') continue;
			records.push({
				el: sibling,
				hadInert: sibling.hasAttribute('inert'),
				ariaHidden: sibling.getAttribute('aria-hidden'),
			});
			sibling.setAttribute('inert', '');
			sibling.setAttribute('aria-hidden', 'true');
		}
		node = parent;
	}
	return () => {
		for (const rec of records) {
			if (!rec.hadInert) rec.el.removeAttribute('inert');
			if (rec.ariaHidden == null) rec.el.removeAttribute('aria-hidden');
			else rec.el.setAttribute('aria-hidden', rec.ariaHidden);
		}
	};
}

/**
 * Escape, Tab / Shift+Tab trap, initial focus on the dialog, restore trigger
 * focus, body scroll lock, and inert background. Pass the dialog node as
 * `panelRef`; the overlay parent is used as the inert root.
 */
export function useModalA11y(
	open: boolean,
	onClose: () => void,
	panelRef: RefObject<HTMLElement | null>,
): void {
	const onCloseRef = useRef(onClose);
	onCloseRef.current = onClose;

	useLayoutEffect(() => {
		if (!open) return;
		const panel = panelRef.current;
		if (!panel) return;
		const dialog: HTMLElement = panel;
		const overlay = dialog.parentElement instanceof HTMLElement ? dialog.parentElement : dialog;
		const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		const unlockBackground = lockBackground(overlay);

		const focusPanel = () => {
			if (!dialog.isConnected) return;
			if (!dialog.hasAttribute('tabindex')) dialog.tabIndex = -1;
			dialog.focus();
		};
		const frame = window.requestAnimationFrame(focusPanel);

		function onKeyDown(event: KeyboardEvent) {
			if (event.key === 'Escape') {
				event.preventDefault();
				event.stopPropagation();
				onCloseRef.current();
				return;
			}
			if (event.key !== 'Tab') return;
			const nodes = focusableIn(dialog);
			if (nodes.length === 0) {
				event.preventDefault();
				dialog.focus();
				return;
			}
			const first = nodes[0];
			const last = nodes[nodes.length - 1];
			const active = document.activeElement;
			if (event.shiftKey && (active === first || active === dialog)) {
				event.preventDefault();
				last.focus();
			} else if (!event.shiftKey && active === last) {
				event.preventDefault();
				first.focus();
			} else if (!dialog.contains(active)) {
				event.preventDefault();
				(event.shiftKey ? last : first).focus();
			}
		}

		window.addEventListener('keydown', onKeyDown, true);
		return () => {
			window.cancelAnimationFrame(frame);
			document.body.style.overflow = previousOverflow;
			window.removeEventListener('keydown', onKeyDown, true);
			unlockBackground();
			if (previous?.isConnected) previous.focus();
		};
	}, [open, panelRef]);
}
