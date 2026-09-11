/**
 * Canonical URL diagnostic engine tests.
 * Run: npx tsx scripts/test-canonical-url.ts
 */
import {
	canonicalMatches,
	diagnoseCanonicalUrl,
	evaluateCanonicalAccuracy,
	normalizeCanonicalCompareUrl,
} from '../lib/audit/canonical-url';

let failed = 0;

function assert(label: string, condition: boolean, detail?: unknown) {
	if (condition) {
		console.log(`ok  ${label}`);
		return;
	}
	failed += 1;
	console.error(`FAIL ${label}${detail !== undefined ? ` — ${JSON.stringify(detail)}` : ''}`);
}

function assertCode(label: string, actual: string, expected: string, detail?: unknown) {
	assert(`${label} (code=${actual})`, actual === expected, detail);
}

// ---------------------------------------------------------------------------
// Legacy wrapper compatibility (evaluateCanonicalAccuracy / canonicalMatches)
// ---------------------------------------------------------------------------

const HOME = 'https://clinic.example.com/';
const HOME_CANONICAL = 'https://clinic.example.com/';

assert(
	'nocache query on requested URL still matches clean canonical',
	canonicalMatches(`${HOME}?_redue_nocache=${Date.now()}`, HOME_CANONICAL),
);
assert(
	'_nocache query is ignored',
	canonicalMatches(`${HOME}?_nocache=1`, HOME_CANONICAL),
);
assert(
	'utm_* + click ids on requested URL still match',
	canonicalMatches(
		`${HOME}?utm_source=google&utm_medium=cpc&utm_campaign=spring&utm_content=ad1&fbclid=abc&gclid=xyz`,
		HOME_CANONICAL,
	),
);
assert(
	'canonical that echoed nocache still matches clean target',
	canonicalMatches(HOME, `${HOME}?_redue_nocache=999`),
);
assert(
	'trailing slash vs no slash match',
	canonicalMatches('https://clinic.example.com', HOME_CANONICAL),
);
assert(
	'index.php homepage matches /',
	canonicalMatches(`${HOME}index.php?_redue_nocache=1`, HOME_CANONICAL),
);
assert(
	'http vs https match (protocol-only diff is a WARN, not a FAIL)',
	canonicalMatches('http://clinic.example.com/?utm_source=x', HOME_CANONICAL),
);
assert(
	'identity query (bo_table) is kept — different board is mismatch',
	!canonicalMatches(
		'https://clinic.example.com/bbs/board.php?bo_table=notice',
		'https://clinic.example.com/bbs/board.php?bo_table=free',
	),
);
assert(
	'same board with utm still matches',
	canonicalMatches(
		'https://clinic.example.com/bbs/board.php?bo_table=notice&utm_source=mail',
		'https://clinic.example.com/bbs/board.php?bo_table=notice',
	),
);
assert(
	'different path is still a mismatch',
	!canonicalMatches('https://clinic.example.com/about/', HOME_CANONICAL),
);

const pass = evaluateCanonicalAccuracy(HOME_CANONICAL, `${HOME}?_redue_nocache=1`);
assert('evaluateCanonicalAccuracy PASS on nocache target', pass.status === 'PASS', pass);

const fail = evaluateCanonicalAccuracy('https://clinic.example.com/other/', HOME);
assert('evaluateCanonicalAccuracy FAIL on other page', fail.status === 'FAIL', fail);

assert(
	'normalize strips nocache and trailing index.php',
	normalizeCanonicalCompareUrl('https://clinic.example.com/index.php?_redue_nocache=1') === HOME,
);

// ---------------------------------------------------------------------------
// Strict engine — diagnoseCanonicalUrl() 6-stage ruleset
// ---------------------------------------------------------------------------

