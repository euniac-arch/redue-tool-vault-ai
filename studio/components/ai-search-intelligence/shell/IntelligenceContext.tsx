'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuditHistory } from '@/lib/audit/use-audit-history';
import { clearAsiToolSnapshots } from '@/lib/ai-search-intelligence/asi-bound-url';
import { composeAsiIaContext, type AsiToolContext } from '@/lib/ai-search-intelligence/ia/context';
import { normalizeAsiSiteUrl } from '@/lib/ai-search-intelligence/normalize-site-url';
import {
	ASI_BASE,
	iaEntryIdFromPath,
	type AsiIaEntryId,
} from '@/lib/ai-search-intelligence/routes';
import {
	BATCH_TOOL_TOTAL,
	entriesForJob,
	jobForEntry,
	runBatchToolAnalysis,
	runSingleToolAnalysis as executeSingleTool,
	toolsCompletedByEntry,
} from '@/lib/ai-search-intelligence/client/run-global-analysis';
import {
	createEmptyModules,
	emptySubModuleState,
	type SubModuleState,
} from '@/lib/ai-search-intelligence/client/module-state';
import {
	getSiteIntelligenceContext,
	loadMatchingAuditPayload,
} from '@/lib/ai-search-intelligence/target/client';
import type { AsiTargetContext } from '@/lib/ai-search-intelligence/target/client';

export const ASI_SITE_INPUT_ID = 'asi-control-bar-url';
export const ASI_SITE_BAR_ID = 'asi-site-input-anchor';
export const ASI_NEED_SITE_MESSAGE = '상단에서 분석할 사이트를 먼저 지정해주세요';
export const ASI_DEFAULT_DETAIL_HREF = '/intelligence/query-generator';
export const ASI_DEFAULT_TOOL_ID: AsiIaEntryId = 'questions';

export type GlobalAnalysisStatus = 'idle' | 'analyzing' | 'completed';

export type IntelligenceRecentAudit = {
	id: string;
	url: string;
	label: string;
	createdAt: string;
};

export type IntelligenceToolResults = Record<AsiIaEntryId, AsiToolContext>;

type IntelligenceContextValue = {
	targetUrl: string;
	setTargetUrl: (url: string) => void;
	recentAudits: IntelligenceRecentAudit[];
	recentAuditsLoading: boolean;
	isRequesting: boolean;
	globalAnalysisStatus: GlobalAnalysisStatus;
	analysisProgress: { done: number; total: number };
	toolResults: IntelligenceToolResults | null;
	currentSiteContext: AsiTargetContext | null;
	currentSite: AsiTargetContext | null;
	selectedToolId: AsiIaEntryId;
	activeTab: AsiIaEntryId;
	setSelectedToolId: (id: AsiIaEntryId) => void;
	modules: Record<AsiIaEntryId, SubModuleState>;
	refreshingEntryIds: readonly AsiIaEntryId[];
	analysisEpoch: number;
	isBatchRunning: boolean;
	requestAnalysis: (url?: string) => string | null;
	initiateAnalysis: (url: string) => void;
	analyzeSingleModule: (moduleId: AsiIaEntryId, url?: string) => Promise<void>;
	runSingleToolAnalysis: (moduleId?: AsiIaEntryId) => Promise<void>;
	reportModuleStatus: (moduleId: AsiIaEntryId, patch: Partial<SubModuleState>) => void;
	reanalyzeTool: (entryId: AsiIaEntryId) => void;
	lastError: string | null;
	focusSiteInput: () => void;
	requireTargetUrl: () => string | null;
};

const IntelligenceContext = createContext<IntelligenceContextValue | null>(null);

function hostLabel(url: string): string {
	try {
		return new URL(url).hostname.replace(/^www\./, '');
	} catch {
		return url;
	}
}

function readToolResults(siteUrl?: string | null): IntelligenceToolResults {
	return composeAsiIaContext(siteUrl);
}

function hasCompletedResults(results: IntelligenceToolResults | null): boolean {
	if (!results) return false;
	return Object.values(results).some((row) => row.status !== 'empty' || row.score != null);
}

