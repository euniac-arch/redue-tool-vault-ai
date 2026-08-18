'use client';

import { useTranslations } from 'next-intl';
import {
	buildExternalVerificationLinks,
	type VerificationToolId,
} from '@/lib/audit/verification-links';

export type ExternalVerificationLinksVariant = 'dark' | 'light' | 'compact';

interface ExternalVerificationLinksProps {
	/** Diagnosed / selected project URL (full URL preferred). */
	url: string;
	variant?: ExternalVerificationLinksVariant;
	className?: string;
	/** Hide the section title (e.g. inside a modal that already has a heading). */
	hideTitle?: boolean;
	/** Optional scrollspy / deep-link anchor id (audit report only). */
	sectionId?: string;
}

const TOOL_BADGE: Record<
	VerificationToolId,
	{ initials: string; tone: string }
> = {
	pagespeed: {
		initials: 'PSI',
		tone: 'bg-emerald-500/15 text-emerald-700 ring-emerald-500/30',
	},
	schemaValidator: {
		initials: 'SD',
		tone: 'bg-sky-500/15 text-sky-700 ring-sky-500/30',
	},
	richResults: {
		initials: 'RR',
		tone: 'bg-amber-500/15 text-amber-800 ring-amber-500/30',
	},
	seoptimer: {
		initials: 'SEO',
		tone: 'bg-violet-500/15 text-violet-700 ring-violet-500/30',
	},
};

const TOOL_BADGE_DARK: Record<VerificationToolId, string> = {
	pagespeed: 'bg-emerald-50 dark:bg-emerald-400/15 text-emerald-700 dark:text-emerald-300 ring-emerald-200 dark:ring-emerald-400/25',
	schemaValidator: 'bg-sky-50 dark:bg-sky-400/15 text-sky-700 dark:text-sky-300 ring-sky-200 dark:ring-sky-400/25',
	richResults: 'bg-amber-50 dark:bg-amber-400/15 text-amber-800 dark:text-amber-200 ring-amber-200 dark:ring-amber-400/25',
	seoptimer: 'bg-violet-50 dark:bg-violet-400/15 text-violet-700 dark:text-violet-300 ring-violet-200 dark:ring-violet-400/25',
};

/**
 * Official SEO / schema verification tool quick-links.
 * Opens each tool in a new tab with the current project URL prefilled.
 */
export function ExternalVerificationLinks({
	url,
	variant = 'light',
	className = '',
	hideTitle = false,
	sectionId,
}: ExternalVerificationLinksProps) {
	const t = useTranslations('audit.verification');
	const links = buildExternalVerificationLinks(url);

	if (links.length === 0) return null;

	const isDark = variant === 'dark';
	const isCompact = variant === 'compact';

	const shell =
		variant === 'dark'
			? 'rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.03] p-5'
			: isCompact
				? 'rounded-lg border border-slate-200 bg-slate-50 p-3'
				: 'rounded-xl border border-slate-200 bg-white p-4 shadow-sm';

	const titleClass = isDark
		? 'text-sm font-semibold text-slate-800 dark:text-slate-200'
		: 'text-sm font-bold text-slate-800';

	const subtitleClass = isDark
		? 'mt-1 text-xs text-slate-500'
		: 'mt-1 text-xs text-slate-500';

	const btnClass = isDark
		? 'border-slate-200 dark:border-white/[0.1] bg-white dark:bg-white/[0.04] text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.08]'
		: 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50';

	const hintClass = isDark ? 'text-slate-500' : 'text-slate-400';

	return (
		<section
			id={sectionId}
			className={`${sectionId ? 'scroll-mt-24 ' : ''}${shell} ${className}`.trim()}
			aria-label={t('title')}
		>
			{!hideTitle ? (
				<div className={isCompact ? 'mb-2' : 'mb-3'}>
					<p className={titleClass}>{t('title')}</p>
					<p className={subtitleClass}>{t('subtitle')}</p>
				</div>
			) : null}

			<div
				className={
					isCompact
						? 'grid grid-cols-1 gap-2 sm:grid-cols-2'
						: 'grid grid-cols-1 gap-2 sm:grid-cols-2'
				}
			>
				{links.map((link) => {
					const badge = TOOL_BADGE[link.id];
					const badgeTone = isDark ? TOOL_BADGE_DARK[link.id] : badge.tone;
					return (
						<a
							key={link.id}
							href={link.href}
							target="_blank"
							rel="noopener noreferrer"
							className={`group flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm font-semibold transition ${btnClass}`}
						>
							<span
								className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[10px] font-extrabold ring-1 ${badgeTone}`}
								aria-hidden
							>
								{badge.initials}
							</span>
							<span className="min-w-0 flex-1">
								<span className="block truncate">{t(`tools.${link.labelKey}`)}</span>
								<span className={`mt-0.5 block text-[10px] font-medium ${hintClass}`}>
									{t('openInNewTab')}
								</span>
							</span>
							<span className={`shrink-0 text-xs ${hintClass}`} aria-hidden>
								↗
							</span>
						</a>
					);
				})}
			</div>
		</section>
	);
}
