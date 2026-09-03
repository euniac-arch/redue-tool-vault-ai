'use client';

import type { KeyboardEvent, ReactNode } from 'react';
import { nextAsiFilterIndex } from '@/lib/ai-search-intelligence/filter-tab-nav';

function tabButtons(list: HTMLElement): HTMLButtonElement[] {
	return Array.from(list.querySelectorAll<HTMLButtonElement>(':scope > [role="tab"]'));
}

export function AsiFilterTabList({
	label,
	children,
}: {
	label: string;
	children: ReactNode;
}) {
	function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
		if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
		const tabs = tabButtons(event.currentTarget);
		if (tabs.length === 0) return;
		const current = tabs.findIndex((tab) => tab === document.activeElement);
		if (current < 0) return;
		event.preventDefault();
		const next = tabs[nextAsiFilterIndex(current, event.key, tabs.length)];
		next?.focus();
		next?.click();
	}

	return (
		<div className="flex flex-wrap gap-2" role="tablist" aria-label={label} onKeyDown={onKeyDown}>
			{children}
		</div>
	);
}
