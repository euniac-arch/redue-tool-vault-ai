'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
	Bomb,
	ChevronLeft,
	ChevronRight,
	Download,
	FileSpreadsheet,
	Loader2,
	Trash2,
	Upload,
	Zap,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
	CRAWL_COUNTRY_OPTIONS,
	CRAWL_INDUSTRY_LABELS,
	DEFAULT_CRAWL_COUNTRY,
	DEFAULT_CRAWL_INDUSTRY,
	DEFAULT_CRAWL_REGION,
	DEFAULT_CRAWL_TARGET_TAG,
	loadTaxonomyDefaults,
	saveTaxonomyDefaults,
	type CrawlCountryCode,
	type CrawlIndustryCode,
} from '@/lib/crawling/taxonomy';
import type { DiscoveredTarget } from '@/lib/crawling/target-discovery';
import {
	clearTargetHistory,
	loadTargetHistory,
	mergeTargetHistory,
	saveTargetHistory,
	TARGET_PAGE_SIZE_OPTIONS,
	type TargetPageSize,
} from '@/lib/crawling/target-history';
import {
	enqueueCrawlTransfers,
	loadImportedCrawlRecords,
	metricsFromScanData,
	upsertImportedCrawlRecords,
	validateCrawlTransferUrl,
	type CrawlTransferItem,
	type ImportedCrawlListRecord,
} from '@/lib/crawling/transfer-queue';
import type {
	HybridCrawlScanData,
	HybridCrawlScanResponse,
	TargetFinderResponse,
} from '@/lib/crawling/types';

type SetupTab = 'discover' | 'excel';
type CollectLimit = 10 | 20 | 50;

const LIMIT_OPTIONS: CollectLimit[] = [10, 20, 50];

function buildPageNumbers(currentPage: number, totalPages: number): number[] {
	if (totalPages <= 7) {
		return Array.from({ length: totalPages }, (_, i) => i + 1);
	}
	const pages = new Set<number>([1, totalPages, currentPage]);
	for (let d = 1; d <= 2; d++) {
		if (currentPage - d >= 1) pages.add(currentPage - d);
		if (currentPage + d <= totalPages) pages.add(currentPage + d);
	}
	return Array.from(pages).sort((a, b) => a - b);
}

function selectClassName() {
	return 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800';
}

function formatTimestampForFilename(date: Date) {
	const pad = (n: number) => String(n).padStart(2, '0');
	return (
		`${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
		`_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
	);
}

function hostnameAsSiteName(url: string): string {
	try {
		return new URL(url).hostname.replace(/^www\./i, '');
	} catch {
		return url;
	}
}

function parseUrlsFromWorkbook(data: ArrayBuffer): string[] {
	const workbook = XLSX.read(data, { type: 'array' });
	const sheetName = workbook.SheetNames[0];
	if (!sheetName) return [];
	const sheet = workbook.Sheets[sheetName];
	const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
		defval: '',
		raw: false,
	});

	const urls: string[] = [];
	const seen = new Set<string>();

	for (const row of rows) {
		const entries = Object.entries(row);
		let candidate = '';
		for (const [key, value] of entries) {
			const text = String(value ?? '').trim();
			if (!text) continue;
			const keyLower = key.toLowerCase();
			if (
				keyLower.includes('url') ||
				keyLower.includes('링크') ||
				keyLower.includes('사이트') ||
				/^https?:\/\//i.test(text)
			) {
				candidate = text;
				if (keyLower.includes('url') || /^https?:\/\//i.test(text)) break;
			}
		}
		if (!candidate) {
			const first = String(Object.values(row)[0] ?? '').trim();
			candidate = first;
		}
		const normalized = validateCrawlTransferUrl(candidate);
		if (!normalized) continue;
		const key = normalized.replace(/\/$/, '').toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		urls.push(normalized);
	}

	return urls;
}

