import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { inquiryTypeLabel } from '@/lib/admin/inquiry-management';
import { authOptions } from '@/lib/auth';
import { listContactLeadsForUser } from '@/lib/server/contact-leads';
import { toUserInquiryStatus } from '@/lib/mypage/work-inquiries';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/user/inquiries — signed-in member's own work inquiries. */
export async function GET() {
	const session = await getServerSession(authOptions).catch(() => null);
	const userId = session?.user?.id?.trim() || '';
	const email = session?.user?.email?.trim() || '';
	if (!userId && !email) {
		return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
	}

	const inquiries = listContactLeadsForUser(userId, email).map((lead) => {
		const status = toUserInquiryStatus(lead.status);
		return {
			id: lead.id,
			userId: lead.userId,
			email: lead.email,
			createdAt: lead.createdAt,
			pageUrl: lead.pageUrl,
			inquiryType: lead.inquiryType,
			inquiryTypeLabel: inquiryTypeLabel(lead.inquiryType, lead.serviceType),
			serviceType: lead.serviceType,
			status,
			title: lead.title,
			message: lead.message,
			adminReply: lead.adminReply,
			repliedAt: lead.repliedAt,
			phone: lead.phone,
			company: lead.company,
			name: lead.name,
		};
	});

	return NextResponse.json({ inquiries });
}
