'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, ExternalLink, Lightbulb, Sparkles, Wallet, X } from 'lucide-react';
import {
	AiToolCategoryBadge,
	CATEGORY_SOLID_ACCENT,
	PricingTypeBadge,
} from '@/components/admin/ai-tools/ai-tools-badges';
import { getAiToolCategoryLabel } from '@/lib/admin/ai-tools-management';
import type { AiTool } from '@/lib/ai-hub';

interface AiHubDetailModalProps {
	tool: AiTool;
	onClose: () => void;
}

export function AiHubDetailModal({ tool, onClose }: AiHubDetailModalProps) {
	const [logoFailed, setLogoFailed] = useState(false);

	useEffect(() => {
		function onKeyDown(event: KeyboardEvent) {
			if (event.key === 'Escape') onClose();
		}
		window.addEventListener('keydown', onKeyDown);

		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';

		return () => {
			window.removeEventListener('keydown', onKeyDown);
			document.body.style.overflow = previousOverflow;
		};
	}, [onClose]);

	return (
		<div
			className="fixed inset-0 z-[999] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4"
			role="presentation"
			onClick={onClose}
		>
			<div
				role="dialog"
				aria-modal="true"
				aria-labelledby="ai-hub-detail-title"
				onClick={(event) => event.stopPropagation()}
				className="relative flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl sm:rounded-2xl dark:border-slate-700 dark:bg-slate-900"
			>
				<header className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-700">
					<div className="flex min-w-0 items-center gap-3">
						{logoFailed || !tool.logo_url ? (
							<span
								className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-base font-bold text-white ${CATEGORY_SOLID_ACCENT[tool.category]}`}
								aria-hidden
							>
								{tool.name.charAt(0).toUpperCase()}
							</span>
						) : (
							// eslint-disable-next-line @next/next/no-img-element -- external favicon URL
							<img
								src={tool.logo_url}
								alt=""
								aria-hidden
								onError={() => setLogoFailed(true)}
								className="h-11 w-11 shrink-0 rounded-xl border border-slate-200 bg-white object-contain p-1.5 dark:border-slate-700"
							/>
						)}
						<div className="min-w-0">
							<h2 id="ai-hub-detail-title" className="truncate text-lg font-bold text-slate-900 dark:text-slate-100">
								{tool.name}
							</h2>
							<p className="truncate text-xs font-semibold text-slate-500 dark:text-slate-400">{tool.provider}</p>
							<div className="mt-1.5 flex flex-wrap items-center gap-1.5">
								<AiToolCategoryBadge category={tool.category} label={getAiToolCategoryLabel(tool.category)} />
								<PricingTypeBadge type={tool.pricing.type} />
							</div>
						</div>
					</div>
					<div className="flex shrink-0 items-center gap-1.5">
						<a
							href={tool.url}
							target="_blank"
							rel="noreferrer"
							className="hidden items-center gap-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 px-3 py-2 text-xs font-bold text-white transition hover:opacity-90 sm:inline-flex"
						>
							<ExternalLink className="h-3.5 w-3.5" aria-hidden />
							공식 사이트 바로가기
						</a>
						<button
							type="button"
							onClick={onClose}
							aria-label="닫기"
							className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-800 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
						>
							<X className="h-4 w-4" />
						</button>
					</div>
				</header>

				<div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
					<div className="flex flex-col gap-6">
						<a
							href={tool.url}
							target="_blank"
							rel="noreferrer"
							className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 px-3 py-2 text-xs font-bold text-white transition hover:opacity-90 sm:hidden"
						>
							<ExternalLink className="h-3.5 w-3.5" aria-hidden />
							공식 사이트 바로가기
						</a>

						<section>
							<SectionTitle icon={Sparkles} label="개요" />
							<p className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300">{tool.desc}</p>
							<div className="mt-2.5 flex flex-wrap gap-1.5">
								{tool.tags.map((tag) => (
									<span
										key={tag}
										className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300"
									>
										#{tag}
									</span>
								))}
							</div>
						</section>

						<section>
							<SectionTitle icon={Wallet} label="요금제 상세 비교" />
							<p className="mt-1.5 text-xs font-bold text-slate-500 dark:text-slate-400">{tool.pricing.summary}</p>
							<div className="mt-2.5 grid gap-3 sm:grid-cols-2">
								<div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 dark:border-emerald-800 dark:bg-emerald-950/30">
									<p className="text-[11px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
										Free · 무료 제공 범위
									</p>
									<p className="mt-1.5 text-sm leading-relaxed text-emerald-900 dark:text-emerald-100">
										{tool.pricing.free_tier}
									</p>
								</div>
								<div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 dark:border-amber-800 dark:bg-amber-950/30">
									<p className="text-[11px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300">
										Paid · 유료 플랜 혜택
									</p>
									<p className="mt-1.5 text-sm leading-relaxed text-amber-900 dark:text-amber-100">
										{tool.pricing.paid_tier}
									</p>
								</div>
							</div>
						</section>

						<section>
							<SectionTitle icon={CheckCircle2} label="핵심 사용 순서 (3-Step Guide)" />
							<ol className="mt-2.5 flex flex-col gap-2.5">
								{tool.guide.steps.map((step, index) => (
									<li key={index} className="flex items-start gap-2.5">
										<span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 text-[10px] font-bold text-white">
											{index + 1}
										</span>
										<p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">{step}</p>
									</li>
								))}
							</ol>
						</section>

						<section className="flex items-start gap-3 rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50 to-indigo-50 p-4 dark:border-violet-800 dark:from-violet-950/40 dark:to-indigo-950/40">
							<span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-600 text-white">
								<Lightbulb className="h-4 w-4" aria-hidden />
							</span>
							<div className="min-w-0">
								<p className="text-[11px] font-bold uppercase tracking-wide text-violet-700 dark:text-violet-300">
									실전 활용 꿀팁 (Pro Tip)
								</p>
								<p className="mt-1 text-sm font-semibold leading-relaxed text-violet-900 dark:text-violet-100">
									{tool.guide.pro_tip}
								</p>
							</div>
						</section>
					</div>
				</div>
			</div>
		</div>
	);
}

function SectionTitle({ icon: Icon, label }: { icon: typeof Sparkles; label: string }) {
	return (
		<div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
			<Icon className="h-3.5 w-3.5" aria-hidden />
			{label}
		</div>
	);
}
