/**
 * schemaAnalyzer.ts — canonical JSON-LD schema analysis entry point.
 *
 * A clinic page that ships a single `<script type="application/ld+json">`
 * `@graph` with `Organization` + `MedicalClinic` + `MedicalWebPage` + `Person`
 * all correctly authored was still being reported as missing:
 *   1. AboutPage / MedicalWebPage not found  (page schema not detected)
 *   2. geo (GeoCoordinates latitude/longitude) missing
 *   3. openingHoursSpecification (weekday/night hours) missing
 *   4. hasOfferCatalog / availableService (service/specialty list) missing
 *
 * The root cause was upstream truncation: some diagnostics re-parsed a
 * 1200-char *display* preview of the JSON-LD instead of the full source,
 * which silently produced invalid JSON once the `@graph` grew past that
 * length (see `ParsedSchema.fullSnippets` in `parser.ts`). This module is
 * the one place every one of those 4 checks should go through — build the
 * entity pool once (flattening every `@graph`, however deep), then run each
 * check against that pool, so no caller can accidentally reintroduce a
 * truncated or single-node view of the graph.
 */

export type JsonLdEntityNode = Record<string, unknown>;

const LD_JSON_SCRIPT_RE =
	/<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

function stripJsonComments(raw: string): string {
	// Some CMS templates wrap JSON-LD in HTML comments or CDATA sections.
	return raw
		.replace(/^\s*<!--([\s\S]*)-->\s*$/, '$1')
		.replace(/^\s*\/\*<!\[CDATA\[\*\/([\s\S]*)\/\*\]\]>\*\/\s*$/, '$1')
		.trim();
}

/** Extracts every raw `application/ld+json` script body from an HTML document, untouched and untruncated. */
export function extractJsonLdScriptTexts(html: string): string[] {
	if (!html) return [];
	const out: string[] = [];
	const re = new RegExp(LD_JSON_SCRIPT_RE.source, LD_JSON_SCRIPT_RE.flags);
	let match: RegExpExecArray | null;
	while ((match = re.exec(html)) != null) {
		const body = stripJsonComments(match[1] || '');
		if (body) out.push(body);
	}
	return out;
}

/**
 * Brace-matched fallback for callers that hand this module a raw JSON-LD
 * corpus (no `<script>` wrapper) — e.g. an already-extracted, multi-block
 * `jsonLdFullCorpus` string where several top-level JSON documents are
 * simply newline-joined and therefore not valid to `JSON.parse` as one blob.
 */
function splitLooseJsonBlocks(text: string): string[] {
	const blocks: string[] = [];
	let i = 0;
	while (i < text.length) {
		const start = text.indexOf('{', i);
		if (start < 0) break;
		let depth = 0;
		let inStr = false;
		let esc = false;
		let closed = false;
		for (let j = start; j < text.length; j += 1) {
			const ch = text[j];
			if (inStr) {
				if (esc) esc = false;
				else if (ch === '\\') esc = true;
				else if (ch === '"') inStr = false;
				continue;
			}
			if (ch === '"') inStr = true;
			else if (ch === '{') depth += 1;
			else if (ch === '}') {
				depth -= 1;
				if (depth === 0) {
					const block = text.slice(start, j + 1);
					// Only keep candidates that look like schema.org JSON-LD — avoids
					// wasting JSON.parse attempts on unrelated `{ }` noise (inline JS,
					// footer text, …) that a raw corpus may also contain.
					if (/"@type"\s*:/.test(block) || /"@graph"\s*:/.test(block)) blocks.push(block);
					i = j + 1;
					closed = true;
					break;
				}
			}
		}
		if (!closed) i = start + 1;
	}
	return blocks;
}

/**
 * Flattens one parsed JSON-LD document into its constituent entity nodes.
 * Recurses into `@graph` (including nested graphs, per the JSON-LD spec)
 * so every entity in a multi-node document — not just the first one — ends
 * up in the pool.
 */
