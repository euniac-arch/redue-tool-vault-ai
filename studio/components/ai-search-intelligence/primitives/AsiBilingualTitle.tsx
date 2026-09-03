import type { ElementType } from 'react';

export function AsiBilingualTitle({
	titleKo,
	titleEn,
	as: Tag = 'p',
	size = 'card',
	className = '',
}: {
	titleKo: string;
	titleEn: string;
	as?: ElementType;
	size?: 'card' | 'detail' | 'page';
	className?: string;
}) {
	const koClass =
		size === 'page'
			? 'text-2xl font-semibold tracking-tight text-slate-900 dark:text-white sm:text-3xl'
			: size === 'detail'
				? 'text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-3xl'
				: 'truncate text-[13px] font-semibold text-slate-800 dark:text-slate-100';
	const enClass =
		size === 'card'
			? 'mt-0.5 block truncate text-xs font-mono text-slate-400'
			: 'mt-1 block text-xs font-mono text-slate-400 dark:text-muted-foreground';

	return (
		<Tag className={className}>
			<span className={koClass}>{titleKo}</span>
			<span className={enClass}>{titleEn}</span>
		</Tag>
	);
}

export function AsiCategoryBadge({
	categoryKo,
	categoryEn,
	className = '',
}: {
	categoryKo: string;
	categoryEn: string;
	className?: string;
}) {
	return (
		<span className={`inline-flex max-w-full items-center gap-1.5 truncate ${className}`}>
			<span>{categoryKo}</span>
			<span aria-hidden className="text-slate-300 dark:text-slate-600">
				·
			</span>
			<span className="font-mono text-slate-400">{categoryEn}</span>
		</span>
	);
}
