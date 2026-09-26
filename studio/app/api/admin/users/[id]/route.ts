import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { writeAdminAuditLog } from '@/lib/admin/admin-audit-log';
import { findAdminMember } from '@/lib/admin/user-query';
import { isFirebaseAdminConfigured } from '@/lib/firebase/admin';
import { prisma } from '@/lib/prisma';
import { deleteDurableUser, findDurableUserById, updateDurableUser } from '@/lib/server/app-users';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' };

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
	if (!member) return NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 404, headers: NO_STORE });
	return NextResponse.json(member, { headers: NO_STORE });
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
	const admin = await requireAdmin();
	if (!admin) {
		return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
	}

	const target = await prisma.user.findUnique({ where: { id: params.id } }).catch((error) => {
		console.error('[admin/users] prisma lookup failed', { id: params.id, error });
		return null;
	});
	const durable = target || !isFirebaseAdminConfigured() ? null : await findDurableUserById(params.id);
	if (!target && !durable) return NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 404, headers: NO_STORE });

	const current = {
		id: target?.id || durable!.id,
		email: target?.email || durable!.email,
		status: target?.status || durable!.status,
		role: target?.role || durable!.role,
		planId: target?.planId || durable!.planId,
	};

	const body = (await request.json().catch(() => ({}))) as PatchBody;
	const data: { status?: string; role?: string; memo?: string; planId?: string } = {};
	const actions: string[] = [];

	if (body.status === 'active' || body.status === 'suspended' || body.status === 'withdrawn') {
		data.status = body.status;
		actions.push(`상태 ${current.status} → ${body.status}`);
	}
	if (body.role === 'admin' || body.role === 'user') {
		if (current.id === admin.id && body.role !== 'admin') {
			return NextResponse.json({ error: '본인 관리자 권한은 해제할 수 없습니다.' }, { status: 400, headers: NO_STORE });
		}
		data.role = body.role;
		actions.push(`권한 ${current.role} → ${body.role}`);
	}
	if (typeof body.memo === 'string') {
		data.memo = body.memo.slice(0, 2000);
		actions.push('운영 메모 수정');
	}
	if (typeof body.planId === 'string' && body.planId.trim()) {
		data.planId = body.planId.trim();
		actions.push(`플랜 ${current.planId} → ${body.planId}`);
	}

	if (Object.keys(data).length === 0) {
		return NextResponse.json({ error: '변경할 필드가 없습니다.' }, { status: 400, headers: NO_STORE });
	}

	if (target) {
		await prisma.user.update({ where: { id: current.id }, data });
	}
	if (isFirebaseAdminConfigured()) {
		await updateDurableUser(current.id, data).catch((error) => {
			console.error('[admin/users] shared profile update failed', { id: current.id, error });
			if (!target) throw error;
		});
	}
	await writeAdminAuditLog({
		admin,
		module: 'USER_MGMT',
		actionDetail: `회원 변경 — ${current.email || current.id} (${actions.join(', ')})`,
	});

	const member = await findAdminMember(current.id);
	return NextResponse.json(member, { headers: NO_STORE });
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
	const admin = await requireAdmin();
	if (!admin) {
		return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
	}
	if (params.id === admin.id) {
		return NextResponse.json({ error: '본인 계정은 삭제할 수 없습니다.' }, { status: 400 });
	}

	const target = await prisma.user.findUnique({ where: { id: params.id }, select: { id: true, email: true } }).catch((error) => {
		console.error('[admin/users] prisma delete lookup failed', { id: params.id, error });
		return null;
	});
	const durable = target || !isFirebaseAdminConfigured() ? null : await findDurableUserById(params.id);
	if (!target && !durable) return NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 404, headers: NO_STORE });
	const email = target?.email || durable?.email || params.id;

	if (target) {
		await prisma.user.delete({ where: { id: target.id } });
	}
	if (isFirebaseAdminConfigured()) {
		await deleteDurableUser(params.id);
	}
	await writeAdminAuditLog({
		admin,
		module: 'USER_MGMT',
		actionDetail: `회원 삭제 — ${email}`,
	});
	return NextResponse.json({ id: params.id }, { headers: NO_STORE });
}
