'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

export function PromptCopyButton({
	text,
	label = '프롬프트 복사',
	copiedLabel = '프롬프트가 클립보드에 복사되었습니다.',
	variant = 'primary',
	className = '',
}: {
	text: string;
	label?: string;
	copiedLabel?: string;
	variant?: 'primary' | 'ghost';
	className?: string;
}) {
	const [copied, setCopied] = useState(false);

	async function copy() {
		const value = text || '';
		try {
			if (navigator.clipboard?.writeText) {
				await navigator.clipboard.writeText(value);
			} else {
				const area = document.createElement('textarea');
				area.value = value;
				area.setAttribute('readonly', 'true');
				area.style.position = 'fixed';
				area.style.left = '-9999px';
				document.body.appendChild(area);
				area.select();
				document.execCommand('copy');
				document.body.removeChild(area);
			}
			setCopied(true);
			window.setTimeout(() => setCopied(false), 2200);
		} catch {
			setCopied(false);
		}
	}

	const base =
		variant === 'primary'
			? 'inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:opacity-60'
			: 'inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-[11px] font-semibold text-slate-600 transition hover:border-cyan-300 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:border-cyan-500/40 dark:hover:text-white';

	return (
		<button type="button" onClick={() => void copy()} className={`${base} ${className}`.trim()}>
			{copied ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
			{copied ? copiedLabel : label}
		</button>
	);
}
