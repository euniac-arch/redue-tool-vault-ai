'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { sanitizeUrlInput, toPunycodeHref } from '@/lib/audit/normalize-url';

export function normalizeAuditUrl(raw: string): string {
	const trimmed = sanitizeUrlInput(raw);
	if (!trimmed) return '';
	try {
		return toPunycodeHref(trimmed);
	} catch {
		if (/^https?:\/\//i.test(trimmed)) return trimmed;
		return `https://${trimmed.replace(/^\/+/, '')}`;
	}
}

function buildResultHref(url: string, extraQuery?: Record<string, string>): string {
	const params = new URLSearchParams();
	params.set('url', url);
	params.set('forceRefresh', 'true');
	params.set('t', String(Date.now()));
	if (extraQuery) {
		for (const [key, value] of Object.entries(extraQuery)) {
			if (value) params.set(key, value);
		}
	}
	return `/audit/result?${params.toString()}`;
}

function isOnAuditResult(): boolean {
	return typeof window !== 'undefined' && window.location.pathname.startsWith('/audit/result');
}

export function useAuditLaunch({
	initialUrl = '',
	extraQuery,
	autoSubmit = false,
}: {
	initialUrl?: string;
	extraQuery?: Record<string, string>;
	autoSubmit?: boolean;
} = {}) {
	const t = useTranslations('hero');
	const router = useRouter();
	const [url, setUrl] = useState(() => normalizeAuditUrl(initialUrl));
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const extraQueryRef = useRef(extraQuery);
	extraQueryRef.current = extraQuery;
	const watchdogRef = useRef<number | null>(null);
	const inFlightRef = useRef(false);

	useEffect(() => {
		const normalized = normalizeAuditUrl(initialUrl);
		if (normalized) setUrl(normalized);
	}, [initialUrl]);

	useEffect(() => {
		return () => {
			if (watchdogRef.current != null) {
				window.clearTimeout(watchdogRef.current);
				watchdogRef.current = null;
			}
		};
	}, []);

	const handleDiagnose = useCallback(
		(raw: string) => {
			const normalized = normalizeAuditUrl(raw);
			if (!normalized) {
				inFlightRef.current = false;
				setError(t('invalidUrl'));
				setSubmitting(false);
				return;
			}
			if (inFlightRef.current) return;
			inFlightRef.current = true;

			setUrl(normalized);
			setError(null);
			setSubmitting(true);

			const href = buildResultHref(normalized, extraQueryRef.current);
			let navigated = false;

			try {
				router.replace(href);
				navigated = true;
			} catch (err) {
				setError(err instanceof Error && err.message ? err.message : t('launchError'));
			} finally {
				if (!navigated) {
					inFlightRef.current = false;
					setSubmitting(false);
				}
			}

			if (!navigated) return;

			if (watchdogRef.current != null) window.clearTimeout(watchdogRef.current);
			watchdogRef.current = window.setTimeout(() => {
				watchdogRef.current = null;
				if (isOnAuditResult()) return;
				try {
					window.location.assign(href);
				} catch {
					inFlightRef.current = false;
					setError(t('launchError'));
					setSubmitting(false);
				}
			}, 1200);
		},
		[router, t],
	);

	useEffect(() => {
		if (!autoSubmit) return;
		const normalized = normalizeAuditUrl(initialUrl);
		if (!normalized) return;

		let cancelled = false;
		const timer = window.setTimeout(() => {
			if (cancelled) return;
			handleDiagnose(normalized);
		}, 0);

		return () => {
			cancelled = true;
			window.clearTimeout(timer);
		};
	}, [autoSubmit, initialUrl, handleDiagnose]);

	function handleSubmit(event: React.FormEvent) {
		event.preventDefault();
		handleDiagnose(url);
	}

	return { url, setUrl, submitting, error, setError, handleSubmit, handleDiagnose, t };
}