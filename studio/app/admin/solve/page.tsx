import { mapAuditReportToSolveSnapshot, solveSnapshotFromReportJson } from '@/lib/solve/from-audit-report';
import type { SolveAuditSnapshot } from '@/lib/solve/types';
import { getAuditProjectById } from '@/lib/firebase/audit-projects';
import { prisma } from '@/lib/prisma';
import { SolveWorkspaceShell } from '@/components/admin/SolveWorkspaceShell';

export const dynamic = 'force-dynamic';

interface PageProps {
	searchParams?:
		| Promise<{ id?: string; auditId?: string; tab?: string }>
		| { id?: string; auditId?: string; tab?: string };
}

async function loadAuditFromFirestore(docId: string): Promise<SolveAuditSnapshot | null> {
	const doc = await getAuditProjectById(docId).catch(() => null);
	if (!doc?.auditPayload?.report) return null;

	const cmsType =
		doc.auditPayload.cmsType && doc.auditPayload.cmsType !== 'UNKNOWN'
			? doc.auditPayload.cmsType
			: 'WordPress';

	return mapAuditReportToSolveSnapshot(doc.auditPayload.report, {
		id: doc.id,
		cmsType,
	});
}

async function loadAuditFromLead(auditId: string): Promise<SolveAuditSnapshot | null> {
	const lead = await prisma.auditLead.findUnique({
		where: { id: auditId },
		include: { project: { select: { cmsType: true } } },
	});
	if (!lead) return null;

	const cmsType =
		lead.project?.cmsType && lead.project.cmsType !== 'UNKNOWN'
			? lead.project.cmsType
			: 'WordPress';

	return solveSnapshotFromReportJson(lead.reportJson, {
		id: lead.id,
		cmsType,
	});
}

export default async function AdminSolvePage({ searchParams }: PageProps) {
	const params = await Promise.resolve(searchParams);
	// Prefer `id` (Firestore audit_projects doc id); keep `auditId` as legacy alias
	const docId = params?.id?.trim() || params?.auditId?.trim() || '';
	const tabParam = params?.tab;

	// TEMP: auth incomplete — open /admin/solve without login redirect
	const initialTab =
		tabParam === 'file-patch' || tabParam === 'tab-patch'
			? 'file-patch'
			: tabParam === 'proposal' || tabParam === 'tab-proposal'
				? 'proposal'
				: 'ai-cms';

	let loaded: SolveAuditSnapshot | null = null;
	if (docId) {
		loaded = await loadAuditFromFirestore(docId);
		if (!loaded) loaded = await loadAuditFromLead(docId);
	}

	return (
		<main className="flex flex-col gap-4">
			<div>
				<h1 className="text-2xl font-bold tracking-tight text-slate-900">해결 및 코드 주입</h1>
				<p className="mt-1 text-sm text-slate-600">
					진단 결과를 바탕으로 AI 해결안 · 파일 패치 · 제안서/견적을 진행합니다.
				</p>
			</div>

			<SolveWorkspaceShell
				initialAudit={loaded}
				initialTab={initialTab}
				firestoreDocId={docId || null}
			/>
		</main>
	);
}
