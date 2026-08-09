import fs from 'node:fs';
import path from 'node:path';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { createBackupZip } from '@/lib/backup';
import { detectCms } from '@/lib/cms-detector';
import { defaultRootPath } from '@/lib/default-target';
import { buildDiffModel } from '@/lib/diff';
import { dispatchIndexingPings } from '@/lib/indexing-dispatch';
import { injectMasterBlock } from '@/lib/injector';
import { simulatePatchRunUsage } from '@/lib/llm-pricing';
import { prisma } from '@/lib/prisma';
import { computeDiagnostics } from '@/lib/scoring';
import { saveResultBundle } from '@/lib/results-store';
import { selectTarget } from '@/lib/target-selector';
import type { ScanBundle } from '@/lib/types';

export const runtime = 'nodejs';

interface PatchRunBody {
	targetPath?: string;
	themeOverride?: string;
	siteUrl?: string;
}

/**
 * POST /api/patch/run — the customer-facing, credit-gated version of
 * `/api/inject`. Requires a signed-in session with `creditsRemaining > 0`,
 * backs up the original file, performs the real injection, then debits one
 * credit and records an `InjectionHistory` row for /mypage.
 */
export async function POST(request: Request) {
	const session = await getServerSession(authOptions);
	if (!session?.user?.id) {
		return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
	}

	const user = await prisma.user.findUnique({ where: { id: session.user.id } });
	if (!user) {
		return NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 401 });
	}
	if (user.creditsRemaining <= 0) {
		return NextResponse.json(
			{ error: 'INSUFFICIENT_CREDITS', message: '잔여 크레딧이 부족합니다. 요금제를 업그레이드하거나 크레딧을 충전해 주세요.' },
			{ status: 402 }
		);
	}

	const startedAt = Date.now();

	const body = (await request.json().catch(() => ({}))) as PatchRunBody;
	const targetPathInput = body.targetPath?.trim() || '';
	const themeOverrideInput = body.themeOverride?.trim() || null;
	const siteUrl = body.siteUrl?.trim() || null;
	const rootPath = targetPathInput || defaultRootPath();

	if (!fs.existsSync(rootPath)) {
		return NextResponse.json({ error: `경로를 찾을 수 없습니다: ${rootPath}` }, { status: 400 });
	}

	const cms = await detectCms(rootPath, themeOverrideInput);
	const target = selectTarget(cms);

	if (!target.found || !target.filePath || !target.anchor) {
		return NextResponse.json({ error: target.reason }, { status: 422 });
	}

	const result = injectMasterBlock(target.filePath, target.anchor, { dryRun: false });
	if (result.error) {
		return NextResponse.json({ error: result.error }, { status: 500 });
	}

	const diff = buildDiffModel(result.before, result.after);
	const diagnostics = computeDiagnostics(cms, target, result.after);
	const fileRelativePath = path.relative(rootPath, target.filePath);
	const injected = diagnostics.checks.find((check) => check.id === 'master-block-present')?.passed ?? false;

	const backupZipPath = await createBackupZip(user.id, target.filePath, result.before);

	// Best-effort search-engine ping runs before we finalize `durationMs` so the
	// admin log's "소요 시간" reflects the full injection+indexing pipeline.
	const indexing = injected ? await dispatchIndexingPings(siteUrl, rootPath) : { attempted: false, siteUrl: null, indexNow: null, google: null };

	const diffText = diff.map((line) => `${line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' '}${line.content}`).join('\n');
	const injectedBlockText = diff
		.filter((line) => line.type === 'add')
		.map((line) => line.content)
		.join('\n');
	const usageEntries = simulatePatchRunUsage(result.before, injectedBlockText, diffText);

	const durationMs = Date.now() - startedAt;

	const [, , historyRecord] = await prisma.$transaction([
		prisma.user.update({ where: { id: user.id }, data: { creditsRemaining: { decrement: 1 } } }),
		prisma.creditTransaction.create({ data: { userId: user.id, delta: -1, reason: 'patch_run' } }),
		prisma.injectionHistory.create({
			data: {
				userId: user.id,
				targetDomain: cms.activeTheme ? `${rootPath} (${cms.activeTheme})` : rootPath,
				siteUrl,
				cmsType: cms.cmsType,
				durationMs,
				score: diagnostics.score,
				maxScore: diagnostics.maxScore,
				statusLabel: diagnostics.statusLabel,
				diagnosticsJson: JSON.stringify(diagnostics),
				backupZipPath,
			},
		}),
	]);

	await prisma.apiUsageLog.createMany({
		data: usageEntries.map((entry) => ({
			userId: user.id,
			injectionHistoryId: historyRecord.id,
			model: entry.model,
			inputTokens: entry.inputTokens,
			outputTokens: entry.outputTokens,
			costUsd: entry.costUsd,
		})),
	});

	if (indexing.attempted) {
		await prisma.indexingLog.createMany({
			data: [
				indexing.indexNow && {
					injectionHistoryId: historyRecord.id,
					service: 'indexnow',
					targetUrl: indexing.siteUrl!,
					success: indexing.indexNow.success,
					message: indexing.indexNow.message,
				},
				indexing.google && {
					injectionHistoryId: historyRecord.id,
					service: 'google',
					targetUrl: indexing.siteUrl!,
					success: indexing.google.success,
					message: indexing.google.message,
				},
			].filter(Boolean) as { injectionHistoryId: string; service: string; targetUrl: string; success: boolean; message: string }[],
		});
	}

	const bundle: ScanBundle = {
		kind: 'applied',
		timestamp: new Date().toISOString(),
		targetPathInput: rootPath,
		themeOverrideInput,
		cms,
		target,
		diagnostics,
		diff,
		fileRelativePath,
		injected,
		indexing,
	};

	saveResultBundle(bundle);

	return NextResponse.json({
		...bundle,
		creditsRemaining: user.creditsRemaining - 1,
		injectionId: historyRecord.id,
	});
}
