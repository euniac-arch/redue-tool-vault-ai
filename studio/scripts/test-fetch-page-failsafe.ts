/**
 * Fail-safe crawl: sitemap / HTTPS refusal must not abort the diagnosis.
 * Run: npx tsx scripts/test-fetch-page-failsafe.ts
 */
import {
	classifyFetchError,
	collectErrorText,
	isHardNetworkError,
	isTimeoutError,
} from '../lib/audit/fetch-page';
import {
	SITEMAP_UNREACHABLE_ERROR,
	enumerateSitemapUrls,
	fetchSitemapCheck,
	parseSitemapXml,
} from '../lib/audit/sitemap';
import { buildDegradedAuditReport } from '../lib/site-auditor';

function assert(cond: unknown, msg: string): asserts cond {
	if (!cond) throw new Error(msg);
}

const timeoutErr = new Error('The operation was aborted due to timeout');
assert(isTimeoutError(timeoutErr), 'timeout message classified');
assert(classifyFetchError(timeoutErr) === 'timeout_or_failed', 'timeout token');

const refused = Object.assign(new Error('fetch failed'), { cause: { code: 'ECONNREFUSED' } });
assert(isHardNetworkError(refused), 'ECONNREFUSED is hard');
assert(classifyFetchError(refused) === 'timeout_or_failed', 'refused token');
assert(collectErrorText(refused).includes('ECONNREFUSED'), 'cause.code flattened');

const ssl = Object.assign(new Error('fetch failed'), { cause: { code: 'ERR_SSL_PROTOCOL_ERROR' } });
assert(isHardNetworkError(ssl), 'SSL protocol error is hard');
assert(classifyFetchError(ssl) === 'timeout_or_failed', 'ssl token');

const generic = new Error('fetch failed');
assert(isHardNetworkError(generic), 'undici fetch failed is hard');

assert(parseSitemapXml('').valid === false, 'empty xml');
assert(parseSitemapXml('<html>not a sitemap</html>').valid === false, 'html is not sitemap');
assert(parseSitemapXml(null as unknown as string).valid === false, 'null xml');

const valid = parseSitemapXml(`<?xml version="1.0"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <loc>http://example.com/a</loc>
</urlset>`);
assert(valid.valid && valid.urlCount === 1, 'urlset parses');

async function main() {
	const originalFetch = globalThis.fetch;
	globalThis.fetch = (async () => {
		throw Object.assign(new Error('fetch failed'), { cause: { code: 'ECONNREFUSED' } });
	}) as typeof fetch;

	try {
		const check = await fetchSitemapCheck('http://http-only.example', '');
		assert(check.ok === false, 'sitemap check ok=false on refuse');
		assert(check.exists === false, 'sitemap check exists=false');
		assert(Array.isArray(check.urls) && check.urls.length === 0, 'sitemap check urls=[]');
		assert(check.error === SITEMAP_UNREACHABLE_ERROR, 'sitemap check error token');

		const enumerated = await enumerateSitemapUrls('http://http-only.example', '');
		assert(enumerated.exists === false, 'enumerate exists=false');
		assert(enumerated.urls.length === 0 && enumerated.locs.length === 0, 'enumerate urls empty');
		assert(enumerated.error === SITEMAP_UNREACHABLE_ERROR || enumerated.error == null, 'enumerate error isolated');
	} finally {
		globalThis.fetch = originalFetch;
	}

	const degraded = buildDegradedAuditReport('http://http-only.example', 'ko', ssl);
	assert(degraded.url.includes('http-only.example'), 'degraded url');
	assert(Array.isArray(degraded.categories), 'degraded categories');
	assert(degraded.sitemap?.exists === false, 'degraded sitemap exists');
	assert(degraded.sitemap?.error === SITEMAP_UNREACHABLE_ERROR, 'degraded sitemap error');
	assert(typeof degraded.score === 'number', 'degraded score');

	console.log('all fetch-page fail-safe assertions passed');
}

void main();
