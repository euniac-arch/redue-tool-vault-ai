'use client';

import Link from 'next/link';

export type PageSubTab = {
	id: string;
	href: string;
	label: string;
};

export function PageSubTabs({
	tabs,
	activeId,
	ariaLabel,
	align = 'start',
	tone = 'default',
}: {
	tabs: readonly PageSubTab[];
	activeId: string;
	ariaLabel: string;
	align?: 'start' | 'center';
	tone?: 'default' | 'navy' | 'cyan';
}) {
	const navy = tone === 'navy';
	const cyan = tone === 'cyan';

	return (
		<nav
			className={`inline-flex max-w-full ${
				cyan
					? 'items-center gap-1 overflow-x-auto rounded-xl border border-cyan-200/80 bg-cyan-50/70 p-1.5 backdrop-blur-md dark:border-cyan-800/40 dark:bg-[#0a1626]/90 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
					: navy
						? 'items-center gap-2'
						: 'items-stretch rounded-xl border border-zinc-200 bg-zinc-100/80 p-1 dark:border-zinc-800 dark:bg-[#0f1319]'
			} ${align === 'center' ? 'w-full justify-center sm:w-auto' : 'w-full sm:w-auto'}`}
			aria-label={ariaLabel}
		>
			{tabs.map((tab) => {
				const active = tab.id === activeId;
				return (
					<Link
						key={tab.id}
						href={tab.href}
						aria-current={active ? 'page' : undefined}
						className={`inline-flex min-h-10 items-center justify-center whitespace-nowrap rounded-lg text-[13px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/40 ${
							cyan || tabs.length > 3 ? 'flex-none' : 'flex-1 sm:flex-none'
						} ${
							cyan
								? active
									? 'border border-cyan-300 bg-white px-4 py-2 font-semibold text-slate-900 shadow-sm dark:border-cyan-600/40 dark:bg-[#13233a] dark:text-white'
									: 'border border-transparent px-4 py-2 text-slate-500 transition-all duration-200 hover:bg-cyan-100/70 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-[#13233a]/50 dark:hover:text-slate-200'
								: navy
									? active
										? 'border border-cyan-400/60 bg-white px-4 py-2 font-semibold text-slate-900 shadow-md shadow-black/10 dark:border-cyan-500/50 dark:bg-[#13233a] dark:text-white dark:shadow-black/30'
										: 'border border-slate-200 bg-white px-4 py-2 font-medium text-slate-400 transition-all duration-150 hover:border-slate-300 hover:bg-slate-100 hover:text-slate-700 dark:border-cyan-900/40 dark:bg-[#0a1626]/80 dark:text-slate-500 dark:hover:border-cyan-800/50 dark:hover:bg-slate-800/40 dark:hover:text-slate-200'
									: active
										? 'border border-zinc-300 bg-zinc-800 px-4 font-bold text-white shadow-md dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50'
										: 'border border-transparent bg-transparent px-4 font-normal text-zinc-500 transition-colors hover:bg-zinc-200/70 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800/40 dark:hover:text-zinc-200'
						}`}
					>
						{tab.label}
					</Link>
				);
			})}
		</nav>
	);
}
