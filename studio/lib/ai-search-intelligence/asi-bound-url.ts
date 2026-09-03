import { loadLatestAuditPayload } from '@/lib/audit/latest-audit-payload';
import { normalizeAsiSiteUrl } from '@/lib/ai-search-intelligence/normalize-site-url';

const ASI_BOUND_URL_KEY = 'asi_bound_url';
const WAR_ROOM_CACHE_KEY = 'asi_war_room_snapshot';
const ASI_SESSION_RESET_MARKER = 'asi_session_reset_v2';

/**
 * One-time cleanup, run at module load: wipes every `asi_*` sessionStorage
 * entry (bound URL + all per-tool snapshot caches) left over from a browser
 * tab that was open before this fix shipped. Without this, a tab that once
 * explicitly analyzed a site (e.g. during QA) would keep "remembering" it
 * forever via `asi_bound_url` / `asi_*_snapshot`, which looks identical to a
 * hardcoded default from the outside even though no source file has one.
 * Guarded by a version marker so it only runs once per tab, not on every
 * `/intelligence/*` navigation.
 */
function resetStaleAsiSessionOnce() {
	if (typeof window === 'undefined') return;
	try {
		if (window.sessionStorage.getItem(ASI_SESSION_RESET_MARKER)) return;
		const staleKeys: string[] = [];
		for (let i = 0; i < window.sessionStorage.length; i += 1) {
			const key = window.sessionStorage.key(i);
			if (key && key.startsWith('asi_')) staleKeys.push(key);
		}
		staleKeys.forEach((key) => window.sessionStorage.removeItem(key));
		window.sessionStorage.setItem(ASI_SESSION_RESET_MARKER, '1');
	} catch {
		// ignore quota / privacy-mode storage errors
	}
}

resetStaleAsiSessionOnce();

/** Rebuild pillar cache when a matching audit exists but the snapshot never bound it. */
export function asiCacheShouldRebuild(snapshot: { site?: { url?: string }; auditBind?: unknown } | null): boolean {
	if (!snapshot?.site?.url) return true;
	const audit = loadLatestAuditPayload();
	if (!audit?.report.url) return false;
	if (normalizeAsiSiteUrl(audit.report.url) !== normalizeAsiSiteUrl(snapshot.site.url)) return false;
	return !snapshot.auditBind;
}

export function readAsiBoundUrl(): string | null {
	if (typeof window === 'undefined') return null;
	try {
		const direct = window.sessionStorage.getItem(ASI_BOUND_URL_KEY)?.trim();
		if (direct) return direct;
		const raw = window.sessionStorage.getItem(WAR_ROOM_CACHE_KEY);
		if (!raw) return null;
		const data = JSON.parse(raw) as { site?: { url?: string } };
		return data?.site?.url || null;
	} catch {
		return null;
	}
}

/**
 * Shared seed: session cache → explicitly bound URL. Deliberately does NOT
 * fall back to `loadLatestAuditPayload()` (the most recent full SEO audit
 * elsewhere in the app) — that fallback used to make every AI 인텔리전스
 * sub-page silently auto-analyze whatever site the user last ran a regular
 * audit on, with no explicit action in this section at all. `asi_bound_url`
 * (read by `readAsiBoundUrl`) is only ever written as the *result* of an
 * explicit action — the shared top control bar's [AI 인텔리전스 분석]
 * button, or any tool page's own Analyze submit — so gating on it alone is
 * enough to guarantee "no explicit request → no analysis". Never re-crawls.
 */
export function seedAsiSiteUrl(cachedUrl?: string | null): string {
	return cachedUrl || readAsiBoundUrl() || '';
}

export function writeAsiBoundUrl(url: string) {
	if (typeof window === 'undefined') return;
	try {
		window.sessionStorage.setItem(ASI_BOUND_URL_KEY, url);
	} catch {
		// ignore quota
	}
}

const ASI_ANALYZE_REQUEST_EVENT = 'asi:analyze-requested';

/**
 * Cross-component bridge for the shared AI 인텔리전스 top control bar
 * (`AsiControlBar`): tells whichever tool dashboard happens to be mounted
 * right now "the user just explicitly asked to analyze this URL". Writing
 * `asi_bound_url` alone only reaches *future* page mounts — each `/intelligence/*`
 * tool is fully remounted on navigation (see `AiIntelligenceLayout`'s
 * `key={route.tool.href}`), so a fresh mount picks up the bound URL on its
 * own via `seedAsiSiteUrl()`. This event additionally reaches the page that
 * is already on screen when the button is clicked, without requiring every
 * dashboard to be rewritten around a shared data context.
 */
export function dispatchAsiAnalyzeRequest(url: string) {
	writeAsiBoundUrl(url);
	if (typeof window === 'undefined') return;
	window.dispatchEvent(new CustomEvent<string>(ASI_ANALYZE_REQUEST_EVENT, { detail: url }));
}

/** Subscribe to explicit analyze requests from `AsiControlBar`. Returns an unsubscribe function. */
export function onAsiAnalyzeRequest(handler: (url: string) => void): () => void {
	if (typeof window === 'undefined') return () => {};
	const listener = (event: Event) => {
		const detail = (event as CustomEvent<string>).detail;
		if (typeof detail === 'string' && detail.trim()) handler(detail.trim());
	};
	window.addEventListener(ASI_ANALYZE_REQUEST_EVENT, listener);
	return () => window.removeEventListener(ASI_ANALYZE_REQUEST_EVENT, listener);
}

export function readAsiSessionSnapshot<T>(key: string, isValid: (data: T) => boolean): T | null {
	if (typeof window === 'undefined') return null;
	try {
		const raw = window.sessionStorage.getItem(key);
		if (!raw) return null;
		const data = JSON.parse(raw) as T;
		return isValid(data) ? data : null;
	} catch {
		return null;
	}
}

export function writeAsiSessionSnapshot(key: string, snapshot: { site: { url: string } }) {
	try {
		window.sessionStorage.setItem(key, JSON.stringify(snapshot));
		writeAsiBoundUrl(snapshot.site.url);
	} catch {
		// ignore quota
	}
}

export { WAR_ROOM_CACHE_KEY };