// ★ The regression this refactor exists to fix: a subpage's canonical
// pointing at site root must FAIL, never silently PASS on tag-presence alone.
{
	const r = diagnoseCanonicalUrl({
		requestUrl: 'https://domain.com/s102.php',
		canonicalHrefs: ['https://domain.com/'],
	});
	assert('s102.php → root canonical is FAIL', r.status === 'FAIL', r);
	assertCode('s102.php → root canonical', r.code, 'SUBPAGE_POINTS_TO_ROOT', r);
	assert('score is 0 on FAIL', r.score === 0, r);
	assert('details.requestUrl echoed', r.details.requestUrl === 'https://domain.com/s102.php', r);
	assert('details.cleanReqPath is the subpage path', r.details.cleanReqPath === '/s102.php', r);
	assert('details.cleanCanPath is root', r.details.cleanCanPath === '/', r);
}

// Same trap via a WordPress-style extensionless slug.
{
	const r = diagnoseCanonicalUrl({
		requestUrl: 'https://domain.com/about',
		canonicalHrefs: ['https://domain.com'],
	});
	assertCode('WordPress /about → root canonical', r.code, 'SUBPAGE_POINTS_TO_ROOT', r);
}

// Stage 1 — existence & multiplicity
{
	const missing = diagnoseCanonicalUrl({ requestUrl: 'https://domain.com/page', canonicalHrefs: [] });
	assertCode('missing canonical tag', missing.code, 'MISSING_CANONICAL', missing);
	assert('missing canonical is FAIL', missing.status === 'FAIL' && missing.score === 0, missing);

	const dup = diagnoseCanonicalUrl({
		requestUrl: 'https://domain.com/page',
		canonicalHrefs: ['https://domain.com/page', 'https://domain.com/page?dup=1'],
	});
	assertCode('duplicate canonical tags', dup.code, 'DUPLICATE_CANONICAL', dup);
	assert('duplicate canonical is FAIL', dup.status === 'FAIL', dup);
}

// Stage 2 — absolute URL validation
{
	const rel = diagnoseCanonicalUrl({
		requestUrl: 'https://domain.com/sub',
		canonicalHrefs: ['/sub'],
	});
	assertCode('relative href "/sub"', rel.code, 'INVALID_ABSOLUTE_URL', rel);

	const relDots = diagnoseCanonicalUrl({
		requestUrl: 'https://domain.com/a/b',
		canonicalHrefs: ['../page'],
	});
	assertCode('relative href "../page"', relDots.code, 'INVALID_ABSOLUTE_URL', relDots);

	const empty = diagnoseCanonicalUrl({ requestUrl: 'https://domain.com/x', canonicalHrefs: [''] });
	assertCode('empty href is treated as missing', empty.code, 'MISSING_CANONICAL', empty);

	const malformed = diagnoseCanonicalUrl({
		requestUrl: 'https://domain.com/x',
		canonicalHrefs: ['ftp://domain.com/x'],
	});
	assertCode('non-http(s) protocol', malformed.code, 'MALFORMED_URL', malformed);
}

// Stage 3 — CMS-agnostic normalization (index files, trailing slash, tracking params)
{
	const idx = diagnoseCanonicalUrl({
		requestUrl: 'https://domain.com/blog/index.html',
		canonicalHrefs: ['https://domain.com/blog/'],
	});
	assert('directory index collapses to same page as PASS', idx.status === 'PASS', idx);

	const tracking = diagnoseCanonicalUrl({
		requestUrl: 'https://domain.com/product/42?utm_source=fb&fbclid=abc&gclid=xyz&_ga=1&ref=insta',
		canonicalHrefs: ['https://domain.com/product/42'],
	});
	assert('tracking params stripped before compare → PASS', tracking.status === 'PASS', tracking);
}