function flattenEntityNodes(value: unknown, out: JsonLdEntityNode[]): void {
	if (value == null) return;
	if (Array.isArray(value)) {
		for (const item of value) flattenEntityNodes(item, out);
		return;
	}
	if (typeof value !== 'object') return;
	const node = value as JsonLdEntityNode;
	const graph = node['@graph'];
	if (graph != null) {
		flattenEntityNodes(graph, out);
		// A graph wrapper is only itself a real entity when it declares an @type.
		if (node['@type'] == null) return;
	}
	out.push(node);
}

/**
 * Builds the full JSON-LD entity pool for a page: every `<script
 * type="application/ld+json">` block is parsed and, when it wraps its nodes
 * in `@graph`, flattened so `Organization`, `MedicalClinic`,
 * `MedicalWebPage`, `Person`, … all become independent, directly-checkable
 * pool entries instead of staying nested inside one opaque root object.
 *
 * A malformed block is skipped (not thrown) so one bad `<script>` tag never
 * hides every other entity on the page — mirrors the requested:
 *   jsonLdScripts.forEach(script => {
 *     try {
 *       const data = JSON.parse(script);
 *       if (data['@graph']) allNodes.push(...data['@graph']);
 *       else allNodes.push(data);
 *     } catch (e) {}
 *   });
 */
export function buildJsonLdEntityPool(html: string): JsonLdEntityNode[] {
	const pool: JsonLdEntityNode[] = [];
	if (!html) return pool;
	const scriptTexts = extractJsonLdScriptTexts(html);
	// No `<script>` wrapper found — the caller likely handed us a raw JSON-LD
	// corpus (e.g. `jsonLdFullCorpus`) instead of full page HTML. Fall back to
	// brace-matching so multi-block corpora still yield a real pool.
	const candidates = scriptTexts.length ? scriptTexts : splitLooseJsonBlocks(html);
	for (const text of candidates) {
		try {
			const data = JSON.parse(text);
			flattenEntityNodes(data, pool);
		} catch {
			// Malformed block — skip it, keep collecting the rest of the pool.
		}
	}
	return pool;
}

function typesOf(node: JsonLdEntityNode): string[] {
	const raw = node['@type'];
	const strip = (t: unknown) => String(t).replace(/^https?:\/\/schema\.org\//i, '').trim();
	if (typeof raw === 'string') return [strip(raw)];
	if (Array.isArray(raw)) return raw.map(strip).filter(Boolean);
	return [];
}

function nodeHasType(node: JsonLdEntityNode, type: string): boolean {
	return typesOf(node).some((t) => t.toLowerCase() === type.toLowerCase());
}

function poolHasType(pool: readonly JsonLdEntityNode[], type: string): boolean {
	return pool.some((node) => nodeHasType(node, type));
}

/**
 * Depth-bounded walk over every nested object reachable from the pool —
 * every key, not a fixed whitelist — since `geo` / `openingHoursSpecification`
 * / `hasOfferCatalog` can be attached under arbitrary intermediate keys
 * (`department`, `provider`, `subOrganization`, …) by different CMS
 * templates.
 */
function forEachEntityNode(
	pool: readonly JsonLdEntityNode[],
	onNode: (node: JsonLdEntityNode) => void,
	maxDepth = 6,
): void {
	const visited = new Set<unknown>();
	const visit = (value: unknown, depth: number) => {
		if (value == null || depth > maxDepth) return;
		if (Array.isArray(value)) {
			for (const item of value) visit(item, depth + 1);
			return;
		}
		if (typeof value !== 'object') return;
		if (visited.has(value)) return;
		visited.add(value);
		const node = value as JsonLdEntityNode;
		onNode(node);
		for (const child of Object.values(node)) visit(child, depth + 1);
	};
	for (const node of pool) visit(node, 0);
}

export interface PageSchemaDetection {
	found: boolean;
	/** The matched @type, e.g. "MedicalWebPage" or "AboutPage". */
	type: string;
}

/** Page-level @types that satisfy "AboutPage / MedicalWebPage" style checks, most specific first. */
const PAGE_SCHEMA_TYPES = [
	'MedicalWebPage',
	'AboutPage',
	'ContactPage',
	'ProfilePage',
	'CollectionPage',
	'WebPage',
];

/**
 * Detects AboutPage / MedicalWebPage (or a recognized WebPage subtype)
 * anywhere in the flattened entity pool — the exact check that was
 * misfiring as "not found" when the page's `@graph` had more than one
 * entity ahead of the page-schema node.
 */
export function detectPageSchema(pool: readonly JsonLdEntityNode[]): PageSchemaDetection {
	for (const wanted of PAGE_SCHEMA_TYPES) {
		if (poolHasType(pool, wanted)) return { found: true, type: wanted };
	}
	return { found: false, type: '' };
}

export interface GeoCoordinatesDetection {
	found: boolean;
	latitude: string;
	longitude: string;
}

function asRecord(value: unknown): JsonLdEntityNode | null {
	return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonLdEntityNode) : null;
}

