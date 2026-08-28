import { Camera, ImageIcon, Images, Map, Sparkles } from 'lucide-react';
import type { ApiProvider } from '@/lib/admin/api-usage';

const WRAP =
	'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1';

const STYLE: Record<ApiProvider, string> = {
	openai: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30',
	anthropic: 'bg-orange-50 text-orange-700 ring-orange-200 dark:bg-orange-500/15 dark:text-orange-300 dark:ring-orange-500/30',
	perplexity: 'bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:ring-sky-500/30',
	gemini: 'bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:ring-blue-500/30',
	googlemaps: 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-500/15 dark:text-red-300 dark:ring-red-500/30',
	unsplash: 'bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700',
	pexels: 'bg-teal-50 text-teal-700 ring-teal-200 dark:bg-teal-500/15 dark:text-teal-300 dark:ring-teal-500/30',
	pixabay: 'bg-lime-50 text-lime-800 ring-lime-200 dark:bg-lime-500/15 dark:text-lime-300 dark:ring-lime-500/30',
};

export function ServiceModelIcon({ provider }: { provider: ApiProvider }) {
	const Icon =
		provider === 'googlemaps'
			? Map
			: provider === 'unsplash'
				? Camera
				: provider === 'pexels'
					? ImageIcon
					: provider === 'pixabay'
						? Images
						: Sparkles;

	return (
		<span className={`${WRAP} ${STYLE[provider]}`}>
			<Icon className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
		</span>
	);
}
