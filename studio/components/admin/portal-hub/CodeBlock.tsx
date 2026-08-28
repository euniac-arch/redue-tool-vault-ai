'use client';

import { useState } from 'react';
import { Check, Copy, Download } from 'lucide-react';

interface CodeBlockProps {
	code: string;
	onCopied?: (code: string) => void;
	/** Optional label shown on the copy button; defaults to "코드 복사". */
	copyLabel?: string;
	maxHeightClass?: string;
	/** When set, shows a download button next to copy. */
	downloadFilename?: string;
}

async function copyText(text: string): Promise<boolean> {
	try {
		await navigator.clipboard.writeText(text);
		return true;
	} catch {
		try {
			const textarea = document.createElement('textarea');
			textarea.value = text;
			textarea.style.position = 'fixed';
			textarea.style.opacity = '0';
			document.body.appendChild(textarea);
			textarea.focus();
			textarea.select();
			const ok = document.execCommand('copy');
			document.body.removeChild(textarea);
			return ok;
		} catch {
			return false;
		}
	}
}

function downloadText(filename: string, content: string) {
	const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = filename;
	document.body.appendChild(link);
	link.click();
	link.remove();
	URL.revokeObjectURL(url);
}

/** Read-only code preview with a one-click clipboard copy button + check feedback. */
export function CodeBlock({
	code,
	onCopied,
	copyLabel = '코드 복사',
	maxHeightClass = 'max-h-72',
	downloadFilename,
}: CodeBlockProps) {
	const [copied, setCopied] = useState(false);

	async function handleCopy() {
		const ok = await copyText(code);
		if (!ok) return;
		setCopied(true);
		onCopied?.(code);
		window.setTimeout(() => setCopied(false), 1800);
	}

	return (
		<div className="relative overflow-hidden rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/60">
			<div className="flex items-center justify-end gap-1.5 border-b border-slate-200 bg-white/60 px-2 py-1.5 dark:border-white/10 dark:bg-slate-900/80">
				<button
					type="button"
					onClick={handleCopy}
					className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-2.5 py-1.5 text-[11px] font-bold text-white transition-colors hover:bg-slate-700 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
				>
					{copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
					{copied ? '복사됨' : copyLabel}
				</button>
				{downloadFilename ? (
					<button
						type="button"
						onClick={() => downloadText(downloadFilename, code)}
						className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-slate-700 transition-colors hover:bg-slate-50 dark:border-white/10 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
					>
						<Download className="h-3.5 w-3.5" />
						{downloadFilename} 다운로드
					</button>
				) : null}
			</div>
			<pre className={`overflow-auto ${maxHeightClass} px-3.5 py-3 text-[11px] leading-relaxed text-slate-700 dark:text-slate-200`}>
				<code>{code}</code>
			</pre>
		</div>
	);
}
