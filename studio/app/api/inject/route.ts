import fs from 'node:fs';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { detectCms } from '@/lib/cms-detector';
import { defaultRootPath } from '@/lib/default-target';
import { buildDiffModel } from '@/lib/diff';
import { injectMasterBlock } from '@/lib/injector';
import { computeDiagnostics } from '@/lib/scoring';
import { saveResultBundle } from '@/lib/results-store';
import { selectTarget } from '@/lib/target-selector';
import type { ScanBundle } from '@/lib/types';

export const runtime = 'nodejs';

interface InjectRequestBody {
	targetPath?: string;
	themeOverride?: string;
	confirm?: boolean;
}

/**
 * Real, file-writing injection: re-runs detection + target selection, then
 * actually writes the master schema block into the target file, re-scans
 * the result, and persists the "applied" bundle consumed by /patch/result.
 */
export async function POST(request: Request) {
	const body = (await request.json().catch(() => ({}))) as InjectRequestBody;

	if (body.confirm !== true) {
		return NextResponse.json({ error: '주입을 적용하려면 confirm=true 값이 필요합니다.' }, { status: 400 });
	}

	const targetPathInput = body.targetPath?.trim() || '';
	const themeOverrideInput = body.themeOverride?.trim() || null;
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
	};

	saveResultBundle(bundle);

	return NextResponse.json(bundle);
}
