'use client';

import { useState, type ReactNode } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ImageAltCoverageList } from '@/components/audit/ImageAltCoverageList';
import {
	missingHeadingLevels,
	normalizeImageAltIssues,
	type H1ElementDetail,
	type HeadingOutlineNode,
	type HeadingSkipDetail,
	type ImageAltIssue,
} from '@/lib/audit/extractors/heading-alt-details';
import {
	RENDER_BLOCKING_RECOMMENDED_MAX,
	displayPageUrl,
	type RenderBlockingScript,
} from '@/lib/audit/extractors/page-resource-trackers';
import type { AuditCheckItem } from '@/lib/site-auditor';

function boundImageAltIssues(item: AuditCheckItem): ImageAltIssue[] {
	const fromCamel = normalizeImageAltIssues(item.imageAltIssues);
	if (fromCamel.length) return fromCamel;
	return normalizeImageAltIssues(
		item.missing_images || item.missing_alt_list || item.details?.missing_images,
	);
}

function ChecklistDetailScroll({ children }: { children: ReactNode }) {
	return (
		<div className="checklist-detail-scroll custom-scrollbar box-border w-full max-w-full bg-slate-50 dark:border-white/10 dark:bg-slate-900/70">
			{children}
		</div>
	);
}

function CopyButton({
	value,
	label,
	copiedLabel,
}: {
	value: string;
	label: string;
	copiedLabel: string;
}) {
	const [copied, setCopied] = useState(false);
	const onCopy = async () => {
		try {
			await navigator.clipboard.writeText(value);
			setCopied(true);
			window.setTimeout(() => setCopied(false), 1400);
		} catch {
			/* clipboard unavailable */
		}
	};
	return (
		<button
			type="button"
			onClick={onCopy}
			className="print:hidden flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs text-slate-200 transition-colors hover:bg-slate-700 active:bg-slate-600"
		>
			{copied ? copiedLabel : label}
		</button>
	);
}

function RenderBlockingScriptList({ items }: { items: RenderBlockingScript[] }) {
	const t = useTranslations('audit.checklist.detailScroll');
	const locale = useLocale();
	const pageLang = locale.toLowerCase().startsWith('en') ? 'en' : 'ko';
	const recLabel = (row: RenderBlockingScript) => {
		if (row.recommendationKind === 'move_to_body_end') return t('recMoveToBody');
		if (row.recommendationKind === 'add_defer') return t('recDefer');
		return row.recommendation;
	};

	if (items.length === 0) {
		return <p className="text-[11px] text-slate-500">{t('renderBlockingEmpty')}</p>;
	}

	return (
		<ChecklistDetailScroll>
			<p className="mb-2 text-[11px] font-bold text-slate-700 dark:text-slate-200">
				{t('renderBlockingSummary', {
					count: items.length,
					max: RENDER_BLOCKING_RECOMMENDED_MAX,
				})}
			</p>
			<ul className="flex w-full max-w-full flex-col gap-2.5">
				{items.map((row, idx) => (
					<li
						key={`${row.pageUrl}-${row.scriptSrc}-${idx}`}
						className="render-blocking-card box-border w-full max-w-full overflow-hidden rounded-xl border border-slate-800 bg-slate-950/90"
					>
						<div className="flex w-full max-w-full flex-wrap items-center justify-between gap-1.5 border-b border-slate-800 px-2.5 py-1.5">
							<span
								className="render-blocking-path-tag min-w-0 max-w-full truncate rounded-md border border-slate-700 bg-slate-800 px-2 py-0.5 text-xs text-slate-300"
								title={row.pageUrl}
							>
								{displayPageUrl(row.pageUrl, pageLang) || row.scriptSrc}
							</span>
							<CopyButton value={row.fullTag} label={t('copyTag')} copiedLabel={t('copied')} />
						</div>
						<pre className="code-tag custom-scrollbar box-border block w-full max-w-full overflow-hidden whitespace-pre-wrap break-all p-3.5 font-mono text-xs leading-relaxed text-emerald-400 selection:bg-emerald-500/30 sm:text-sm">
							<code className="block w-full max-w-full overflow-hidden whitespace-pre-wrap break-all">
								{row.fullTag}
							</code>
						</pre>
						<div className="w-full max-w-full border-t border-slate-800 px-2.5 py-1.5">
							<span className="render-blocking-rec-badge inline-block rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-300">
								{recLabel(row)}
							</span>
						</div>
					</li>
				))}
			</ul>
		</ChecklistDetailScroll>
	);
}

