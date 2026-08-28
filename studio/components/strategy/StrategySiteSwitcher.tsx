'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { rememberAudit } from '@/lib/audit/report-client-cache';
import { resolveHistoryMeasuredHeadline, saveGuestAudit, type AuditHistoryEntry } from '@/lib/audit-history-storage';
import { formatTargetCategory } from '@/lib/audit/target-entity';
import { getGradeBadgeStyle } from '@/lib/audit/score-grade';
import { hostFromUrl } from '@/lib/strategy/common-engine';
import { buildStrategyStudioHref, sameStrategySite } from '@/lib/strategy/strategy-url';

const LIST_LIMIT = 8;

function siteHost(raw: string): string {
	return hostFromUrl(raw);
}

function formatAuditedAt(value: string, locale: string): string {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return value;
	return new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'ko-KR', {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
	}).format(date);
}

function industryLabel(item: AuditHistoryEntry, lang: 'ko' | 'en'): string {
	const meta = item.report?.siteMeta;
	if (!meta) return '';
	const label = formatTargetCategory(meta, lang).trim();
	if (!label || label === (lang === 'en' ? 'General' : '일반')) return '';
	return label;
}

export function StrategySiteSwitcher({
	currentId,
	currentUrl,
	currentIndustry,
	history,
	loading,
}: {
	currentId: string | null;
	currentUrl: string;
	currentIndustry: string;
	history: AuditHistoryEntry[];
	loading?: boolean;
}) {
	const t = useTranslations('strategyStudio');
	const locale = useLocale();
	const lang = locale === 'en' ? 'en' : 'ko';
	const router = useRouter();
	const rootRef = useRef<HTMLDivElement>(null);
	const [open, setOpen] = useState(false);

	const rows = useMemo(() => {
		const seen = new Set<string>();
		const out: AuditHistoryEntry[] = [];
		for (const item of history) {
			if (!item?.id || !item.url) continue;
			if (seen.has(item.id)) continue;
			seen.add(item.id);
			out.push(item);
			if (out.length >= LIST_LIMIT) break;
		}
		return out;
	}, [history]);

	useEffect(() => {
		if (!open) return;
		function onPointer(event: MouseEvent) {
			if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
		}
		function onKey(event: KeyboardEvent) {
			if (event.key === 'Escape') setOpen(false);
		}
		document.addEventListener('mousedown', onPointer);
		document.addEventListener('keydown', onKey);
		return () => {
			document.removeEventListener('mousedown', onPointer);
			document.removeEventListener('keydown', onKey);
		};
	}, [open]);

	function selectSite(item: AuditHistoryEntry) {
		if (item.id === currentId) {
			setOpen(false);
			return;
		}
		if (item.report?.url) {
			rememberAudit(item.id, item.report);
			saveGuestAudit(item.id, item.report);
		}
		setOpen(false);
		router.push(buildStrategyStudioHref(item.id, null, item.url));
	}

	const host = siteHost(currentUrl);

	return (
		<div ref={rootRef} className="relative">
			<p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">SITE</p>
			<button
				type="button"
				aria-haspopup="listbox"
				aria-expanded={open}
				aria-label={t('siteSwitcherOpen')}
				onClick={() => setOpen((prev) => !prev)}
				className="mt-2 flex w-full items-start justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2.5 text-left transition hover:border-slate-400 dark:border-white/15 dark:hover:border-white/35"
			>
				<span className="min-w-0">
					<span className="block break-all font-mono text-xl font-semibold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
						{host}
					</span>
					{currentIndustry ? (
						<span className="mt-2 inline-flex rounded-full border border-slate-200 px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-slate-600 dark:border-white/15 dark:text-slate-300">
							{currentIndustry}
						</span>
					) : null}
				</span>
				<span className="mt-2 shrink-0 text-slate-400" aria-hidden="true">
					{open ? '▴' : '▾'}
				</span>
			</button>

			{open ? (
				<div
					role="listbox"
					className="absolute z-20 mt-2 w-full min-w-[18rem] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-white/15 dark:bg-[#0b1726]"
				>
					{loading && !rows.length ? (
						<p className="px-4 py-3 text-[13px] text-slate-500">{t('siteSwitcherLoading')}</p>
					) : null}
					{!loading && !rows.length ? (
						<p className="px-4 py-3 text-[13px] text-slate-500">{t('siteSwitcherEmpty')}</p>
					) : null}
					<ul className="max-h-80 overflow-y-auto py-1">
						{rows.map((item) => {
							const selected = item.id === currentId || sameStrategySite(item.url, currentUrl);
							const headline = resolveHistoryMeasuredHeadline(item);
							const industry = industryLabel(item, lang);
							return (
								<li key={item.id}>
									<button
										type="button"
										role="option"
										aria-selected={selected}
										onClick={() => selectSite(item)}
										className={`flex w-full items-start justify-between gap-3 px-4 py-2.5 text-left transition ${
											selected
												? 'bg-slate-100 dark:bg-white/10'
												: 'hover:bg-slate-50 dark:hover:bg-white/5'
										}`}
									>
										<span className="min-w-0">
											<span className="block truncate font-mono text-[13px] font-semibold text-slate-800 dark:text-slate-100">
												{siteHost(item.url)}
											</span>
											<span className="mt-0.5 block text-[11px] text-slate-400">
												{[industry, formatAuditedAt(item.createdAt || item.fetchedAt, locale)]
													.filter(Boolean)
													.join(' · ')}
											</span>
										</span>
										<span
											className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${getGradeBadgeStyle(headline.grade)}`}
										>
											{headline.grade}
											<span className="font-mono font-semibold">{headline.score}</span>
										</span>
									</button>
								</li>
							);
						})}
					</ul>
					<Link
						href="/audit"
						className="flex items-center gap-2 border-t border-slate-200 px-4 py-2.5 text-[13px] font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/5"
					>
						<span aria-hidden="true">+</span>
						{t('siteNewAudit')}
					</Link>
				</div>
			) : null}
		</div>
	);
}
