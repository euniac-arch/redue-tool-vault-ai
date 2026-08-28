/**
 * GnuBoard / PHP write-time sanitizer — 3 safety guards before any write.
 *
 * 1) Exception Guard — `catch (Throwable)` without `\` fatals on PHP 5.6~7
 *    namespaced files (`Class 'Throwable' not found`). Dual-catch
 *    `catch (\Exception) {} catch (\Throwable) {}` is mandatory.
 * 2) Encoding Guard — NBSP / `&nbsp;` / UTF-8 `C2 A0` / zero-width / BOM
 *    become ASCII space or are stripped. Files are UTF-8 without BOM.
 * 3) Theme-delegation Guard — never copy the root `/head.sub.php`
 *    `G5_THEME_PATH` include + `return;` stub into `theme/{name}/head.sub.php`.
 */

/** PHP 5.6~8.x dual catch — Exception first so PHP 5.6 never resolves Throwable. */
export function buildPhpDualCatchClause(varName = '$_e'): string {
	const v = String(varName || '$_e').trim() || '$_e';
	return `catch (\\Exception ${v}) {} catch (\\Throwable ${v}) {}`;
}

/**
 * NBSP / invisible-char / BOM cleaner. UTF-8 `C2 A0` is `\u00A0` when the
 * string is already decoded; the two-byte latin1 mojibake `\xC2\xA0` is
 * also folded. HTML `&nbsp;` entities become ASCII space.
 */
