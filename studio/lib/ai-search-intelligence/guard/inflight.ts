const INFLIGHT = new Map<string, Promise<unknown>>();

export function clearAsiInflight() {
	INFLIGHT.clear();
}

export function withAsiInflight<T>(key: string, run: () => Promise<T>): Promise<T> {
	const existing = INFLIGHT.get(key);
	if (existing) return existing as Promise<T>;
	const pending = run().finally(() => {
		if (INFLIGHT.get(key) === pending) INFLIGHT.delete(key);
	});
	INFLIGHT.set(key, pending);
	return pending;
}
