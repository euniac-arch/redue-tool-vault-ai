'use client';

import { Suspense, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { usePathname, useSearchParams } from 'next/navigation';
import { isInternalAnalyticsHost } from '@/lib/analytics/detect';

/**
 * One visit beacon per browser session, or again after 30 minutes.
 * `sessionStorage` is cleared when the tab/browser session ends, so a later
 * visit counts again. Refreshing the same session does not.
 *
 * Localhost, `next dev`, `/admin`, and admin devices never send the beacon.
 */

const VISIT_SESSION_KEY = 'redue_visited_session';
const IGNORE_STORAGE_KEY = 'ignore_analytics';
const IGNORE_COOKIE = 'ignore_analytics=true';
const VISIT_WINDOW_MS = 30 * 60 * 1000;
const EXCLUDED_PREFIXES = ['/admin', '/api'];

function shouldTrackPath(pathname: string): boolean {
	return !EXCLUDED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function isIgnoredAdminDevice(): boolean {
	try {
		if (window.localStorage.getItem(IGNORE_STORAGE_KEY) === 'true') return true;
	} catch {
		// private mode
	}
	return document.cookie.split(';').some((part) => part.trim() === IGNORE_COOKIE);
}

function markAdminDeviceIgnored(): void {
	try {
		window.localStorage.setItem(IGNORE_STORAGE_KEY, 'true');
	} catch {
		// ignore
	}
	document.cookie = `${IGNORE_COOKIE}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

/** True when this session has not recorded a visit in the last 30 minutes. */
function claimVisitSlot(): boolean {
	try {
		const raw = window.sessionStorage.getItem(VISIT_SESSION_KEY);
		const at = raw ? Number(raw) : Number.NaN;
		if (Number.isFinite(at) && Date.now() - at < VISIT_WINDOW_MS) return false;
		window.sessionStorage.setItem(VISIT_SESSION_KEY, String(Date.now()));
		return true;
	} catch {
		return false;
	}
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
	const { data: session, status } = useSession();

	useEffect(() => {
		if (process.env.NODE_ENV === 'development') return;
		if (isInternalAnalyticsHost(window.location.hostname)) return;
		if (!shouldTrackPath(pathname)) return;
		if (isIgnoredAdminDevice()) return;
		if (status === 'loading') return;
		if (status === 'authenticated' && session?.user?.isAdmin === true) {
			markAdminDeviceIgnored();
			return;
		}
		if (!claimVisitSlot()) return;

		sendAnalyticsBeacon({
			path: pathname,
			referrer: typeof document !== 'undefined' ? document.referrer || '' : '',
			utmSource: searchParams.get('utm_source') || undefined,
			utmMedium: searchParams.get('utm_medium') || undefined,
			utmCampaign: searchParams.get('utm_campaign') || undefined,
			userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
			screenWidth: typeof window !== 'undefined' ? window.screen?.width : undefined,
		});
	}, [pathname, searchParams, session?.user?.isAdmin, status]);

	return null;
}

export function AnalyticsTracker() {
	return (
		<Suspense fallback={null}>
			<AnalyticsTrackerInner />
		</Suspense>
	);
}