export function cleanPhpInvisibleUnicode(code: string): string {
	return String(code || '')
		.replace(/^\uFEFF/, '')
		.replace(/\uFEFF/g, '')
		.replace(/\xC2\xA0/g, ' ')
		.replace(/\u00A0/g, ' ')
		.replace(/&nbsp;|&#160;|&#x0*A0;/gi, ' ')
		.replace(/[\u200B-\u200F\u202A-\u202E\u2060\u2066-\u2069\u180E]/g, '')
		.replace(/\r\n/g, '\n')
		.replace(/\r/g, '\n');
}

/** Drop a leading UTF-8 BOM so writers persist "UTF-8 without BOM". */
export function toUtf8WithoutBom(code: string): string {
	let s = String(code || '');
	if (s.charCodeAt(0) === 0xfeff) s = s.slice(1);
	if (s.charCodeAt(0) === 0xef && s.charCodeAt(1) === 0xbb && s.charCodeAt(2) === 0xbf) {
		s = s.slice(3);
	}
	return s;
}

/**
 * Mandatory last-mile cleaner — run immediately before any PHP write/deploy.
 * Encoding clean → Exception dual-catch → UTF-8 without BOM.
 */
export function sanitizePhpCode(code: string): string {
	return toUtf8WithoutBom(
		normalizePhpExceptionGuards(normalizeLlmsExtendBootHook(cleanPhpInvisibleUnicode(code))),
	);
}

/** @deprecated Use `sanitizePhpCode` — same pipeline. */
export const cleanPhpTemplate = sanitizePhpCode;

export function isGnuboardThemeRelativePath(relativePath?: string | null): boolean {
	const p = String(relativePath || '')
		.replace(/\\/g, '/')
		.replace(/^\/+/, '');
	return /(^|\/)theme\//i.test(p);
}

export function isGnuboardHeadSubPath(relativePath?: string | null): boolean {
	const p = String(relativePath || '')
		.replace(/\\/g, '/')
		.replace(/^\/+/, '');
	return /(^|\/)head\.sub\.php$/i.test(p);
}

function isThemeDelegationStub(block: string): boolean {
	if (!/G5_THEME_PATH/i.test(block)) return false;
	if (!/\breturn\s*;/.test(block)) return false;
	if (!/\b(?:include|require)(?:_once)?\b/i.test(block)) return false;
	return /head\.sub\.php|basename\s*\(\s*__FILE__\s*\)|\$theme_head/i.test(block);
}

function skipPhpStringOrComment(source: string, i: number): number | null {
	const ch = source[i];
	const next = source[i + 1];
	if (ch === '/' && next === '/') {
		const end = source.indexOf('\n', i + 2);
		return end < 0 ? source.length : end + 1;
	}
	if (ch === '/' && next === '*') {
		const end = source.indexOf('*/', i + 2);
		return end < 0 ? source.length : end + 2;
	}
	if (ch === "'" || ch === '"') {
		const quote = ch;
		for (let j = i + 1; j < source.length; j++) {
			if (source[j] === '\\') {
				j += 1;
				continue;
			}
			if (source[j] === quote) return j + 1;
		}
		return source.length;
	}
	return null;
}

function readBalanced(source: string, openIndex: number, openCh: string, closeCh: string): number {
	let depth = 0;
	for (let i = openIndex; i < source.length; i++) {
		const skipped = skipPhpStringOrComment(source, i);
		if (skipped != null) {
			i = skipped - 1;
			continue;
		}
		if (source[i] === openCh) depth += 1;
		else if (source[i] === closeCh) {
			depth -= 1;
			if (depth === 0) return i + 1;
		}
	}
	return -1;
}

function readIfBlock(source: string, ifIndex: number): { start: number; end: number } | null {
	const condOpen = source.indexOf('(', ifIndex);
	if (condOpen < 0 || condOpen - ifIndex > 8) return null;
	const condEnd = readBalanced(source, condOpen, '(', ')');
	if (condEnd < 0) return null;
	let i = condEnd;
	while (i < source.length && /\s/.test(source[i])) i += 1;
	if (source[i] === '{') {
		const end = readBalanced(source, i, '{', '}');
		if (end < 0) return null;
		return { start: ifIndex, end };
	}
	// One-liner: `if (...) require_once(...); return;`
	const semi = source.indexOf(';', i);
	if (semi < 0) return null;
	let end = semi + 1;
	const after = source.slice(end, end + 48);
	const ret = after.match(/^\s*return\s*;/);
	if (ret) end += ret[0].length;
	return { start: ifIndex, end };
}

function findOutermostDelegationIf(
	source: string,
	hintIndex: number,
): { start: number; end: number } | null {
	const before = source.slice(0, hintIndex);
	const matches = [...before.matchAll(/\bif\s*\(/gi)];
	for (const m of matches) {
		if (m.index == null) continue;
		const block = readIfBlock(source, m.index);
		if (!block || block.end <= hintIndex) continue;
		const text = source.slice(block.start, block.end);
		if (isThemeDelegationStub(text)) return block;
	}
	return null;
}

/**
 * Remove root-only `G5_THEME_PATH` include + `return;` stubs.
 * Safe to run on snippets (engine must never ship this) and on theme sources.
 * Do NOT run on a live root `/head.sub.php` — that stub is the official dispatcher.
 */
export function stripGnuboardThemeSelfDelegation(source: string): string {
	let out = String(source || '');
	for (let guard = 0; guard < 8; guard++) {
		const hint = out.search(/G5_THEME_PATH/i);
		if (hint < 0) break;
		const block = findOutermostDelegationIf(out, hint);
		if (!block) break;
		out = `${out.slice(0, block.start)}${out.slice(block.end)}`;
	}
	return out.replace(/\n{3,}/g, '\n\n');
}

function splitPhpCallArgs(argsSrc: string): string[] {
	const args: string[] = [];
	let cur = '';
	let depth = 0;
	let quote: string | null = null;
	for (let i = 0; i < argsSrc.length; i++) {
		const ch = argsSrc[i];
		if (quote) {
			cur += ch;
			if (ch === '\\') {
				cur += argsSrc[i + 1] ?? '';
				i += 1;
				continue;
			}
			if (ch === quote) quote = null;
			continue;
		}
		if (ch === "'" || ch === '"') {
			quote = ch;
			cur += ch;
			continue;
		}
		if (ch === '(' || ch === '[' || ch === '{') {
			depth += 1;
			cur += ch;
			continue;
		}
		if (ch === ')' || ch === ']' || ch === '}') {
			depth -= 1;
			cur += ch;
			continue;
		}
		if (ch === ',' && depth === 0) {
			args.push(cur.trim());
			cur = '';
			continue;
		}
		cur += ch;
	}
	if (cur.trim()) args.push(cur.trim());
	return args;
}

function isRunReplaceAlreadyGuarded(source: string, callIndex: number): boolean {
	const before = source.slice(Math.max(0, callIndex - 160), callIndex);
	if (/function_exists\s*\(\s*['"]run_replace['"]\s*\)\s*\??\s*$/i.test(before)) return true;
	if (/function_exists\s*\(\s*['"]run_replace['"][\s\S]{0,80}$/i.test(before)) return true;
	if (/\bfunction\s+$/i.test(before)) return true;
	return false;
}

function isInsidePhpStringOrComment(source: string, index: number): boolean {
	let i = 0;
	while (i < index) {
		const skipped = skipPhpStringOrComment(source, i);
		if (skipped != null) {
			if (index < skipped) return true;
			i = skipped;
			continue;
		}
		i += 1;
	}
	return false;
}

function escapeRegExp(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Force every PHP `catch (Throwable|Exception $var)` onto the dual global-namespace
 * form. Bare `Throwable` in a namespaced file (or on PHP 5.6) fatals with
 * `Class 'Throwable' not found`. Already-correct dual catches are left alone.
 */
export function normalizePhpExceptionGuards(source: string): string {
	const src = String(source || '');
	const re = /catch\s*\(\s*(\\)?(Throwable|Exception)\s*(\$[A-Za-z_][A-Za-z0-9_]*)\s*\)/gi;
	let out = '';
	let last = 0;
	let match: RegExpExecArray | null;
	while ((match = re.exec(src)) !== null) {
		const idx = match.index;
		if (isInsidePhpStringOrComment(src, idx)) continue;
		const slash = match[1] || '';
		const type = match[2];
		const varName = match[3];
		if (/^Exception$/i.test(type)) {
			if (slash === '\\') continue;
			out += src.slice(last, idx);
			out += `catch (\\Exception ${varName})`;
			last = idx + match[0].length;
			re.lastIndex = last;
			continue;
		}
		const before = src.slice(0, idx);
		const dualPrefix = new RegExp(
			`catch\\s*\\(\\s*\\\\Exception\\s+${escapeRegExp(varName)}\\s*\\)\\s*\\{\\s*\\}\\s*$`,
		);
		if (dualPrefix.test(before)) {
			if (slash === '\\') continue;
			out += src.slice(last, idx);
			out += `catch (\\Throwable ${varName})`;
			last = idx + match[0].length;
			re.lastIndex = last;
			continue;
		}
		out += src.slice(last, idx);
		out += `catch (\\Exception ${varName}) {} catch (\\Throwable ${varName})`;
		last = idx + match[0].length;
		re.lastIndex = last;
	}
	return out + src.slice(last);
}

function isLlmsServeAlreadyGated(source: string, callIndex: number): boolean {
	const before = source.slice(Math.max(0, callIndex - 480), callIndex);
	return /redue_llms/.test(before) && /llms\(-full\)\?/.test(before);
}

/**
 * GnuBoard `extend/*.php` is auto-included from `common.php` before headers/DB
 * are stable. Never invoke `redue_llms_maybe_serve()` (it `header()` + `exit`)
 * unless `?redue_llms=` or `/llms.txt` is the actual request.
 */
export function normalizeLlmsExtendBootHook(source: string): string {
	let out = String(source || '');
	out = out.replace(
		/function\s+redue_llms_boot\s*\(\s*\)\s*\{\s*if\s*\(\s*function_exists\s*\(\s*['"]redue_llms_maybe_serve['"]\s*\)\s*\)\s*\{\s*redue_llms_maybe_serve\s*\(\s*\)\s*;\s*\}\s*\}/g,
		`function redue_llms_boot() {
		if ( defined('G5_IS_ADMIN') && G5_IS_ADMIN ) { return; }
		if ( isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] === 'POST' ) { return; }
		if ( empty($_GET['redue_llms']) && !(isset($_SERVER['REQUEST_URI']) && preg_match('#/llms(-full)?\\.txt#i', $_SERVER['REQUEST_URI'])) ) { return; }
		if ( function_exists('redue_llms_maybe_serve') ) { redue_llms_maybe_serve(); }
	}`,
	);
	const unguarded =
		/try\s*\{\s*if\s*\(\s*function_exists\s*\(\s*['"]redue_llms_maybe_serve['"]\s*\)\s*\)\s*\{\s*redue_llms_maybe_serve\s*\(\s*\)\s*;\s*\}\s*\}\s*catch\s*\([^)]*\)\s*\{\s*\}(?:\s*catch\s*\([^)]*\)\s*\{\s*\})?/g;
	let rebuilt = '';
	let last = 0;
	let match: RegExpExecArray | null;
	unguarded.lastIndex = 0;
	while ((match = unguarded.exec(out)) !== null) {
		if (isLlmsServeAlreadyGated(out, match.index)) continue;
		rebuilt += out.slice(last, match.index);
		rebuilt += `if (defined('G5_IS_ADMIN') && G5_IS_ADMIN) return;
if (isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] === 'POST') return;
if (!empty($_GET['redue_llms']) || (isset($_SERVER['REQUEST_URI']) && preg_match('#/llms(-full)?\\.txt#i', $_SERVER['REQUEST_URI']))) {
	try {
		if (function_exists('redue_llms_maybe_serve')) {
			redue_llms_maybe_serve();
		}
	} catch (\\Exception $_redue_extend_boot) {} catch (\\Throwable $_redue_extend_boot) {}
}`;
		last = match.index + match[0].length;
		unguarded.lastIndex = last;
	}
	if (last > 0) out = rebuilt + out.slice(last);
	return out;
}

/**
 * Wrap bare `run_replace(...)` so old GnuBoard (pre-hook API) never fatals
 * with `Call to undefined function run_replace()`.
 * Already-guarded calls and `function run_replace` definitions are left alone.
 * Fallback is the 2nd argument (filter identity) or `null`.
 */
export function guardRunReplaceCalls(source: string): string {
	const src = String(source || '');
	if (!/\brun_replace\s*\(/i.test(src)) return src;
	const re = /\brun_replace\s*\(/gi;
	let out = '';
	let last = 0;
	let match: RegExpExecArray | null;
	while ((match = re.exec(src)) !== null) {
		const idx = match.index;
		if (isInsidePhpStringOrComment(src, idx) || isRunReplaceAlreadyGuarded(src, idx)) {
			continue;
		}
		const open = src.indexOf('(', idx);
		const close = readBalanced(src, open, '(', ')');
		if (close < 0) continue;
		const call = src.slice(idx, close);
		const args = splitPhpCallArgs(src.slice(open + 1, close - 1));
		const fallback = args[1] && args[1].length > 0 ? args[1] : 'null';
		out += src.slice(last, idx);
		out += `(function_exists('run_replace') ? ${call} : ${fallback})`;
		last = close;
		re.lastIndex = close;
	}
	return out + src.slice(last);
}

/**
 * Phase-1 polyfill: define no-op `run_replace` / `run_event` when the board
 * is older than the hook API so original theme calls after this block stay safe.
 */
export function buildGnuboardLegacyCompatPhp(): string {
	return `if ( ! function_exists( 'run_replace' ) ) {
	function run_replace( $tag, $data = null ) {
		return func_num_args() > 1 ? $data : null;
	}
}
if ( ! function_exists( 'run_event' ) ) {
	function run_event( $tag ) {
		return null;
	}
}
`;
}

/** Generated-snippet pipeline: encoding + Exception dual-catch + llms boot + `run_replace`. */
export function sanitizeGeneratedPhpSnippet(code: string): string {
	return sanitizePhpCode(guardRunReplaceCalls(code));
}

/**
 * Remove leftover `function redue_*` bodies from a header file after marker strip
 * (broken/unclosed REDUE blocks that would otherwise stay and 500 the site).
 */
export function stripOrphanedReduePhpFunctions(source: string): string {
	let out = String(source || '');
	out = out.replace(/^[ \t]*(?:echo\s+)?redue_render_full_schema\s*\(\s*\)\s*;[ \t]*\r?\n?/gm, '');
	out = out.replace(/^[ \t]*redue_dynamic_schema_controller(?:_safe)?\s*\(\s*\)\s*;[ \t]*\r?\n?/gm, '');
	const needle = /function\s+redue_[A-Za-z0-9_]+/g;
	let match: RegExpExecArray | null;
	const ranges: Array<{ start: number; end: number }> = [];
	while ((match = needle.exec(out)) !== null) {
		const fnIdx = match.index;
		let start = fnIdx;
		const lookbehind = out.slice(Math.max(0, fnIdx - 220), fnIdx);
		const ifMatch = lookbehind.match(/if\s*\(\s*!\s*function_exists\s*\(\s*['"]redue_[^'"]+['"]\s*\)\s*\)\s*\{?\s*$/);
		if (ifMatch && ifMatch.index != null) {
			start = fnIdx - lookbehind.length + ifMatch.index;
		}
		const brace = out.indexOf('{', fnIdx);
		if (brace < 0) continue;
		const end = readBalanced(out, brace, '{', '}');
		if (end < 0) continue;
		let extra = end;
		const after = out.slice(end, end + 8);
		if (/^\s*\}/.test(after)) extra = end + after.match(/^\s*\}/)![0].length;
		ranges.push({ start, end: extra });
	}
	for (let i = ranges.length - 1; i >= 0; i--) {
		out = `${out.slice(0, ranges[i].start)}${out.slice(ranges[i].end)}`;
	}
	return out.replace(/\n{3,}/g, '\n\n');
}

/** Remove a previously injected charset-after render call (wrong root vs theme file). */
export function stripRedueHeadRenderCall(source: string): string {
	return String(source || '')
		.replace(/<\?php\s*\/\*\s*REDUE_AI_STUDIO_RENDER:START[\s\S]*?REDUE_AI_STUDIO_RENDER:END\s*\*\/\s*\?>\s*/gi, '')
		.replace(/\/\*\s*REDUE_AI_STUDIO_RENDER:START[\s\S]*?REDUE_AI_STUDIO_RENDER:END\s*\*\//gi, '');
}

/** Last-mile deploy sanitizer: encoding + Exception + llms boot + theme self-delegation. */
export function sanitizePhpForDeploy(source: string, targetPath?: string | null): string {
	let out = sanitizePhpCode(source);
	if (isGnuboardThemeRelativePath(targetPath)) {
		out = stripGnuboardThemeSelfDelegation(out);
	}
	return toUtf8WithoutBom(out);
}

/**
 * Heal a previously-broken theme `head.sub.php`:
 * strip NBSP / zero-width chars and any copied root `return;` dispatcher.
 * Original CSS/JS/config is left untouched.
 *
 * Pass a non-theme path (e.g. `head.sub.php`) to keep the official root dispatcher.
 * Unknown / theme paths always strip the self-include stub.
 */
export function healGnuboardHeadSubSource(source: string, targetPath?: string | null): string {
	let out = cleanPhpTemplate(source);
	if (!targetPath || isGnuboardThemeRelativePath(targetPath)) {
		out = stripGnuboardThemeSelfDelegation(out);
	}
	return out;
}
