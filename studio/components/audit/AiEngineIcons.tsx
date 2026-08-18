import type { ReactElement } from 'react';
import type { AiVisibilityEngineId } from '@/lib/audit/ai-engine-visibility';

export function ChatGptGlyph({ className }: { className?: string }) {
	return (
		<svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
			<path d="M22.28 9.81a5.98 5.98 0 00-.52-4.91 6.05 6.05 0 00-6.5-2.9A6.03 6.03 0 0010.05 0a6.05 6.05 0 00-5.72 4.17 6.01 6.01 0 00-4.03 2.91 6.07 6.05 0 00.74 7.11 5.98 5.98 0 00.52 4.91 6.05 6.05 0 006.5 2.9A6.02 6.05 0 0013.95 24a6.05 6.05 0 005.72-4.17 6.01 6.05 0 004.03-2.91 6.07 6.05 0 00-.74-7.11h-.68zM13.95 22.2a4.5 4.5 0 01-2.89-1.04l.14-.08 4.78-2.76a.78.78 0 00.39-.67V11.3l2.02 1.17c.04.02.06.06.06.1v5.58a4.51 4.5 0 01-4.5 4.05zm-9.65-3.65a4.48 4.5 0 01-.54-3.02l.14.08 4.78 2.76c.24.14.54.14.78 0l5.83-3.37v2.33a.78.78 0 01-.31.66l-4.84 2.8a4.51 4.5 0 01-5.84-1.24zm-1.25-10.4l.14-.09 4.78-2.76c.24-.14.53-.14.78 0l5.83 3.37V11.8a.78.78 0 01-.31.66l-4.83 2.79a.78.78 0 01-.78 0L5.8 12.1a.78.78 0 01-.39-.67V8.87a4.5 4.5 0 011.64-.72zm16.1 3.75l-2.02-1.17V8.5a.78.78 0 00-.31-.66l-4.83-2.79-.14.08v5.54l2.02 1.17a.78.78 0 00.78 0l4.84-2.8c.02-.02.04-.04.04-.07a4.47 4.5 0 00-.38-.97zm2.08-3.04l-.14.08-4.78 2.76a.78.78 0 00-.39.67v6.73l-2.02-1.16V9.2a.78.78 0 01.31-.66l4.83-2.8a4.51 4.5 0 012.19 4.98zm-14.6 4.85l-2.02-1.17V7.66c0-.27.14-.52.39-.67l4.83-2.79.14.08v5.54l-2.02 1.17a.78.78 0 01-.78 0l-.54-.32zM9.2 3.84A4.5 4.5 0 0112.1 2.8l-.14.08L7.17 5.64a.78.78 0 00-.39.67v6.73L4.76 11.87V6.3a4.51 4.5 0 014.44-2.46z" />
		</svg>
	);
}

export function GeminiGlyph({ className }: { className?: string }) {
	return (
		<svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
			<path d="M12 2.2c.35 3.55 2.2 6.55 5.7 7.8-3.5 1.25-5.35 4.25-5.7 7.8-.35-3.55-2.2-6.55-5.7-7.8 3.5-1.25 5.35-4.25 5.7-7.8z" />
			<path d="M18.6 3.4c.18 1.7 1.05 3.12 2.7 3.7-1.65.58-2.52 2-2.7 3.7-.18-1.7-1.05-3.12-2.7-3.7 1.65-.58 2.52-2 2.7-3.7z" opacity="0.85" />
		</svg>
	);
}

export function ClaudeGlyph({ className }: { className?: string }) {
	return (
		<svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
			<path d="M12.9 2.1l1.7 4.6 4.7.2-3.7 3 1.3 4.7-4.1-2.4-4.2 2.3 1.4-4.7-3.7-2.9 4.7-.1 1.9-4.7zm-6.4 9.2l1.1 2.9 2.9.1-2.3 1.8.8 2.9-2.6-1.5-2.6 1.4.9-2.9-2.3-1.8 2.9-.1 1.2-2.8z" />
		</svg>
	);
}

export function PerplexityGlyph({ className }: { className?: string }) {
	return (
		<svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
			<path d="M12 3v18M7.2 6.5l9.6 11M16.8 6.5l-9.6 11" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" />
			<circle cx="12" cy="4.2" r="1.5" fill="currentColor" />
			<circle cx="12" cy="19.8" r="1.5" fill="currentColor" />
		</svg>
	);
}

export function CopilotGlyph({ className }: { className?: string }) {
	return (
		<svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
			<path d="M8.2 4.4c1.7-1.6 4.4-1.6 6.1.1 1.4-1 3.4-.9 4.7.4 1.4 1.4 1.5 3.6.3 5.1 1.4 1.6 1.3 4-.3 5.5-1.3 1.3-3.3 1.5-4.8.5-1.7 1.8-4.5 1.9-6.3.2-1.5 1.1-3.6.9-4.9-.4-1.5-1.5-1.6-3.8-.2-5.4-1.3-1.6-1.1-4 .4-5.4 1.4-1.3 3.4-1.4 4.9-.4z" />
			<circle cx="9.2" cy="11.2" r="1.15" fill="#fff" />
			<circle cx="14.8" cy="11.2" r="1.15" fill="#fff" />
		</svg>
	);
}

