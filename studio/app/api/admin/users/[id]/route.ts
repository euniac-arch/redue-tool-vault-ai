import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { writeAdminAuditLog } from '@/lib/admin/admin-audit-log';
import { findAdminMember } from '@/lib/admin/user-query';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface PatchBody {
	status?: string;
	role?: string;
	memo?: string;
	planId?: string;
}

export async function GET(_request: Request, { params }: { params: { id: string } }) {
	const admin = await requireAdmin();
	if (!admin) {
		return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
	}
	const member = await findAdminMember(params.id);
	if (!member) return NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 404 });
	return NextResponse.json(member);
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
	const admin = await requireAdmin();
	if (!admin) {
		return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
	}

	const target = await prisma.user.findUnique({ where: { id: params.id } });
	if (!target) return NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 404 });

	const body = (await request.json().catch(() => ({}))) as PatchBody;
	const data: { status?: string; role?: string; memo?: string; planId?: string } = {};
	const actions: string[] = [];

	if (body.status === 'active' || body.status === 'suspended' || body.status === 'withdrawn') {
		data.status = body.status;
		actions.push(`상태 ${target.status} → ${body.status}`);
	}
	if (body.role === 'admin' || body.role === 'user') {
		if (target.id === admin.id && body.role !== 'admin') {
			return NextResponse.json({ error: '본인 관리자 권한은 해제할 수 없습니다.' }, { status: 400 });
		}
		data.role = body.role;
		actions.push(`권한 ${target.role} → ${body.role}`);
	}
	if (typeof body.memo === 'string') {
		data.memo = body.memo.slice(0, 2000);
		actions.push('운영 메모 수정');
	}
	if (typeof body.planId === 'string' && body.planId.trim()) {
		data.planId = body.planId.trim();
		actions.push(`플랜 ${target.planId} → ${body.planId}`);
	}

	if (Object.keys(data).length === 0) {
		return NextResponse.json({ error: '변경할 필드가 없습니다.' }, { status: 400 });
	}

	await prisma.user.update({ where: { id: target.id }, data });
	await writeAdminAuditLog({
		admin,
		module: 'USER_MGMT',
		actionDetail: `회원 변경 — ${target.email || target.id} (${actions.join(', ')})`,
	});

	const member = await findAdminMember(target.id);
	return NextResponse.json(member);
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
	const admin = await requireAdmin();
	if (!admin) {
		return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
	}
	if (params.id === admin.id) {
		return NextResponse.json({ error: '본인 계정은 삭제할 수 없습니다.' }, { status: 400 });
	}

	const target = await prisma.user.findUnique({ where: { id: params.id }, select: { id: true, email: true } });
	if (!target) return NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 404 });

	await prisma.user.delete({ where: { id: target.id } });
	await writeAdminAuditLog({
		admin,
		module: 'USER_MGMT',
		actionDetail: `회원 삭제 — ${target.email || target.id}`,
	});
	return NextResponse.json({ id: target.id });
}
