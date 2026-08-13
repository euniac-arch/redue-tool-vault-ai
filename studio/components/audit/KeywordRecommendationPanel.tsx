'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
	buildKeywordRecommendations,
	type KeywordCategoryId,
} from '@/lib/audit/keyword-recommendations';
import type { AuditReport } from '@/lib/site-auditor';

interface KeywordRecommendationPanelProps {
	report: AuditReport;
}

const CATEGORY_ORDER: KeywordCategoryId[] = ['geoPrompt', 'primary', 'longTail', 'lsiLocal'];

const CATEGORY_SHELL: Record<
	KeywordCategoryId,
	{ card: string; chip: string; title: string; accent?: boolean }
> = {
	geoPrompt: {
		accent: true,
		card: 'border-fuchsia-400/35 bg-gradient-to-br from-fuchsia-500/15 via-indigo-500/10 to-cyan-500/15 shadow-[0_0_0_1px_rgba(217,70,239,0.18),0_12px_32px_-16px_rgba(34,211,238,0.45)]',
		chip: 'border-fuchsia-400/35 bg-fuchsia-500/15 text-fuchsia-100 hover:border-cyan-300/50 hover:bg-cyan-500/15 hover:text-cyan-100',
		title: 'text-fuchsia-100',
	},
	primary: {
		card: 'border-white/[0.08] bg-black/25',
		chip: 'border-cyan-500/25 bg-cyan-500/10 text-cyan-200 hover:border-cyan-400/50 hover:bg-cyan-500/20',
		title: 'text-slate-100',
	},
	longTail: {
		card: 'border-white/[0.08] bg-black/25',
		chip: 'border-amber-500/25 bg-amber-500/10 text-amber-100 hover:border-amber-400/45 hover:bg-amber-500/20',
		title: 'text-slate-100',
	},
	lsiLocal: {
		card: 'border-white/[0.08] bg-black/25',
		chip: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-100 hover:border-emerald-400/45 hover:bg-emerald-500/20',
		title: 'text-slate-100',
	},
};

function KeywordChip({
	label,
	className,
	copiedHint,
}: {
	label: string;
	className: string;
	copiedHint: string;
}) {
	const [copied, setCopied] = useState(false);

	async function handleCopy() {
		try {
			await navigator.clipboard.writeText(label);
			setCopied(true);
			setTimeout(() => setCopied(false), 1600);
		} catch {
			/* clipboard unavailable */
		}
	}

	return (
		<button
			type="button"
			onClick={handleCopy}
			title={label}
			className={`group relative max-w-full rounded-lg border px-2.5 py-1.5 text-left text-[11px] font-semibold leading-snug transition print:border-slate-300 print:bg-slate-100 print:text-slate-700 ${className}`}
		>
			<span className="line-clamp-2 break-words">{label}</span>
			{copied ? (
				<span className="absolute -top-2 right-1 rounded bg-emerald-500 px-1.5 py-0.5 text-[9px] font-extrabold text-white shadow print:hidden">
					{copiedHint}
				</span>
			) : null}
		</button>
	);
}

export function KeywordRecommendationPanel({ report }: KeywordRecommendationPanelProps) {
	const t = useTranslations('audit.keywordRecommend');
	const locale = useLocale();
	const lang = locale === 'en' ? 'en' : 'ko';
	const pack = buildKeywordRecommendations(report.siteMeta, lang);
	const byId = Object.fromEntries(pack.categories.map((c) => [c.id, c.keywords])) as Record<
		KeywordCategoryId,
		string[]
	>;

	const hasAny = CATEGORY_ORDER.some((id) => (byId[id]?.length ?? 0) > 0);
	if (!hasAny) return null;

	return (
		<section
			id="sec-keyword-recommend"
			className="audit-report-section scroll-mt-24 flex flex-col gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 sm:p-6"
		>
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div>
					<p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#D4AF37]">{t('badge')}</p>
					<h2 className="mt-1 text-lg font-extrabold text-white">{t('title')}</h2>
					<p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-500">{t('subtitle')}</p>
				</div>
				<p className="rounded-lg border border-white/10 bg-black/30 px-2.5 py-1.5 text-[10px] font-semibold text-slate-400 print:hidden">
					{t('copyHint')}
				</p>
			</div>

			<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
				{CATEGORY_ORDER.map((id) => {
					const shell = CATEGORY_SHELL[id];
					const keywords = byId[id] ?? [];
					if (keywords.length === 0) return null;

					return (
						<article
							key={id}
							className={`flex flex-col gap-3 rounded-xl border p-4 ${shell.card}`}
						>
							<div className="flex flex-wrap items-center gap-2">
								{shell.accent ? (
									<span className="rounded-md bg-gradient-to-r from-fuchsia-500 to-cyan-400 px-2 py-0.5 text-[10px] font-extrabold tracking-wide text-[#0B1030] shadow-[0_0_12px_-2px_rgba(34,211,238,0.7)]">
										{t('geoAiBadge')}
									</span>
								) : null}
								<div>
									<p className={`text-sm font-extrabold ${shell.title}`}>{t(`categories.${id}.title`)}</p>
									<p className="mt-0.5 text-[10px] leading-snug text-slate-500">
										{t(`categories.${id}.desc`)}
									</p>
								</div>
							</div>

							<div className="flex flex-wrap gap-1.5">
								{keywords.map((kw) => (
									<KeywordChip
										key={`${id}-${kw}`}
										label={kw}
										className={shell.chip}
										copiedHint={t('copied')}
									/>
								))}
							</div>
						</article>
					);
				})}
			</div>
		</section>
	);
}
