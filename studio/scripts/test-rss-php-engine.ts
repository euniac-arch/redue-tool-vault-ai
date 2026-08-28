/**
 * GnuBoard 5 rss.php generator + RSS checklist helpers.
 * Run: npx tsx scripts/test-rss-php-engine.ts
 */
import {
	extractRssAlternateHrefs,
	isRssFeedDocument,
	isRssXmlContentType,
	RSS_FEED_CHECK_ID,
	RSS_FEED_CHECK_WEIGHT,
	buildRssFeedCheckItem,
	ensureRssFeedChecklistItem,
} from '../lib/audit/rss-feed-check';
import { generateRssFeedCode, RSS_PHP_DEFAULT_ITEM_LIMIT, RSS_PHP_RELATIVE_PATH } from '../lib/solve/rss-php-engine';

let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
	if (condition) {
		console.log(`ok  ${label}`);
		return;
	}
	failed += 1;
	console.error(`FAIL ${label}${detail ? ` — ${detail}` : ''}`);
}

const php = generateRssFeedCode({
	siteName: "서초피부과의원 O'Brien",
	siteUrl: 'https://www.seochoskin.co.kr',
	description: "공식 최신 글 <RSS>",
	itemLimit: 30,
	telephone: '02-1234-5678',
	address: '서울 서초구 강남대로 1',
});

assert('relative path is rss.php', RSS_PHP_RELATIVE_PATH === 'rss.php');
assert('starts with php open', php.trimStart().startsWith('<?php'));
assert('includes common.php', php.includes("include_once('./common.php')"));
assert('xml content-type header', php.includes("header('Content-Type: text/xml; charset=utf-8')"));
assert('no-cache header', php.includes("header('Cache-Control: no-cache, no-store, must-revalidate')"));
assert('rss 2.0 namespaces', php.includes('xmlns:dc=') && php.includes('xmlns:atom='));
assert('board_new join', php.includes('g5_board_new') && php.includes('g5_board'));
assert('write prefix', php.includes('g5_write_'));
assert('item limit 30', php.includes(`redue_rss_build_items(${RSS_PHP_DEFAULT_ITEM_LIMIT}`));
assert('pretty url helper', php.includes('get_pretty_url'));
assert('htmlspecialchars + strip_tags', php.includes('htmlspecialchars') && php.includes('strip_tags'));
assert('channel always closed', php.includes("echo '</channel>'") && php.includes("echo '</rss>'"));
assert('dual catch', php.includes('catch (\\Exception') && php.includes('catch (\\Throwable'));
assert('bo_table allowlist', php.includes("preg_replace('/[^a-zA-Z0-9_]/'"));
assert('wr_id int cast', php.includes('(int) $wr_id') || php.includes('$wr_id = (int)'));
assert('site name escaped quotes', php.includes("O\\'Brien") || php.includes("O\\'Brien"));
assert('nap in channel description', php.includes('02-1234-5678') && php.includes('서울 서초구 강남대로 1'));
assert('no raw SQL concat of request', !php.includes('$_GET') && !php.includes('$_REQUEST'));
assert('no php close tag', !php.trimEnd().endsWith('?>'));

assert('xml content-type matcher', isRssXmlContentType('text/xml; charset=utf-8'));
assert('rss+xml matcher', isRssXmlContentType('application/rss+xml'));
assert('html type rejected', !isRssXmlContentType('text/html'));
assert(
	'rss body 200 xml',
	isRssFeedDocument('<?xml version="1.0"?><rss version="2.0"><channel></channel></rss>', 200, 'text/xml'),
);
assert('html error page rejected', !isRssFeedDocument('<!DOCTYPE html><html><body>404</body></html>', 200, 'text/html'));
assert('non-200 rejected', !isRssFeedDocument('<rss></rss>', 404, 'text/xml'));

const hrefs = extractRssAlternateHrefs(
	'<head><link rel="alternate" type="application/rss+xml" href="/rss.php" title="RSS"></head>',
	'https://clinic.example/',
);
assert('extracts /rss.php alternate', hrefs.some((href) => href.includes('/rss.php')), hrefs.join(','));

const missing = buildRssFeedCheckItem({ lang: 'ko', present: false });
assert('missing is warning not fail', missing.status === 'warning' && missing.passed === false);
assert('engine id', missing.id === RSS_FEED_CHECK_ID);
assert('weight is 3', missing.weight === RSS_FEED_CHECK_WEIGHT && RSS_FEED_CHECK_WEIGHT === 3);

const ensured = ensureRssFeedChecklistItem([{ id: 'title', label: 'title', passed: true, status: 'pass', weight: 5 }]);
assert('ensure appends rss row', ensured.some((item) => item.id === RSS_FEED_CHECK_ID));

if (failed) {
	console.error(`\n${failed} assertion(s) failed`);
	process.exit(1);
}
console.log('\nall rss.php engine assertions passed');
