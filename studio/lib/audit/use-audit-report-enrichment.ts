'use client';

import { useEffect, useRef, useState } from 'react';
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

		if (psiCacheRef.current.auditKey !== auditKey) {
			psiCacheRef.current = { auditKey, byStrategy: {} };
			psiInflightRef.current = {};
			setPsiByStrategy({});
			setPsiErrorByStrategy({});
			setPsiLoadingByStrategy({ desktop: true, mobile: true });
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
			setPsiErrorByStrategy((prev) => ({ ...prev, [nextStrategy]: null }));
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
					const res = await fetch('/api/audit/pagespeed', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ url: targetUrl, strategy: nextStrategy }),
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
		const cached = psiCacheRef.current.byStrategy[strategy] ?? peekCachedPageSpeed(
			psiCacheKey(targetUrl, fetchedAt, strategy),
		);
		if (cached) {
			applySnapshot(strategy, cached);
			void fetchStrategy(other, true);
			return;
		}

		let cancelled = false;
		void Promise.all([fetchStrategy(strategy, false), fetchStrategy(other, true)]).then(() => {
			if (cancelled) return;
		});

		return () => {
			cancelled = true;
		};
	}, [report?.url, report?.fetchedAt, psiStrategy]);

	const pageSpeed = psiByStrategy[psiStrategy] ?? null;
	const pageSpeedDesktop = psiByStrategy.desktop ?? null;
	const pageSpeedMobile = psiByStrategy.mobile ?? null;
	const pageSpeedLoading = Boolean(psiLoadingByStrategy[psiStrategy]) && !pageSpeed;
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
	};
}
