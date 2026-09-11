/**
 * Self-hosted site analytics tests: bot filtering, device/browser/OS
 * detection, referrer/UTM classification, and the in-memory rate limiter.
 *
 * `lib/analytics/store.ts` (memory + disk + Firestore persistence tiers) is
 * intentionally NOT exercised here: it transitively imports
 * `lib/firebase/admin.ts`, which is guarded by the `server-only` package —
 * same as `lib/ai-hub/daily-ai-rankings-store.ts`, that module is only
 * exercised inside the Next.js server runtime (API routes), never via a
 * plain `tsx` script. Verify it with `npm run dev` + curling
 * `/api/analytics/collect` and `/api/admin/analytics` instead.
 *
 * Run: npx tsx scripts/test-site-analytics.ts
 */
import {
	classifyReferrer,
	detectBrowser,
	detectDevice,
	detectOs,
	isLikelyBot,
	isValidDateKey,
	seoulDateKey,
	shiftDateKey,
} from '../lib/analytics/detect';
import { takeAnalyticsRateLimit } from '../lib/analytics/rate-limit';

let failed = 0;

function assert(label: string, condition: boolean, detail?: unknown) {
	if (condition) {
		console.log(`ok  ${label}`);
		return;
	}
	failed += 1;
	console.error(`FAIL ${label}${detail !== undefined ? ` — ${JSON.stringify(detail)}` : ''}`);
}

// ---------------------------------------------------------------------------
// Bot detection
// ---------------------------------------------------------------------------

assert('Googlebot UA is detected as a bot', isLikelyBot('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'));
assert('GPTBot UA is detected as a bot', isLikelyBot('Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.0; +https://openai.com/gptbot'));
assert('PerplexityBot UA is detected as a bot', isLikelyBot('Mozilla/5.0 (compatible; PerplexityBot/1.0)'));
assert('ClaudeBot UA is detected as a bot', isLikelyBot('ClaudeBot/1.0 (+https://www.anthropic.com)'));
assert('curl UA is detected as a bot', isLikelyBot('curl/8.4.0'));
assert('empty UA is treated as a bot (non-browser)', isLikelyBot(''));
assert('headless Chrome is detected as a bot', isLikelyBot('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 HeadlessChrome/120.0.0.0 Safari/537.36'));
assert(
	'a real desktop Chrome UA is NOT a bot',
	!isLikelyBot('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'),
);
assert(
	'a real mobile Safari UA is NOT a bot',
	!isLikelyBot('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'),
);

// ---------------------------------------------------------------------------
// Device / OS / browser detection
// ---------------------------------------------------------------------------

const UA_WINDOWS_CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const UA_IPHONE_SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const UA_IPAD_SAFARI = 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/604.1';
const UA_ANDROID_CHROME = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';
const UA_MAC_SAFARI = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';
const UA_WINDOWS_EDGE = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0';

assert('Windows Chrome UA -> Desktop', detectDevice(UA_WINDOWS_CHROME) === 'Desktop');
assert('iPhone UA -> Mobile', detectDevice(UA_IPHONE_SAFARI) === 'Mobile');
assert('iPad UA -> Tablet', detectDevice(UA_IPAD_SAFARI) === 'Tablet');
assert('Android phone UA -> Mobile', detectDevice(UA_ANDROID_CHROME) === 'Mobile');

assert('Windows Chrome UA -> os Windows', detectOs(UA_WINDOWS_CHROME) === 'Windows');
assert('iPhone UA -> os iOS', detectOs(UA_IPHONE_SAFARI) === 'iOS');
assert('Mac Safari UA -> os macOS', detectOs(UA_MAC_SAFARI) === 'macOS');
assert('Android UA -> os Android', detectOs(UA_ANDROID_CHROME) === 'Android');

assert('Windows Chrome UA -> browser Chrome', detectBrowser(UA_WINDOWS_CHROME) === 'Chrome');
assert('Edge UA -> browser Edge (not misdetected as Chrome)', detectBrowser(UA_WINDOWS_EDGE) === 'Edge');
assert('Mac Safari UA -> browser Safari', detectBrowser(UA_MAC_SAFARI) === 'Safari');
assert('iPhone Safari UA -> browser Safari', detectBrowser(UA_IPHONE_SAFARI) === 'Safari');

// ---------------------------------------------------------------------------
// Referrer / UTM classification
// ---------------------------------------------------------------------------

assert('empty referrer + no UTM -> Direct', classifyReferrer('', undefined) === 'Direct');
assert('google.com referrer -> Google', classifyReferrer('https://www.google.com/search?q=redue', undefined) === 'Google');
assert('naver.com referrer -> Naver', classifyReferrer('https://search.naver.com/search.naver?query=redue', undefined) === 'Naver');
assert('daum.net referrer -> Daum', classifyReferrer('https://search.daum.net/search?q=redue', undefined) === 'Daum');
assert('unrecognized referrer host is kept as-is', classifyReferrer('https://www.instagram.com/somepost', undefined) === 'instagram.com');
assert('a known domain\'s subdomains still bucket to the friendly label', classifyReferrer('https://blog.naver.com/somepost', undefined) === 'Naver');
assert('UTM source wins over referrer', classifyReferrer('https://www.google.com/', 'newsletter') === 'Newsletter');
assert('malformed referrer URL falls back to Direct', classifyReferrer('not-a-url', undefined) === 'Direct');

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

assert('seoulDateKey returns YYYY-MM-DD', /^\d{4}-\d{2}-\d{2}$/.test(seoulDateKey()));
assert('shiftDateKey(-1) moves one day back', shiftDateKey('2026-01-01', -1) === '2025-12-31');
assert('shiftDateKey(+1) moves one day forward across month boundary', shiftDateKey('2026-01-31', 1) === '2026-02-01');
assert('isValidDateKey accepts YYYY-MM-DD', isValidDateKey('2026-09-11'));
assert('isValidDateKey rejects garbage', !isValidDateKey('not-a-date'));

// ---------------------------------------------------------------------------
// Rate limiter
// ---------------------------------------------------------------------------

{
	const key = `test:${Date.now()}`;
	let allowed = 0;
	for (let i = 0; i < 5; i += 1) {
		if (takeAnalyticsRateLimit(key, 3, 60_000)) allowed += 1;
	}
	assert('rate limiter allows exactly `limit` calls then blocks', allowed === 3, { allowed });
}

console.log(failed === 0 ? '\nAll site-analytics tests passed.' : `\n${failed} site-analytics test(s) failed.`);
process.exit(failed === 0 ? 0 : 1);
