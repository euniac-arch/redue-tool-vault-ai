import { NextResponse } from 'next/server';
import { inquiryTypeLabel } from '@/lib/admin/inquiry-management';
import { contactLeadNoStoreHeaders, listContactLeadsForUser } from '@/lib/server/contact-leads';
import { toUserInquiryStatus } from '@/lib/mypage/work-inquiries';
import { resolveSignedInUser } from '@/lib/resolve-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** GET /api/user/inquiries — signed-in member's own work inquiries. */
export async function GET() {
	const signedIn = await resolveSignedInUser();
	const userId = signedIn?.id?.trim() || '';
	const email = signedIn?.email?.trim() || '';
	if (!signedIn || (!userId && !email)) {
		return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
	}

	let leads;
	try {
		leads = await listContactLeadsForUser(userId, email);
	} catch (error) {
		console.error('[user/inquiries] list failed', { userId, email, error });
		if (signedIn.isAdmin) {
			return NextResponse.json({ inquiries: [] }, { headers: contactLeadNoStoreHeaders() });
		}
		return NextResponse.json(
			{ error: '문의 내역을 불러오지 못했습니다.' },
			{ status: 500, headers: contactLeadNoStoreHeaders() },
		);
	}

	const inquiries = leads.map((lead) => {
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

	return NextResponse.json({ inquiries }, { headers: contactLeadNoStoreHeaders() });
}
