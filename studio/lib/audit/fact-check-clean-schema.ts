/**
 * Best-effort "clean JSON-LD" builder for the AI fact-check issue report.
 *
 * The LLM reports a free-form `field` path per issue (e.g. `"knowsAbout"`,
 * `"author / representative"`) rather than a strict JSON Pointer, so removal
 * is heuristic: try the raw string as a key, then each `/`-or-`.`-separated
 * token, at the top level of every node (and inside `@graph`). This is meant
 * as a quick "here's a candidate to review", not a guaranteed-safe patch —
 * callers should always let the user re-check the result before publishing.
 *
 * Pure JSON manipulation only (no Node/browser APIs) so it is safe to import
 * from both server routes and client components.
 */
import type { FactCheckIssue } from '@/lib/audit/fact-check';

function candidateKeysForField(field: string): string[] {
	const trimmed = field.trim();
	if (!trimmed) return [];
	const tokens = trimmed
		.split(/[\/.,·|]+/)
		.map((token) => token.trim())
		.filter(Boolean);
	return Array.from(new Set([trimmed, ...tokens]));
}

function removeKeysFromNode(node: unknown, keys: readonly string[]): boolean {
	if (!node || typeof node !== 'object' || Array.isArray(node)) return false;
	const record = node as Record<string, unknown>;
	let removed = false;
	for (const key of keys) {
		if (key in record) {
			delete record[key];
			removed = true;
		}
	}
	const graph = record['@graph'];
	if (Array.isArray(graph)) {
		for (const child of graph) {
			if (removeKeysFromNode(child, keys)) removed = true;
		}
	}
	return removed;
}

/**
 * Deep-clones `schemaBlocks` and strips every field flagged by `issues`.
 * Returns the cleaned blocks plus the list of field paths that were actually
 * found and removed (so the UI can be honest about what changed).
 */
export function buildCleanSchemaBlocks(
	schemaBlocks: readonly unknown[],
	issues: readonly FactCheckIssue[],
): { cleaned: unknown[]; removedFields: string[] } {
	const cleaned = JSON.parse(JSON.stringify(schemaBlocks ?? [])) as unknown[];
	const removedFields: string[] = [];

	for (const issue of issues) {
		const keys = candidateKeysForField(issue.field);
		if (!keys.length) continue;
		let removedAny = false;
		for (const block of cleaned) {
			if (removeKeysFromNode(block, keys)) removedAny = true;
		}
		if (removedAny) removedFields.push(issue.field);
	}

	return { cleaned, removedFields };
}

/** Pretty-printed `<script type="application/ld+json">` block ready to paste back into the page. */
export function formatCleanSchemaAsScriptTag(cleaned: readonly unknown[]): string {
	const body = cleaned.length === 1 ? cleaned[0] : cleaned;
	return `<script type="application/ld+json">\n${JSON.stringify(body, null, 2)}\n</script>`;
}
