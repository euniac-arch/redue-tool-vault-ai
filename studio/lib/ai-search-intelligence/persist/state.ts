const HYDRATED = new Set<string>();

export function asiHistoryHydrated(domain: string): boolean {
	return HYDRATED.has(domain.trim().toLowerCase());
}

export function markAsiHistoryHydrated(domain: string) {
	HYDRATED.add(domain.trim().toLowerCase());
}

export function resetAsiHistoryHydration(domain?: string) {
	if (!domain) {
		HYDRATED.clear();
		return;
	}
	HYDRATED.delete(domain.trim().toLowerCase());
}
