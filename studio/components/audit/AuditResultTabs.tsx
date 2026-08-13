'use client';

import { useState, type ReactNode } from 'react';

export type AuditResultTabId = 'geo' | 'onpage';

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
}

/**
 * Two-tab layout for the audit result body. Both tab panels stay mounted in
 * the DOM at all times — only visibility toggles on screen (`hidden`) — so
 * that printing (`window.print()`) still renders the complete report exactly
 * like before this tab split existed. `nav`/`button` are already forced
 * hidden by the print stylesheet (see globals.css), so the tab switcher never
 * shows up in the PDF output.
 */
export function AuditResultTabs({
	geoLabel,
	onpageLabel,
	geoContent,
	onpageContent,
	activeTab,
	onTabChange,
}: AuditResultTabsProps) {
	const [internalTab, setInternalTab] = useState<AuditResultTabId>('geo');
	const tab = activeTab ?? internalTab;

	function setTab(next: AuditResultTabId) {
		onTabChange?.(next);
		if (activeTab === undefined) setInternalTab(next);
	}

	return (
		<div className="w-full max-w-full overflow-visible box-border flex flex-col gap-6">
			<nav className="print:hidden grid w-full grid-cols-1 gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-2 sm:grid-cols-2">
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
								? 'border-cyan-400 bg-gradient-to-r from-cyan-500/25 via-indigo-500/25 to-fuchsia-500/25 text-white shadow-[0_0_0_1px_rgba(34,211,238,0.5),0_10px_30px_-8px_rgba(99,102,241,0.55)]'
								: 'border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/20 hover:bg-white/[0.07] hover:text-slate-200'
						}`}
					>
						<span
							className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-extrabold ${
								tab === item.id ? 'bg-cyan-400 text-[#0B1030]' : 'bg-white/10 text-slate-400'
							}`}
						>
							{item.step}
						</span>
						{item.label}
					</button>
				))}
			</nav>

			<div
				className={
					tab === 'geo'
						? 'w-full max-w-full overflow-visible box-border flex flex-col gap-6'
						: 'hidden print:flex print:w-full print:max-w-full print:flex-col print:gap-6'
				}
			>
				{geoContent}
			</div>
			<div
				className={
					tab === 'onpage'
						? 'w-full max-w-full overflow-visible box-border flex flex-col gap-6'
						: 'hidden print:flex print:w-full print:max-w-full print:flex-col print:gap-6'
				}
			>
				{onpageContent}
			</div>
		</div>
	);
}
