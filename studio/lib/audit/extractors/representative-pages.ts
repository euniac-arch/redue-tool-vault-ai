/**
 * Greeting / about / doctor-page discovery for representative-name extraction.
 * Diagnosis fetches footer first, then these pages so `$rep_name` / ceo_name
 * can be compiled when the legal name is not on the homepage.
 */

export const GREETING_PAGE_PATHS = [
	'/ceo_message.php',
	'/102.php',
	'/s102.php',
	'/ceo.php',
	'/message.php',
	'/greeting.php',
	'/about.php',
	'/about.html',
	'/about',
	'/intro.php',
	'/company.php',
	'/101.php',
] as const;

export const DOCTOR_PAGE_PATHS = [
	'/doctor.php',
	'/doctors.php',
	'/medical.php',
	'/team.php',
	'/staff.php',
] as const;

export const LOCATION_PAGE_PATHS = [
	'/location.php',
	'/map.php',
	'/direction.php',
	'/contact.php',
	'/way.php',
] as const;

const GREETING_PATH_RE =
	/(?:^|\/)(?:ceo(?:[_-]?message)?|message|greeting|about|intro|company|102|s102|101|인사(?:말)?)(?:\.php|\.html?)?(?:$|[/?#])/i;

const GREETING_INTRO_PATH_RE = /(?:^|\/)(?:소개|sogae)(?:\.php|\.html?)?(?:$|[/?#])/i;

const GREETING_HINT_RE = /ceo|message|intro|about|greeting|인사말|인사/i;

const GREETING_NAV_RE = /인사말|인사|원장\s*인사|병원\s*소개|클리닉\s*소개|치과\s*소개|의원\s*소개|about|greeting/i;

const DOCTOR_PATH_RE =
	/(?:^|\/)(?:doctors?|medical|team|staff|의료진)(?:\.php|\.html?)?(?:$|[/?#])/i;

const DOCTOR_HINT_RE = /doctor|medical|team|staff|의료진|의료팀/i;

const DOCTOR_NAV_RE = /의료진|의료팀|의료\s*진|의료진\s*소개|의료팀\s*소개|doctor|medical\s*team/i;

const LOCATION_PATH_RE =
	/(?:^|\/)(?:location|map|direction|contact|way|오시는|찾아오시는)(?:\.php|\.html?)?(?:$|[/?#])/i;

const LOCATION_NAV_RE = /오시는\s*길|찾아오시는|위치안내|찾아오시는길|location|directions?/i;

function haystackOf(urlPath: string, title?: string): string {
	return `${urlPath || ''} ${title || ''}`;
}

export function isGreetingPagePath(path: string): boolean {
	const raw = String(path || '').split('#')[0] || '';
	if (!raw) return false;
	if (DOCTOR_PATH_RE.test(raw) || DOCTOR_HINT_RE.test(raw)) return false;
	return GREETING_PATH_RE.test(raw) || GREETING_INTRO_PATH_RE.test(raw);
}

export function isGreetingCeoPage(urlPath: string, title?: string): boolean {
	const hay = haystackOf(urlPath, title);
	if (!hay.trim()) return false;
	if (isDoctorTeamPage(urlPath, title)) return false;
	if (isGreetingPagePath(urlPath)) return true;
	if (GREETING_NAV_RE.test(title || '')) return true;
	if (GREETING_HINT_RE.test(hay)) return true;
	if (/소개/.test(hay) && !/진료\s*소개|서비스\s*소개|의료진/.test(hay)) return true;
	return false;
}

export function isDoctorPagePath(path: string): boolean {
	const raw = String(path || '').split('#')[0] || '';
	if (!raw) return false;
	if (/인사/.test(raw)) return false;
	return DOCTOR_PATH_RE.test(raw);
}

export function isDoctorTeamPage(urlPath: string, title?: string): boolean {
	const hay = haystackOf(urlPath, title);
	if (!hay.trim()) return false;
	if (/인사말|인사/.test(hay) && !DOCTOR_HINT_RE.test(hay)) return false;
	if (isDoctorPagePath(urlPath)) return true;
	if (DOCTOR_NAV_RE.test(title || '') || DOCTOR_HINT_RE.test(hay)) return true;
	if (/원장/.test(hay) && !/인사/.test(hay) && /의료진|doctor|team|소개/.test(hay)) return true;
	return false;
}

function collectCandidateUrls(opts: {
	origin: string;
	seedPaths: readonly string[];
	collectedUrls?: string[];
	navItems?: Array<{ name?: string; url?: string }>;
	limit?: number;
	matchHref: (href: string) => boolean;
	matchNav: (nav: { name?: string; url?: string }) => boolean;
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

	for (const href of opts.collectedUrls || []) {
		if (opts.matchHref(href)) push(href);
	}

	for (const nav of opts.navItems || []) {
		if (!nav?.url) continue;
		if (opts.matchNav(nav)) push(nav.url);
	}

	for (const path of opts.seedPaths) push(path);

	return out.slice(0, limit);
}

export function collectGreetingCandidateUrls(opts: {
	origin: string;
	collectedUrls?: string[];
	navItems?: Array<{ name?: string; url?: string }>;
	limit?: number;
}): string[] {
	return collectCandidateUrls({
		origin: opts.origin,
		seedPaths: GREETING_PAGE_PATHS,
		collectedUrls: opts.collectedUrls,
		navItems: opts.navItems,
		limit: opts.limit ?? 4,
		matchHref: (href) => isGreetingCeoPage(href),
		matchNav: (nav) => isGreetingCeoPage(nav.url || '', nav.name),
	});
}

export function isLocationPagePath(path: string): boolean {
	const raw = String(path || '').split('#')[0] || '';
	if (!raw) return false;
	return LOCATION_PATH_RE.test(raw);
}

export function isLocationMapPage(urlPath: string, title?: string): boolean {
	const hay = haystackOf(urlPath, title);
	if (!hay.trim()) return false;
	if (isLocationPagePath(urlPath)) return true;
	return LOCATION_NAV_RE.test(hay);
}

export function collectLocationCandidateUrls(opts: {
	origin: string;
	collectedUrls?: string[];
	navItems?: Array<{ name?: string; url?: string }>;
	limit?: number;
}): string[] {
	return collectCandidateUrls({
		origin: opts.origin,
		seedPaths: LOCATION_PAGE_PATHS,
		collectedUrls: opts.collectedUrls,
		navItems: opts.navItems,
		limit: opts.limit ?? 3,
		matchHref: (href) => isLocationMapPage(href),
		matchNav: (nav) => isLocationMapPage(nav.url || '', nav.name),
	});
}

export function collectDoctorCandidateUrls(opts: {
	origin: string;
	collectedUrls?: string[];
	navItems?: Array<{ name?: string; url?: string }>;
	limit?: number;
}): string[] {
	return collectCandidateUrls({
		origin: opts.origin,
		seedPaths: DOCTOR_PAGE_PATHS,
		collectedUrls: opts.collectedUrls,
		navItems: opts.navItems,
		limit: opts.limit ?? 3,
		matchHref: (href) => isDoctorTeamPage(href),
		matchNav: (nav) => isDoctorTeamPage(nav.url || '', nav.name),
	});
}
