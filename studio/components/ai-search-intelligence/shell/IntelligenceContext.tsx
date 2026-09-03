'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useAuditHistory } from '@/lib/audit/use-audit-history';
import { dispatchAsiAnalyzeRequest } from '@/lib/ai-search-intelligence/asi-bound-url';
import { normalizeAsiSiteUrl } from '@/lib/ai-search-intelligence/normalize-site-url';

export type IntelligenceRecentAudit = {
	id: string;
	url: string;
	label: string;
	createdAt: string;
};

type IntelligenceContextValue = {
	/** Current value of the shared top-bar URL field (not necessarily analyzed yet). */
	targetUrl: string;
	setTargetUrl: (url: string) => void;
	recentAudits: IntelligenceRecentAudit[];
	recentAuditsLoading: boolean;
	/** Brief "request just sent" flag for the top-bar button — each dashboard owns its own loading state. */
	isRequesting: boolean;
	/**
	 * Explicitly request an AI 인텔리전스 analysis for `url` (defaults to the current
	 * `targetUrl`). This is the ONLY path that is allowed to trigger analysis — no
	 * `/intelligence/*` sub-page may auto-run on mount without going through here
	 * (directly, via the shared top bar, or via a page's own Analyze submit).
	 * Returns the normalized URL on success, or null if the input was invalid.
	 */
	requestAnalysis: (url?: string) => string | null;
	lastError: string | null;
};

const IntelligenceContext = createContext<IntelligenceContextValue | null>(null);

function hostLabel(url: string): string {
	try {
		return new URL(url).hostname.replace(/^www\./, '');
	} catch {
		return url;
	}
}

export function IntelligenceProvider({ children }: { children: ReactNode }) {
	// Always truly blank — never a hardcoded default, and never prefilled from any
	// prior session state either. The user must type/select a URL and press
	// [AI 인텔리전스 분석] every time; nothing here can trigger a fetch on its own.
	const [targetUrl, setTargetUrl] = useState<string>('');
	const [isRequesting, setIsRequesting] = useState(false);
	const [lastError, setLastError] = useState<string | null>(null);
	const { historyList, loading: recentAuditsLoading } = useAuditHistory();

	const recentAudits = useMemo<IntelligenceRecentAudit[]>(
		() =>
			historyList
				.filter((entry) => Boolean(entry.url))
				.slice(0, 20)
				.map((entry) => ({
					id: entry.id,
					url: entry.url,
					label: hostLabel(entry.url),
					createdAt: entry.createdAt,
				})),
		[historyList],
	);

	const requestAnalysis = useCallback(
		(url?: string) => {
			const candidate = (url ?? targetUrl).trim();
			const normalized = normalizeAsiSiteUrl(candidate);
			if (!normalized) {
				setLastError('분석할 사이트 URL을 입력하거나 이력에서 선택해주세요.');
				return null;
			}
			setLastError(null);
			setTargetUrl(normalized);
			setIsRequesting(true);
			dispatchAsiAnalyzeRequest(normalized);
			window.setTimeout(() => setIsRequesting(false), 500);
			return normalized;
		},
		[targetUrl],
	);

	const value = useMemo<IntelligenceContextValue>(
		() => ({
			targetUrl,
			setTargetUrl,
			recentAudits,
			recentAuditsLoading,
			isRequesting,
			requestAnalysis,
			lastError,
		}),
		[targetUrl, recentAudits, recentAuditsLoading, isRequesting, requestAnalysis, lastError],
	);

	return <IntelligenceContext.Provider value={value}>{children}</IntelligenceContext.Provider>;
}

export function useIntelligence(): IntelligenceContextValue {
	const ctx = useContext(IntelligenceContext);
	if (!ctx) throw new Error('useIntelligence must be used within an IntelligenceProvider');
	return ctx;
}
