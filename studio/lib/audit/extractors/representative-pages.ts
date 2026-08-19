/**
 * Greeting / about-page discovery for representative-name extraction.
 * Diagnosis fetches main + footer + these pages so `$rep_name` can be compiled
 * even when the legal name lives on 102.php / about rather than the homepage.
 */

export const GREETING_PAGE_PATHS = [
	'/102.php',
	'/s102.php',
	'/about.php',
	'/about.html',
	'/about',
	'/greeting.php',
	'/intro.php',
	'/company.php',
	'/101.php',
] as const;

const GREETING_PATH_RE =
	/(?:^|\/)(?:102|s102|101|about|greeting|intro|company|인사)(?:\.php|\.html?)?(?:$|[/?#])/i;

const GREETING_NAV_RE = /인사말|인사|원장\s*소개|병원\s*소개|클리닉\s*소개|about|greeting/i;

export function isGreetingPagePath(path: string): boolean {
	const raw = String(path || '').split('#')[0] || '';
	if (!raw) return false;
	return GREETING_PATH_RE.test(raw);
}

export function collectGreetingCandidateUrls(opts: {
	origin: string;
	collectedUrls?: string[];
	navItems?: Array<{ name?: string; url?: string }>;
	limit?: number;
}): string[] {
	const limit = opts.limit ?? 4;
	let origin = opts.origin || '';
	try {
		origin = new URL(opts.origin).origin;
	} catch {
		origin = String(opts.origin || '').replace(/\/+$/, '');
	}

	const seen = new Set<string>();
	const out: string[] = [];

	const push = (href: string) => {
		if (!href || out.length >= limit) return;
		try {
			const abs = new URL(href, origin.endsWith('/') ? origin : `${origin}/`).toString();
			const key = abs.replace(/\/+$/, '').toLowerCase();
			if (seen.has(key)) return;
			seen.add(key);
			out.push(abs);
		} catch {
			/* skip */
		}
	};

	for (const path of GREETING_PAGE_PATHS) push(path);

	for (const href of opts.collectedUrls || []) {
		if (isGreetingPagePath(href)) push(href);
	}

	for (const nav of opts.navItems || []) {
		if (!nav?.url) continue;
		if (GREETING_NAV_RE.test(nav.name || '') || isGreetingPagePath(nav.url)) {
			push(nav.url);
		}
	}

	return out.slice(0, limit);
}
