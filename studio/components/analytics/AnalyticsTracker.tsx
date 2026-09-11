'use client';

import { Suspense, useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

/**
 * Lightweight, self-hosted page-view tracker. No cookies, no consent popup:
 * the visitor id lives in `sessionStorage` only (cleared when the browser
 * tab/session ends), which is enough to de-duplicate "unique visitors" for a
 * given day without persistent cross-session tracking.
 *
 * Fires once per route change via `navigator.sendBeacon` (falls back to
 * `fetch(..., { keepalive: true })`) so it never blocks navigation and still
 * delivers even when the page is unloading.
 */

const VISITOR_STORAGE_KEY = 'redue_analytics_visitor_id';
const EXCLUDED_PREFIXES = ['/admin', '/api'];

function getOrCreateVisitorId(): string {
	try {
		const existing = window.sessionStorage.getItem(VISITOR_STORAGE_KEY);
		if (existing) return existing;
		const id =
			typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
				? crypto.randomUUID()
				: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
		window.sessionStorage.setItem(VISITOR_STORAGE_KEY, id);
		return id;
	} catch {
		// sessionStorage unavailable (privacy mode, etc.) — fall back to a per-load id.
		return `anon-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
	}
}

function shouldTrack(pathname: string): boolean {
	return !EXCLUDED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function sendAnalyticsBeacon(payload: Record<string, unknown>) {
	try {
		const body = JSON.stringify(payload);
		if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
			const blob = new Blob([body], { type: 'application/json' });
			const accepted = navigator.sendBeacon('/api/analytics/collect', blob);
			if (accepted) return;
		}
		void fetch('/api/analytics/collect', {
			method: 'POST',
			body,
			headers: { 'Content-Type': 'application/json' },
			keepalive: true,
		}).catch(() => {
			// best-effort telemetry — never surface errors to the user
		});
	} catch {
		// swallow — analytics must never break the page
	}
}

function AnalyticsTrackerInner() {
	const pathname = usePathname() ?? '/';
	const searchParams = useSearchParams();
	const lastTrackedKeyRef = useRef<string | null>(null);

	useEffect(() => {
		if (!shouldTrack(pathname)) return;

		const search = searchParams.toString();
		const key = search ? `${pathname}?${search}` : pathname;
		if (lastTrackedKeyRef.current === key) return;
		lastTrackedKeyRef.current = key;

		sendAnalyticsBeacon({
			path: pathname,
			referrer: typeof document !== 'undefined' ? document.referrer || '' : '',
			utmSource: searchParams.get('utm_source') || undefined,
			utmMedium: searchParams.get('utm_medium') || undefined,
			utmCampaign: searchParams.get('utm_campaign') || undefined,
			visitorId: getOrCreateVisitorId(),
			userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
			screenWidth: typeof window !== 'undefined' ? window.screen?.width : undefined,
		});
	}, [pathname, searchParams]);

	return null;
}

export function AnalyticsTracker() {
	return (
		<Suspense fallback={null}>
			<AnalyticsTrackerInner />
		</Suspense>
	);
}
