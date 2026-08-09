import { NextResponse } from 'next/server';
import { buildWpPluginZip } from '@/lib/wp-plugin-zip';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
	const built = await buildWpPluginZip();
	return new NextResponse(new Uint8Array(built.buffer), {
		status: 200,
		headers: {
			'Content-Type': 'application/zip',
			'Content-Disposition': `attachment; filename="${built.fileName}"`,
			'Content-Length': String(built.bytes),
			'Cache-Control': 'no-store',
		},
	});
}

export async function POST() {
	const built = await buildWpPluginZip();
	return NextResponse.json({
		ok: true,
		fileName: built.fileName,
		bytes: built.bytes,
		path: built.absolutePath,
		downloadUrl: '/api/builder/wp-plugin',
	});
}
