import { NextResponse } from 'next/server';
import { runAutonomousCron } from '@/lib/agent-healer';
import { requireAdmin } from '@/lib/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Weekly Autonomous Self-Healing cron.
 * Auth: `Authorization: Bearer ${AGENT_CRON_SECRET}` or admin session.
 * Invoke via: `npm run agent:cron` or an external scheduler (e.g. weekly).
 */
export async function POST(request: Request) {
	const secret = process.env.AGENT_CRON_SECRET?.trim();
	const authHeader = request.headers.get('authorization') ?? '';
	const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
	const admin = await requireAdmin();

	const authorized = (secret && bearer && bearer === secret) || Boolean(admin);
	if (!authorized) {
		return NextResponse.json(
			{ error: 'Unauthorized. Provide AGENT_CRON_SECRET bearer token or admin session.' },
			{ status: 401 }
		);
	}

	const result = await runAutonomousCron();
	return NextResponse.json(result);
}

export async function GET(request: Request) {
	// Allow GET for simple cron pingers that only support GET.
	return POST(request);
}
