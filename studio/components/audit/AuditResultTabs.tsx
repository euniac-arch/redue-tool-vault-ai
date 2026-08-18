'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import {
	MOUNT_AUDIT_RESULT_TABS_EVENT,
	SWITCH_AUDIT_RESULT_TAB_EVENT,
	type SwitchAuditResultTabDetail,
} from '@/lib/audit/scroll-to-category';

export type AuditResultTabId = 'geo' | 'onpage';

/** Tab navigation header — floating widget scrolls here on tab switch. */
export const AUDIT_TAB_ANCHOR_ID = 'audit-tab-anchor';

interface AuditResultTabsProps {
	geoLabel: string;
	onpageLabel: string;
	/** Tab 1 · AI 검색 신뢰도 · GEO 진단 (default active). */
	geoContent: ReactNode;
	/** Tab 2 · SEO·GEO·Schema 진단. */
	onpageContent: ReactNode;
	/** Controlled tab (optional). */
	activeTab?: AuditResultTabId;
	onTabChange?: (tab: AuditResultTabId) => void;
	/** Public / A4 share view — stack both panels like print. */
	forceStack?: boolean;
}

function TabSectionHeader({ title, description }: { title: string; description: string }) {
	return (
		<header className="flex flex-col gap-1">
			<h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white print:text-[#0B1C2C]">
				{title}
			</h2>
			<p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
				{description}
			</p>
		</header>
	);
}

/**
 * Screen: only the active panel is shown (via CSS, not Tailwind `hidden`).
 * PDF / print (`html.pdf-printing` or `@media print`): both panels stack
 * vertically so html2canvas and Save-as-PDF capture the full report.
 * `display: none` is never applied inside the print/capture tree.
 */
export function AuditResultTabs({
	geoLabel,
	onpageLabel,
	geoContent,
	onpageContent,
	activeTab,
	onTabChange,
	forceStack = false,
}: AuditResultTabsProps) {
	const t = useTranslations('audit.tabs');
	const [internalTab, setInternalTab] = useState<AuditResultTabId>('geo');
	const [mountedTabs, setMountedTabs] = useState<Record<AuditResultTabId, boolean>>({
		geo: true,
		onpage: forceStack,
	});
	const tab = activeTab ?? internalTab;

	function markMounted(next: AuditResultTabId) {
		setMountedTabs((prev) => (prev[next] ? prev : { ...prev, [next]: true }));
	}

	function setTab(next: AuditResultTabId) {
		markMounted(next);
		onTabChange?.(next);
		if (activeTab === undefined) setInternalTab(next);
	}

	useEffect(() => {
		if (forceStack) setMountedTabs({ geo: true, onpage: true });
	}, [forceStack]);

	useEffect(() => {
		const onSwitch = (event: Event) => {
			const next = (event as CustomEvent<SwitchAuditResultTabDetail>).detail?.tab;
			if (next !== 'geo' && next !== 'onpage') return;
			markMounted(next);
			onTabChange?.(next);
			if (activeTab === undefined) setInternalTab(next);
		};
		const mountAll = () => setMountedTabs({ geo: true, onpage: true });
		window.addEventListener(SWITCH_AUDIT_RESULT_TAB_EVENT, onSwitch);
		window.addEventListener(MOUNT_AUDIT_RESULT_TABS_EVENT, mountAll);
		window.addEventListener('beforeprint', mountAll);
		return () => {
			window.removeEventListener(SWITCH_AUDIT_RESULT_TAB_EVENT, onSwitch);
			window.removeEventListener(MOUNT_AUDIT_RESULT_TABS_EVENT, mountAll);
			window.removeEventListener('beforeprint', mountAll);
		};
	}, [activeTab, onTabChange]);

	useEffect(() => {
		if (forceStack || mountedTabs.onpage) return;
		const win = window as Window & {
			requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
			cancelIdleCallback?: (id: number) => void;
		};
		const prefetch = () => markMounted('onpage');
		if (typeof win.requestIdleCallback === 'function') {
			const id = win.requestIdleCallback(prefetch, { timeout: 2200 });
			return () => win.cancelIdleCallback?.(id);
		}
		const timer = window.setTimeout(prefetch, 1800);
		return () => window.clearTimeout(timer);
	}, [forceStack, mountedTabs.onpage]);

	const geoActive = tab === 'geo' || forceStack;
	const onpageActive = tab === 'onpage' || forceStack;
	const renderGeo = forceStack || mountedTabs.geo || geoActive;
	const renderOnpage = forceStack || mountedTabs.onpage || onpageActive;

	return (
		<div
			id="audit-tab-root"
			className={`audit-result-tabs w-full max-w-full overflow-visible box-border flex flex-col gap-6${
				forceStack ? ' audit-result-tabs--stack' : ''
			}`}
		>
			<nav
				id={AUDIT_TAB_ANCHOR_ID}
				className={`print:hidden pdf-screen-only scroll-mt-24 grid w-full grid-cols-1 gap-3 rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.02] p-2 sm:grid-cols-2${forceStack ? ' hidden' : ''}`}
			>
				{(
					[
						{ id: 'geo' as const, label: geoLabel, step: '1' },
						{ id: 'onpage' as const, label: onpageLabel, step: '2' },
					] as const
				).map((item) => (
					<button
						key={item.id}
						type="button"
						onClick={() => setTab(item.id)}
						aria-pressed={tab === item.id}
						className={`flex w-full items-center justify-center gap-2.5 rounded-xl border-2 px-5 py-4 text-center text-base font-extrabold transition sm:text-lg ${
							tab === item.id
								? 'border-cyan-400 bg-gradient-to-r from-cyan-500/25 via-indigo-500/25 to-fuchsia-500/25 text-slate-900 dark:text-white shadow-[0_0_0_1px_rgba(34,211,238,0.5),0_10px_30px_-8px_rgba(99,102,241,0.55)]'
								: 'border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.03] text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-white/20 hover:bg-slate-50 dark:hover:bg-white/[0.07] hover:text-slate-800 dark:hover:text-slate-200'
						}`}
					>
						<span
							className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-extrabold ${
								tab === item.id ? 'bg-cyan-400 text-[#0B1030]' : 'bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-400'
							}`}
						>
							{item.step}
						</span>
						{item.label}
					</button>
				))}
			</nav>

			<div
				className={`audit-result-tab-panel w-full max-w-full overflow-visible box-border flex flex-col gap-6 ${
					geoActive ? 'is-active' : ''
				}${geoActive && !forceStack ? ' audit-tab-fade-in' : ''}`}
			>
				<p className="pdf-print-only text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-500">
					1. {geoLabel}
				</p>
				<TabSectionHeader title={t('geoTitle')} description={t('geoDescription')} />
				{renderGeo ? geoContent : null}
			</div>
			<div
				className={`audit-result-tab-panel w-full max-w-full overflow-visible box-border flex flex-col gap-6 ${
					onpageActive ? 'is-active' : ''
				}${onpageActive && !forceStack ? ' audit-tab-fade-in' : ''}`}
			>
				<p className="pdf-print-only text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-500">
					2. {onpageLabel}
				</p>
				<TabSectionHeader title={t('onpageTitle')} description={t('onpageDescription')} />
				{renderOnpage ? onpageContent : null}
			</div>
		</div>
	);
}
