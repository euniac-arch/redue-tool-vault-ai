const RUNS = new Map<string, AbortController>();

export function beginAsiRun(requestId: string): AbortController {
	endAsiRun(requestId);
	const controller = new AbortController();
	RUNS.set(requestId, controller);
	return controller;
}

export function abortAsiRun(requestId: string, reason: 'cancelled' | 'timeout' = 'cancelled'): boolean {
	const run = RUNS.get(requestId);
	if (!run) return false;
	if (!run.signal.aborted) run.abort(reason);
	return true;
}

export function endAsiRun(requestId: string) {
	RUNS.delete(requestId);
}

export function getAsiRunController(requestId: string): AbortController | undefined {
	return RUNS.get(requestId);
}

export function clearAsiRuns() {
	for (const controller of RUNS.values()) {
		if (!controller.signal.aborted) controller.abort('cancelled');
	}
	RUNS.clear();
}
