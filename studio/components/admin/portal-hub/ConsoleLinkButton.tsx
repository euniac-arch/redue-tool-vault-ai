'use client';

import { ExternalLink } from 'lucide-react';

interface ConsoleLinkButtonProps {
	label: string;
	url: string;
	variant?: 'primary' | 'secondary';
}

/** "공식 콘솔 바로가기" — opens the official console/tool in a new tab. */
export function ConsoleLinkButton({ label, url, variant = 'primary' }: ConsoleLinkButtonProps) {
	const primaryClass =
		'bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200';
	const secondaryClass =
		'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700';

	return (
		<a
			href={url}
			target="_blank"
			rel="noopener noreferrer"
			className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold transition-colors ${
				variant === 'primary' ? primaryClass : secondaryClass
			}`}
		>
			<ExternalLink className="h-3.5 w-3.5" />
			{label}
		</a>
	);
}