function scalarText(value: unknown): string {
	if (typeof value === 'string' || typeof value === 'number') return String(value).trim();
	return '';
}

const LAT_LNG_RE = /^-?\d+(\.\d+)?$/;

/**
 * Detects `geo.latitude` / `geo.longitude` (or a bare `GeoCoordinates` node)
 * reachable from any node in the pool — not just the first/root node — so a
 * `GeoCoordinates` block nested under `MedicalClinic` inside a multi-entity
 * `@graph` is still found.
 */
export function detectGeoCoordinates(pool: readonly JsonLdEntityNode[]): GeoCoordinatesDetection {
	let result: GeoCoordinatesDetection = { found: false, latitude: '', longitude: '' };
	forEachEntityNode(pool, (node) => {
		if (result.found) return;
		const geo = asRecord(node.geo) || (nodeHasType(node, 'GeoCoordinates') ? node : null);
		if (!geo) return;
		const latitude = scalarText(geo.latitude);
		const longitude = scalarText(geo.longitude);
		if (latitude && longitude && LAT_LNG_RE.test(latitude) && LAT_LNG_RE.test(longitude)) {
			result = { found: true, latitude, longitude };
		}
	});
	return result;
}

export interface OpeningHoursDetection {
	found: boolean;
	/** Number of distinct `OpeningHoursSpecification` rows collected. */
	specCount: number;
}

/**
 * Detects `openingHoursSpecification` (structured rows) or the
 * `openingHours` shorthand string, reachable from anywhere in the pool.
 */
export function detectOpeningHoursSpecification(pool: readonly JsonLdEntityNode[]): OpeningHoursDetection {
	let specCount = 0;
	forEachEntityNode(pool, (node) => {
		if (nodeHasType(node, 'OpeningHoursSpecification')) specCount += 1;
		const spec = node.openingHoursSpecification;
		if (spec) specCount += Array.isArray(spec) ? spec.length : 1;
		if (typeof node.openingHours === 'string' && node.openingHours.trim()) specCount += 1;
	});
	return { found: specCount > 0, specCount };
}

export interface ServiceCatalogDetection {
	found: boolean;
	/** Total leaf service/offer names collected across every catalog reachable in the pool. */
	itemCount: number;
}

function offerLeafName(row: unknown): string {
	if (typeof row === 'string') return row.trim();
	const rec = asRecord(row);
	if (!rec) return '';
	const itemOffered = asRecord(rec.itemOffered);
	return scalarText(itemOffered?.name) || scalarText(rec.name) || scalarText(rec.serviceType) || '';
}

function countOfferCatalogItems(catalog: JsonLdEntityNode, depth = 0): number {
	if (depth > 5) return 0;
	const rows = catalog.itemListElement;
	if (rows == null) return nodeHasType(catalog, 'OfferCatalog') || catalog.name ? 1 : 0;
	const list = Array.isArray(rows) ? rows : [rows];
	let count = 0;
	for (const row of list) {
		const rec = asRecord(row);
		if (rec && (nodeHasType(rec, 'OfferCatalog') || Array.isArray(rec.itemListElement))) {
			count += countOfferCatalogItems(rec, depth + 1);
		} else if (offerLeafName(row)) {
			count += 1;
		}
	}
	return count;
}

/**
 * Detects `hasOfferCatalog` (including nested category catalogs) or
 * `availableService`, reachable from anywhere in the pool.
 */
