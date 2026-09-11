'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { useTheme } from '@/components/theme/ThemeProvider';
import {
	MOUNT_AUDIT_RESULT_TABS_EVENT,
	SWITCH_AUDIT_RESULT_TAB_EVENT,
	type SwitchAuditResultTabDetail,
} from '@/lib/audit/scroll-to-category';
import { MEASURED_SCORE_WEIGHTS } from '@/lib/audit/scoreCalculator';

export type AuditResultTabId = 'geo' | 'onpage' | 'cwv';

/** Track 1 · 기술 무결성 & Schema — default / leftmost tab. */
export const DEFAULT_AUDIT_RESULT_TAB: AuditResultTabId = 'onpage';

/** Left-to-right order matches the three-track diagnosis model (Track 1 → 2 → 3). */
export const AUDIT_RESULT_TAB_ORDER = [
	{ id: 'onpage' as const, track: 1, subTitle: 'Technical SEO' },
	{ id: 'geo' as const, track: 2, subTitle: 'GEO / AEO' },
	{ id: 'cwv' as const, track: 3, subTitle: 'CWV' },
] as const;

/** Track-domain id shared by the top summary cards and the bottom tab nav (single source of truth). */
export type AuditTrackId = 'track1' | 'track2' | 'track3';

const TAB_TO_TRACK: Record<AuditResultTabId, AuditTrackId> = {
	onpage: 'track1',
	geo: 'track2',
	cwv: 'track3',
};

const TRACK_TO_TAB: Record<AuditTrackId, AuditResultTabId> = {
	track1: 'onpage',
	track2: 'geo',
	track3: 'cwv',
};

export function tabIdToTrackId(tab: AuditResultTabId): AuditTrackId {
	return TAB_TO_TRACK[tab];
}

export function trackIdToTabId(track: AuditTrackId): AuditResultTabId {
	return TRACK_TO_TAB[track];
}

/** Single source of truth for the Track 1/2/3 composite weight badges shown in the tab nav. */
const TRACK_WEIGHT_PCT: Record<1 | 2 | 3, number> = {
	1: Math.round(MEASURED_SCORE_WEIGHTS.track1 * 100),
	2: Math.round(MEASURED_SCORE_WEIGHTS.track2 * 100),
	3: Math.round(MEASURED_SCORE_WEIGHTS.coreWebVitals * 100),
};

/**
 * Active-tab theme per track — border / glow / tint / badge all switch to the
 * track's own accent color (Track 1 cyan, Track 2 purple, Track 3 emerald).
 * Light mode uses a soft fill; dark mode keeps the neon glow.
 */
const TRACK_ACTIVE_SUBTITLE: Record<1 | 2 | 3, string> = {
	1: 'text-cyan-600 font-bold dark:text-cyan-400',
	2: 'text-purple-600 font-bold dark:text-purple-300',
	3: 'text-emerald-600 font-bold dark:text-emerald-400',
};

const TRACK_ACTIVE_THEME: Record<
	1 | 2 | 3,
	{ border: string; glow: string; bgLight: string; bgDark: string; badge: string }
> = {
	1: {
		border: 'border-cyan-300 dark:border-cyan-400',
		glow: 'shadow-sm shadow-cyan-200/60 dark:shadow-[0_0_30px_rgba(6,182,212,0.4),inset_0_0_15px_rgba(6,182,212,0.15)]',
		bgLight: 'bg-white',
		bgDark: 'bg-gradient-to-b from-cyan-950/40 via-slate-900/90 to-slate-950',
		badge: 'bg-cyan-500 text-white font-bold shadow-sm shadow-cyan-200/70 dark:bg-cyan-400 dark:text-slate-950 dark:shadow-[0_0_10px_rgba(6,182,212,0.5)]',
	},
	2: {
		border: 'border-purple-300 dark:border-purple-400',
		glow: 'shadow-sm shadow-purple-200/60 dark:shadow-[0_0_30px_rgba(168,85,247,0.4),inset_0_0_15px_rgba(168,85,247,0.15)]',
		bgLight: 'bg-white',
		bgDark: 'bg-gradient-to-b from-purple-950/40 via-slate-900/90 to-slate-950',
		badge: 'bg-purple-500 text-white font-bold shadow-sm shadow-purple-200/70 dark:bg-purple-400 dark:text-slate-950 dark:shadow-[0_0_10px_rgba(168,85,247,0.5)]',
	},
	3: {
		border: 'border-emerald-300 dark:border-emerald-400',
		glow: 'shadow-sm shadow-emerald-200/60 dark:shadow-[0_0_30px_rgba(16,185,129,0.4),inset_0_0_15px_rgba(16,185,129,0.15)]',
		bgLight: 'bg-white',
		bgDark: 'bg-gradient-to-b from-emerald-950/40 via-slate-900/90 to-slate-950',
		badge: 'bg-emerald-500 text-white font-bold shadow-sm shadow-emerald-200/70 dark:bg-emerald-400 dark:text-slate-950 dark:shadow-[0_0_10px_rgba(16,185,129,0.5)]',
	},
};

