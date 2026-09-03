/**
 * Recent Simulator queries. Session-scoped by site domain. Query text only.
 */
const KEY = 'asi_simulator_recent';
const MAX = 5;

function isBrowser(): boolean {
	return typeof window !== 'undefined';
}

function readAll(): Record<string, string[]> {
	if (!isBrowser()) return {};
	try {
		const raw = window.sessionStorage.getItem(KEY);
		if (!raw) return {};
		const parsed = JSON.parse(raw) as Record<string, string[]>;
		return parsed && typeof parsed === 'object' ? parsed : {};
	} catch {
		return {};
	}
}

export function readRecentSimulatorQueries(domain: string): string[] {
	const host = domain.trim().toLowerCase();
	if (!host) return [];
	return (readAll()[host] ?? []).filter((item) => item.trim());
}

export function pushRecentSimulatorQuery(domain: string, query: string): string[] {
	const host = domain.trim().toLowerCase();
	const text = query.trim();
	if (!host || !text || !isBrowser()) return readRecentSimulatorQueries(host);
	const next = [text, ...(readAll()[host] ?? []).filter((item) => item.trim().toLowerCase() !== text.toLowerCase())].slice(
		0,
		MAX,
	);
	try {
		window.sessionStorage.setItem(KEY, JSON.stringify({ ...readAll(), [host]: next }));
	} catch {
		// ignore quota
	}
	return next;
}