function isIntelligenceHub(pathname: string | null | undefined): boolean {
	const path = (pathname || '').replace(/\/+$/, '') || ASI_BASE;
	return path === ASI_BASE;
}

export function IntelligenceProvider({ children }: { children: ReactNode }) {
	const router = useRouter();
	const pathname = usePathname();
	const [targetUrl, setTargetUrlState] = useState<string>('');
	const [globalAnalysisStatus, setGlobalAnalysisStatus] = useState<GlobalAnalysisStatus>('idle');
	const [analysisProgress, setAnalysisProgress] = useState({ done: 0, total: BATCH_TOOL_TOTAL });
	const [isBatchRunning, setIsBatchRunning] = useState(false);
	const [toolResults, setToolResults] = useState<IntelligenceToolResults | null>(null);
	const [selectedToolId, setSelectedToolId] = useState<AsiIaEntryId>(ASI_DEFAULT_TOOL_ID);
	const [modules, setModules] = useState<Record<AsiIaEntryId, SubModuleState>>(createEmptyModules);
	const [refreshingEntryIds, setRefreshingEntryIds] = useState<AsiIaEntryId[]>([]);
	const [analysisEpoch, setAnalysisEpoch] = useState(0);
	const [lastError, setLastError] = useState<string | null>(null);
	const [hash, setHash] = useState('');
	const inFlightRef = useRef<Set<AsiIaEntryId>>(new Set());
	const currentSiteRef = useRef<AsiTargetContext | null>(null);
	const boundSiteRef = useRef('');

	const setTargetUrl = useCallback((url: string) => {
		setTargetUrlState(url);
		setLastError(null);
	}, []);
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

	const currentSiteContext = useMemo(() => {
		const url = normalizeAsiSiteUrl(targetUrl);
		if (!url) return null;
		return getSiteIntelligenceContext({ url, audit: loadMatchingAuditPayload(url) });
	}, [targetUrl, analysisEpoch]);
	currentSiteRef.current = currentSiteContext;

	useEffect(() => {
		const next = currentSiteContext?.siteUrl ?? '';
		if (next === boundSiteRef.current) return;
		boundSiteRef.current = next;
		setModules((prev) => {
			if (!next) return createEmptyModules();
			const reset = createEmptyModules();
			for (const id of Object.keys(prev) as AsiIaEntryId[]) {
				const row = prev[id];
				if (row?.lastAnalyzedUrl && row.lastAnalyzedUrl === next) reset[id] = row;
			}
			return reset;
		});
		setAnalysisEpoch((value) => value + 1);
	}, [currentSiteContext?.siteUrl]);

	useEffect(() => {
		const sync = () => setHash(typeof window !== 'undefined' ? window.location.hash || '' : '');
		sync();
		window.addEventListener('hashchange', sync);
		return () => window.removeEventListener('hashchange', sync);
	}, [pathname]);

	useEffect(() => {
		setSelectedToolId(iaEntryIdFromPath(pathname || '', hash));
	}, [pathname, hash]);

	useEffect(() => {
		const url = normalizeAsiSiteUrl(targetUrl);
		const current = readToolResults(url);
		setToolResults(current);
		setGlobalAnalysisStatus((prev) => {
			if (modules[selectedToolId]?.isLoading) return 'analyzing';
			if (hasCompletedResults(current)) return 'completed';
			if (prev === 'analyzing') return prev;
			return 'idle';
		});
	}, [targetUrl, analysisEpoch, modules, selectedToolId]);

	const focusSiteInput = useCallback(() => {
		setLastError(ASI_NEED_SITE_MESSAGE);
		if (typeof document === 'undefined') return;
		const bar = document.getElementById(ASI_SITE_BAR_ID);
		const input = document.getElementById(ASI_SITE_INPUT_ID) as HTMLInputElement | null;
		bar?.scrollIntoView({ behavior: 'smooth', block: 'center' });
		window.setTimeout(() => input?.focus({ preventScroll: true }), 280);
	}, []);

	const requireTargetUrl = useCallback((): string | null => {
		const normalized = normalizeAsiSiteUrl(targetUrl);
		if (!normalized) {
			focusSiteInput();
			return null;
		}
		setLastError(null);
		return normalized;
	}, [focusSiteInput, targetUrl]);

	const patchRelatedModules = useCallback((moduleId: AsiIaEntryId, patch: Partial<SubModuleState>) => {
		const related = entriesForJob(jobForEntry(moduleId));
		setModules((prev) => {
			const next = { ...prev };
			for (const id of related) {
				next[id] = { ...emptySubModuleState(), ...prev[id], ...patch };
			}
			return next;
		});
		return related;
	}, []);

	const reportModuleStatus = useCallback(
		(moduleId: AsiIaEntryId, patch: Partial<SubModuleState>) => {
			patchRelatedModules(moduleId, patch);
			if (patch.isLoading) {
				setGlobalAnalysisStatus('analyzing');
				setAnalysisProgress({ done: 0, total: 1 });
				return;
			}
			setAnalysisProgress({ done: 1, total: 1 });
			setGlobalAnalysisStatus(patch.error ? 'idle' : 'completed');
			setToolResults(readToolResults(normalizeAsiSiteUrl(targetUrl)));
		},
		[patchRelatedModules, targetUrl],
	);

	const runSingleToolAnalysis = useCallback(
		async (moduleId?: AsiIaEntryId) => {
			const site = currentSiteRef.current;
			if (!site) {
				focusSiteInput();
				return;
			}
			const entryId = moduleId ?? selectedToolId;
			if (inFlightRef.current.has(entryId)) return;
			const related = entriesForJob(jobForEntry(entryId));
			related.forEach((id) => inFlightRef.current.add(id));
			setRefreshingEntryIds(related);
			patchRelatedModules(entryId, { isLoading: true, error: null });
			setLastError(null);
			try {
				const result = await executeSingleTool(site, entryId);
				patchRelatedModules(entryId, {
					isLoading: false,
					data: result.ok ? true : null,
					error: result.ok ? null : '이 모듈 분석을 완료하지 못했습니다. 잠시 후 다시 시도해주세요.',
					lastAnalyzedUrl: result.ok ? site.siteUrl : undefined,
				});
				setToolResults(readToolResults(site.siteUrl));
				setAnalysisEpoch((value) => value + 1);
				if (!result.ok) {
					setLastError('이 모듈 분석을 완료하지 못했습니다. 잠시 후 다시 시도해주세요.');
					return;
				}
				setGlobalAnalysisStatus('completed');
			} catch {
				patchRelatedModules(entryId, {
					isLoading: false,
					error: '이 모듈 분석을 완료하지 못했습니다. 잠시 후 다시 시도해주세요.',
				});
				setLastError('이 모듈 분석을 완료하지 못했습니다. 잠시 후 다시 시도해주세요.');
			} finally {
				related.forEach((id) => inFlightRef.current.delete(id));
				setRefreshingEntryIds((prev) => prev.filter((id) => !related.includes(id)));
			}
		},
		[focusSiteInput, patchRelatedModules, selectedToolId],
	);

	const analyzeSingleModule = useCallback(
		async (moduleId: AsiIaEntryId) => {
			await runSingleToolAnalysis(moduleId);
		},
		[runSingleToolAnalysis],
	);

	const requestAnalysis = useCallback(
		(url?: string) => {
			const candidate = (url ?? targetUrl).trim();
			const normalized = normalizeAsiSiteUrl(candidate);
			if (!normalized) {
				setLastError('분석할 사이트 URL을 입력하거나 이력에서 선택해주세요.');
				return null;
			}
			const site = getSiteIntelligenceContext({ url: normalized, audit: loadMatchingAuditPayload(normalized) });
			if (!site) {
				setLastError('분석할 사이트 URL을 입력하거나 이력에서 선택해주세요.');
				return null;
			}
			clearAsiToolSnapshots();
			setModules(createEmptyModules());
			setLastError(null);
			setTargetUrl(normalized);
			currentSiteRef.current = site;
			boundSiteRef.current = site.siteUrl;
			const active = isIntelligenceHub(pathname) ? ASI_DEFAULT_TOOL_ID : iaEntryIdFromPath(pathname || '', hash);
			setSelectedToolId(active);
			setIsBatchRunning(true);
			setGlobalAnalysisStatus('analyzing');
			setAnalysisProgress({ done: 0, total: BATCH_TOOL_TOTAL });
			setAnalysisEpoch((value) => value + 1);
			if (isIntelligenceHub(pathname)) {
				router.push(ASI_DEFAULT_DETAIL_HREF);
			}
			void runBatchToolAnalysis(site, {
				onProgress: (done, total, entryId) => {
					setAnalysisProgress({ done, total });
					for (const id of toolsCompletedByEntry(entryId)) {
						patchRelatedModules(id, {
							isLoading: false,
							data: true,
							error: null,
							lastAnalyzedUrl: site.siteUrl,
						});
					}
					setToolResults(readToolResults(site.siteUrl));
					setAnalysisEpoch((value) => value + 1);
				},
			})
				.then((result) => {
					setIsBatchRunning(false);
					if (result.okCount === 0) {
						setLastError('일괄 진단을 완료하지 못했습니다. 개별 도구에서 다시 시도해주세요.');
						setGlobalAnalysisStatus('idle');
						return;
					}
					setGlobalAnalysisStatus('completed');
				})
				.catch(() => {
					setIsBatchRunning(false);
					setLastError('일괄 진단을 완료하지 못했습니다. 개별 도구에서 다시 시도해주세요.');
					setGlobalAnalysisStatus('idle');
				});
			return normalized;
		},
		[hash, patchRelatedModules, pathname, router, targetUrl],
	);

	const initiateAnalysis = useCallback(
		(url: string) => {
			requestAnalysis(url);
		},
		[requestAnalysis],
	);

	const reanalyzeTool = useCallback(
		(entryId: AsiIaEntryId) => {
			void runSingleToolAnalysis(entryId);
		},
		[runSingleToolAnalysis],
	);

	const isRequesting = isBatchRunning;

	const value = useMemo<IntelligenceContextValue>(
		() => ({
			targetUrl,
			setTargetUrl,
			recentAudits,
			recentAuditsLoading,
			isRequesting,
			globalAnalysisStatus,
			analysisProgress,
			toolResults,
			currentSiteContext,
			currentSite: currentSiteContext,
			selectedToolId,
			activeTab: selectedToolId,
			setSelectedToolId,
			modules,
			refreshingEntryIds,
			analysisEpoch,
			isBatchRunning,
			requestAnalysis,
			initiateAnalysis,
			analyzeSingleModule,
			runSingleToolAnalysis,
			reportModuleStatus,
			reanalyzeTool,
			lastError,
			focusSiteInput,
			requireTargetUrl,
		}),
		[
			targetUrl,
			setTargetUrl,
			recentAudits,
			recentAuditsLoading,
			isRequesting,
			globalAnalysisStatus,
			analysisProgress,
			toolResults,
			currentSiteContext,
			selectedToolId,
			modules,
			refreshingEntryIds,
			analysisEpoch,
			isBatchRunning,
			requestAnalysis,
			initiateAnalysis,
			analyzeSingleModule,
			runSingleToolAnalysis,
			reportModuleStatus,
			reanalyzeTool,
			lastError,
			focusSiteInput,
			requireTargetUrl,
		],
	);

	return <IntelligenceContext.Provider value={value}>{children}</IntelligenceContext.Provider>;
}

export function useIntelligence(): IntelligenceContextValue {
	const ctx = useContext(IntelligenceContext);
	if (!ctx) throw new Error('useIntelligence must be used within an IntelligenceProvider');
	return ctx;
}

export function useIntelligenceOptional(): IntelligenceContextValue | null {
	return useContext(IntelligenceContext);
}

export function useSiteIntelligenceContext(): AsiTargetContext | null {
	return useIntelligence().currentSiteContext;
}
