import { ASI_EMPTY } from '@/lib/ui/asi-chrome';

export function AsiEmptyState({ title, body }: { title: string; body: string }) {
	return (
		<section className={ASI_EMPTY}>
			<p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</p>
			<p className="mx-auto mt-2 max-w-md text-sm text-slate-500 dark:text-slate-400">{body}</p>
		</section>
	);
}

export function AsiErrorNote({ message }: { message: string }) {
	return <p className="text-sm font-semibold text-rose-600 dark:text-rose-300">{message}</p>;
}

export function AsiLoadingState({ title, hint }: { title: string; hint?: string }) {
	return (
		<section className={ASI_EMPTY} aria-busy="true" aria-live="polite">
			<div className="mx-auto h-1.5 w-32 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
				<div className="asi-loading-bar h-full w-1/2 rounded-full bg-cyan-500" />
			</div>
			<p className="mt-4 text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</p>
			{hint ? <p className="mx-auto mt-2 max-w-md text-sm text-slate-500 dark:text-slate-400">{hint}</p> : null}
		</section>
	);
}
