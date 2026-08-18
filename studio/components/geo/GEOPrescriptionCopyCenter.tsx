'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Bot, Check, ClipboardCopy, Code2, FileText, MapPin, MessageCircleQuestion, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { LlmsTxtImpactCard } from '@/components/audit/LlmsTxtImpactCard';
import { PrescriptionAppliedBadge } from '@/components/geo/PrescriptionAppliedBadge';
import { CustomSelect } from '@/components/ui/CustomSelect';
import {
	collectCopyCenterKeywordOptions,
	copyCenterClipboardBundle,
	generatePrescriptionCode,
	industryConfigFromContext,
	normalizeTargetKeywords,
	padTargetKeywords,
	resolveCopyCenterMenus,
	type RankedTargetKeywords,
} from '@/lib/geo/copy-center';
import { geoAnswerCenterModuleAnchor } from '@/lib/audit/exec-brief';
import { HTTPS_P0_LABEL, HTTPS_SECURITY_ALERT, resolveIsHttps } from '@/lib/audit/scoreCalculator';
import { contextFromDiagnostic } from '@/lib/geo/prescription-patches';
import type { PrescriptionAfterOptions, PrescriptionLang } from '@/lib/geo/prescription-after';
import type { GeoDiagnosticReport } from '@/types/geo-diagnostic';
import type { KeywordWeight } from '@/types/geo-prescription';

export interface GEOPrescriptionCopyCenterProps {
	report: GeoDiagnosticReport;
	lang: PrescriptionLang;
	opts?: PrescriptionAfterOptions;
	keywordWeights?: readonly KeywordWeight[] | null;
	/** Increment to force-open the keyword editor (reapply / keyword change). */
	editorOpenRequest?: number;
	/** Keep 6-engine To-Be queries 1:1 with Answer Center ranks. */
	onTargetKeywordsChange?: (keywords: string[]) => void;
}

type CopyModuleId = 'schema' | 'faq' | 'maps' | 'blog' | 'llms';

const RANKS = [1, 2, 3] as const;

const COPY_LABEL_KEY: Record<CopyModuleId, 'copyCode' | 'copyText' | 'copyArticle'> = {
	schema: 'copyCode',
	faq: 'copyCode',
	maps: 'copyText',
	blog: 'copyArticle',
	llms: 'copyCode',
};

function formatRegenClock(at: Date): string {
	const hh = String(at.getHours()).padStart(2, '0');
	const mm = String(at.getMinutes()).padStart(2, '0');
	const ss = String(at.getSeconds()).padStart(2, '0');
	return `${hh}:${mm}:${ss}`;
}

