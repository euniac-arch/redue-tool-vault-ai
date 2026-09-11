'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import type { GeoNarrativeReport } from '@/lib/audit/geo-narrative';
import { buildTechnicalFailsFromReport } from '@/lib/audit/geo-narrative';
import type { PageSpeedSnapshot } from '@/lib/audit/pagespeed';
import type { PageSpeedStrategy } from '@/components/audit/PageSpeedPrecisionPanel';
import {
	getGeoNarrativeInflight,
	getPageSpeedInflight,
	peekCachedGeoNarrative,
	peekCachedPageSpeed,
	psiCacheKey,
	rememberGeoNarrative,
	rememberPageSpeed,
	setGeoNarrativeInflight,
	setPageSpeedInflight,
} from '@/lib/audit/report-client-cache';
import { siteLabelFromUrl } from '@/lib/audit/report-url';
import type { AuditReport } from '@/lib/site-auditor';

/** Slightly above `/api/audit/pagespeed`'s own `maxDuration=60` so a normal (if slow) real
 *  Lighthouse read is never cut off client-side before the server's own fallback would fire. */
const PAGESPEED_CLIENT_FETCH_TIMEOUT_MS = 65_000;

export function useAuditReportEnrichment(report: AuditReport | null) {
	const locale = useLocale();
	const [geoNarrative, setGeoNarrative] = useState<GeoNarrativeReport | null>(null);
	const [geoNarrativeLoading, setGeoNarrativeLoading] = useState(true);
	const [psiByStrategy, setPsiByStrategy] = useState<
		Partial<Record<PageSpeedStrategy, PageSpeedSnapshot>>
	>({});
	const [psiLoadingByStrategy, setPsiLoadingByStrategy] = useState<
		Partial<Record<PageSpeedStrategy, boolean>>
	>({ desktop: true });
	const [psiErrorByStrategy, setPsiErrorByStrategy] = useState<
		Partial<Record<PageSpeedStrategy, string | null>>
	>({});
	const [psiStrategy, setPsiStrategy] = useState<PageSpeedStrategy>('desktop');
	/** Track 3 부분 재진단(리프레시) — 전체 재스캔 없이 Lighthouse만 다시 호출하는 동안 true. */
	const [isPsiRefreshing, setIsPsiRefreshing] = useState(false);
	const geoFetchKeyRef = useRef('');
	const psiCacheRef = useRef<{
		auditKey: string;
		byStrategy: Partial<Record<PageSpeedStrategy, PageSpeedSnapshot>>;
	}>({ auditKey: '', byStrategy: {} });
	const psiInflightRef = useRef<
		Partial<Record<PageSpeedStrategy, Promise<PageSpeedSnapshot | null>>>
	>({});

	useEffect(() => {
		if (!report) {
			setGeoNarrative(null);
			setGeoNarrativeLoading(false);
			geoFetchKeyRef.current = '';
			return;
		}

		const domain = siteLabelFromUrl(report.url);
		const technicalFails = buildTechnicalFailsFromReport(report, locale === 'en' ? 'en' : 'ko');
		const siteTitle = report.metrics?.pageTitle || report.siteMeta?.brandName || domain;
		const metaDescription =
			report.metrics?.metaDescription ||
			[report.siteMeta?.category, report.siteMeta?.location, report.siteMeta?.primaryKeyword]
				.filter(Boolean)
				.join(' · ') ||
			undefined;

		const fetchKey = `${report.url}|${report.fetchedAt}|${locale}`;
		const cached = peekCachedGeoNarrative(fetchKey);
		if (cached) {
			geoFetchKeyRef.current = fetchKey;
			setGeoNarrative(cached);
			setGeoNarrativeLoading(false);
			return;
		}
		if (geoFetchKeyRef.current === fetchKey && geoNarrative) return;
		geoFetchKeyRef.current = fetchKey;

		let cancelled = false;
		setGeoNarrativeLoading(true);

		const inflight = getGeoNarrativeInflight(fetchKey);
		const promise =
			inflight ??
			(async () => {
				try {
					const res = await fetch('/api/generate-geo-report', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							domain,
							siteTitle,
							metaDescription,
							technicalFails,
							failItems: technicalFails,
							brandName: report.siteMeta?.brandName,
							category: report.siteMeta?.category,
							mainSpecialty:
								report.siteMeta?.coreSpecialties?.[0] ||
								report.siteMeta?.primaryKeyword ||
								report.siteMeta?.category,
							location: report.siteMeta?.location,
							broadLocation: report.siteMeta?.broadLocation,
							industryType: report.siteMeta?.industryType,
							schemaTypes: report.metrics?.schemaTypes,
							lang: locale === 'en' ? 'en' : 'ko',
							address: report.siteMeta?.address,
							telephone: report.siteMeta?.telephone,
							sameAs: report.siteMeta?.sameAs,
							collectedUrls: report.collectedUrls,
						}),
					});
					const data = await res.json();
					if (!res.ok) throw new Error(data.error || 'GEO narrative failed');
					const next = data as GeoNarrativeReport;
					rememberGeoNarrative(fetchKey, next);
					return next;
				} catch {
					return null;
				}
			})();

		if (!inflight) setGeoNarrativeInflight(fetchKey, promise);

		void promise.then((next) => {
			if (cancelled) return;
			setGeoNarrative(next);
			setGeoNarrativeLoading(false);
		});

		return () => {
			cancelled = true;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps -- refetch when audit identity changes
	}, [report?.url, report?.fetchedAt, locale]);

	useEffect(() => {
		if (!report?.url) {
			psiCacheRef.current = { auditKey: '', byStrategy: {} };
			psiInflightRef.current = {};
			setPsiByStrategy({});
			setPsiLoadingByStrategy({});
			setPsiErrorByStrategy({});
			return;
		}

		const targetUrl = report.url;
		const fetchedAt = report.fetchedAt;
		const auditKey = `${targetUrl}|${fetchedAt}`;
		let strategy = psiStrategy;

		// Improves the server's on-page estimate fallback (used only if the live Lighthouse
		// read fails) — mirrors the hints the scan orchestrator used to compute itself
		// before Track 3 was deferred to this client-side fetch.
		const perfCategory = report.categories?.find((c) => c.id === 'performance');
		const onPagePerformanceScore100 =
			perfCategory && perfCategory.maxScore > 0
				? Math.round((perfCategory.score / perfCategory.maxScore) * 100)
				: undefined;
		const responseTimeMs = report.responseTimeMs ?? undefined;

		if (psiCacheRef.current.auditKey !== auditKey) {
			// Track 3 is now collected server-side alongside Track 1/2 by `/api/audit/scan`
			// — seed both strategies straight from the scan payload instead of re-fetching
			// PageSpeed client-side. Only a report saved before this field existed (or one
			// where a Lighthouse run genuinely failed) falls through to fetchStrategy below.
			const seededByStrategy: Partial<Record<PageSpeedStrategy, PageSpeedSnapshot>> = {};
			if (report.pageSpeedDesktop) seededByStrategy.desktop = report.pageSpeedDesktop;
			if (report.pageSpeedMobile) seededByStrategy.mobile = report.pageSpeedMobile;
			for (const [seededStrategy, snapshot] of Object.entries(seededByStrategy) as Array<
				[PageSpeedStrategy, PageSpeedSnapshot]
			>) {
				rememberPageSpeed(psiCacheKey(targetUrl, fetchedAt, seededStrategy), snapshot);
			}

			psiCacheRef.current = { auditKey, byStrategy: seededByStrategy };
			psiInflightRef.current = {};
			setPsiByStrategy(seededByStrategy);
			setPsiErrorByStrategy({
				desktop: seededByStrategy.desktop?.unavailableMessage || null,
				mobile: seededByStrategy.mobile?.unavailableMessage || null,
			});
			setPsiLoadingByStrategy({
				desktop: !seededByStrategy.desktop,
				mobile: !seededByStrategy.mobile,
			});
			if (psiStrategy !== 'desktop') {
				setPsiStrategy('desktop');
				return;
			}
			strategy = 'desktop';
		}

		function applySnapshot(nextStrategy: PageSpeedStrategy, snapshot: PageSpeedSnapshot) {
			if (psiCacheRef.current.auditKey !== auditKey) return;
			psiCacheRef.current.byStrategy[nextStrategy] = snapshot;
			rememberPageSpeed(psiCacheKey(targetUrl, fetchedAt, nextStrategy), snapshot);
			setPsiByStrategy((prev) =>
				prev[nextStrategy] === snapshot ? prev : { ...prev, [nextStrategy]: snapshot },
			);
			setPsiErrorByStrategy((prev) => ({
				...prev,
				[nextStrategy]: snapshot.unavailableMessage || null,
			}));
			setPsiLoadingByStrategy((prev) => ({ ...prev, [nextStrategy]: false }));
		}

		function fetchStrategy(
			nextStrategy: PageSpeedStrategy,
			background: boolean,
		): Promise<PageSpeedSnapshot | null> {
			const moduleKey = psiCacheKey(targetUrl, fetchedAt, nextStrategy);
			const moduleHit = peekCachedPageSpeed(moduleKey);
			if (moduleHit) {
				applySnapshot(nextStrategy, moduleHit);
				return Promise.resolve(moduleHit);
			}

			const inflight = psiInflightRef.current[nextStrategy] ?? getPageSpeedInflight(moduleKey);
			if (inflight) {
				if (!background) {
					setPsiLoadingByStrategy((prev) => ({ ...prev, [nextStrategy]: true }));
					setPsiErrorByStrategy((prev) => ({ ...prev, [nextStrategy]: null }));
				}
				return inflight;
			}

			if (!background) {
				setPsiLoadingByStrategy((prev) => ({ ...prev, [nextStrategy]: true }));
				setPsiErrorByStrategy((prev) => ({ ...prev, [nextStrategy]: null }));
			}

			const promise = (async () => {
				try {
					console.log('[audit/pagespeed][client][Track 3] fetch start', { targetUrl, strategy: nextStrategy, background });
					const res = await fetch('/api/audit/pagespeed', {
						method: 'POST',
						cache: 'no-store',
						headers: {
							'Content-Type': 'application/json',
						'Cache-Control': 'no-cache, no-store, must-revalidate',
						Pragma: 'no-cache',
					},
					body: JSON.stringify({
						url: targetUrl,
						strategy: nextStrategy,
						onPagePerformanceScore100,
						responseTimeMs,
					}),
					signal: AbortSignal.timeout(PAGESPEED_CLIENT_FETCH_TIMEOUT_MS),
				});
					const data = await res.json().catch(() => ({}));
					if (psiCacheRef.current.auditKey !== auditKey) return null;
					if (!res.ok) {
						throw new Error(
							typeof data.error === 'string' && data.error
								? data.error
								: 'PageSpeed Insights failed',
						);
					}
					const snapshot = data as PageSpeedSnapshot;
					applySnapshot(nextStrategy, snapshot);
					return snapshot;
				} catch (err) {
					if (psiCacheRef.current.auditKey === auditKey) {
						setPsiErrorByStrategy((prev) => ({
							...prev,
							[nextStrategy]: err instanceof Error ? err.message : 'PageSpeed Insights failed',
						}));
						setPsiLoadingByStrategy((prev) => ({ ...prev, [nextStrategy]: false }));
					}
					return null;
				} finally {
					delete psiInflightRef.current[nextStrategy];
				}
			})();

			psiInflightRef.current[nextStrategy] = promise;
			setPageSpeedInflight(moduleKey, promise);
			return promise;
		}

		const other: PageSpeedStrategy = strategy === 'desktop' ? 'mobile' : 'desktop';
		const cached =
			psiCacheRef.current.byStrategy[strategy] ??
			peekCachedPageSpeed(psiCacheKey(targetUrl, fetchedAt, strategy));
		if (cached) applySnapshot(strategy, cached);

		const otherCached =
			psiCacheRef.current.byStrategy[other] ?? peekCachedPageSpeed(psiCacheKey(targetUrl, fetchedAt, other));
		if (otherCached) applySnapshot(other, otherCached);

		// Both strategies already resolved (embedded scan payload or module cache) —
		// nothing left to fetch, so the result screen never shows a Track 3 spinner.
		if (cached && otherCached) return;

		let cancelled = false;
		const pending: Promise<PageSpeedSnapshot | null>[] = [];
		if (!cached) pending.push(fetchStrategy(strategy, false));
		if (!otherCached) pending.push(fetchStrategy(other, true));
		void Promise.all(pending).then(() => {
			if (cancelled) return;
		});

		return () => {
			cancelled = true;
		};
	}, [report?.url, report?.fetchedAt, report?.pageSpeedDesktop, report?.pageSpeedMobile, psiStrategy]);

	/**
	 * Track 3 부분 재진단(리프레시) — 전체 사이트 재스캔(`runAudit`) 없이 Lighthouse
	 * mobile/desktop 두 API만 강제로 재호출한다(`forceRefresh: true` → 서버 15분 캐시 우회).
	 * 결과가 도착하면 `psiByStrategy`만 교체되고, 이 값을 소비하는
	 * `resolveTrack3PerformanceScore` → `buildDiagnosisScoreSnapshot`(AuditReportDocument)이
	 * 자동으로 재계산되어 종합 점수(SSOT)·3-트랙 카드·Track 3 세부 영역이 모두 리렌더링된다.
	 */
	const refreshPageSpeed = useCallback(async () => {
		if (!report?.url || isPsiRefreshing) return;
		const targetUrl = report.url;
		const fetchedAt = report.fetchedAt;
		const auditKey = `${targetUrl}|${fetchedAt}`;
		if (psiCacheRef.current.auditKey !== auditKey) return;

		setIsPsiRefreshing(true);

		async function refreshStrategy(nextStrategy: PageSpeedStrategy): Promise<void> {
			try {
				console.log('[audit/pagespeed][client][Track 3] manual refresh start', { targetUrl, strategy: nextStrategy });
				const res = await fetch('/api/audit/pagespeed', {
					method: 'POST',
					cache: 'no-store',
					headers: {
						'Content-Type': 'application/json',
						'Cache-Control': 'no-cache, no-store, must-revalidate',
						Pragma: 'no-cache',
					},
					body: JSON.stringify({ url: targetUrl, strategy: nextStrategy, forceRefresh: true }),
					signal: AbortSignal.timeout(PAGESPEED_CLIENT_FETCH_TIMEOUT_MS),
				});
				const data = await res.json().catch(() => ({}));
				if (psiCacheRef.current.auditKey !== auditKey) return;
				if (!res.ok) {
					throw new Error(
						typeof data.error === 'string' && data.error ? data.error : 'PageSpeed Insights failed',
					);
				}
				const snapshot = data as PageSpeedSnapshot;
				psiCacheRef.current.byStrategy[nextStrategy] = snapshot;
				rememberPageSpeed(psiCacheKey(targetUrl, fetchedAt, nextStrategy), snapshot);
				setPsiByStrategy((prev) => ({ ...prev, [nextStrategy]: snapshot }));
				setPsiErrorByStrategy((prev) => ({ ...prev, [nextStrategy]: snapshot.unavailableMessage || null }));
			} catch (err) {
				if (psiCacheRef.current.auditKey === auditKey) {
					setPsiErrorByStrategy((prev) => ({
						...prev,
						[nextStrategy]: err instanceof Error ? err.message : 'PageSpeed Insights failed',
					}));
				}
			}
		}

		try {
			await Promise.all([refreshStrategy('desktop'), refreshStrategy('mobile')]);
		} finally {
			if (psiCacheRef.current.auditKey === auditKey) setIsPsiRefreshing(false);
		}
	}, [report?.url, report?.fetchedAt, isPsiRefreshing]);

	const pageSpeed = psiByStrategy[psiStrategy] ?? null;
	const pageSpeedDesktop = psiByStrategy.desktop ?? null;
	const pageSpeedMobile = psiByStrategy.mobile ?? null;
	const pageSpeedLoadingDesktop = Boolean(psiLoadingByStrategy.desktop) && !pageSpeedDesktop;
	const pageSpeedLoadingMobile = Boolean(psiLoadingByStrategy.mobile) && !pageSpeedMobile;
	const pageSpeedLoading = pageSpeedLoadingDesktop || pageSpeedLoadingMobile;
	const pageSpeedError = pageSpeed ? null : (psiErrorByStrategy[psiStrategy] ?? null);

	return {
		geoNarrative,
		geoNarrativeLoading,
		pageSpeed,
		pageSpeedDesktop,
		pageSpeedMobile,
		pageSpeedLoading,
		pageSpeedError,
		psiStrategy,
		setPsiStrategy,
		isPsiRefreshing,
		refreshPageSpeed,
	};
}