export function CrawlingSetupWorkspace() {
	const router = useRouter();
	const fileInputRef = useRef<HTMLInputElement>(null);

	const [tab, setTab] = useState<SetupTab>('discover');
	const [toast, setToast] = useState<string | null>(null);

	const [country, setCountry] = useState<CrawlCountryCode>(DEFAULT_CRAWL_COUNTRY);
	const [region, setRegion] = useState(DEFAULT_CRAWL_REGION);
	const [category, setCategory] = useState<CrawlIndustryCode>(DEFAULT_CRAWL_INDUSTRY);
	const [keyword, setKeyword] = useState('');
	const [limit, setLimit] = useState<CollectLimit>(20);
	const [placesFirst, setPlacesFirst] = useState(false);

	const [singleUrl, setSingleUrl] = useState('');
	const [singleRunning, setSingleRunning] = useState(false);
	const [discovering, setDiscovering] = useState(false);
	const [transferring, setTransferring] = useState(false);

	const [targets, setTargets] = useState<DiscoveredTarget[]>([]);
	const [targetsHydrated, setTargetsHydrated] = useState(false);
	const [selected, setSelected] = useState<Set<string>>(new Set());
	const [pageSize, setPageSize] = useState<TargetPageSize>(20);
	const [currentPage, setCurrentPage] = useState(1);
	const [deleteAllOpen, setDeleteAllOpen] = useState(false);

	const [dragOver, setDragOver] = useState(false);
	const [excelFileName, setExcelFileName] = useState<string | null>(null);
	const [excelUrls, setExcelUrls] = useState<string[]>([]);
	const [excelParsing, setExcelParsing] = useState(false);
	const [excelTransferring, setExcelTransferring] = useState(false);

	const totalPages = Math.max(1, Math.ceil(targets.length / pageSize));
	const paginatedTargets = useMemo(
		() => targets.slice((currentPage - 1) * pageSize, currentPage * pageSize),
		[targets, currentPage, pageSize],
	);
	const pageIds = useMemo(() => paginatedTargets.map((t) => t.id), [paginatedTargets]);
	const allPageSelected =
		pageIds.length > 0 && pageIds.every((id) => selected.has(id));
	const pageNumbers = useMemo(
		() => buildPageNumbers(currentPage, totalPages),
		[currentPage, totalPages],
	);

	useEffect(() => {
		const defaults = loadTaxonomyDefaults();
		setCountry(defaults.country);
		setRegion(defaults.region);
		setCategory(defaults.category);
		setTargets(loadTargetHistory());
		setSelected(new Set());
		setTargetsHydrated(true);
	}, []);

	useEffect(() => {
		if (!targetsHydrated) return;
		saveTargetHistory(targets);
	}, [targets, targetsHydrated]);

	useEffect(() => {
		if (currentPage > totalPages) setCurrentPage(totalPages);
	}, [currentPage, totalPages]);

	useEffect(() => {
		setSelected(new Set());
	}, [currentPage, pageSize]);

	useEffect(() => {
		if (!toast) return;
		const t = window.setTimeout(() => setToast(null), 3200);
		return () => window.clearTimeout(t);
	}, [toast]);

	function persistTaxonomy() {
		saveTaxonomyDefaults({
			country,
			region,
			category,
			targetTag: DEFAULT_CRAWL_TARGET_TAG,
		});
	}

	function transferAndNavigate(
		items: CrawlTransferItem[],
		successMessage: string,
		options?: { autoScan?: boolean },
	) {
		const autoScan = options?.autoScan ?? true;
		const result = enqueueCrawlTransfers(items, { autoScan });
		if (result.ok === 0) {
			setToast('유효한 URL이 없어 이관할 수 없습니다. URL 형식을 확인해 주세요.');
			return false;
		}
		persistTaxonomy();

		const stamped = (() => {
			const d = new Date();
			const pad = (n: number) => String(n).padStart(2, '0');
			return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
		})();
		const existing = loadImportedCrawlRecords();
		let nextNo = Math.max(2000, ...existing.map((r) => r.no), 0);
		const stamp = Date.now().toString(36);
		const rows: ImportedCrawlListRecord[] = items
			.map((item) => validateCrawlTransferUrl(item.url))
			.filter((url): url is string => Boolean(url))
			.map((url, index) => {
				const item = items.find((i) => validateCrawlTransferUrl(i.url) === url) ?? items[index];
				nextNo += 1;
				const scan = item?.scanResult;
				const metrics = scan ? metricsFromScanData(scan) : null;
				const pendingScan = autoScan && !metrics;
				return {
					id: `cr-import-${stamp}-${index}`,
					no: nextNo,
					siteName: metrics?.siteName || item?.siteName?.trim() || hostnameAsSiteName(url),
					menuPath: metrics
						? '이관 > 정밀 스캔 완료'
						: pendingScan
							? '이관 > 정밀 스캔 진행 중'
							: '이관 > 정밀 진단 대기',
					title: `${metrics?.siteName || item?.siteName?.trim() || hostnameAsSiteName(url)} 정밀 진단`,
					url,
					crawledAt: metrics ? formatIsoLocal(metrics.crawledAt) : stamped,
					status: (metrics?.status ?? 'warning') as ImportedCrawlListRecord['status'],
					country: item?.country ?? country,
					region: item?.region ?? region,
					category: item?.category ?? category,
					targetTag: item?.targetTag ?? DEFAULT_CRAWL_TARGET_TAG,
					snippet: metrics?.snippet ?? (pendingScan ? '[ 🔄 진단 중... ]' : '설정 페이지에서 이관됨 — 하이브리드 정밀 스캔 대기'),
					auditPhase: 'PENDING' as const,
					cms: metrics?.cms ?? (pendingScan ? '스캔 중...' : undefined),
					ttfbMs: metrics?.ttfbMs,
					hasViewport: metrics?.hasViewport,
					isIndexable: metrics?.isIndexable,
					seoScore: metrics?.seoScore ?? (pendingScan ? 0 : undefined),
					psiUsed: metrics?.psiUsed,
					description: metrics?.description,
					scanning: pendingScan,
					scanLifecycle: metrics ? 'COMPLETED' : pendingScan ? 'SCANNING' : 'IDLE',
				};
			});
		upsertImportedCrawlRecords(rows);

		const skipHint = result.skipped > 0 ? ` (건너뜀 ${result.skipped})` : '';
		setToast(
			pendingAutoScanMessage(autoScan, successMessage, result.ok, skipHint),
		);
		router.push('/admin/crawling/list');
		return true;
	}

	function pendingAutoScanMessage(
		autoScan: boolean,
		successMessage: string,
		ok: number,
		skipHint: string,
	) {
		if (autoScan) {
			return `${successMessage} ${ok}건${skipHint} — 즉시 정밀 스캔을 시작합니다.`;
		}
		return `${successMessage} ${ok}건${skipHint}`;
	}

	function formatIsoLocal(raw: string): string {
		const parsed = Date.parse(raw);
		if (Number.isNaN(parsed)) return raw;
		const d = new Date(parsed);
		const pad = (n: number) => String(n).padStart(2, '0');
		return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
	}

	async function handleSingleCollect(e: FormEvent) {
		e.preventDefault();
		const url = validateCrawlTransferUrl(singleUrl);
		if (!url) {
			setToast('올바른 URL을 입력해 주세요. (예: https://example.com)');
			return;
		}

		persistTaxonomy();
		setSingleRunning(true);
		try {
			const res = await fetch('/api/crawling/scan', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					targetUrl: url,
					category: CRAWL_INDUSTRY_LABELS[category],
					region,
				}),
			});
			const json = (await res.json()) as HybridCrawlScanResponse;
			const scanResult: HybridCrawlScanData | undefined =
				res.ok && 'data' in json && json.data ? json.data : undefined;
			const siteName = scanResult?.siteName || hostnameAsSiteName(url);

			transferAndNavigate(
				[
					{
						url,
						siteName,
						country,
						region,
						category,
						targetTag: DEFAULT_CRAWL_TARGET_TAG,
						source: 'single',
						scanResult,
					},
				],
				scanResult
					? '즉시 수집 완료 — 정밀 진단 리스트로 이관'
					: 'URL 검증 후 정밀 진단 리스트로 이관',
				{ autoScan: !scanResult },
			);
		} catch {
			transferAndNavigate(
				[
					{
						url,
						siteName: hostnameAsSiteName(url),
						country,
						region,
						category,
						targetTag: DEFAULT_CRAWL_TARGET_TAG,
						source: 'single',
					},
				],
				'URL 검증 후 정밀 진단 리스트로 이관',
				{ autoScan: true },
			);
		} finally {
			setSingleRunning(false);
		}
	}

	async function handleDiscover(e: FormEvent) {
		e.preventDefault();
		const trimmedKeyword = keyword.trim();
		if (!trimmedKeyword) {
			setToast('검색할 지역과 업종을 입력해 주세요.');
			return;
		}
		persistTaxonomy();
		setDiscovering(true);
		try {
			const res = await fetch('/api/crawling/target-finder', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					country,
					keyword: trimmedKeyword,
					displayCount: limit,
					...(placesFirst ? { engine: 'places' as const } : {}),
				}),
			});
			const json = (await res.json()) as TargetFinderResponse;
			if (!res.ok || !('data' in json) || !Array.isArray(json.data)) {
				const errMsg =
					('error' in json && typeof json.error === 'string' && json.error) ||
					'타겟 발굴에 실패했습니다.';
				setToast(errMsg);
				return;
			}

			const found: DiscoveredTarget[] = json.data.map((item) => ({
				id: item.id,
				siteName: item.siteName,
				url: item.url,
				region: item.region || trimmedKeyword,
				category: category,
				categoryLabel: item.category || trimmedKeyword,
				country:
					item.country && CRAWL_COUNTRY_OPTIONS.some((o) => o.value === item.country)
						? item.country
						: country,
				crawledAt: item.crawledAt,
				source: item.source,
				checkLocationNeeded: Boolean(item.checkLocationNeeded),
				parsedAddress: item.parsedAddress ?? null,
				phoneNumber: item.phoneNumber ?? null,
				googleRating: item.googleRating ?? null,
				googleReviewCount: item.googleReviewCount ?? null,
			}));

			let mergeMeta = { added: [] as DiscoveredTarget[], skipped: 0 };
			setTargets((prev) => {
				const result = mergeTargetHistory(prev, found);
				mergeMeta = { added: result.added, skipped: result.skipped };
				return result.merged;
			});
			setSelected(new Set());
			setCurrentPage(1);

			const sourceHint =
				json.isFallback || json.meta?.source === 'seed'
					? '폴백 샘플'
					: json.meta?.source === 'places'
						? '구글 플레이스'
						: json.meta?.source === 'google'
							? '구글 맞춤검색'
							: json.meta?.source === 'naver'
								? '네이버 검색'
								: '검색';
			const underfillHint =
				typeof json.meta?.requested === 'number' &&
				typeof json.meta?.returned === 'number' &&
				json.meta.returned < json.meta.requested
					? ` (요청 ${json.meta.requested}건 중 ${json.meta.returned}건)`
					: '';
			const persist = json.meta?.persistence;
			const persistHintParts: string[] = [];
			if (persist) {
				const dbSkip =
					persist.skippedExcluded + persist.skippedDiagnosed + persist.skippedContacted;
				if (dbSkip > 0) persistHintParts.push(`DB 제외 ${dbSkip}건`);
				if (persist.skippedLocation > 0) {
					persistHintParts.push(`타 지역 주소 ${persist.skippedLocation}건`);
				}
				if (persist.skippedPhone && persist.skippedPhone > 0) {
					persistHintParts.push(`전화번호 중복 ${persist.skippedPhone}건`);
				}
			}
			const persistHint = persistHintParts.length > 0 ? ` · ${persistHintParts.join(' · ')}` : '';
			if (found.length === 0) {
				setToast(
					`${sourceHint}: 자사 공식 웹사이트를 찾지 못했습니다. 검색어를 바꿔 보세요.`,
				);
			} else if (
				json.isFallback &&
				((typeof json.errorNotice === 'string' && json.errorNotice) ||
					(typeof json.message === 'string' && json.message))
			) {
				const notice =
					(typeof json.errorNotice === 'string' && json.errorNotice) ||
					(typeof json.message === 'string' && json.message) ||
					'';
				const dupHint = mergeMeta.skipped > 0 ? ` · 중복 ${mergeMeta.skipped}건 제외` : '';
				setToast(`${notice} (신규 ${mergeMeta.added.length}건${dupHint}${persistHint})`);
			} else {
				const dupHint =
					mergeMeta.skipped > 0 ? ` · 중복 도메인 ${mergeMeta.skipped}건 제외` : '';
				setToast(
					`${sourceHint}: 신규 ${mergeMeta.added.length}건 수집${dupHint}${persistHint}${underfillHint}. 선택 후 이관하세요.`,
				);
			}
		} catch {
			setToast('타겟 발굴 요청 중 오류가 발생했습니다.');
		} finally {
			setDiscovering(false);
		}
	}

	function toggleAll() {
		if (allPageSelected) {
			setSelected(new Set());
			return;
		}
		setSelected(new Set(pageIds));
	}

	function toggleOne(id: string) {
		setSelected((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	}

	async function excludeDomains(urls: string[]) {
		if (urls.length === 0) return;
		try {
			await fetch('/api/crawling/target-sites/exclude', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ urls }),
			});
		} catch {
			/* local list still updates; next crawl may re-surface until exclude succeeds */
		}
	}

	async function handleDeleteSelected() {
		if (selected.size === 0) {
			setToast('삭제할 항목을 선택해 주세요.');
			return;
		}
		const removeIds = new Set(selected);
		const removedUrls = targets.filter((item) => removeIds.has(item.id)).map((item) => item.url);
		setTargets((prev) => {
			const updated = prev.filter((item) => !removeIds.has(item.id));
			saveTargetHistory(updated);
			return updated;
		});
		setSelected(new Set());
		await excludeDomains(removedUrls);
		setToast(`선택한 ${removeIds.size}건을 제외했습니다. 이후 검색에서 재수집되지 않습니다.`);
	}

	async function confirmDeleteAll() {
		const urls = targets.map((item) => item.url);
		setTargets([]);
		setSelected(new Set());
		setCurrentPage(1);
		clearTargetHistory();
		setDeleteAllOpen(false);
		await excludeDomains(urls);
		setToast('추출된 타겟 리스트를 모두 제외했습니다. 이후 검색에서 재수집되지 않습니다.');
	}

	function handlePageSizeChange(next: TargetPageSize) {
		setSelected(new Set());
		setPageSize(next);
		setCurrentPage(1);
	}

	function handleTransferSelected() {
		const chosen = targets.filter((t) => selected.has(t.id));
		if (chosen.length === 0) {
			setToast('이관할 타겟을 선택해 주세요.');
			return;
		}
		setTransferring(true);
		try {
			transferAndNavigate(
				chosen.map((t) => ({
					url: t.url,
					siteName: t.siteName,
					country: t.country,
					region: t.region,
					category: t.category,
					targetTag: DEFAULT_CRAWL_TARGET_TAG,
					source: 'discovery' as const,
				})),
				'선택한 사이트 정밀 진단 리스트로 이관',
			);
		} finally {
			setTransferring(false);
		}
	}

	function handleExportTempExcel() {
		if (targets.length === 0) {
			setToast('저장할 타겟이 없습니다. 먼저 타겟을 검색해 주세요.');
			return;
		}
		const rows = targets.map((t, index) => ({
			번호: index + 1,
			업체명: t.siteName,
			URL: t.url,
			국가: t.country,
			검색어: t.categoryLabel || t.region,
			'지역 확인': t.checkLocationNeeded ? '필요' : '',
			'파싱 주소': t.parsedAddress || '',
			업종: t.categoryLabel || CRAWL_INDUSTRY_LABELS[t.category],
		}));
		const worksheet = XLSX.utils.json_to_sheet(rows);
		const workbook = XLSX.utils.book_new();
		XLSX.utils.book_append_sheet(workbook, worksheet, '타겟리스트');
		XLSX.writeFile(workbook, `crawl_targets_${formatTimestampForFilename(new Date())}.xlsx`);
		setToast(`타겟 리스트 ${targets.length}건 엑셀 저장을 시작했습니다.`);
	}

	function downloadTemplate() {
		const rows = [
			{ 업체명: '예시클리닉', URL: 'https://example-clinic.com/', 지역: '서울', 업종: '의료/클리닉' },
			{ 업체명: '예시몰', URL: 'https://example-shop.com/', 지역: '부산', 업종: '쇼핑몰/커머스' },
		];
		const worksheet = XLSX.utils.json_to_sheet(rows);
		const workbook = XLSX.utils.book_new();
		XLSX.utils.book_append_sheet(workbook, worksheet, '업로드양식');
		XLSX.writeFile(workbook, 'crawl_bulk_upload_template.xlsx');
		setToast('엑셀 업로드 양식 파일 다운로드를 시작했습니다.');
	}

	const ingestExcelFile = useCallback(async (file: File) => {
		const lower = file.name.toLowerCase();
		if (!lower.endsWith('.xlsx') && !lower.endsWith('.xls') && !lower.endsWith('.csv')) {
			setToast('.xlsx / .xls / .csv 파일만 업로드할 수 있습니다.');
			return;
		}
		setExcelParsing(true);
		try {
			const buffer = await file.arrayBuffer();
			const urls = parseUrlsFromWorkbook(buffer);
			setExcelFileName(file.name);
			setExcelUrls(urls);
			if (urls.length === 0) {
				setToast('파일에서 유효한 URL을 찾지 못했습니다. URL 열을 확인해 주세요.');
			} else {
				setToast(`${file.name}에서 URL ${urls.length}건을 인식했습니다.`);
			}
		} catch {
			setToast('파일을 읽는 중 오류가 발생했습니다.');
			setExcelFileName(null);
			setExcelUrls([]);
		} finally {
			setExcelParsing(false);
		}
	}, []);

	function onDrop(e: DragEvent<HTMLDivElement>) {
		e.preventDefault();
		setDragOver(false);
		const file = e.dataTransfer.files?.[0];
		if (file) void ingestExcelFile(file);
	}

	function handleExcelTransfer() {
		if (excelUrls.length === 0) {
			setToast('업로드된 파일에서 인식된 URL이 없습니다.');
			return;
		}
		setExcelTransferring(true);
		try {
			transferAndNavigate(
				excelUrls.map((url) => ({
					url,
					siteName: hostnameAsSiteName(url),
					country,
					region,
					category,
					targetTag: DEFAULT_CRAWL_TARGET_TAG,
					source: 'excel' as const,
				})),
				'파일 내 URL 일괄 이관',
			);
		} finally {
			setExcelTransferring(false);
		}
	}

	return (
		<div className="flex flex-col gap-4">
			{toast ? (
				<div
					role="status"
					className="rounded-lg border border-slate-200 bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm"
				>
					{toast}
				</div>
			) : null}

			{/* Tabs */}
			<div
				role="tablist"
				aria-label="크롤링 실행 방식"
				className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm sm:flex-row"
			>
				<button
					type="button"
					role="tab"
					aria-selected={tab === 'discover'}
					onClick={() => setTab('discover')}
					className={`flex-1 rounded-lg px-3 py-3 text-left text-sm font-semibold transition ${
						tab === 'discover'
							? 'bg-slate-900 text-white shadow-sm'
							: 'bg-transparent text-slate-700 hover:bg-slate-50'
					}`}
				>
					<span className="mr-1.5" aria-hidden>
						🔍
					</span>
					타겟 사이트 자동 발굴 &amp; 단일 수집
				</button>
				<button
					type="button"
					role="tab"
					aria-selected={tab === 'excel'}
					onClick={() => setTab('excel')}
					className={`flex-1 rounded-lg px-3 py-3 text-left text-sm font-semibold transition ${
						tab === 'excel'
							? 'bg-slate-900 text-white shadow-sm'
							: 'bg-transparent text-slate-700 hover:bg-slate-50'
					}`}
				>
					<span className="mr-1.5" aria-hidden>
						📁
					</span>
					엑셀(.xlsx) 대량 등록
				</button>
			</div>

			{tab === 'discover' ? (
				<div role="tabpanel" className="flex flex-col gap-4">
					{/* Single URL */}
					<section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
						<div className="mb-4 border-b border-slate-100 pb-3">
							<h2 className="text-base font-bold text-slate-900">단일 URL 즉시 수집</h2>
							<p className="mt-0.5 text-sm text-slate-600">
								URL을 직접 입력하면 검증 후 정밀 진단 리스트로 이관·스캔합니다.
							</p>
						</div>
						<form onSubmit={handleSingleCollect} className="flex flex-col gap-3 sm:flex-row sm:items-end">
							<label className="flex min-w-0 flex-1 flex-col gap-1.5">
								<span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
									대상 URL
								</span>
								<input
									type="url"
									value={singleUrl}
									onChange={(e) => setSingleUrl(e.target.value)}
									placeholder="https://..."
									className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 font-mono text-sm text-slate-800"
								/>
							</label>
							<button
								type="submit"
								disabled={singleRunning}
								className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
							>
								{singleRunning ? (
									<Loader2 className="h-4 w-4 animate-spin" aria-hidden />
								) : (
									<Zap className="h-4 w-4" aria-hidden />
								)}
								{singleRunning ? '[ 🔄 진단 중... ]' : '⚡ 즉시 수집'}
							</button>
						</form>
					</section>

					{/* Discovery filters — simplified: country + keyword + count */}
					<section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
						<div className="mb-4 border-b border-slate-100 pb-3">
							<h2 className="text-base font-bold text-slate-900">타겟 자동 발굴</h2>
							<p className="mt-0.5 text-sm text-slate-600">
								검색어로 네이버·구글 플레이스·맞춤검색에서 자사 공식 웹사이트를 발굴합니다.
								구글 지도(Places) 옵션은 상호·전화·평점과 연동 웹사이트를 함께 수집합니다.
							</p>
						</div>
						<form onSubmit={handleDiscover} className="flex flex-col gap-4">
							<div className="grid gap-4 sm:grid-cols-[minmax(0,180px)_minmax(0,1fr)_minmax(0,140px)]">
								<label className="flex flex-col gap-1.5">
									<span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
										국가 선택
									</span>
									<select
										value={country}
										onChange={(e) => setCountry(e.target.value as CrawlCountryCode)}
										className={selectClassName()}
									>
										{CRAWL_COUNTRY_OPTIONS.map((opt) => (
											<option key={opt.value} value={opt.value}>
												{opt.flag} {opt.label}
											</option>
										))}
									</select>
								</label>
								<label className="flex flex-col gap-1.5">
									<span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
										통합 검색어
									</span>
									<input
										type="text"
										value={keyword}
										onChange={(e) => setKeyword(e.target.value)}
										placeholder="검색할 지역과 업종을 입력하세요 (예: 부산 사하구 피부과, 서울 강남구 치과)"
										required
										className={selectClassName()}
									/>
								</label>
								<label className="flex flex-col gap-1.5">
									<span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
										수집 개수
									</span>
									<select
										value={limit}
										onChange={(e) => setLimit(Number(e.target.value) as CollectLimit)}
										className={selectClassName()}
									>
										{LIMIT_OPTIONS.map((n) => (
											<option key={n} value={n}>
												{n}개
											</option>
										))}
									</select>
								</label>
							</div>
							<div className="flex flex-wrap items-center gap-4">
								<label className="inline-flex items-center gap-2 text-sm text-slate-700">
									<input
										type="checkbox"
										checked={placesFirst}
										onChange={(e) => setPlacesFirst(e.target.checked)}
										className="h-4 w-4 rounded border-slate-300 text-sky-700"
									/>
									Google 지도(Places)로 수집
								</label>
								<button
									type="submit"
									disabled={discovering}
									className="inline-flex items-center gap-2 rounded-lg bg-sky-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-60"
								>
									{discovering ? (
										<Loader2 className="h-4 w-4 animate-spin" aria-hidden />
									) : (
										<Zap className="h-4 w-4" aria-hidden />
									)}
									{discovering ? '발굴 중…' : '⚡ 타겟 발굴'}
								</button>
							</div>
						</form>
					</section>

					{/* Results table */}
					<section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
						<div className="flex flex-col gap-2 border-b border-slate-200 bg-slate-50/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
							<div>
								<h2 className="text-sm font-bold text-slate-900">
									추출된 타겟 리스트 ({targets.length}개)
								</h2>
								<p className="text-xs text-slate-500">
									{targets.length > 0
										? `${targets.length}건 · 선택 ${selected.size}건 · 페이지 ${currentPage}/${totalPages}`
										: '검색 결과가 여기에 누적 저장됩니다.'}
								</p>
							</div>
							<div className="flex flex-wrap gap-2">
								<button
									type="button"
									disabled={selected.size === 0 || transferring}
									onClick={handleTransferSelected}
									className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
								>
									{transferring ? (
										<Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
									) : (
										<span aria-hidden>⚡</span>
									)}
									{transferring ? '[ 🔄 진단 중... ]' : '선택한 사이트 정밀 진단 리스트로 이관'}
								</button>
								<button
									type="button"
									disabled={targets.length === 0}
									onClick={handleExportTempExcel}
									className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-40"
								>
									<span aria-hidden>📊</span>
									타겟 리스트 엑셀 저장
								</button>
							</div>
						</div>

						{/* Action bar: delete + page size */}
						<div className="flex flex-col gap-2 border-b border-slate-100 bg-white px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
							<div className="flex flex-wrap items-center gap-2">
								<button
									type="button"
									disabled={selected.size === 0}
									onClick={handleDeleteSelected}
									className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-40"
								>
									<Trash2 className="h-3.5 w-3.5" aria-hidden />
									선택 삭제 ({selected.size})
								</button>
								<button
									type="button"
									disabled={targets.length === 0}
									onClick={() => setDeleteAllOpen(true)}
									className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-slate-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
								>
									<Bomb className="h-3.5 w-3.5" aria-hidden />
									전체 삭제
								</button>
							</div>
							<label className="inline-flex items-center gap-2 text-xs text-slate-600">
								<span className="font-medium">보기 개수</span>
								<select
									value={pageSize}
									onChange={(e) =>
										handlePageSizeChange(Number(e.target.value) as TargetPageSize)
									}
									className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800"
								>
									{TARGET_PAGE_SIZE_OPTIONS.map((n) => (
										<option key={n} value={n}>
											{n}개씩 보기
										</option>
									))}
								</select>
							</label>
						</div>

						<div className="overflow-x-auto">
							<table className="w-full min-w-[720px] border-collapse text-left text-sm">
								<thead>
									<tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-500">
										<th className="w-12 px-3 py-3">
											<input
												type="checkbox"
												checked={allPageSelected}
												onChange={toggleAll}
												disabled={paginatedTargets.length === 0}
												aria-label="현재 페이지 전체 선택"
												className="h-4 w-4 accent-slate-900"
											/>
										</th>
										<th className="px-3 py-3">업체명</th>
										<th className="px-3 py-3">URL</th>
										<th className="whitespace-nowrap px-3 py-3">국가</th>
										<th className="min-w-[140px] px-3 py-3">검색어</th>
									</tr>
								</thead>
								<tbody>
									{targets.length === 0 ? (
										<tr>
											<td colSpan={5} className="px-4 py-14 text-center text-sm text-slate-500">
												수집된 타겟 데이터가 없습니다. 위에서{' '}
												<span className="font-semibold text-slate-700">[타겟 발굴]</span>으로
												사이트를 발굴해 보세요.
											</td>
										</tr>
									) : (
										paginatedTargets.map((row) => {
											const checked = selected.has(row.id);
											return (
												<tr
													key={row.id}
													className={`border-b border-slate-100 ${checked ? 'bg-slate-50' : 'hover:bg-slate-50/70'}`}
												>
													<td className="px-3 py-3">
														<input
															type="checkbox"
															checked={checked}
															onChange={() => toggleOne(row.id)}
															aria-label={`${row.siteName} 선택`}
															className="h-4 w-4 accent-slate-900"
														/>
													</td>
													<td className="max-w-[180px] px-3 py-3">
														<p className="truncate font-semibold text-slate-900">{row.siteName}</p>
														{row.checkLocationNeeded ? (
															<span
																className="mt-1 inline-flex items-center rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 ring-1 ring-amber-200"
																title={row.parsedAddress || '주소 파싱 실패 — 관리자 확인 필요'}
															>
																지역 확인 필요
															</span>
														) : null}
													</td>
													<td className="max-w-[280px] px-3 py-3">
														<a
															href={row.url}
															target="_blank"
															rel="noopener noreferrer"
															className="block truncate font-mono text-xs text-sky-700 underline-offset-2 hover:underline"
														>
															{row.url}
														</a>
													</td>
													<td className="whitespace-nowrap px-3 py-3 text-slate-700">
														{row.country}
													</td>
													<td className="max-w-[200px] px-3 py-3 text-slate-700">
														<span className="line-clamp-2">
															{row.categoryLabel || row.region || '—'}
														</span>
													</td>
												</tr>
											);
										})
									)}
								</tbody>
							</table>
						</div>

						{targets.length > 0 ? (
							<div className="flex flex-col items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 sm:flex-row">
								<p className="text-xs text-slate-500">
									{(currentPage - 1) * pageSize + 1}–
									{Math.min(currentPage * pageSize, targets.length)} / 전체 {targets.length}건
								</p>
								<nav
									aria-label="타겟 리스트 페이지"
									className="flex flex-wrap items-center justify-center gap-1"
								>
									<button
										type="button"
										onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
										disabled={currentPage <= 1}
										className="inline-flex items-center gap-0.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
										aria-label="이전 페이지"
									>
										<ChevronLeft className="h-3.5 w-3.5" aria-hidden />
										이전
									</button>
									{pageNumbers.map((page, index) => {
										const prev = pageNumbers[index - 1];
										const showEllipsis = prev != null && page - prev > 1;
										return (
											<span key={page} className="inline-flex items-center gap-1">
												{showEllipsis ? (
													<span className="px-1 text-xs text-slate-400" aria-hidden>
														…
													</span>
												) : null}
												<button
													type="button"
													onClick={() => setCurrentPage(page)}
													aria-current={page === currentPage ? 'page' : undefined}
													className={`min-w-[2rem] rounded-lg px-2 py-1.5 text-xs font-semibold ${
														page === currentPage
															? 'bg-slate-900 text-white'
															: 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
													}`}
												>
													{page}
												</button>
											</span>
										);
									})}
									<button
										type="button"
										onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
										disabled={currentPage >= totalPages}
										className="inline-flex items-center gap-0.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
										aria-label="다음 페이지"
									>
										다음
										<ChevronRight className="h-3.5 w-3.5" aria-hidden />
									</button>
								</nav>
							</div>
						) : null}
					</section>
				</div>
			) : (
				<div role="tabpanel" className="flex flex-col gap-4">
					<section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
						<div className="mb-4 flex flex-col gap-3 border-b border-slate-100 pb-3 sm:flex-row sm:items-end sm:justify-between">
							<div>
								<h2 className="text-base font-bold text-slate-900">엑셀 대량 업로드</h2>
								<p className="mt-0.5 text-sm text-slate-600">
									.xlsx / .csv 파일의 URL을 검증한 뒤 정밀 진단 리스트로 일괄 이관합니다.
								</p>
							</div>
							<button
								type="button"
								onClick={downloadTemplate}
								className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
							>
								<Download className="h-4 w-4" aria-hidden />
								📥 엑셀 업로드 양식 파일 다운로드
							</button>
						</div>

						<div
							onDragOver={(e) => {
								e.preventDefault();
								setDragOver(true);
							}}
							onDragLeave={() => setDragOver(false)}
							onDrop={onDrop}
							className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-12 text-center transition ${
								dragOver
									? 'border-sky-400 bg-sky-50'
									: 'border-slate-300 bg-slate-50/60'
							}`}
						>
							{excelParsing ? (
								<Loader2 className="mb-3 h-8 w-8 animate-spin text-slate-500" aria-hidden />
							) : (
								<Upload className="mb-3 h-8 w-8 text-slate-400" aria-hidden />
							)}
							<p className="text-sm font-semibold text-slate-800">
								파일을 여기에 드래그 앤 드롭하세요
							</p>
							<p className="mt-1 text-xs text-slate-500">또는 클릭하여 .xlsx / .csv 선택</p>
							<button
								type="button"
								onClick={() => fileInputRef.current?.click()}
								disabled={excelParsing}
								className="mt-4 inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
							>
								<FileSpreadsheet className="h-4 w-4" aria-hidden />
								파일 선택
							</button>
							<input
								ref={fileInputRef}
								type="file"
								accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
								className="hidden"
								onChange={(e) => {
									const file = e.target.files?.[0];
									if (file) void ingestExcelFile(file);
									e.target.value = '';
								}}
							/>
							{excelFileName ? (
								<p className="mt-4 text-xs font-medium text-slate-600">
									선택됨: {excelFileName}
									{excelUrls.length > 0 ? ` · 인식 URL ${excelUrls.length}건` : ''}
								</p>
							) : null}
						</div>

						{excelUrls.length > 0 ? (
							<div className="mt-4 max-h-40 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
								<ul className="space-y-1 font-mono text-[11px] text-slate-600">
									{excelUrls.slice(0, 30).map((url) => (
										<li key={url} className="truncate">
											{url}
										</li>
									))}
									{excelUrls.length > 30 ? (
										<li className="text-slate-400">…외 {excelUrls.length - 30}건</li>
									) : null}
								</ul>
							</div>
						) : null}

						<div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
							<button
								type="button"
								disabled={excelUrls.length === 0 || excelTransferring}
								onClick={handleExcelTransfer}
								className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
							>
								{excelTransferring ? (
									<Loader2 className="h-4 w-4 animate-spin" aria-hidden />
								) : (
									<span aria-hidden>🚀</span>
								)}
								{excelTransferring ? '[ 🔄 진단 중... ]' : '파일 내 URL 일괄 이관 및 스캔'}
							</button>
						</div>
					</section>
				</div>
			)}

			{deleteAllOpen ? (
				<div
					className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
					role="dialog"
					aria-modal="true"
					aria-labelledby="target-delete-all-title"
					onClick={() => setDeleteAllOpen(false)}
				>
					<div
						className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl"
						onClick={(e) => e.stopPropagation()}
					>
						<h3 id="target-delete-all-title" className="text-base font-bold text-slate-900">
							추출된 타겟 전체 삭제
						</h3>
						<p className="mt-2 text-sm leading-relaxed text-slate-600">
							리스트에서 제거하고 해당 도메인을 재수집 제외(EXCLUDED)로 표시합니다.
							<br />
							현재 {targets.length}건이 비워지며, DB 레코드는 삭제되지 않습니다.
						</p>
						<div className="mt-5 flex justify-end gap-2">
							<button
								type="button"
								onClick={() => setDeleteAllOpen(false)}
								className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
							>
								취소
							</button>
							<button
								type="button"
								onClick={confirmDeleteAll}
								className="rounded-lg bg-rose-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-rose-700"
							>
								전체 삭제
							</button>
						</div>
					</div>
				</div>
			) : null}
		</div>
	);
}
