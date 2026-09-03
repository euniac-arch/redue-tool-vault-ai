import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
	normalizeCaseStudyType,
	parseProjectCustomBaseline,
	type CaseStudyType,
} from '@/lib/projects';
import { isFirebaseAdminConfigured } from '@/lib/firebase/admin';
import {
	getAuditProjectById,
	updateAuditProjectCaseStudyFields,
} from '@/lib/firebase/audit-projects';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * PATCH /api/admin/projects/[id]/case-study
 *
 * Toggles a project's public "도입 사례" exposure/type and optional custom
 * Before baseline from the admin "전체 프로젝트 관리" list. Tries Prisma first,
 * then Firestore `audit_projects`.
 * TEMP: requireAdmin bypassed while login is incomplete (matches sibling routes).
 */
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
	const id = params.id?.trim();
	if (!id) {
		return NextResponse.json({ error: true, message: 'id가 필요합니다.' }, { status: 400 });
	}

	if (id.startsWith('local-') || id.startsWith('local-proj-')) {
		return NextResponse.json(
			{ error: true, message: '로컬 전용 진단은 도입사례로 등록할 수 없습니다. 먼저 서버에 동기화해 주세요.' },
			{ status: 400 },
		);
	}

	const body = (await request.json().catch(() => null)) as {
		isCaseStudy?: boolean;
		caseStudyType?: string | null;
		customBaseline?: unknown;
	} | null;

	if (!body || (typeof body.isCaseStudy !== 'boolean' && !('customBaseline' in body))) {
		return NextResponse.json({ error: true, message: 'isCaseStudy(boolean)는 필수입니다.' }, { status: 400 });
	}

	const requestedType = normalizeCaseStudyType(body.caseStudyType);
	const customBaseline =
		'customBaseline' in body
			? body.customBaseline == null
				? null
				: parseProjectCustomBaseline(body.customBaseline)
			: undefined;
	if (customBaseline === null && body.customBaseline != null) {
		return NextResponse.json(
			{ error: true, message: '초기 베이스라인 점수(overall 0–100)가 올바르지 않습니다.' },
			{ status: 400 },
		);
	}

	try {
		const existing = await prisma.project.findUnique({ where: { id } });
		if (existing) {
			const isCaseStudy = typeof body.isCaseStudy === 'boolean' ? body.isCaseStudy : existing.isCaseStudy;
			const caseStudyType: CaseStudyType | null = isCaseStudy
				? requestedType || normalizeCaseStudyType(existing.caseStudyType) || 'simulation'
				: null;
			const updated = await prisma.project.update({
				where: { id },
				data: {
					isCaseStudy,
					caseStudyType,
					...(customBaseline !== undefined
						? { customBaseline: customBaseline ? JSON.stringify(customBaseline) : null }
						: {}),
				},
			});
			return NextResponse.json({
				id: updated.id,
				isCaseStudy: updated.isCaseStudy,
				caseStudyType: normalizeCaseStudyType(updated.caseStudyType),
				customBaseline: parseProjectCustomBaseline(updated.customBaseline),
				source: 'prisma',
			});
		}
	} catch (prismaErr) {
		const code = (prismaErr as { code?: string } | null)?.code;
		if (code !== 'P2025') {
			console.error('[admin/projects/case-study] Prisma update failed:', prismaErr);
		}
	}

	if (isFirebaseAdminConfigured()) {
		try {
			const existing = await getAuditProjectById(id);
			if (!existing) {
				return NextResponse.json({ error: true, message: '프로젝트를 찾을 수 없습니다.' }, { status: 404 });
			}
			const isCaseStudy = typeof body.isCaseStudy === 'boolean' ? body.isCaseStudy : existing.isCaseStudy;
			const caseStudyType: CaseStudyType | null = isCaseStudy
				? requestedType || existing.caseStudyType || 'simulation'
				: null;
			const result = await updateAuditProjectCaseStudyFields(id, {
				isCaseStudy,
				caseStudyType,
				...(customBaseline !== undefined ? { customBaseline } : {}),
			});
			if (result) {
				return NextResponse.json({ ...result, source: 'firestore' });
			}
		} catch (firestoreErr) {
			console.error('[admin/projects/case-study] Firestore update failed:', firestoreErr);
			return NextResponse.json(
				{ error: true, message: '도입사례 노출 설정 변경에 실패했습니다.' },
				{ status: 500 },
			);
		}
	}

	return NextResponse.json({ error: true, message: '프로젝트를 찾을 수 없습니다.' }, { status: 404 });
}
