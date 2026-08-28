'use client';

import { useState } from 'react';

export function StrategyCopyButton({ text, label }: { text: string; label?: string }) {
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
			window.setTimeout(() => setCopied(false), 1500);
		} catch {
			setCopied(false);
		}
	}

	return (
		<button
			type="button"
			onClick={() => void copy()}
			className="rounded-md border border-slate-300 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-slate-600 transition hover:border-slate-900 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/50 dark:border-white/20 dark:text-slate-300 dark:hover:border-white dark:hover:text-white"
		>
			{copied ? 'Copied' : label || 'Copy'}
		</button>
	);
}