export function ClovaGlyph({ className }: { className?: string }) {
	return (
		<svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
			<path d="M12 3.2c-4.6 0-8.3 3.2-8.3 7.2 0 2.5 1.5 4.7 3.8 6l-.9 3.4 3.7-2c.5.1 1.1.1 1.7.1 4.6 0 8.3-3.2 8.3-7.3S16.6 3.2 12 3.2zm-2.4 5.3h1.8l1.1 3.3 1.1-3.3h1.8l-2.1 5.6H11.7L9.6 8.5z" />
		</svg>
	);
}

export const ENGINE_GLYPH: Record<AiVisibilityEngineId, (props: { className?: string }) => ReactElement> = {
	chatgpt: ChatGptGlyph,
	gemini: GeminiGlyph,
	claude: ClaudeGlyph,
	perplexity: PerplexityGlyph,
	copilot: CopilotGlyph,
	clova: ClovaGlyph,
};

/** Native-ish chat chrome per AI brand (light + dark). */
export const ENGINE_CHAT_THEME: Record<
	AiVisibilityEngineId,
	{
		logoWrap: string;
		header: string;
		shell: string;
		userBubble: string;
		aiBubble: string;
		accentText: string;
	}
> = {
	chatgpt: {
		logoWrap: 'bg-[#10A37F] text-white',
		header: 'border-[#2f2f2f]/10 dark:border-white/10 bg-[#f7f7f8] dark:bg-[#171717]',
		shell: 'bg-white dark:bg-[#212121] border-slate-200 dark:border-[#2f2f2f]',
		userBubble: 'bg-slate-100 dark:bg-[#2f2f2f] text-slate-800 dark:text-slate-100',
		aiBubble: 'bg-white dark:bg-[#212121] text-slate-700 dark:text-slate-200',
		accentText: 'text-[#0d8c6a] dark:text-[#19c37d]',
	},
	gemini: {
		logoWrap: 'bg-gradient-to-br from-[#4B8BF5] via-[#9B72CB] to-[#D96570] text-white',
		header: 'border-indigo-200/70 dark:border-indigo-500/25 bg-gradient-to-r from-blue-50 to-fuchsia-50 dark:from-indigo-950/50 dark:to-fuchsia-950/30',
		shell: 'bg-white dark:bg-[#0b1020] border-indigo-200 dark:border-indigo-500/30',
		userBubble: 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-950 dark:text-indigo-50',
		aiBubble: 'bg-slate-50 dark:bg-white/[0.04] text-slate-700 dark:text-slate-200',
		accentText: 'text-indigo-700 dark:text-indigo-300',
	},
	claude: {
		logoWrap: 'bg-[#D97757] text-white',
		header: 'border-[#E8D5C4] dark:border-[#D97757]/30 bg-[#F7F0E8] dark:bg-[#2a1c16]',
		shell: 'bg-[#FBF7F3] dark:bg-[#1a1410] border-[#E8D5C4] dark:border-[#D97757]/25',
		userBubble: 'bg-[#EFE4D8] dark:bg-[#3a2a22] text-[#4a372c] dark:text-[#f3e6dc]',
		aiBubble: 'bg-white/80 dark:bg-[#241c18] text-[#3f2f27] dark:text-[#f0e4da]',
		accentText: 'text-[#C65D3B] dark:text-[#E8A07A]',
	},
	perplexity: {
		logoWrap: 'bg-[#20B8CD] text-[#042026]',
		header: 'border-cyan-200 dark:border-cyan-500/25 bg-cyan-50 dark:bg-[#062026]',
		shell: 'bg-white dark:bg-[#071318] border-cyan-200 dark:border-cyan-500/20',
		userBubble: 'bg-cyan-100 dark:bg-cyan-500/15 text-cyan-950 dark:text-cyan-50',
		aiBubble: 'bg-slate-50 dark:bg-white/[0.03] text-slate-700 dark:text-slate-200',
		accentText: 'text-cyan-700 dark:text-cyan-300',
	},
	copilot: {
		logoWrap: 'bg-[#0078D4] text-white',
		header: 'border-sky-200 dark:border-sky-500/25 bg-sky-50 dark:bg-[#0b1a2c]',
		shell: 'bg-white dark:bg-[#0a1624] border-sky-200 dark:border-sky-500/25',
		userBubble: 'bg-sky-100 dark:bg-sky-500/20 text-sky-950 dark:text-sky-50',
		aiBubble: 'bg-slate-50 dark:bg-white/[0.04] text-slate-700 dark:text-slate-200',
		accentText: 'text-sky-700 dark:text-sky-300',
	},
	clova: {
		logoWrap: 'bg-[#03C75A] text-white',
		header: 'border-emerald-200 dark:border-emerald-500/25 bg-emerald-50 dark:bg-[#062416]',
		shell: 'bg-white dark:bg-[#07140e] border-emerald-200 dark:border-emerald-500/25',
		userBubble: 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-950 dark:text-emerald-50',
		aiBubble: 'bg-slate-50 dark:bg-white/[0.03] text-slate-700 dark:text-slate-200',
		accentText: 'text-emerald-700 dark:text-emerald-300',
	},
};