function MultipleH1List({ elements }: { elements: H1ElementDetail[] }) {
	const t = useTranslations('audit.checklist.detailScroll');

	return (
		<ChecklistDetailScroll>
			<p className="mb-2 text-[11px] font-bold text-slate-700 dark:text-slate-200">
				{t('h1Count', { count: elements.length })}
			</p>
			<ol className="flex flex-col gap-1.5">
				{elements.map((el, idx) => {
					const keep = idx === 0;
					return (
						<li
							key={`${el.selector}-${idx}`}
							className="rounded-md border border-slate-200/80 bg-white/80 px-2 py-1.5 dark:border-white/10 dark:bg-white/[0.03]"
						>
							<div className="flex flex-wrap items-center gap-1.5">
								<span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold text-white dark:bg-slate-200 dark:text-slate-900">
									H1 #{el.index ?? idx + 1}
								</span>
								<span
									className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
										keep
											? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300'
											: 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300'
									}`}
								>
									{keep ? t('h1Keep') : t('h1Demote')}
								</span>
							</div>
							<p className="mt-1 text-[12px] font-medium text-slate-800 dark:text-slate-100">
								{el.text || t('h1Empty')}
							</p>
							{el.selector ? (
								<p className="mt-0.5 truncate font-mono text-[10px] text-slate-400" title={el.selector}>
									{el.selector}
								</p>
							) : null}
						</li>
					);
				})}
			</ol>
		</ChecklistDetailScroll>
	);
}

function HeadingSkipList({
	outline,
	skips,
}: {
	outline: HeadingOutlineNode[];
	skips: HeadingSkipDetail[];
}) {
	const t = useTranslations('audit.checklist.detailScroll');
	const nodes =
		outline.length > 0
			? outline
			: skips.map((skip) => ({
					level: Number(String(skip.to).replace(/\D/g, '')) || 0,
					text: skip.text,
					selector: skip.selector,
					skip: true,
					fromLevel: Number(String(skip.from).replace(/\D/g, '')) || undefined,
				}));

	const trail = nodes
		.map((node) => {
			const missing =
				node.skip && node.fromLevel != null ? missingHeadingLevels(node.fromLevel, node.level) : '';
			const label = `[H${node.level}] ${node.text || '—'}`.trim();
			return node.skip
				? `⚠️ ${label} (${t('headingSkipWarn', { missing: missing || `H${(node.level || 1) - 1}` })})`
				: label;
		})
		.join(' → ');

	return (
		<ChecklistDetailScroll>
			<p className="mb-2 text-[11px] leading-relaxed text-slate-700 dark:text-slate-200">{trail}</p>
			<ol className="flex flex-col gap-1">
				{nodes.map((node, nodeIdx) => {
					const missing =
						node.skip && node.fromLevel != null
							? missingHeadingLevels(node.fromLevel, node.level)
							: '';
					return (
						<li
							key={`${node.selector}-${nodeIdx}`}
							className={`flex items-start gap-2 rounded-md px-2 py-1.5 ${
								node.skip
									? 'border border-amber-300 bg-amber-50 dark:border-amber-700/60 dark:bg-amber-950/40'
									: 'border border-transparent'
							}`}
						>
							<span className="mt-0.5 shrink-0 rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold text-white dark:bg-slate-200 dark:text-slate-900">
								H{node.level}
							</span>
							<div className="min-w-0 flex-1">
								<p className="text-[12px] font-medium text-slate-800 dark:text-slate-100">
									{node.skip ? (
										<>
											<span className="mr-1">⚠️</span>
											{t('headingSkipWarn', { missing: missing || `H${(node.level || 1) - 1}` })}
										</>
									) : null}{' '}
									{node.text || '—'}
								</p>
								{node.selector ? (
									<p className="truncate font-mono text-[10px] text-slate-400" title={node.selector}>
										{node.selector}
									</p>
								) : null}
							</div>
						</li>
					);
				})}
			</ol>
		</ChecklistDetailScroll>
	);
}

export function ChecklistIssueDetails({ item }: { item: AuditCheckItem }) {
	const t = useTranslations('audit.checklist.detailScroll');

	if (item.id === 'render-blocking' && item.renderBlockingScriptItems && item.renderBlockingScriptItems.length > 0) {
		return (
			<div>
				<p className="mb-1 font-bold uppercase tracking-wide text-slate-500">{t('renderBlockingTitle')}</p>
				<RenderBlockingScriptList items={item.renderBlockingScriptItems} />
			</div>
		);
	}

	if (item.id === 'image-alt') {
		const issues = boundImageAltIssues(item);
		const missingCount = item.imagesMissingAlt ?? item.missing_images?.length ?? issues.length;
		if (issues.length > 0 || (missingCount ?? 0) > 0) {
			return (
				<div>
					<p className="mb-1 font-bold uppercase tracking-wide text-slate-500">{t('imageAltTitle')}</p>
					<ImageAltCoverageList
						issues={issues}
						coveragePct={item.imageAltCoveragePct}
						missingCount={missingCount}
					/>
				</div>
			);
		}
	}

	if (item.id === 'single-h1' && item.h1Elements && item.h1Elements.length !== 1) {
		return (
			<div>
				<p className="mb-1 font-bold uppercase tracking-wide text-slate-500">{t('h1Title')}</p>
				<MultipleH1List elements={item.h1Elements} />
			</div>
		);
	}

	if (
		item.id === 'heading-skip' &&
		((item.headingSkips && item.headingSkips.length > 0) ||
			(item.headingOutline && item.headingOutline.some((node) => node.skip)))
	) {
		return (
			<div>
				<p className="mb-1 font-bold uppercase tracking-wide text-slate-500">{t('headingSkipTitle')}</p>
				<HeadingSkipList outline={item.headingOutline ?? []} skips={item.headingSkips ?? []} />
			</div>
		);
	}

	return null;
}

export function checklistHasStructuredDetails(item: AuditCheckItem): boolean {
	if (item.id === 'render-blocking') return Boolean(item.renderBlockingScriptItems?.length);
	if (item.id === 'image-alt') {
		return (
			boundImageAltIssues(item).length > 0 ||
			Boolean(item.imagesMissingAlt && item.imagesMissingAlt > 0)
		);
	}
	if (item.id === 'single-h1') return Boolean(item.h1Elements && item.h1Elements.length !== 1);
	if (item.id === 'heading-skip') {
		return Boolean(
			item.headingSkips?.length || item.headingOutline?.some((node) => node.skip),
		);
	}
	return false;
}
