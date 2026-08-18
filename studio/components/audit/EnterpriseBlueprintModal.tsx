'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Check, Copy } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { getBlueprintGuideSnippets } from '@/lib/audit/enterprise-blueprint-guides';
import { scrollToSolutionPackages } from '@/lib/audit/solution-packages';

interface EnterpriseBlueprintModalProps {
	open: boolean;
	onClose: () => void;
}

const BLUEPRINT_SECTIONS = [
	{ key: 'pr', icon: '📰' },
	{ key: 'nap', icon: '📍' },
	{ key: 'rag', icon: '📝' },
	{ key: 'guard', icon: '🛡️' },
] as const;

const GUIDE_SECTIONS = [
	{ key: 'pr', icon: '📰', stepKeys: ['1', '2', '3', '4', '5', '6', '7'] as const, propKeys: ['p31', 'p856', 'p1448', 'p159', 'p1329', 'p17', 'p625', 'p154'] as const },
	{ key: 'nap', icon: '📍', platformKeys: ['gbp', 'apple', 'naver', 'kakao'] as const, ruleKeys: ['1', '2', '3', '4'] as const },
	{ key: 'rag', icon: '📝', ruleKeys: ['1', '2', '3', '4'] as const, chunkKeys: ['q', 'a', 'p1', 'p2', 'p3'] as const },
	{ key: 'guard', icon: '🛡️', protocolKeys: ['weekly', 'monthly', 'quarterly', 'update'] as const },
] as const;

function ChunkCode({ children }: { children: ReactNode }) {
	return (
		<code className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-indigo-300">
			{children}
		</code>
	);
}

