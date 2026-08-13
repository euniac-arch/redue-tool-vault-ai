'use client';

import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
	type ReactNode,
} from 'react';
import {
	buildLatestAuditPayload,
	loadLatestAuditPayload,
	type LatestAuditPayload,
} from '@/lib/audit/latest-audit-payload';
import type { AuditReport } from '@/lib/site-auditor';

interface AuditPayloadContextValue {
	latest: LatestAuditPayload | null;
	/** Persist report to Context (optional session cache). Firestore is source of truth. */
	persistAudit: (
		report: AuditReport,
		opts?: { auditId?: string | null; cmsType?: string; archiveProject?: boolean },
	) => LatestAuditPayload | null;
	refreshFromStorage: () => void;
}

const AuditPayloadContext = createContext<AuditPayloadContextValue | null>(null);

export function AuditPayloadProvider({ children }: { children: ReactNode }) {
	const [latest, setLatest] = useState<LatestAuditPayload | null>(null);

	const refreshFromStorage = useCallback(() => {
		setLatest(loadLatestAuditPayload());
	}, []);

	useEffect(() => {
		refreshFromStorage();

		function onStorage(e: StorageEvent) {
			if (e.key === 'latest_audit_payload') refreshFromStorage();
		}
		function onCustom() {
			refreshFromStorage();
		}

		window.addEventListener('storage', onStorage);
		window.addEventListener('redue:latest-audit', onCustom);
		return () => {
			window.removeEventListener('storage', onStorage);
			window.removeEventListener('redue:latest-audit', onCustom);
		};
	}, [refreshFromStorage]);

	const persistAudit = useCallback(
		(
			report: AuditReport,
			opts?: { auditId?: string | null; cmsType?: string; archiveProject?: boolean },
		) => {
			// In-memory Context only — durable store is Firestore `audit_projects`
			const next = buildLatestAuditPayload(report, opts);
			setLatest(next);
			return next;
		},
		[],
	);

	const value = useMemo(
		() => ({ latest, persistAudit, refreshFromStorage }),
		[latest, persistAudit, refreshFromStorage],
	);

	return <AuditPayloadContext.Provider value={value}>{children}</AuditPayloadContext.Provider>;
}

export function useAuditPayload(): AuditPayloadContextValue {
	const ctx = useContext(AuditPayloadContext);
	if (!ctx) {
		return {
			latest: null,
			persistAudit: (report, opts) => buildLatestAuditPayload(report, opts),
			refreshFromStorage: () => undefined,
		};
	}
	return ctx;
}
