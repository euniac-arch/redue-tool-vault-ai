'use client';

import { useState } from 'react';
import { Check, Copy, Download, ExternalLink } from 'lucide-react';
import type { SchemaTemplateResult } from '@/lib/schema/schemaTemplateService';
import { HighlightedInjectionCode } from './schema-code-highlight';

interface SchemaCodeViewerProps {
	result: SchemaTemplateResult;
	richResultsUrl: string;
}

type ViewerTab = 'schema' | 'rss';

async function copyText(text: string): Promise<boolean> {
	try {
		await navigator.clipboard.writeText(text);
		return true;
	} catch {
		return false;
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

export function SchemaCodeViewer({ result, richResultsUrl }: SchemaCodeViewerProps) {
	const [copied, setCopied] = useState(false);
	const [tab, setTab] = useState<ViewerTab>('schema');
	const rssActive = tab === 'rss';
	const activeCode = rssActive ? result.rssCode : result.code;
	const activeFilename = rssActive ? result.rssFilename : result.filename;
	const activeGuide = rssActive ? result.rssGuide : result.guide;
	const extension = rssActive ? '.php' : result.language === 'html' ? '.html' : '.php';

	async function handleCopy() {
		const ok = await copyText(activeCode);
		if (!ok) return;
		setCopied(true);
		window.setTimeout(() => setCopied(false), 1800);
	}

	return (
		<section className="flex flex-col gap-3 xl:sticky xl:top-0">
			<nav
				className="grid grid-cols-2 gap-1.5 rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm dark:border-white/10 dark:bg-slate-900"
				aria-label="코드 내보내기 탭"
			>
				<button
					type="button"
					onClick={() => setTab('schema')}
					aria-pressed={!rssActive}
					className={`rounded-lg px-3 py-2 text-center text-sm font-bold transition ${
						!rssActive
							? 'bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-950'
							: 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-slate-100'
					}`}
				>
					코드 복사 · 주입 엔진
				</button>
				<button
					type="button"
					onClick={() => setTab('rss')}
					aria-pressed={rssActive}
					className={`rounded-lg px-3 py-2 text-center text-sm font-bold transition ${
						rssActive
							? 'bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-950'
							: 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-slate-100'
					}`}
				>
					rss.php (RSS 2.0 피드)
				</button>
			</nav>

			<div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900">
				<div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-3 py-2.5 dark:border-white/10">
					<div className="min-w-0">
						<p className="text-sm font-bold text-slate-900 dark:text-slate-100">
							{rssActive ? 'RSS 2.0 피드 코드' : '실시간 코드 뷰어'}
						</p>
						<p className="truncate font-mono text-[11px] text-slate-500 dark:text-slate-400">{activeFilename}</p>
					</div>
					<div className="flex flex-wrap items-center gap-1.5">
						<span className="rounded-md bg-slate-100 px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-wide text-slate-600 dark:bg-slate-950 dark:text-slate-300">
							{rssActive ? 'php' : result.language}
						</span>
						<button
							type="button"
							onClick={handleCopy}
							className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white transition hover:bg-slate-700 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
						>
							{copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
							{copied ? '복사됨' : '코드 복사'}
						</button>
						<button
							type="button"
							onClick={() => downloadText(activeFilename, activeCode)}
							className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
						>
							<Download className="h-3.5 w-3.5" />
							{rssActive ? 'rss.php 다운로드' : `파일로 다운로드(${extension})`}
						</button>
						{rssActive ? null : (
							<a
								href={richResultsUrl}
								target="_blank"
								rel="noopener noreferrer"
								className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
							>
								<ExternalLink className="h-3.5 w-3.5" />
								리치 결과 테스트
							</a>
						)}
					</div>
				</div>
				<HighlightedInjectionCode code={activeCode} />
			</div>

			<aside className="rounded-xl border border-sky-200 bg-sky-50 p-4 dark:border-white/10 dark:bg-slate-900">
				<p className="text-[11px] font-bold uppercase tracking-wider text-sky-700 dark:text-cyan-400">설치 가이드</p>
				<p className="mt-1 text-sm font-bold text-sky-950 dark:text-slate-100">{activeGuide.title}</p>
				<p className="mt-1 font-mono text-xs font-semibold text-sky-800 dark:text-cyan-300">{activeGuide.path}</p>
				<ol className="mt-2 list-decimal space-y-1 pl-4 text-xs leading-5 text-sky-900 dark:text-slate-300">
					{activeGuide.steps.map((step) => (
						<li key={step}>{step}</li>
					))}
				</ol>
			</aside>
		</section>
	);
}