/** Common inactive-tab style shared by all three tracks. `bg-white` is light-only. */
const INACTIVE_TAB_CLASS_LIGHT =
	'border-slate-200 bg-white text-slate-500 shadow-none hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700';
const INACTIVE_TAB_CLASS_DARK =
	'border-slate-800/80 bg-slate-900/40 text-slate-400 shadow-none hover:border-slate-700 hover:bg-slate-900/70 hover:text-slate-200';

/** Tab navigation header — floating widget scrolls here on tab switch. */
export const AUDIT_TAB_ANCHOR_ID = 'audit-tab-anchor';

const VALID_TAB_IDS: readonly AuditResultTabId[] = ['geo', 'onpage', 'cwv'];

function isAuditResultTabId(value: unknown): value is AuditResultTabId {
	return typeof value === 'string' && (VALID_TAB_IDS as readonly string[]).includes(value);
}

interface AuditResultTabsProps {
	geoLabel: string;
	onpageLabel: string;
	cwvLabel: string;
	/** Track 2 · AI 검색 신뢰도 & 인용 지배력 (GEO). */
	geoContent: ReactNode;
	/** Track 1 · 기술 무결성 & Schema 진단 (default active). */
	onpageContent: ReactNode;
	/** Track 3 · Core Web Vitals & 웹 성능 실측. */
	cwvContent: ReactNode;
	/** Controlled tab (optional). */
	activeTab?: AuditResultTabId;
	onTabChange?: (tab: AuditResultTabId) => void;
	/** Public / A4 share view — stack all three track panels like print. */
	forceStack?: boolean;
}