function CopySnippet({
	code,
	label,
	copyLabel,
	copiedLabel,
}: {
	code: string;
	label: string;
	copyLabel: string;
	copiedLabel: string;
}) {
	const [copied, setCopied] = useState(false);

	async function handleCopy() {
		try {
			await navigator.clipboard.writeText(code);
			setCopied(true);
			window.setTimeout(() => setCopied(false), 1800);
		} catch {
			/* clipboard unavailable */
		}
	}

	return (
		<div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
			<div className="flex items-center justify-between gap-3 border-b border-zinc-800 bg-zinc-900/80 px-3 py-2">
				<span className="truncate font-mono text-[11px] font-semibold tracking-wide text-zinc-400">
					{label}
				</span>
				<button
					type="button"
					onClick={() => void handleCopy()}
					aria-live="polite"
					className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-bold transition-colors ${
						copied
							? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
							: 'border-indigo-400/30 bg-indigo-500/10 text-indigo-200 hover:bg-indigo-500/20'
					}`}
				>
					{copied ? <Check className="h-3 w-3" aria-hidden /> : <Copy className="h-3 w-3" aria-hidden />}
					<span>{copied ? copiedLabel : copyLabel}</span>
				</button>
			</div>
			<pre className="custom-scrollbar max-h-64 overflow-auto p-3 font-mono text-[11px] leading-relaxed text-cyan-200/90">
				<code>{code}</code>
			</pre>
		</div>
	);
}

function GuideStepList({ items }: { items: string[] }) {
	return (
		<ol className="space-y-2">
			{items.map((item, index) => (
				<li key={item} className="flex items-start gap-2.5 text-xs leading-relaxed text-slate-300 md:text-sm">
					<span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-indigo-500/15 text-[11px] font-bold text-indigo-300">
						{index + 1}
					</span>
					<span className="break-keep">{item}</span>
				</li>
			))}
		</ol>
	);
}

function BlueprintEngineeringGuides() {
	const t = useTranslations('audit.b2b.blueprint.guides');
	const locale = useLocale();
	const snippets = getBlueprintGuideSnippets(locale === 'en' ? 'en' : 'ko');

	return (
		<section className="mt-8 border-t border-zinc-800/80 pt-6" aria-labelledby="blueprint-guides-title">
			<div className="mb-4 space-y-1.5">
				<span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">{t('kicker')}</span>
				<h4 id="blueprint-guides-title" className="break-keep text-sm font-bold text-white md:text-base">
					{t('title')}
				</h4>
				<p className="break-keep text-xs leading-relaxed text-zinc-400 md:text-sm">{t('desc')}</p>
			</div>

			<div className="space-y-2">
				{GUIDE_SECTIONS.map((section) => (
					<details
						key={section.key}
						className="group overflow-hidden rounded-xl border border-zinc-800/80 bg-zinc-950/60 open:border-indigo-500/30 open:bg-zinc-950/80"
					>
						<summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors hover:bg-white/[0.03] [&::-webkit-details-marker]:hidden">
							<span className="flex min-w-0 items-center gap-3">
								<span
									className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-indigo-400/20 bg-indigo-500/10 text-sm"
									aria-hidden
								>
									{section.icon}
								</span>
								<span className="break-keep text-xs font-bold text-white md:text-sm">
									{t(`${section.key}.title`)}
								</span>
							</span>
							<svg
								className="h-4 w-4 shrink-0 text-zinc-500 transition-transform duration-200 group-open:rotate-180"
								viewBox="0 0 20 20"
								fill="currentColor"
								aria-hidden
							>
								<path
									fillRule="evenodd"
									d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
									clipRule="evenodd"
								/>
							</svg>
						</summary>

						<div className="space-y-5 border-t border-zinc-800/80 px-4 py-4 md:px-5">
							{section.key === 'pr' && (
								<>
									<div className="space-y-2.5">
										<h5 className="text-xs font-bold text-indigo-300 md:text-sm">{t('pr.qidTitle')}</h5>
										<GuideStepList items={section.stepKeys.map((key) => t(`pr.qid.${key}`))} />
									</div>
									<div className="space-y-2.5">
										<h5 className="text-xs font-bold text-indigo-300 md:text-sm">{t('pr.propsTitle')}</h5>
										<ul className="space-y-2">
											{section.propKeys.map((key) => (
												<li
													key={key}
													className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 px-3 py-2.5 text-xs leading-relaxed text-slate-300 md:text-sm"
												>
													<code className="mr-1.5 font-mono text-[11px] font-bold text-amber-300">
														{t(`pr.props.${key}.code`)}
													</code>
													<strong className="font-semibold text-slate-100">{t(`pr.props.${key}.name`)}</strong>
													<span className="mt-1 block break-keep text-slate-400">{t(`pr.props.${key}.body`)}</span>
												</li>
											))}
										</ul>
									</div>
									<div className="space-y-2.5">
										<h5 className="text-xs font-bold text-indigo-300 md:text-sm">{t('pr.pressTitle')}</h5>
										<p className="break-keep text-xs leading-relaxed text-slate-400 md:text-sm">{t('pr.pressIntro')}</p>
										<ol className="space-y-1.5 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-3 font-mono text-[11px] leading-relaxed text-cyan-200/90 md:text-xs">
											{(['role', 'goal', 'headline', 'lead', 'facts', 'proofs', 'quote', 'source', 'forbid'] as const).map(
												(key, index) => (
													<li key={key} className="break-keep">
														<span className="text-zinc-500">{index + 1}.</span> {t(`pr.press.${key}`)}
													</li>
												),
											)}
										</ol>
									</div>
								</>
							)}

							{section.key === 'nap' && (
								<>
									<div className="space-y-2.5">
										<h5 className="text-xs font-bold text-indigo-300 md:text-sm">{t('nap.platformTitle')}</h5>
										<ul className="space-y-2">
											{section.platformKeys.map((key) => (
												<li
													key={key}
													className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 px-3 py-2.5 text-xs leading-relaxed text-slate-300 md:text-sm"
												>
													<strong className="font-semibold text-slate-100">{t(`nap.platforms.${key}.name`)}</strong>
													<span className="mt-1 block break-keep text-slate-400">{t(`nap.platforms.${key}.body`)}</span>
												</li>
											))}
										</ul>
									</div>
									<div className="space-y-2.5">
										<h5 className="text-xs font-bold text-indigo-300 md:text-sm">{t('nap.rulesTitle')}</h5>
										<GuideStepList items={section.ruleKeys.map((key) => t(`nap.rules.${key}`))} />
									</div>
									<CopySnippet
										code={snippets.sameAsJsonLd}
										label={t('jsonLdLabel')}
										copyLabel={t('copy')}
										copiedLabel={t('copied')}
									/>
								</>
							)}

							{section.key === 'rag' && (
								<>
									<div className="space-y-2.5">
										<h5 className="text-xs font-bold text-indigo-300 md:text-sm">{t('rag.chunkTitle')}</h5>
										<p className="break-keep text-xs leading-relaxed text-slate-400 md:text-sm">{t('rag.chunkIntro')}</p>
										<GuideStepList items={section.ruleKeys.map((key) => t(`rag.rules.${key}`))} />
										<div className="space-y-1.5 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-3">
											{section.chunkKeys.map((key) => (
												<p key={key} className="break-keep font-mono text-[11px] leading-relaxed text-cyan-200/90 md:text-xs">
													{t(`rag.chunk.${key}`)}
												</p>
											))}
										</div>
									</div>
									<div className="space-y-2.5">
										<h5 className="text-xs font-bold text-indigo-300 md:text-sm">{t('rag.faqTitle')}</h5>
										<p className="break-keep text-xs leading-relaxed text-slate-400 md:text-sm">{t('rag.faqIntro')}</p>
										<CopySnippet
											code={snippets.faqPageJsonLd}
											label={t('faqLabel')}
											copyLabel={t('copy')}
											copiedLabel={t('copied')}
										/>
									</div>
								</>
							)}

							{section.key === 'guard' && (
								<>
									<div className="space-y-2.5">
										<h5 className="text-xs font-bold text-indigo-300 md:text-sm">{t('guard.llmsTitle')}</h5>
										<p className="break-keep text-xs leading-relaxed text-slate-400 md:text-sm">{t('guard.llmsIntro')}</p>
										<CopySnippet
											code={snippets.llmsTxt}
											label={t('llmsLabel')}
											copyLabel={t('copy')}
											copiedLabel={t('copied')}
										/>
									</div>
									<div className="space-y-2.5">
										<h5 className="text-xs font-bold text-indigo-300 md:text-sm">{t('guard.protocolTitle')}</h5>
										<ul className="space-y-2">
											{section.protocolKeys.map((key) => (
												<li
													key={key}
													className="flex items-start gap-2.5 text-xs leading-relaxed text-slate-300 md:text-sm"
												>
													<span className="mt-0.5 shrink-0 font-bold text-indigo-400" aria-hidden>
														✓
													</span>
													<span className="break-keep">
														<strong className="font-semibold text-slate-100">{t(`guard.protocol.${key}.label`)}</strong>{' '}
														{t(`guard.protocol.${key}.body`)}
													</span>
												</li>
											))}
										</ul>
									</div>
								</>
							)}
						</div>
					</details>
				))}
			</div>
		</section>
	);
}

export function EnterpriseBlueprintModal({ open, onClose }: EnterpriseBlueprintModalProps) {
	const t = useTranslations('audit.b2b.blueprint');

	useEffect(() => {
		if (!open) return;
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') onClose();
		};
		window.addEventListener('keydown', onKeyDown);
		const prevOverflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		return () => {
			window.removeEventListener('keydown', onKeyDown);
			document.body.style.overflow = prevOverflow;
		};
	}, [open, onClose]);

	if (!open || typeof document === 'undefined') return null;

	const handleCta = () => {
		onClose();
		requestAnimationFrame(() => {
			const consulting =
				document.getElementById('consulting-section') ??
				document.getElementById('solution-packages');
			if (consulting) {
				consulting.scrollIntoView({ behavior: 'smooth', block: 'start' });
				return;
			}
			scrollToSolutionPackages();
		});
	};

	return createPortal(
		<div
			className="print:hidden animate-fadeIn fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
			role="dialog"
			aria-modal="true"
			aria-labelledby="enterprise-blueprint-title"
			aria-describedby="enterprise-blueprint-desc"
			onClick={onClose}
		>
			<div
				className="relative flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-zinc-800/90 bg-[#0b0f19] shadow-2xl md:rounded-3xl"
				onClick={(event) => event.stopPropagation()}
			>
				<header className="shrink-0 border-b border-zinc-800/80 px-6 py-5 pr-16 md:px-8 md:py-6">
					<button
						type="button"
						onClick={onClose}
						className="absolute top-5 right-5 rounded-xl border border-zinc-800/80 bg-zinc-900/60 p-2 text-zinc-400 transition-all hover:bg-zinc-800 hover:text-white"
						aria-label={t('closeAria')}
					>
						<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>

					<div className="space-y-2">
						<span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
							{t('badge')}
						</span>
						<h3
							id="enterprise-blueprint-title"
							className="break-keep text-xl font-black tracking-tight text-white md:text-2xl"
						>
							{t('title')}
						</h3>
						<p
							id="enterprise-blueprint-desc"
							className="break-keep text-xs leading-relaxed text-zinc-400 md:text-sm"
						>
							{t('desc')}
						</p>
						<div className="pt-1 text-[11px] text-zinc-500">{t('meta')}</div>
					</div>
				</header>

				<div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-6 py-6 md:px-8">
					<div className="grid grid-cols-1 items-stretch gap-5 md:grid-cols-2 md:gap-6">
						{BLUEPRINT_SECTIONS.map(({ key, icon }) => (
							<article
								key={key}
								className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-700/70 bg-slate-900/60 shadow-sm transition-shadow hover:border-slate-600/80 hover:shadow-md"
							>
								<div className="flex flex-1 flex-col gap-3 p-5 md:p-6">
									<div className="flex items-start gap-3">
										<span
											className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-indigo-400/20 bg-indigo-500/10 text-lg shadow-sm"
											aria-hidden
										>
											{icon}
										</span>
										<h4 className="break-keep pt-1 text-sm font-bold leading-snug text-white md:text-base">
											{t(`cards.${key}.title`)}
										</h4>
									</div>
									<p className="break-keep text-xs leading-relaxed text-slate-300 md:text-sm">
										{t(`cards.${key}.lead`)}
									</p>
								</div>
								<ul className="space-y-2.5 border-t border-slate-700/70 px-5 py-4 md:px-6">
									{([1, 2] as const).map((item) => (
										<li
											key={item}
											className="flex items-start gap-2 text-xs leading-relaxed text-slate-300 md:text-sm"
										>
											<span className="mt-0.5 shrink-0 font-bold text-indigo-400" aria-hidden>
												✓
											</span>
											<span className="break-keep">
												<strong className="font-semibold text-slate-100">
													{t(`cards.${key}.item${item}.label`)}
												</strong>{' '}
												{key === 'rag' && item === 1
													? t.rich(`cards.${key}.item${item}.body`, {
															chunk: (chunks) => <ChunkCode>{chunks}</ChunkCode>,
														})
													: t(`cards.${key}.item${item}.body`)}
											</span>
										</li>
									))}
								</ul>
							</article>
						))}
					</div>

					<BlueprintEngineeringGuides />
				</div>

				<footer className="shrink-0 border-t border-zinc-800/80 px-6 py-4 md:px-8">
					<button
						type="button"
						onClick={handleCta}
						className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-indigo-600/30 transition-all hover:bg-indigo-500 md:text-base"
					>
						<span aria-hidden>👑</span>
						<span className="break-keep">{t('footerCta')}</span>
					</button>
				</footer>
			</div>
		</div>,
		document.body,
	);
}
