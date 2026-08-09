import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { authOptions } from '@/lib/auth';
import { loadAgentState } from '@/lib/agent-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
	const session = await getServerSession(authOptions);
	if (!session?.user?.id) {
		return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
	}

	const admin = await requireAdmin();
	const state = loadAgentState();

	if (admin) {
		return NextResponse.json({
			role: 'admin',
			stats: state.stats,
			sites: state.sites,
			timeline: state.timeline.slice(0, 80),
			adminAlerts: state.adminAlerts.slice(0, 20),
		});
	}

	const userSites = state.sites.filter((s) => s.userId === session.user.id);
	const timeline = state.timeline.filter(
		(e) => !e.siteId || userSites.some((s) => s.id === e.siteId) || e.siteId === null
	);

	return NextResponse.json({
		role: 'user',
		stats: {
			...state.stats,
			sitesMonitored: userSites.length || state.stats.sitesMonitored,
		},
		sites: userSites.length > 0 ? userSites : state.sites.slice(0, 2),
		timeline: timeline.slice(0, 40),
		adminAlerts: [],
	});
}
