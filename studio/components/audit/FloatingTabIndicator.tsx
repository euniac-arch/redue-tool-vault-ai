'use client';

import { ShieldCheck, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { AUDIT_TAB_ANCHOR_ID, type AuditResultTabId } from '@/components/audit/AuditResultTabs';

interface FloatingTabIndicatorProps {
	activeTab: AuditResultTabId;
	onTabChange: (tab: AuditResultTabId) => void;
	/** Scroll target id (default: tab navigation header). */
	targetAnchorId?: string;
}

const TAB_ITEMS = [
	{
		id: 'geo' as const,
		icon: Sparkles,
		labelKey: 'reputation',
		ariaKey: 'reputationAria',
	},
	{
		id: 'onpage' as const,
		icon: ShieldCheck,
		labelKey: 'technical',
		ariaKey: 'technicalAria',
	},
] as const;

function scrollToTabAnchor(targetAnchorId: string) {
	window.setTimeout(() => {
		const anchorElement = document.getElementById(targetAnchorId);
		anchorElement?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}, 50);
}

export function FloatingTabIndicator({
	activeTab,
	onTabChange,
	targetAnchorId = AUDIT_TAB_ANCHOR_ID,
}: FloatingTabIndicatorProps) {
	const t = useTranslations('audit.floatingTab');

	function handleTabClick(tab: AuditResultTabId) {
		onTabChange(tab);
		scrollToTabAnchor(targetAnchorId);
	}

	return (
		<div
			className="pointer-events-auto absolute bottom-full left-0 mb-3 hidden origin-bottom-left flex-col items-start gap-1.5 rounded-2xl border border-slate-200/80 bg-white/95 p-2 shadow-xl backdrop-blur-md transition-all duration-200 xl:flex dark:border-slate-800/80 dark:bg-[#0B1120]/95"
			role="navigation"
			aria-label={t('ariaLabel')}
		>
			{TAB_ITEMS.map((item) => {
				const isActive = activeTab === item.id;
				const Icon = item.icon;
				return (
					<button
						key={item.id}
						type="button"
						onClick={() => handleTabClick(item.id)}
						aria-pressed={isActive}
						aria-label={t(item.ariaKey)}
						className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-semibold transition-all duration-200 ${
							isActive
								? 'bg-cyan-500 text-slate-950 shadow-sm shadow-cyan-500/20'
								: 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-[#0E162B]'
						}`}
					>
						<Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
						<span>{t(item.labelKey)}</span>
						{isActive ? (
							<span className="ml-1 h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-200" aria-hidden />
						) : null}
					</button>
				);
			})}
		</div>
	);
}