function CompactCopyButton({
	copied,
	onCopy,
	label,
	copiedLabel,
}: {
	copied: boolean;
	onCopy: () => void;
	label: string;
	copiedLabel: string;
}) {
	return (
		<button
			type="button"
			onClick={onCopy}
			aria-live="polite"
			className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-semibold transition ${
				copied
					? 'border border-transparent text-emerald-500'
					: 'border border-slate-200/90 bg-white/90 text-slate-600 hover:bg-slate-50 hover:text-slate-800 dark:border-white/15 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white'
			}`}
		>
			{copied ? <Check className="h-3 w-3" aria-hidden /> : <ClipboardCopy className="h-3 w-3" aria-hidden />}
			{copied ? copiedLabel : label}
		</button>
	);
}

async function writeClipboard(text: string): Promise<boolean> {
	try {
		await navigator.clipboard.writeText(text);
		return true;
	} catch {
		try {
			const ta = document.createElement('textarea');
			ta.value = text;
			ta.setAttribute('readonly', '');
			ta.style.position = 'fixed';
			ta.style.left = '-9999px';
			document.body.appendChild(ta);
			ta.select();
			const ok = document.execCommand('copy');
			document.body.removeChild(ta);
			return ok;
		} catch {
			return false;
		}
	}
}

function hasDuplicateRanks(keywords: RankedTargetKeywords): boolean {
	const filled = keywords.map((item) => item.replace(/\s+/g, ' ').trim().toLowerCase()).filter(Boolean);
	return new Set(filled).size !== filled.length;
}

export function TargetKeywordCustomizer({
	open,
	onToggle,
	draft,
	onDraftChange,
	options,
	error,
	generated,
	onRegenerate,
}: {
	open: boolean;
	onToggle: () => void;
	draft: RankedTargetKeywords;
	onDraftChange: (rankIndex: 0 | 1 | 2, value: string) => void;
	options: readonly string[];
	error: string | null;
	generated: boolean;
	onRegenerate: () => void;
}) {
	const t = useTranslations('audit.geoCopyCenter');
	const duplicate = hasDuplicateRanks(draft);

	if (!open) return null;

	return (
		<div
			id="geo-target-keyword-editor"
			className="mt-3 rounded-2xl border border-indigo-200/80 bg-white/90 p-3.5 dark:border-indigo-400/25 dark:bg-white/[0.04]"
		>
			<div className="flex items-start justify-between gap-2">
				<p className="text-sm font-extrabold text-slate-900 dark:text-white">{t('editorTitle')}</p>
				<button
					type="button"
					onClick={onToggle}
					className="text-[11px] font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
				>
					{t('closeEditor')}
				</button>
			</div>
			<p className="mt-1.5 text-[12px] leading-relaxed text-slate-600 dark:text-slate-400">{t('customizeHint')}</p>

			<div
				className="mt-2.5 rounded-xl border border-sky-200/80 bg-sky-50/80 px-3 py-2.5 dark:border-sky-400/20 dark:bg-sky-500/[0.08]"
				role="note"
			>
				<p className="text-[12px] font-extrabold tracking-wide text-sky-800 dark:text-sky-200">{t('sourceTipTitle')}</p>
				<p className="mt-1 text-[12px] leading-relaxed text-sky-950/75 dark:text-sky-100/80">{t('sourceTip')}</p>
			</div>

			<div className="mt-3 grid grid-cols-1 gap-2.5">
				{RANKS.map((rank, index) => {
					const rankIndex = index as 0 | 1 | 2;
					const value = draft[rankIndex];
					const matched = options.includes(value);
					const selectId = `geo-kw-select-${rank}`;
					const inputId = `geo-kw-input-${rank}`;
					return (
						<div
							key={rank}
							className="grid grid-cols-1 gap-2 rounded-xl border border-slate-200/80 bg-slate-50/80 p-2.5 sm:grid-cols-[4.5rem_minmax(0,1fr)_minmax(0,1.15fr)] sm:items-center dark:border-white/10 dark:bg-black/20"
						>
							<span className="inline-flex w-fit items-center rounded-full bg-gradient-to-r from-cyan-500 to-indigo-500 px-2 py-0.5 text-[10px] font-extrabold text-white">
								{t('rank', { rank })}
							</span>
							<div className="min-w-0">
								<label htmlFor={selectId} className="sr-only">
									{t('selectLabel', { rank })}
								</label>
								<CustomSelect
									id={selectId}
									value={matched ? value : ''}
									onChange={(event) => onDraftChange(rankIndex, event.target.value)}
									className="text-[12px] font-semibold"
								>
									<option value="">{value && !matched ? t('customOption') : t('selectPlaceholder')}</option>
									{options.map((option) => (
										<option key={`${rank}-${option}`} value={option}>
											{option}
										</option>
									))}
								</CustomSelect>
							</div>
							<div className="min-w-0">
								<label htmlFor={inputId} className="sr-only">
									{t('inputLabel', { rank })}
								</label>
								<input
									id={inputId}
									value={value}
									onChange={(event) => onDraftChange(rankIndex, event.target.value)}
									placeholder={t('inputPlaceholder')}
									autoComplete="off"
									className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-[12px] font-semibold text-slate-800 outline-none ring-cyan-400/0 transition placeholder:font-medium placeholder:text-slate-400 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/40 dark:border-white/10 dark:bg-black/40 dark:text-slate-100"
								/>
							</div>
						</div>
					);
				})}
			</div>

			<p
				className={
					duplicate
						? 'mt-2.5 rounded-xl border border-amber-200/80 bg-amber-50/80 px-3 py-2 text-[12px] font-semibold leading-relaxed text-amber-800 dark:border-amber-400/20 dark:bg-amber-500/[0.08] dark:text-amber-200'
						: 'mt-2.5 rounded-xl border border-slate-200/70 bg-slate-50/80 px-3 py-2 text-[12px] font-semibold leading-relaxed text-slate-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-400'
				}
			>
				{t('duplicateWarning')}
			</p>
			{error ? <p className="mt-2 text-[11px] font-semibold text-rose-600 dark:text-rose-300">{error}</p> : null}

			<div className="mt-3 flex flex-wrap items-center gap-2">
				<button
					type="button"
					onClick={onRegenerate}
					className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-500 px-3.5 py-2 text-[12px] font-extrabold text-white shadow-sm shadow-indigo-950/20 transition hover:from-cyan-400 hover:to-indigo-400"
				>
					{t('regenerate')}
				</button>
				{generated ? (
					<p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300" aria-live="polite">
						{t('regenerated')}
					</p>
				) : null}
			</div>
		</div>
	);
}

export function GEOPrescriptionCopyCenter({
	report,
	lang,
	opts,
	keywordWeights,
	editorOpenRequest = 0,
	onTargetKeywordsChange,
}: GEOPrescriptionCopyCenterProps) {
	const t = useTranslations('audit.geoCopyCenter');
	const reduceMotion = useReducedMotion();
	const [copiedId, setCopiedId] = useState<CopyModuleId | null>(null);
	const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const generatedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const customizedRef = useRef(false);

	const aiKeywords = useMemo(
		() => padTargetKeywords(resolveCopyCenterMenus(report, lang, opts, keywordWeights).map((menu) => menu.name)),
		[report, lang, opts, keywordWeights],
	);
	const keywordOptions = useMemo(
		() => collectCopyCenterKeywordOptions(report, lang, opts, keywordWeights),
		[report, lang, opts, keywordWeights],
	);

	const [targetKeywords, setTargetKeywords] = useState<RankedTargetKeywords>(aiKeywords);
	const [draft, setDraft] = useState<RankedTargetKeywords>(aiKeywords);
	const [editorOpen, setEditorOpen] = useState(false);
	const [formError, setFormError] = useState<string | null>(null);
	const [generated, setGenerated] = useState(false);
	const [isRegenerated, setIsRegenerated] = useState(false);
	const [lastRegeneratedAt, setLastRegeneratedAt] = useState<Date | null>(null);
	const [flashKey, setFlashKey] = useState(0);

	useEffect(() => {
		customizedRef.current = false;
		setTargetKeywords(aiKeywords);
		setDraft(aiKeywords);
		setEditorOpen(false);
		setFormError(null);
		setGenerated(false);
		setIsRegenerated(false);
		setLastRegeneratedAt(null);
		setFlashKey(0);
	}, [report.targetUrl, report.brandName, lang]);

	useEffect(() => {
		if (editorOpenRequest > 0) setEditorOpen(true);
	}, [editorOpenRequest]);

	useEffect(() => {
		if (customizedRef.current) return;
		setTargetKeywords(aiKeywords);
		setDraft(aiKeywords);
	}, [aiKeywords]);

	useEffect(() => {
		const synced = normalizeTargetKeywords(targetKeywords);
		if (synced.length) onTargetKeywordsChange?.(synced);
	}, [targetKeywords, onTargetKeywordsChange]);

	const payload = useMemo(
		() => generatePrescriptionCode(report, targetKeywords, lang, opts),
		[report, targetKeywords, lang, opts],
	);
	const clipboard = useMemo(() => copyCenterClipboardBundle(payload), [payload]);
	const industry = useMemo(() => {
		const ctx = contextFromDiagnostic(report, lang, {
			industryType: opts?.industryType,
			category: opts?.category,
			location: opts?.location,
			targetKeywords: payload.menus.map((menu) => menu.name),
			existingSchemaTypes: opts?.existingSchemaTypes,
			description: opts?.description || opts?.ogDescription,
		});
		return industryConfigFromContext(ctx, payload.menus);
	}, [report, lang, opts, payload.menus]);

	useEffect(() => {
		return () => {
			if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
			if (generatedTimerRef.current) window.clearTimeout(generatedTimerRef.current);
		};
	}, []);

	async function copyModule(id: CopyModuleId, text: string) {
		const ok = await writeClipboard(text);
		if (!ok) return;
		if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
		setCopiedId(id);
		copyTimerRef.current = setTimeout(() => setCopiedId(null), 2000);
	}

	function handleDraftChange(rankIndex: 0 | 1 | 2, value: string) {
		setDraft((prev) => {
			const next: RankedTargetKeywords = [...prev];
			next[rankIndex] = value;
			return next;
		});
		setFormError(null);
		setGenerated(false);
		setIsRegenerated(false);
	}

	function handleRegenerate() {
		const next = padTargetKeywords(normalizeTargetKeywords(draft));
		if (!next[0]) {
			setFormError(t('rank1Required'));
			return;
		}
		customizedRef.current = true;
		setTargetKeywords(next);
		setDraft(next);
		setFormError(null);
		setGenerated(true);
		setIsRegenerated(true);
		setLastRegeneratedAt(new Date());
		setFlashKey((key) => key + 1);
		if (generatedTimerRef.current) window.clearTimeout(generatedTimerRef.current);
		generatedTimerRef.current = setTimeout(() => setGenerated(false), 4000);
	}

	const appliedBadge = useMemo(() => {
		const summary = targetKeywords
			.map((keyword, index) => {
				const name = keyword.replace(/\s+/g, ' ').trim();
				return name ? t('rankKeyword', { rank: index + 1, keyword: name }) : null;
			})
			.filter((part): part is string => Boolean(part))
			.join(', ');
		return summary ? t('appliedBadge', { summary }) : null;
	}, [t, targetKeywords]);

	const modules: Array<{
		id: CopyModuleId;
		icon: typeof Code2;
		title: string;
		hint: string;
		badge: string;
		content: string;
		preview: string;
		code: boolean;
	}> = [
		{
			id: 'schema',
			icon: Code2,
			title: t('modules.schema.title'),
			hint: t('modules.schema.hint'),
			badge: t('modules.schema.badge'),
			content: clipboard.schema,
			preview: payload.schemaJson,
			code: true,
		},
		{
			id: 'faq',
			icon: MessageCircleQuestion,
			title: t('modules.faq.title'),
			hint: t('modules.faq.hint'),
			badge: t('modules.faq.badge'),
			content: clipboard.faq,
			preview: payload.faqJson,
			code: true,
		},
		{
			id: 'maps',
			icon: MapPin,
			title: t('modules.maps.title'),
			hint: t('modules.maps.hint'),
			badge: t('modules.maps.badge'),
			content: clipboard.maps,
			preview: payload.mapsText,
			code: false,
		},
		{
			id: 'blog',
			icon: FileText,
			title: t('modules.blog.title'),
			hint: t('modules.blog.hint'),
			badge: t('modules.blog.badge'),
			content: clipboard.blog,
			preview: payload.blogArticle,
			code: false,
		},
		{
			id: 'llms',
			icon: Bot,
			title: t('modules.llms.title'),
			hint: t('modules.llms.hint'),
			badge: t('modules.llms.badge'),
			content: clipboard.llms,
			preview: payload.llmsTxt,
			code: true,
		},
	];

	return (
		<motion.section
			initial={reduceMotion ? false : { opacity: 0, y: -16, height: 0 }}
			animate={{ opacity: 1, y: 0, height: 'auto' }}
			exit={reduceMotion ? undefined : { opacity: 0, y: -10, height: 0 }}
			transition={{ duration: reduceMotion ? 0 : 0.38, ease: [0.22, 1, 0.36, 1] }}
			id="geo-answer-center"
			className="print:hidden overflow-hidden"
			aria-labelledby="geo-copy-center-heading"
		>
			<div className="rounded-2xl border border-cyan-200/90 dark:border-cyan-400/25 bg-gradient-to-br from-cyan-50 via-white to-indigo-50 dark:from-cyan-500/[0.10] dark:via-[#0B1028] dark:to-indigo-500/[0.08] p-5 sm:p-6">
				<div className="flex items-start gap-3">
					<span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-700 dark:text-cyan-300">
						<Sparkles className="h-5 w-5" aria-hidden />
					</span>
					<div className="min-w-0">
						<p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#D4AF37]">{t('kicker')}</p>
						<div className="mt-1 flex flex-wrap items-center gap-2">
							<h3
								id="geo-copy-center-heading"
								className="text-lg font-extrabold text-slate-900 dark:text-white sm:text-xl"
							>
								{t('title')}
							</h3>
							<PrescriptionAppliedBadge />
						</div>
						<p className="mt-0.5 text-xs leading-relaxed text-slate-400">{t('subtitle')}</p>
						<div className="mt-2 flex flex-wrap items-center gap-1.5">
							<span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-1 font-mono text-[11px] font-extrabold text-indigo-700 ring-1 ring-indigo-200 dark:bg-indigo-500/15 dark:text-indigo-300 dark:ring-indigo-400/30">
								{t('schemaBadge', { schemaType: payload.schemaType || industry.schemaType })}
							</span>
							<span className="inline-flex items-center rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-extrabold text-slate-700 ring-1 ring-slate-200 dark:bg-white/[0.06] dark:text-slate-200 dark:ring-white/15">
								{t('categoryBadge', { category: industry.defaultCategory })}
							</span>
						</div>
						{lastRegeneratedAt ? (
							<p
								className="mt-2 text-[12px] font-semibold leading-relaxed text-emerald-700 dark:text-emerald-300"
								aria-live="polite"
							>
								{t('regeneratedAt', { time: formatRegenClock(lastRegeneratedAt) })}
							</p>
						) : null}
					</div>
				</div>

				{!resolveIsHttps({ url: report.targetUrl }) && (
					<div
						role="alert"
						className="mt-4 rounded-xl border border-rose-300 bg-rose-50 p-4 dark:border-rose-500/40 dark:bg-rose-500/10"
					>
						<p className="text-[10px] font-extrabold uppercase tracking-wide text-rose-700 dark:text-rose-300">
							P0
						</p>
						<p className="mt-1 text-sm font-extrabold text-rose-900 dark:text-rose-100">
							{lang === 'en' ? HTTPS_P0_LABEL.en : HTTPS_P0_LABEL.ko}
						</p>
						<p className="mt-1 text-xs leading-relaxed text-rose-800 dark:text-rose-200">
							{lang === 'en' ? HTTPS_SECURITY_ALERT.en : HTTPS_SECURITY_ALERT.ko}
						</p>
					</div>
				)}

				<div className="mt-4 flex flex-wrap items-center gap-2">
					<ul className="flex flex-wrap gap-1.5" aria-label={t('menusAria')}>
						{payload.menus.map((menu) => (
							<li
								key={`${menu.rank}-${menu.name}`}
								className="inline-flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-extrabold text-slate-800 ring-1 ring-cyan-400/40 dark:bg-white/[0.06] dark:text-slate-100"
							>
								<span className="rounded-full bg-gradient-to-r from-cyan-500 to-indigo-500 px-1.5 py-0.5 text-[10px] text-white">
									{t('rank', { rank: menu.rank })}
								</span>
								{menu.name}
							</li>
						))}
					</ul>
					{isRegenerated && appliedBadge ? (
						<span
							className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-extrabold text-emerald-700 ring-1 ring-emerald-300/80 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-400/35"
							aria-live="polite"
						>
							{appliedBadge}
						</span>
					) : null}
					<button
						type="button"
						onClick={() => setEditorOpen((prev) => !prev)}
						aria-expanded={editorOpen}
						aria-controls="geo-target-keyword-editor"
						aria-label={t('customizeAria')}
						className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1.5 text-[11px] font-extrabold text-white shadow-sm transition hover:bg-slate-800 dark:bg-white/15 dark:hover:bg-white/25"
					>
						{t('customize')}
					</button>
				</div>

				<TargetKeywordCustomizer
					open={editorOpen}
					onToggle={() => setEditorOpen((prev) => !prev)}
					draft={draft}
					onDraftChange={handleDraftChange}
					options={keywordOptions}
					error={formError}
					generated={generated}
					onRegenerate={handleRegenerate}
				/>

				<div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-2">
					{modules.map((mod, index) => {
						const Icon = mod.icon;
						const copied = copiedId === mod.id;
						return (
							<article
								key={mod.id}
								id={geoAnswerCenterModuleAnchor(mod.id)}
								className={`relative isolate flex min-h-0 flex-col scroll-mt-24 rounded-2xl border border-slate-200/90 bg-white/90 p-3.5 dark:border-white/10 dark:bg-white/[0.04]${
									mod.id === 'llms' ? ' lg:col-span-2' : ''
								}`}
							>
								{flashKey > 0 && !reduceMotion ? (
									<span
										key={flashKey}
										className="geo-copy-module-flash pointer-events-none absolute inset-0 z-[1] rounded-2xl"
										aria-hidden
									/>
								) : null}
								<div className="flex min-w-0 items-start gap-2">
									<span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-500/12 text-indigo-700 dark:text-indigo-300">
										<Icon className="h-4 w-4" aria-hidden />
									</span>
									<div className="min-w-0">
										<p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
											{t('moduleIndex', { index: index + 1 })}
										</p>
										<h4 className="text-sm font-extrabold text-slate-900 dark:text-white">{mod.title}</h4>
										<p className="mt-0.5 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
											{mod.hint}
										</p>
									</div>
								</div>
								<div className="mt-2 flex items-center justify-between gap-2">
									<p className="min-w-0 truncate text-[10px] font-bold text-indigo-700 dark:text-indigo-300">
										{mod.badge}
									</p>
									<CompactCopyButton
										copied={copied}
										onCopy={() => void copyModule(mod.id, mod.content)}
										label={t(COPY_LABEL_KEY[mod.id])}
										copiedLabel={t('copied')}
									/>
								</div>
								{mod.id === 'llms' ? (
									<LlmsTxtImpactCard industryConfig={industry} className="mt-2 mb-0" />
								) : null}
								<pre
									className={`mt-1.5 max-h-48 flex-1 overflow-auto rounded-xl px-3 py-2.5 text-[11px] leading-relaxed ${
										mod.code
											? 'border border-slate-800 bg-slate-950 text-emerald-100'
											: 'border border-slate-200 bg-slate-50 text-slate-700 dark:border-white/10 dark:bg-black/30 dark:text-slate-200'
									}`}
								>
									<code className="whitespace-pre-wrap break-words">{mod.preview}</code>
								</pre>
							</article>
						);
					})}
				</div>
			</div>
		</motion.section>
	);
}
