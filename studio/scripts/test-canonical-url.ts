/**
 * Canonical URL sanitizer: cache-bust / tracking params must not cause mismatch.
 * Run: npx tsx scripts/test-canonical-url.ts
 */
import {
	canonicalMatches,
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
	'http vs https match',
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

if (failed) {
	console.error(`\n${failed} assertion(s) failed`);
	process.exit(1);
}
console.log('\ncanonical-url: all assertions passed');
