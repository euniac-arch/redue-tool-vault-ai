/**
 * Pure, server-safe classification helpers for the site analytics feature:
 * date bucketing (KST), bot filtering, device/OS/browser detection, and
 * referrer/UTM classification. No Firebase/Next imports here so this module
 * is also usable from the client tracker if ever needed.
 */

/** `YYYY-MM-DD` for the given instant in Asia/Seoul — matches `seoulDateKey()` in `lib/server/daily-usage.ts`. */
export function seoulDateKey(date: Date = new Date()): string {
	return new Intl.DateTimeFormat('en-CA', {
		timeZone: 'Asia/Seoul',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
	}).format(date);
}

/** Shift a `YYYY-MM-DD` key by `days` (can be negative). Pure UTC date-math — no DST edge cases. */
export function shiftDateKey(dateKey: string, days: number): string {
	const [y, m, d] = dateKey.split('-').map((part) => Number(part));
	const dt = new Date(Date.UTC(y || 1970, (m || 1) - 1, d || 1));
	dt.setUTCDate(dt.getUTCDate() + days);
	return dt.toISOString().slice(0, 10);
}

export function isValidDateKey(value: string): boolean {
	return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/**
 * Known crawler / bot / automation User-Agent signatures. Deliberately broad
 * — analytics should undercount rather than let bot traffic skew human KPIs.
 * Includes AI assistant crawlers (GPTBot, PerplexityBot, ClaudeBot, ...) per
 * the same allow-list used in `app/robots.ts`, since those should NOT be
 * counted as "visitors" even though they're welcome to crawl for indexing.
 */
const BOT_PATTERNS: RegExp[] = [
	/googlebot/i,
	/bingbot/i,
	/slurp/i,
	/duckduckbot/i,
	/baiduspider/i,
	/yandexbot/i,
	/naver.*yeti/i,
	/facebookexternalhit/i,
	/twitterbot/i,
	/linkedinbot/i,
	/telegrambot/i,
	/discordbot/i,
	/whatsapp/i,
	/applebot/i,
	/gptbot/i,
	/chatgpt-user/i,
	/perplexitybot/i,
	/claudebot/i,
	/anthropic-ai/i,
	/google-extended/i,
	/ahrefsbot/i,
	/semrushbot/i,
	/mj12bot/i,
	/dotbot/i,
	/petalbot/i,
	/bytespider/i,
	/headlesschrome/i,
	/phantomjs/i,
	/puppeteer/i,
	/playwright/i,
	/curl\//i,
	/wget\//i,
	/python-requests/i,
	/go-http-client/i,
	/java\//i,
	/okhttp/i,
	/axios\//i,
	/node-fetch/i,
	/\bbot\b/i,
	/spider/i,
	/crawler/i,
	/crawling/i,
	/pingdom/i,
	/uptimerobot/i,
	/statuscake/i,
	/monitor/i,
];

/** True when the User-Agent looks like a crawler/bot/script rather than a real browser (or is missing). */
export function isLikelyBot(userAgent: string | null | undefined): boolean {
	const ua = (userAgent || '').trim();
	if (!ua) return true;
	return BOT_PATTERNS.some((pattern) => pattern.test(ua));
}

export type DeviceCategory = 'Mobile' | 'Tablet' | 'Desktop';

export function detectDevice(userAgent: string): DeviceCategory {
	const ua = userAgent || '';
	if (/iPad|Tablet(?!.*Mobile)|PlayBook|Kindle|Silk(?!.*Mobile)/i.test(ua)) return 'Tablet';
	if (/Mobi|iPhone|iPod|Android.*Mobile|BlackBerry|IEMobile|Opera Mini/i.test(ua)) return 'Mobile';
	if (/Android/i.test(ua)) return 'Mobile';
	return 'Desktop';
}

export function detectOs(userAgent: string): string {
	const ua = userAgent || '';
	// Check iOS before macOS: iPhone/iPad UAs contain "like Mac OS X" as part
	// of their WebKit compatibility string, which would otherwise misclassify
	// every iPhone/iPad as macOS.
	if (/iPhone|iPad|iPod|iOS/i.test(ua)) return 'iOS';
	if (/Windows NT|Windows/i.test(ua)) return 'Windows';
	if (/Mac OS X|Macintosh/i.test(ua)) return 'macOS';
	if (/Android/i.test(ua)) return 'Android';
	if (/CrOS/i.test(ua)) return 'ChromeOS';
	if (/Linux/i.test(ua)) return 'Linux';
	return 'Unknown';
}

export function detectBrowser(userAgent: string): string {
	const ua = userAgent || '';
	if (/Edg\//i.test(ua)) return 'Edge';
	if (/OPR\/|Opera/i.test(ua)) return 'Opera';
	if (/SamsungBrowser/i.test(ua)) return 'Samsung Internet';
	if (/(Chrome|CriOS)\//i.test(ua)) return 'Chrome';
	if (/(Firefox|FxiOS)\//i.test(ua)) return 'Firefox';
	if (/Safari\//i.test(ua)) return 'Safari';
	return 'Unknown';
}

const SEARCH_ENGINE_HOSTS: { pattern: RegExp; label: string }[] = [
	{ pattern: /(^|\.)google\.[a-z.]+$/i, label: 'Google' },
	{ pattern: /(^|\.)naver\.com$/i, label: 'Naver' },
	{ pattern: /(^|\.)daum\.net$/i, label: 'Daum' },
	{ pattern: /(^|\.)bing\.com$/i, label: 'Bing' },
	{ pattern: /(^|\.)yahoo\.[a-z.]+$/i, label: 'Yahoo' },
	{ pattern: /(^|\.)duckduckgo\.com$/i, label: 'DuckDuckGo' },
];

function capitalizeLabel(value: string): string {
	const trimmed = value.trim();
	if (!trimmed) return trimmed;
	return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

/**
 * Classify traffic source: UTM source wins when present (campaign tracking),
 * otherwise fall back to `document.referrer`'s hostname — well-known search
 * engines get a friendly label, everything else keeps the bare hostname, and
 * an empty referrer means a direct visit / typed URL / bookmark.
 */
export function classifyReferrer(referrer: string | null | undefined, utmSource?: string | null): string {
	const source = (utmSource || '').trim();
	if (source) return capitalizeLabel(source).slice(0, 60);

	const ref = (referrer || '').trim();
	if (!ref) return 'Direct';

	try {
		const url = new URL(ref);
		const host = url.hostname.replace(/^www\./i, '');
		const engine = SEARCH_ENGINE_HOSTS.find((entry) => entry.pattern.test(host));
		if (engine) return engine.label;
		return host || 'Direct';
	} catch {
		return 'Direct';
	}
}
