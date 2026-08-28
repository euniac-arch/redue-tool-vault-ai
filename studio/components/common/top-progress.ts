/**
 * Imperative API for the global top progress bar.
 * Navigation is started automatically from link clicks; call these
 * around long data fetches that are not tied to a route change.
 */

export const TOP_PROGRESS_START_EVENT = 'redue:top-progress-start';
export const TOP_PROGRESS_DONE_EVENT = 'redue:top-progress-done';

export function startTopProgress() {
	if (typeof window === 'undefined') return;
	window.dispatchEvent(new Event(TOP_PROGRESS_START_EVENT));
}

export function doneTopProgress() {
	if (typeof window === 'undefined') return;
	window.dispatchEvent(new Event(TOP_PROGRESS_DONE_EVENT));
}
