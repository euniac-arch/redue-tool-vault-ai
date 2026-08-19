'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import {
	AUDIT_HISTORY_SYNC_CHANNEL,
	AUDIT_HISTORY_SYNC_KEY,
	dedupeHistoryEntries,
	filterDeletedHistoryEntries,
	getGuestAudits,
	type AuditHistoryEntry,
} from '@/lib/audit-history-storage';

type HistorySyncDetail = {
	entry?: AuditHistoryEntry | null;
	ids?: string[];
	all?: boolean;
};

function parseHistoryPayload(data: unknown): AuditHistoryEntry[] {
	if (!data || typeof data !== 'object') return [];
	const body = data as { items?: AuditHistoryEntry[]; history?: AuditHistoryEntry[] };
	if (Array.isArray(body.items) && body.items.length) return body.items;
	if (Array.isArray(body.history)) return body.history;
	if (Array.isArray(body.items)) return body.items;
	return [];
}

/**
 * Dual-load audit history: Prisma `/api/audit/history` when signed in,
 * `localStorage` guest cache otherwise. New scans can be unshifted immediately.
 */
export function useAuditHistory() {
	const { data: session, status: authStatus } = useSession();
	const signedIn = Boolean(session?.user?.id);
	const [historyList, setHistoryList] = useState<AuditHistoryEntry[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const loadHistory = useCallback(
		async (opts?: { quiet?: boolean }) => {
			if (authStatus === 'loading') return;
			if (!opts?.quiet) {
				setLoading(true);
				setError(null);
			}

			try {
				if (!signedIn) {
					setHistoryList(filterDeletedHistoryEntries(getGuestAudits()));
					return;
				}

				const res = await fetch('/api/audit/history', { cache: 'no-store' });
				const data: unknown = await res.json().catch(() => ({}));
				if (!res.ok) {
					const message =
						data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
							? data.error
							: 'Failed to load history.';
					throw new Error(message);
				}
				setHistoryList(filterDeletedHistoryEntries(dedupeHistoryEntries(parseHistoryPayload(data))));
			} catch (err) {
				setError((err as Error).message);
				if (!signedIn) {
					setHistoryList(filterDeletedHistoryEntries(getGuestAudits()));
				}
			} finally {
				if (!opts?.quiet) setLoading(false);
			}
		},
		[authStatus, signedIn],
	);

	const prependHistory = useCallback((entry: AuditHistoryEntry) => {
		setHistoryList((prev) => filterDeletedHistoryEntries(dedupeHistoryEntries([entry, ...prev])));
	}, []);

	useEffect(() => {
		if (authStatus === 'loading') return;
		void loadHistory();
	}, [authStatus, signedIn, loadHistory]);

	useEffect(() => {
		const onCustom = (event: Event) => {
			const detail = (event as CustomEvent<HistorySyncDetail>).detail;
			if (detail?.entry?.id) {
				prependHistory(detail.entry);
			}
			void loadHistory({ quiet: true });
		};
		const onStorage = (event: StorageEvent) => {
			if (event.key !== AUDIT_HISTORY_SYNC_KEY) return;
			try {
				const parsed = event.newValue ? (JSON.parse(event.newValue) as HistorySyncDetail) : null;
				if (parsed?.entry?.id) prependHistory(parsed.entry);
			} catch {
				// ignore malformed sync payload
			}
			void loadHistory({ quiet: true });
		};
		const onVisible = () => {
			if (document.visibilityState === 'visible') void loadHistory({ quiet: true });
		};

		window.addEventListener('storage', onStorage);
		window.addEventListener(AUDIT_HISTORY_SYNC_CHANNEL, onCustom as EventListener);
		document.addEventListener('visibilitychange', onVisible);

		let channel: BroadcastChannel | null = null;
		try {
			channel = new BroadcastChannel(AUDIT_HISTORY_SYNC_CHANNEL);
			channel.onmessage = (event: MessageEvent<HistorySyncDetail>) => {
				if (event.data?.entry?.id) prependHistory(event.data.entry);
				void loadHistory({ quiet: true });
			};
		} catch {
			channel = null;
		}

		return () => {
			window.removeEventListener('storage', onStorage);
			window.removeEventListener(AUDIT_HISTORY_SYNC_CHANNEL, onCustom as EventListener);
			document.removeEventListener('visibilitychange', onVisible);
			channel?.close();
		};
	}, [loadHistory, prependHistory]);

	return {
		session,
		authStatus,
		signedIn,
		historyList,
		setHistoryList,
		prependHistory,
		loadHistory,
		loading,
		error,
		setError,
	};
}
