import type { PromptCategoryId, PromptDifficulty } from '@/lib/prompt-hub';
import { PROMPT_DIFFICULTY_LABEL } from '@/lib/prompt-hub';

const CATEGORY_CLASS: Record<PromptCategoryId, string> = {
	seo: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-300',
	geo: 'border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-500/30 dark:bg-cyan-500/10 dark:text-cyan-300',
	aeo: 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-300',
	entity: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300',
	schema: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300',
	local: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300',
	content: 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-600 dark:bg-slate-800/70 dark:text-slate-300',
};

const DIFFICULTY_CLASS: Record<PromptDifficulty, string> = {
	beginner: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300',
	intermediate: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300',
	advanced: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300',
};

export function PromptCategoryBadge({ category, label }: { category: PromptCategoryId; label: string }) {
	return (
		<span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${CATEGORY_CLASS[category]}`}>
			{label}
		</span>
	);
}

export function PromptDifficultyBadge({ difficulty }: { difficulty: PromptDifficulty }) {
	return (
		<span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${DIFFICULTY_CLASS[difficulty]}`}>
			{PROMPT_DIFFICULTY_LABEL[difficulty]}
		</span>
	);
}
