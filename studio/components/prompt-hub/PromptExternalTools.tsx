'use client';

import { ExternalLink } from 'lucide-react';
import { loadPublicAiTools, type AiTool } from '@/lib/ai-hub';

const FALLBACK_LABEL: Record<string, string> = {
	chatgpt: 'ChatGPT에서 사용',
	claude: 'Claude에서 사용',
	gemini: 'Gemini에서 사용',
	perplexity: 'Perplexity에서 사용',
};

function resolveTools(ids: string[]): AiTool[] {
	const publicTools = loadPublicAiTools();
	return ids
		.map((id) => publicTools.find((tool) => tool.id === id))
		.filter((tool): tool is AiTool => Boolean(tool));
}

export function PromptExternalTools({
	toolIds,
	promptText,
}: {
	toolIds: string[];
	promptText: string;
}) {
	const tools = resolveTools(toolIds);
	if (tools.length === 0) return null;

	async function openTool(url: string) {
		try {
			if (promptText && navigator.clipboard?.writeText) {
				await navigator.clipboard.writeText(promptText);
			}
		} catch {
			/* copy is optional; still open the official site */
		}
		window.open(url, '_blank', 'noopener,noreferrer');
	}

	return (
		<div className="flex flex-col gap-2">
			<p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
				관련 AI 도구
			</p>
			<div className="flex flex-wrap gap-2">
				{tools.map((tool) => (
					<button
						key={tool.id}
						type="button"
						onClick={() => void openTool(tool.url)}
						className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold text-slate-700 transition hover:border-cyan-300 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200 dark:hover:border-cyan-500/40"
					>
						<ExternalLink className="h-3.5 w-3.5" aria-hidden />
						{FALLBACK_LABEL[tool.id] ?? `${tool.name}에서 사용`}
					</button>
				))}
			</div>
			<p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
				공식 사이트를 엽니다. 가능한 경우 프롬프트를 먼저 복사해 두었으니 붙여넣기 하면 됩니다.
			</p>
		</div>
	);
}