// CMS identity params preserved: 그누보드 bo_table/wr_id, 워드프레스 p/page_id, 쇼피파이 variant
{
	const gnuboard = diagnoseCanonicalUrl({
		requestUrl: 'https://domain.com/bbs/board.php?bo_table=notice&wr_id=10&utm_source=x',
		canonicalHrefs: ['https://domain.com/bbs/board.php?bo_table=notice&wr_id=10'],
	});
	assert('그누보드 bo_table/wr_id preserved, utm_ ignored → PASS', gnuboard.status === 'PASS', gnuboard);

	const gnuboardMismatch = diagnoseCanonicalUrl({
		requestUrl: 'https://domain.com/bbs/board.php?bo_table=notice&wr_id=10',
		canonicalHrefs: ['https://domain.com/bbs/board.php?bo_table=notice&wr_id=11'],
	});
	assertCode('그누보드 different wr_id → mismatch', gnuboardMismatch.code, 'CANONICAL_PATH_MISMATCH', gnuboardMismatch);

	const wp = diagnoseCanonicalUrl({
		requestUrl: 'https://domain.com/?page_id=42&utm_campaign=spring',
		canonicalHrefs: ['https://domain.com/?page_id=42'],
	});
	assert('워드프레스 page_id preserved, utm_ ignored → PASS', wp.status === 'PASS', wp);

	const shopify = diagnoseCanonicalUrl({
		requestUrl: 'https://domain.com/products/shirt?variant=123&fbclid=x',
		canonicalHrefs: ['https://domain.com/products/shirt?variant=123'],
	});
	assert('쇼피파이 variant preserved, fbclid ignored → PASS', shopify.status === 'PASS', shopify);
}

// Stage 5 — self-reference / domain consistency
{
	const crossDomain = diagnoseCanonicalUrl({
		requestUrl: 'https://domain.com/page',
		canonicalHrefs: ['https://other-domain.com/page'],
	});
	assertCode('cross-domain canonical', crossDomain.code, 'CROSS_DOMAIN_CANONICAL', crossDomain);
	assert('cross-domain canonical is WARN, not a hard FAIL', crossDomain.status === 'WARN', crossDomain);

	const pathMismatch = diagnoseCanonicalUrl({
		requestUrl: 'https://domain.com/page-a',
		canonicalHrefs: ['https://domain.com/page-b'],
	});
	assertCode('two distinct non-root pages mismatch', pathMismatch.code, 'CANONICAL_PATH_MISMATCH', pathMismatch);
	assert('path mismatch is FAIL', pathMismatch.status === 'FAIL' && pathMismatch.score === 0, pathMismatch);

	const protocolOnly = diagnoseCanonicalUrl({
		requestUrl: 'http://domain.com/page',
		canonicalHrefs: ['https://domain.com/page'],
	});
	assertCode('protocol-only difference', protocolOnly.code, 'PROTOCOL_MISMATCH', protocolOnly);
	assert('protocol mismatch is WARN, not FAIL', protocolOnly.status === 'WARN' && protocolOnly.score > 0, protocolOnly);

	const wwwInsensitive = diagnoseCanonicalUrl({
		requestUrl: 'https://www.domain.com/page',
		canonicalHrefs: ['https://domain.com/page'],
	});
	assert('www. is not treated as a cross-domain', wwwInsensitive.status === 'PASS', wwwInsensitive);
}

// Stage 6 — OpenGraph / JSON-LD cross-check
{
	const ogMismatch = diagnoseCanonicalUrl({
		requestUrl: 'https://domain.com/page',
		canonicalHrefs: ['https://domain.com/page'],
		ogUrl: 'https://domain.com/other-page',
	});
	assertCode('og:url mismatch', ogMismatch.code, 'OG_URL_MISMATCH', ogMismatch);
	assert('og:url mismatch is WARN, not FAIL', ogMismatch.status === 'WARN', ogMismatch);

	const schemaMismatch = diagnoseCanonicalUrl({
		requestUrl: 'https://domain.com/page',
		canonicalHrefs: ['https://domain.com/page'],
		schemaUrls: ['https://domain.com/other-page'],
	});
	assertCode('JSON-LD url mismatch', schemaMismatch.code, 'SCHEMA_URL_MISMATCH', schemaMismatch);

	const clean = diagnoseCanonicalUrl({
		requestUrl: 'https://domain.com/page',
		canonicalHrefs: ['https://domain.com/page'],
		ogUrl: 'https://domain.com/page',
		schemaUrls: ['https://domain.com/page'],
	});
	assertCode('fully self-referencing page is PASS', clean.code, 'CANONICAL_OK', clean);
	assert('clean self-reference scores 100', clean.status === 'PASS' && clean.score === 100, clean);
}

if (failed) {
	console.error(`\n${failed} assertion(s) failed`);
	process.exit(1);
}
console.log('\ncanonical-url: all assertions passed');
