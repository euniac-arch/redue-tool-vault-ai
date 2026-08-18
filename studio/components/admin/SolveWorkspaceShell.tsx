'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useAuditPayload } from '@/components/audit/AuditPayloadProvider';
import { SolveSummaryBar } from '@/components/admin/SolveSummaryBar';
import { SolveWorkspaceTabs } from '@/components/admin/SolveWorkspaceTabs';
import { MenuStructurePanel } from '@/components/admin/solve/MenuStructurePanel';
import { SolveEmptyContext } from '@/components/admin/solve/SolveEmptyContext';
import { ExternalVerificationLinks } from '@/components/ExternalVerificationLinks';
import {
	getAuditProjectByIdClient,
	type AuditProjectDoc,
} from '@/lib/firebase/audit-projects-client';
import { isFirebaseClientConfigured } from '@/lib/firebase/client';
import type { AuditReport } from '@/lib/site-auditor';
import { mapAuditReportToSolveSnapshot } from '@/lib/solve/from-audit-report';
import { resolveClientSolveTransfer } from '@/lib/solve/payload-bridge';
import type { SolveAuditSnapshot } from '@/lib/solve/types';

interface SolveWorkspaceShellProps {
	/** Server-resolved audit; null when `?id=` missing or document not found */
	initialAudit: SolveAuditSnapshot | null;
	initialTab?: 'ai-cms' | 'file-patch' | 'proposal';
	/** Firestore `audit_projects` document id from `?id=` */
	firestoreDocId?: string | null;
}

async function fetchAuditViaApi(id: string): Promise<AuditProjectDoc | null> {
	try {
		const res = await fetch(`/api/audit/${encodeURIComponent(id)}`);
		if (!res.ok) return null;
		const data = await res.json();
		if (!data?.report?.url) return null;
		return {
			id: data.id as string,
			url: data.report.url as string,
			score: typeof data.score === 'number' ? data.score : Math.round(data.report.score),
			issueCount: typeof data.issueCount === 'number' ? data.issueCount : 0,
			auditPayload: {
				report: data.report,
				issues: [],
				checklist: [],
				specs: {
					h1: { count: 0, texts: [] },
					meta: {
						pageTitle: '',
						metaDescription: '',
						titleLength: 0,
						metaDescriptionLength: 0,
					},
					schema: { coverage: 0, types: [], jsonLdBlockCount: 0 },
				},
				cmsType: undefined,
			},
			createdAt: data.createdAt || new Date().toISOString(),
		};
	} catch {
		return null;
	}
}

type LoadPhase = 'ready' | 'hydrating' | 'empty';

