import { NextResponse } from 'next/server';
import { getKnowledgeGraphReport } from '@/lib/knowledge-graph';

export const runtime = 'nodejs';

export async function GET(request: Request) {
	const { searchParams } = new URL(request.url);
	const domain = searchParams.get('domain');
	const report = getKnowledgeGraphReport(domain);
	return NextResponse.json(report);
}
