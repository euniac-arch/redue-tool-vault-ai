import fs from 'node:fs';
import { generateFunctionsBlock, generateHeaderBlock, MARKER_END, MARKER_START } from './code-generator';
import type { InjectionAnchor } from './types';

export interface InjectionResult {
	before: string;
	after: string;
	changed: boolean;
	wrote: boolean;
	mode: 'insert' | 'replace' | 'noop';
	error: string | null;
}

const WRAPPED_BLOCK_RE = new RegExp(
	`[ \\t]*<\\?php\\s*\\/\\*\\s*${MARKER_START}[\\s\\S]*?${MARKER_END}\\s*\\*\\/\\s*\\?>`,
	'm'
);

const BARE_BLOCK_RE = new RegExp(`\\/\\*\\s*${MARKER_START}[\\s\\S]*?${MARKER_END}\\s*\\*\\/`, 'm');

const HEAD_OPEN_RE = /<head(\s[^>]*)?>/i;
const WP_HEAD_CALL_RE = /<\?php\s+wp_head\(\s*\);\s*\?>/i;

interface InjectOptions {
	dryRun: boolean;
}

/**
 * Insert or (idempotently) replace the REDUE AI Studio master schema block
 * inside the target file at the given anchor.
 */
export function injectMasterBlock(
	filePath: string,
	anchor: InjectionAnchor,
	{ dryRun }: InjectOptions
): InjectionResult {
	let before: string;
	try {
		before = fs.readFileSync(filePath, 'utf8');
	} catch (err) {
		return {
			before: '',
			after: '',
			changed: false,
			wrote: false,
			mode: 'noop',
			error: `타겟 파일을 읽을 수 없습니다: ${(err as Error).message}`,
		};
	}

	const block = anchor === 'header-head-open' ? generateHeaderBlock() : generateFunctionsBlock();
	const blockRegex = anchor === 'header-head-open' ? WRAPPED_BLOCK_RE : BARE_BLOCK_RE;

	let after: string;
	let mode: 'insert' | 'replace' | 'noop';

	if (blockRegex.test(before)) {
		// The header anchor's regex intentionally captures the same leading
		// tab that `block` itself starts with, so re-substituting the raw
		// `block` string reproduces byte-identical output (true
		// idempotency). The functions.php anchor's regex captures only the
		// bare `/* ... */` comment (no surrounding blank lines), so the
		// replacement must be trimmed to match.
		const replacement = anchor === 'header-head-open' ? block : block.trim();
		after = before.replace(blockRegex, replacement);
		mode = 'replace';
	} else if (anchor === 'header-head-open') {
		const headMatch = before.match(HEAD_OPEN_RE);
		const wpHeadMatch = before.match(WP_HEAD_CALL_RE);

		if (headMatch && headMatch.index !== undefined) {
			const insertAt = headMatch.index + headMatch[0].length;
			after = `${before.slice(0, insertAt)}\n${block}\n${before.slice(insertAt)}`;
			mode = 'insert';
		} else if (wpHeadMatch && wpHeadMatch.index !== undefined) {
			after = `${before.slice(0, wpHeadMatch.index)}${block}\n\t`.concat(before.slice(wpHeadMatch.index));
			mode = 'insert';
		} else {
			return {
				before,
				after: before,
				changed: false,
				wrote: false,
				mode: 'noop',
				error: 'header.php에서 <head> 태그와 wp_head() 호출을 모두 찾지 못했습니다.',
			};
		}
	} else {
		const needsLeadingNewline = before.length > 0 && !before.endsWith('\n');
		after = `${before}${needsLeadingNewline ? '\n' : ''}${block}`;
		mode = 'insert';
	}

	const changed = after !== before;

	if (changed && !dryRun) {
		fs.writeFileSync(filePath, after, 'utf8');
	}

	return { before, after, changed, wrote: changed && !dryRun, mode, error: null };
}