function TabSectionHeader({
	title,
	description,
	weightBadge,
}: {
	title: string;
	description: string;
	weightBadge: string;
}) {
	return (
		<header className="flex flex-col gap-1">
			<div className="flex flex-wrap items-center gap-2">
				<h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white print:text-[#0B1C2C]">
					{title}
				</h2>
				<span className="inline-flex shrink-0 items-center rounded-full border border-[#C9A227]/35 bg-[#D4AF37]/10 px-2.5 py-0.5 text-[11px] font-extrabold tabular-nums text-[#8B6914] dark:bg-[#D4AF37]/10 dark:text-[#E8C547]">
					{weightBadge}
				</span>
			</div>
			<p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
				{description}
			</p>
		</header>
	);
}

function isPdfPrintingRoot(): boolean {
	return (
		typeof document !== 'undefined' &&
		(document.documentElement.classList.contains('pdf-printing') ||
			document.documentElement.classList.contains('print-mode'))
	);
}

/**
 * Screen: only the active panel is shown (via CSS, not Tailwind `hidden`).
 * PDF / print (`html.pdf-printing` or `@media print`): all three track
 * panels stack vertically so html2canvas and Save-as-PDF capture the full
 * report. Inactive tabs stay mounted in the print tree — never `display: none`.
 */
export function AuditResultTabs({
	geoLabel,
	onpageLabel,
	cwvLabel,
	geoContent,
	onpageContent,
	cwvContent,
	activeTab,
	onTabChange,
	forceStack = false,
}: AuditResultTabsProps) {
	const t = useTranslations('audit.tabs');
	const { theme } = useTheme();
	const isLight = theme === 'light';
	const [internalTab, setInternalTab] = useState<AuditResultTabId>(DEFAULT_AUDIT_RESULT_TAB);
	const [printExpand, setPrintExpand] = useState(() => forceStack || isPdfPrintingRoot());
	const [mountedTabs, setMountedTabs] = useState<Record<AuditResultTabId, boolean>>({
		onpage: true,
		geo: forceStack || isPdfPrintingRoot(),
		cwv: forceStack || isPdfPrintingRoot(),
	});
	const tab = activeTab ?? internalTab;
	const stackAll = forceStack;
	const mountAllTracks = forceStack || printExpand;

	function markMounted(next: AuditResultTabId) {
		setMountedTabs((prev) => (prev[next] ? prev : { ...prev, [next]: true }));
	}

	function setTab(next: AuditResultTabId) {
		markMounted(next);
		onTabChange?.(next);
		if (activeTab === undefined) setInternalTab(next);
	}

	useEffect(() => {
		if (forceStack || isPdfPrintingRoot()) {
			setPrintExpand(true);
			setMountedTabs({ geo: true, onpage: true, cwv: true });
		}
	}, [forceStack]);

	useEffect(() => {
		const onSwitch = (event: Event) => {
			const next = (event as CustomEvent<SwitchAuditResultTabDetail>).detail?.tab;
			if (!isAuditResultTabId(next)) return;
			markMounted(next);
			onTabChange?.(next);
			if (activeTab === undefined) setInternalTab(next);
		};
		const mountAll = () => {
			setPrintExpand(true);
			setMountedTabs({ geo: true, onpage: true, cwv: true });
		};
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
		if (mountAllTracks) return;
		const pending: AuditResultTabId[] = (['geo', 'cwv'] as const).filter((id) => !mountedTabs[id]);
		if (pending.length === 0) return;
		const win = window as Window & {
			requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
			cancelIdleCallback?: (id: number) => void;
		};
		const prefetch = () => pending.forEach(markMounted);
		if (typeof win.requestIdleCallback === 'function') {
			const id = win.requestIdleCallback(prefetch, { timeout: 2200 });
			return () => win.cancelIdleCallback?.(id);
		}
		const timer = window.setTimeout(prefetch, 1800);
		return () => window.clearTimeout(timer);
	}, [mountAllTracks, mountedTabs.geo, mountedTabs.cwv]);

	const onpageActive = tab === 'onpage' || stackAll;
	const geoActive = tab === 'geo' || stackAll;
	const cwvActive = tab === 'cwv' || stackAll;
	const renderOnpage = mountAllTracks || mountedTabs.onpage || onpageActive;
	const renderGeo = mountAllTracks || mountedTabs.geo || geoActive;
	const renderCwv = mountAllTracks || mountedTabs.cwv || cwvActive;

	const navItems = [
		{ id: 'onpage' as const, track: 1 as const, label: onpageLabel, subTitle: t('onpageSub') },
		{ id: 'geo' as const, track: 2 as const, label: geoLabel, subTitle: t('geoSub') },
		{ id: 'cwv' as const, track: 3 as const, label: cwvLabel, subTitle: t('cwvSub') },
	];

	return (
		<div
			id="audit-tab-root"
			className={`audit-result-tabs w-full max-w-full overflow-visible box-border flex flex-col gap-8${
				stackAll ? ' audit-result-tabs--stack' : ''
			}`}
		>
			<ol className="pdf-print-only pdf-page-item m-0 flex list-none flex-col gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
				{navItems.map((item) => (
					<li
						key={`print-index-${item.id}`}
						className="text-[12px] font-extrabold text-slate-800"
					>
						{t('trackBadge', { n: item.track })} · {item.label}
						<span className="ml-2 text-[10px] font-bold text-slate-500">
							{t('weightBadge', { pct: TRACK_WEIGHT_PCT[item.track] })}
						</span>
					</li>
				))}
			</ol>
			<nav
				id={AUDIT_TAB_ANCHOR_ID}
				className={`print:hidden pdf-screen-only scroll-mt-24 grid w-full grid-cols-1 gap-3.5 md:grid-cols-3${stackAll ? ' hidden' : ''}`}
			>
				{navItems.map((item) => {
					const isActive = tab === item.id;
					const trackTheme = TRACK_ACTIVE_THEME[item.track];
					return (
						<button
							key={item.id}
							type="button"
							onClick={() => setTab(item.id)}
							aria-pressed={isActive}
							className={`group flex w-full flex-col items-center justify-center gap-1 rounded-xl border-2 px-4 py-2.5 text-center transition-all duration-300 ease-out ${
								isActive
									? `${trackTheme.border} ${isLight ? trackTheme.bgLight : trackTheme.bgDark} ${trackTheme.glow}`
									: isLight
										? INACTIVE_TAB_CLASS_LIGHT
										: INACTIVE_TAB_CLASS_DARK
							}`}
						>
							<span className="flex items-center justify-center gap-1.5">
								<span
									className={`flex h-6 shrink-0 items-center justify-center rounded-full px-2 text-[10px] tracking-wide ${
										isActive ? trackTheme.badge : 'font-extrabold bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-400'
									}`}
								>
									{t('trackBadge', { n: item.track })}
								</span>
								<span
									className={`flex h-6 shrink-0 items-center justify-center rounded-full px-2 text-[10px] font-extrabold tabular-nums tracking-wide ${
										isActive
											? 'bg-[#D4AF37]/25 text-[#8B6914] dark:text-[#F0D264]'
											: 'bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400'
									}`}
								>
									{t('weightBadge', { pct: TRACK_WEIGHT_PCT[item.track] })}
								</span>
							</span>
							<span className="flex flex-col items-center justify-center text-center gap-0.5">
								<span
									className={`text-sm font-semibold sm:text-base ${
										isActive
											? 'text-slate-900 dark:text-slate-100'
											: 'text-slate-600 group-hover:text-slate-900 dark:text-slate-300 dark:group-hover:text-slate-100'
									}`}
								>
									{item.label}
								</span>
								<span
									className={`text-[11px] font-mono font-medium uppercase tracking-wider sm:text-xs ${
										isActive
											? TRACK_ACTIVE_SUBTITLE[item.track]
											: 'text-slate-400 group-hover:text-slate-500 dark:group-hover:text-slate-300'
									}`}
								>
									{item.subTitle}
								</span>
							</span>
						</button>
					);
				})}
			</nav>

			{/*
			 * Print/PDF: every track panel stays in the DOM (`display:flex` via
			 * `html.pdf-printing .audit-result-tab-panel`) so capture is not
			 * gated on `activeTab`. Screen still shows only the active panel.
			 */}
			<div
				id="sec-print-track-1"
				className={`audit-result-tab-panel pdf-page-item w-full max-w-full overflow-visible box-border flex flex-col gap-8 ${
					onpageActive ? 'is-active' : ''
				}${onpageActive && !stackAll ? ' audit-tab-fade-in' : ''}`}
			>
				<p className="pdf-print-only text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-500">
					{t('trackBadge', { n: 1 })}. {onpageLabel}
				</p>
				<TabSectionHeader
					title={t('onpageTitle')}
					description={t('onpageDescription')}
					weightBadge={t('weightBadge', { pct: TRACK_WEIGHT_PCT[1] })}
				/>
				{renderOnpage ? onpageContent : null}
			</div>
			<div
				id="sec-print-track-2"
				className={`audit-result-tab-panel pdf-page-item w-full max-w-full overflow-visible box-border flex flex-col gap-8 ${
					geoActive ? 'is-active' : ''
				}${geoActive && !stackAll ? ' audit-tab-fade-in' : ''}`}
			>
				<p className="pdf-print-only text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-500">
					{t('trackBadge', { n: 2 })}. {geoLabel}
				</p>
				<TabSectionHeader
					title={t('geoTitle')}
					description={t('geoDescription')}
					weightBadge={t('weightBadge', { pct: TRACK_WEIGHT_PCT[2] })}
				/>
				{renderGeo ? geoContent : null}
			</div>
			<div
				id="sec-print-track-3"
				className={`audit-result-tab-panel pdf-page-item w-full max-w-full overflow-visible box-border flex flex-col gap-8 ${
					cwvActive ? 'is-active' : ''
				}${cwvActive && !stackAll ? ' audit-tab-fade-in' : ''}`}
			>
				<p className="pdf-print-only text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-500">
					{t('trackBadge', { n: 3 })}. {cwvLabel}
				</p>
				<TabSectionHeader
					title={t('cwvTitle')}
					description={t('cwvDescription')}
					weightBadge={t('weightBadge', { pct: TRACK_WEIGHT_PCT[3] })}
				/>
				{renderCwv ? cwvContent : null}
			</div>
		</div>
	);
}
