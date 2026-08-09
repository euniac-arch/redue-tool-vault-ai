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

interface ScanRequestBody {
	targetPath?: string;
	themeOverride?: string;
}

/**
 * Read-only diagnostic scan: detects the CMS, selects the injection
 * target, computes the pre-injection score, and renders a dry-run preview
 * of what the master schema injection would change (without writing
 * anything to disk).
 */
export async function POST(request: Request) {
	const body = (await request.json().catch(() => ({}))) as ScanRequestBody;
	const targetPathInput = body.targetPath?.trim() || '';
	const themeOverrideInput = body.themeOverride?.trim() || null;
	const rootPath = targetPathInput || defaultRootPath();

	if (!fs.existsSync(rootPath)) {
		return NextResponse.json({ error: `경로를 찾을 수 없습니다: ${rootPath}` }, { status: 400 });
	}

	const cms = await detectCms(rootPath, themeOverrideInput);
	const target = selectTarget(cms);

	let diff: ScanBundle['diff'] = null;
	let fileRelativePath: string | null = null;
	let currentContent: string | null = null;

	if (target.found && target.filePath && target.anchor) {
		fileRelativePath = path.relative(rootPath, target.filePath);
		const preview = injectMasterBlock(target.filePath, target.anchor, { dryRun: true });
		currentContent = preview.before;
		if (!preview.error && preview.changed) {
			diff = buildDiffModel(preview.before, preview.after);
		}
	}

	const diagnostics = computeDiagnostics(cms, target, currentContent);

	const bundle: ScanBundle = {
		kind: 'preview',
		timestamp: new Date().toISOString(),
		targetPathInput: rootPath,
		themeOverrideInput,
		cms,
		target,
		diagnostics,
		diff,
		fileRelativePath,
		injected: false,
	};

	saveResultBundle(bundle);

	return NextResponse.json(bundle);
}