export function SolveWorkspaceShell({
	initialAudit,
	initialTab = 'ai-cms',
	firestoreDocId = null,
}: SolveWorkspaceShellProps) {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const { latest, refreshFromStorage } = useAuditPayload();
	const [audit, setAudit] = useState<SolveAuditSnapshot | null>(initialAudit);
	const [hydratedFromPayload, setHydratedFromPayload] = useState(false);
	const [phase, setPhase] = useState<LoadPhase>(initialAudit ? 'ready' : 'hydrating');
	const [reanalyzing, setReanalyzing] = useState(false);
	const [reanalyzeError, setReanalyzeError] = useState<string | null>(null);
	const [lastMenuRefreshedAt, setLastMenuRefreshedAt] = useState<string | null>(null);

	useEffect(() => {
		setAudit(initialAudit);
		setPhase(initialAudit ? 'ready' : 'hydrating');
		setHydratedFromPayload(false);
	}, [initialAudit, firestoreDocId]);

	useEffect(() => {
		let cancelled = false;

		async function hydrate() {
			refreshFromStorage();

			// 1) Firestore / API when `?id=` is present
			if (firestoreDocId) {
				let doc: AuditProjectDoc | null = null;
				if (isFirebaseClientConfigured()) {
					doc = await getAuditProjectByIdClient(firestoreDocId).catch(() => null);
				}
				if (!doc) {
					doc = await fetchAuditViaApi(firestoreDocId);
				}

				if (!cancelled && doc?.auditPayload?.report) {
					const fromFs = mapAuditReportToSolveSnapshot(doc.auditPayload.report, {
						id: doc.id,
						cmsType:
							doc.auditPayload.cmsType ||
							latest?.cmsType ||
							'WordPress',
					});
					setAudit(fromFs);
					setHydratedFromPayload(true);
					setPhase('ready');
					return;
				}

				// Keep server-loaded audit if client hydrate failed
				if (!cancelled && initialAudit) {
					setPhase('ready');
					return;
				}

				if (!cancelled) {
					setAudit(null);
					setPhase('empty');
					return;
				}
			}

			// 2) Optional session transfer (soft handoff from audit result CTA)
			const transfer = resolveClientSolveTransfer({ clearSession: true });
			if (!cancelled && transfer?.report) {
				const fromPayload = mapAuditReportToSolveSnapshot(transfer.report, {
					id: transfer.auditId || firestoreDocId || 'session',
					cmsType: transfer.cmsType || latest?.cmsType || 'WordPress',
				});
				setAudit(fromPayload);
				setHydratedFromPayload(true);
				setPhase('ready');
				return;
			}

			if (!cancelled) {
				setPhase(initialAudit ? 'ready' : 'empty');
			}
		}

		void hydrate();
		return () => {
			cancelled = true;
		};
	}, [firestoreDocId, initialAudit, latest?.cmsType, refreshFromStorage]);

	const defectCount = useMemo(
		() => (audit ? audit.issues.filter((i) => i.severity !== 'PASS').length : 0),
		[audit],
	);

	async function handleReanalyzeMenu() {
		if (!audit?.targetUrl || reanalyzing) return;
		setReanalyzing(true);
		setReanalyzeError(null);
		try {
			const res = await fetch(`/api/audit/scan?t=${Date.now()}`, {
				method: 'POST',
				cache: 'no-store',
				headers: {
					'Content-Type': 'application/json',
					'Cache-Control': 'no-cache, no-store, must-revalidate',
					Pragma: 'no-cache',
				},
				body: JSON.stringify({
					url: audit.targetUrl,
					lang: 'ko',
					forceRefresh: true,
					t: Date.now(),
					...(firestoreDocId ? { replaceId: firestoreDocId } : {}),
				}),
			});
			const data = (await res.json().catch(() => ({}))) as AuditReport & {
				id?: string | null;
				error?: string;
			};
			if (!res.ok || !data?.url || !Array.isArray(data.categories)) {
				throw new Error(data?.error || '메뉴구조 재분석에 실패했습니다. URL을 확인해 주세요.');
			}

			const nextId = (data.id && String(data.id).trim()) || audit.id;
			const snapshot = mapAuditReportToSolveSnapshot(data, {
				id: nextId,
				cmsType: audit.cmsType || latest?.cmsType || 'WordPress',
			});
			setAudit(snapshot);
			setHydratedFromPayload(true);
			setLastMenuRefreshedAt(new Date().toLocaleTimeString());
			setPhase('ready');

			if (nextId && nextId !== firestoreDocId && nextId !== 'session' && nextId !== 'payload') {
				const params = new URLSearchParams(searchParams.toString());
				params.set('id', nextId);
				params.delete('auditId');
				const qs = params.toString();
				router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
			}
		} catch (err) {
			setReanalyzeError(err instanceof Error ? err.message : String(err));
		} finally {
			setReanalyzing(false);
		}
	}

	if (phase === 'hydrating' && !audit) {
		return (
			<p className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500 shadow-sm">
				진단 데이터를 확인하는 중…
			</p>
		);
	}

	if (phase === 'empty' || !audit) {
		return <SolveEmptyContext missingDocId={firestoreDocId} />;
	}

	return (
		<>
			{hydratedFromPayload ? (
				<p className="text-xs font-medium text-emerald-700">
					DB 진단 데이터(audit_payload)가 로드되어 메뉴 구조 · 요약 · AI 해결 탭에 반영되었습니다.
				</p>
			) : null}

			{reanalyzeError ? (
				<p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-800">
					{reanalyzeError}
				</p>
			) : null}

			<div className="flex flex-col gap-3">
				<SolveSummaryBar
					url={audit.targetUrl}
					defectCount={defectCount}
					schemaCoveragePercent={audit.schemaCoveragePercent}
					overallScore={audit.overallScore}
					reanalyzing={reanalyzing}
					onReanalyzeMenu={() => void handleReanalyzeMenu()}
				/>

				<MenuStructurePanel
					pageMetas={audit.pageMetas || []}
					targetUrl={audit.targetUrl}
					reanalyzing={reanalyzing}
					onReanalyze={() => void handleReanalyzeMenu()}
					lastRefreshedAt={lastMenuRefreshedAt}
				/>
			</div>

			<SolveWorkspaceTabs audit={audit} initialTab={initialTab} />

			{/* 진단 요약 리포트 맨 하단 — 공식 검증 툴 퀵링크 */}
			<ExternalVerificationLinks url={audit.targetUrl} variant="light" className="mt-3" />
		</>
	);
}
