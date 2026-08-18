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
import {
	resolveEvaluationReport,
	type AppliedPrescriptionState,
	type PrescriptionViewMode,
} from '@/lib/audit/evaluation-result';
import type { AuditReport } from '@/lib/site-auditor';

interface AuditPayloadContextValue {
	latest: LatestAuditPayload | null;
	/** Persist report to Context (optional session cache). Firestore is source of truth. */
	persistAudit: (
		report: AuditReport,
		opts?: { auditId?: string | null; cmsType?: string; archiveProject?: boolean },
	) => LatestAuditPayload | null;
	refreshFromStorage: () => void;
	/** Measured report overlay (flags only) — never a projected After-state. */
	evaluationResult: AuditReport | null;
	isPrescriptionApplied: boolean;
	appliedResult: AppliedPrescriptionState | null;
	/** Bumps whenever After/Before evaluation changes — PDF preview remounts on this. */
	prescriptionRevision: number;
	setEvaluationResult: (updatedData: AuditReport | null) => void;
	setAppliedResult: (next: AppliedPrescriptionState | null) => void;
	setPrescriptionViewMode: (mode: PrescriptionViewMode) => void;
	clearPrescriptionEvaluation: () => void;
}

const AuditPayloadContext = createContext<AuditPayloadContextValue | null>(null);

function sameAuditIdentity(a: AuditReport | null | undefined, b: AuditReport | null | undefined): boolean {
	if (!a || !b) return false;
	return a.url === b.url && a.fetchedAt === b.fetchedAt;
}

export function AuditPayloadProvider({ children }: { children: ReactNode }) {
	const [latest, setLatest] = useState<LatestAuditPayload | null>(null);
	const [evaluationResult, setEvaluationResultState] = useState<AuditReport | null>(null);
	const [isPrescriptionApplied, setIsPrescriptionApplied] = useState(false);
	const [appliedResult, setAppliedResultState] = useState<AppliedPrescriptionState | null>(null);
	const [prescriptionRevision, setPrescriptionRevision] = useState(0);

	const bumpRevision = useCallback(() => {
		setPrescriptionRevision((n) => n + 1);
	}, []);

	const clearPrescriptionEvaluation = useCallback(() => {
		setEvaluationResultState(null);
		setIsPrescriptionApplied(false);
		setAppliedResultState(null);
		bumpRevision();
	}, [bumpRevision]);

	const setEvaluationResult = useCallback(
		(updatedData: AuditReport | null) => {
			setEvaluationResultState(updatedData);
			if (updatedData) {
				setIsPrescriptionApplied(true);
			}
			bumpRevision();
		},
		[bumpRevision],
	);

	const setAppliedResult = useCallback(
		(next: AppliedPrescriptionState | null) => {
			setAppliedResultState(next);
			if (!next) {
				setEvaluationResultState(null);
				setIsPrescriptionApplied(false);
				bumpRevision();
				return;
			}
			setIsPrescriptionApplied(true);
			bumpRevision();
		},
		[bumpRevision],
	);

	const setPrescriptionViewMode = useCallback((mode: PrescriptionViewMode) => {
		setAppliedResultState((prev) => {
			if (!prev) return prev;
			return { ...prev, viewMode: mode };
		});
		bumpRevision();
	}, [bumpRevision]);

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
			const next = buildLatestAuditPayload(report, opts);
			setLatest((prev) => {
				const identityChanged = Boolean(prev && !sameAuditIdentity(prev.report, report));
				if (identityChanged) {
					setEvaluationResultState(null);
					setIsPrescriptionApplied(false);
					setAppliedResultState(null);
					setPrescriptionRevision((n) => n + 1);
				}
				return next;
			});
			return next;
		},
		[],
	);

	const value = useMemo(
		() => ({
			latest,
			persistAudit,
			refreshFromStorage,
			evaluationResult,
			isPrescriptionApplied,
			appliedResult,
			prescriptionRevision,
			setEvaluationResult,
			setAppliedResult,
			setPrescriptionViewMode,
			clearPrescriptionEvaluation,
		}),
		[
			latest,
			persistAudit,
			refreshFromStorage,
			evaluationResult,
			isPrescriptionApplied,
			appliedResult,
			prescriptionRevision,
			setEvaluationResult,
			setAppliedResult,
			setPrescriptionViewMode,
			clearPrescriptionEvaluation,
		],
	);

	return <AuditPayloadContext.Provider value={value}>{children}</AuditPayloadContext.Provider>;
}

const EMPTY_AUDIT_PAYLOAD: AuditPayloadContextValue = {
	latest: null,
	persistAudit: (report, opts) => buildLatestAuditPayload(report, opts),
	refreshFromStorage: () => undefined,
	evaluationResult: null,
	isPrescriptionApplied: false,
	appliedResult: null,
	prescriptionRevision: 0,
	setEvaluationResult: () => undefined,
	setAppliedResult: () => undefined,
	setPrescriptionViewMode: () => undefined,
	clearPrescriptionEvaluation: () => undefined,
};

export function useAuditPayload(): AuditPayloadContextValue {
	const ctx = useContext(AuditPayloadContext);
	return ctx ?? EMPTY_AUDIT_PAYLOAD;
}

/** Measured report (plus apply-event flags) when a prescription was recorded; otherwise the baseline crawl. */
export function useEvaluationReport(fallback: AuditReport): AuditReport {
	const { evaluationResult } = useAuditPayload();
	return useMemo(
		() => resolveEvaluationReport(fallback, evaluationResult),
		[fallback, evaluationResult],
	);
}
