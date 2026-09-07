import type { ReactNode } from 'react';

export type LegalTocItem = { id: string; label: string };

export function LegalDocument({
	kicker,
	title,
	lead,
	effectiveDate,
	toc,
	children,
}: {
	kicker: string;
	title: string;
	lead: string;
	effectiveDate: string;
	toc: readonly LegalTocItem[];
	children: ReactNode;
}) {
	return (
		<article className="mx-auto w-full max-w-4xl py-6 sm:py-10">
			<header className="mb-8 border-b border-slate-200 pb-8 dark:border-white/10">
				<p className="text-[11px] font-bold uppercase tracking-[0.22em] text-cyan-700 dark:text-cyan-400">{kicker}</p>
				<h1 className="mt-3 break-keep text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
					{title}
				</h1>
				<div className="mt-4 flex flex-wrap items-center gap-2">
					<span className="inline-flex rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-[11px] font-semibold text-cyan-800 dark:border-cyan-500/25 dark:bg-cyan-500/10 dark:text-cyan-300">
						최종 개정일 {effectiveDate}
					</span>
				</div>
				<p className="mt-4 max-w-3xl break-keep text-sm leading-relaxed text-slate-600 dark:text-slate-300">{lead}</p>
			</header>

			<nav
				aria-label="조항 목차"
				className="mb-8 rounded-2xl border border-slate-200 bg-white/80 px-4 py-4 dark:border-white/10 dark:bg-white/[0.03] sm:px-5"
			>
				<p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">목차</p>
				<ol className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm">
					{toc.map((item, index) => (
						<li key={item.id}>
							<a
								href={`#${item.id}`}
								className="text-slate-600 underline-offset-2 hover:text-slate-900 hover:underline dark:text-slate-300 dark:hover:text-white"
							>
								{index + 1}. {item.label}
							</a>
						</li>
					))}
				</ol>
			</nav>

			<div className="space-y-5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{children}</div>
		</article>
	);
}

export function LegalArticle({
	id,
	number,
	title,
	children,
}: {
	id: string;
	number: string;
	title: string;
	children: ReactNode;
}) {
	return (
		<section
			id={id}
			className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white/70 px-5 py-6 dark:border-white/10 dark:bg-white/[0.03] sm:px-6"
		>
			<h2 className="break-keep text-base font-semibold text-slate-900 dark:text-white sm:text-lg">
				제{number}조 ({title})
			</h2>
			<div className="mt-3 space-y-3">{children}</div>
		</section>
	);
}

export function LegalList({ items }: { items: readonly ReactNode[] }) {
	return (
		<ol className="list-decimal space-y-2 pl-5">
			{items.map((item, index) => (
				<li key={index} className="break-keep pl-1">
					{item}
				</li>
			))}
		</ol>
	);
}