export function detectServiceCatalog(pool: readonly JsonLdEntityNode[]): ServiceCatalogDetection {
	let itemCount = 0;
	forEachEntityNode(pool, (node) => {
		const catalog = node.hasOfferCatalog;
		if (catalog) {
			for (const row of Array.isArray(catalog) ? catalog : [catalog]) {
				const rec = asRecord(row);
				if (rec) itemCount += countOfferCatalogItems(rec);
				else if (typeof row === 'string' && row.trim()) itemCount += 1;
			}
		}
		const service = node.availableService;
		if (service) {
			for (const row of Array.isArray(service) ? service : [service]) {
				if (offerLeafName(row)) itemCount += 1;
			}
		}
	});
	return { found: itemCount > 0, itemCount };
}

export interface DetectedVideoObject {
	name: string;
	description?: string;
	contentUrl?: string;
	embedUrl?: string;
	thumbnailUrl?: string;
	uploadDate?: string;
}

function firstScalar(value: unknown): string {
	if (Array.isArray(value)) return scalarText(value[0]);
	return scalarText(value);
}

/**
 * Real (non-simulated) `VideoObject` extraction from the flattened JSON-LD
 * entity pool — e.g. YouTube embeds a clinic/business declared via schema.
 * Returns an empty array (never fabricated rows) when the page's `@graph`
 * has no `VideoObject` node; callers must render an honest "not detected"
 * state instead of guessing.
 */
export function detectVideoObjects(pool: readonly JsonLdEntityNode[]): DetectedVideoObject[] {
	const out: DetectedVideoObject[] = [];
	const seen = new Set<string>();
	forEachEntityNode(pool, (node) => {
		if (!nodeHasType(node, 'VideoObject')) return;
		const name = scalarText(node.name) || scalarText(node.headline);
		const contentUrl = firstScalar(node.contentUrl);
		const embedUrl = firstScalar(node.embedUrl);
		const thumbnailNode = asRecord(node.thumbnailUrl);
		const thumbnailUrl = thumbnailNode ? scalarText(thumbnailNode.url) : firstScalar(node.thumbnailUrl);
		const uploadDate = scalarText(node.uploadDate) || scalarText(node.datePublished);
		const key = `${name}|${contentUrl}|${embedUrl}`;
		if (!name && !contentUrl && !embedUrl) return;
		if (seen.has(key)) return;
		seen.add(key);
		out.push({
			name: name || contentUrl || embedUrl,
			description: scalarText(node.description) || undefined,
			contentUrl: contentUrl || undefined,
			embedUrl: embedUrl || undefined,
			thumbnailUrl: thumbnailUrl || undefined,
			uploadDate: uploadDate || undefined,
		});
	});
	return out;
}

export interface SchemaAnalyzerResult {
	entityPool: JsonLdEntityNode[];
	entityTypes: string[];
	pageSchema: PageSchemaDetection;
	geo: GeoCoordinatesDetection;
	openingHours: OpeningHoursDetection;
	serviceCatalog: ServiceCatalogDetection;
	videos: DetectedVideoObject[];
}

/**
 * Single canonical analysis pass: build the `@graph`-flattened entity pool
 * once, then run every one of the 4 previously-misdiagnosed checks against
 * that same pool. Prefer this over re-deriving a pool per-check so every
 * caller agrees on what "the page's schema" is.
 */
export function analyzeSchema(html: string): SchemaAnalyzerResult {
	const entityPool = buildJsonLdEntityPool(html);
	const entityTypes = Array.from(new Set(entityPool.flatMap(typesOf)));
	return {
		entityPool,
		entityTypes,
		pageSchema: detectPageSchema(entityPool),
		geo: detectGeoCoordinates(entityPool),
		openingHours: detectOpeningHoursSpecification(entityPool),
		serviceCatalog: detectServiceCatalog(entityPool),
		videos: detectVideoObjects(entityPool),
	};
}

/**
 * Convenience entry point for callers that already hold the report's
 * untruncated JSON-LD corpus (`metrics.jsonLdFullCorpus`) instead of raw
 * HTML — `buildJsonLdEntityPool` falls back to brace-matching in that case.
 */
export function detectVideoObjectsFromCorpus(corpus: string | undefined | null): DetectedVideoObject[] {
	if (!corpus) return [];
	return detectVideoObjects(buildJsonLdEntityPool(corpus));
}
