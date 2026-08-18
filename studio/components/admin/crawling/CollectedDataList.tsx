'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ExternalLink, FileText, Loader2, Mail, MoreVertical, RefreshCw, Trash2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { EmailPreviewModal } from '@/components/EmailPreviewModal';
import {
	CRAWL_COUNTRY_OPTIONS,
	CRAWL_INDUSTRY_LABELS,
	DEFAULT_CRAWL_TARGET_TAG,
	formatCountryRegionBadge,
	getIndustryLabel,
	getTargetTagLabel,
	loadTaxonomyDefaults,
	regionsForCountry,
	type CrawlCountryCode,
	type CrawlIndustryCode,
	type CrawlTargetTagCode,
} from '@/lib/crawling/taxonomy';
import {
	clearCrawlTransferQueue,
	clearImportedCrawlRecords,
	loadImportedCrawlRecords,
	metricsFromScanData,
	patchImportedCrawlRecord,
	peekCrawlTransferQueue,
	saveImportedCrawlRecords,
	upsertImportedCrawlRecords,
	urlKey,
	validateCrawlTransferUrl,
	type ImportedCrawlListRecord,
} from '@/lib/crawling/transfer-queue';
import { extractRootDomain } from '@/lib/crawling/domain';
import type {
	CrawlCollectStatus,
	HybridCrawlScanResponse,
	TargetRefreshResponse,
	TargetSiteListItem,
	TargetSitesLookupResponse,
} from '@/lib/crawling/types';

type CrawlToastState = {
	message: string;
	actionHref?: string;
	actionLabel?: string;
};

type SheetsExportApiResponse = {
	success?: boolean;
	spreadsheetId?: string;
	spreadsheetUrl?: string;
	fileId?: string;
	rowCount?: number;
	error?: string;
	details?: string;
	code?: string;
};

function GoogleSheetsIcon({ className }: { className?: string }) {
	return (
		<svg
			className={className}
			viewBox="0 0 24 24"
			aria-hidden
			focusable="false"
		>
			<path
				fill="#0F9D58"
				d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"
			/>
			<path fill="#87CEAC" d="M14 2v6h6" />
			<path fill="#FFF" d="M8 12h8v1.5H8zm0 3h8v1.5H8zm0 3h5V19.5H8z" />
		</svg>
	);
}

function normalizeToast(toast: CrawlToastState | string | null): CrawlToastState | null {
	if (!toast) return null;
	if (typeof toast === 'string') return { message: toast };
	return toast;
}

type CrawlStatus = CrawlCollectStatus;

/** SEO/GEO 진단 진행 상태 (크롤 수집 상태와 별개) */
type AuditPhase = 'PENDING' | 'RUNNING' | 'DONE';

type ScheduleCadence = 'daily' | 'weekly' | 'monthly' | 'off';

/** 리스트 UI용 확장 레코드 — CrawledSiteItem + 관리 필드 */
interface CrawlRecord {
	id: string;
	no: number;
	siteName: string;
	menuPath: string;
	title: string;
	url: string;
	crawledAt: string;
	status: CrawlStatus;
	country: CrawlCountryCode;
	region: string;
	category: CrawlIndustryCode;
	targetTag: CrawlTargetTagCode;
	snippet: string;
	errorMessage?: string;
	auditPhase: AuditPhase;
	cms?: string;
	ttfbMs?: number;
	hasViewport?: boolean;
	isIndexable?: boolean;
	seoScore?: number;
	psiUsed?: boolean;
	description?: string;
	/** True while /api/crawling/scan is in flight for this row */
	scanning?: boolean;
	/** Transfer → auto-scan lifecycle (SCANNING / COMPLETED / FAILED) */
	scanLifecycle?: 'IDLE' | 'SCANNING' | 'COMPLETED' | 'FAILED';
	domain?: string;
	targetSiteId?: string;
	email?: string | null;
	contactFormUrl?: string | null;
	phoneNumber?: string | null;
	address?: string | null;
	kakaoChannelUrl?: string | null;
	instagramUrl?: string | null;
	naverTalkUrl?: string | null;
	googleRating?: number | null;
	googleReviewCount?: number | null;
	lastScrapedAt?: string | null;
	targetStatus?: 'PENDING' | 'DIAGNOSED' | 'CONTACTED' | 'EXCLUDED';
	auditLeadId?: string | null;
	checkLocationNeeded?: boolean;
	parsedAddress?: string | null;
}

const CATEGORY_FILTER_LABELS: Record<CrawlIndustryCode | 'ALL', string> = {
	ALL: '전체 업종',
	...CRAWL_INDUSTRY_LABELS,
};

const COUNTRY_FILTER_LABELS: Record<CrawlCountryCode | 'ALL', string> = {
	ALL: '전체 국가',
	KR: '🇰🇷 대한민국',
	US: '🇺🇸 미국',
	JP: '🇯🇵 일본',
	GLOBAL: '🌐 기타/해외',
};

const STATUS_LABELS: Record<CrawlStatus | 'ALL', string> = {
	ALL: '전체 상태',
	success: '성공',
	warning: '경고',
	failed: '실패',
};

const SCHEDULE_OPTIONS: { value: ScheduleCadence; label: string }[] = [
	{ value: 'daily', label: '매일 00시' },
	{ value: 'weekly', label: '매주 월요일' },
	{ value: 'monthly', label: '매월 1일' },
	{ value: 'off', label: '사용 안 함' },
];

const SCHEDULE_STORAGE_KEY = 'admin.crawling.scheduleCadence';
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;

/** Prevent React Strict Mode double-mount from starting duplicate transfer scans */
let activeTransferScanQueuedAt: string | null = null;

function formatTimestampForFilename(date: Date) {
	const pad = (n: number) => String(n).padStart(2, '0');
	return (
		`${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
		`_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
	);
}

function formatLocalDateTime(date: Date) {
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function formatCrawledAt(raw: string): string {
	const parsed = Date.parse(raw);
	if (Number.isNaN(parsed)) return raw;
	return formatLocalDateTime(new Date(parsed));
}

function crawledAtLines(crawledAt: string) {
	const [date, time] = crawledAt.split(' ');
	if (!time) return { date: crawledAt, time: null as string | null };
	return { date, time };
}

function crawledAtCell(crawledAt: string) {
	const { date, time } = crawledAtLines(crawledAt);
	return (
		<div className="flex flex-col items-center justify-center text-center leading-tight">
			<span>{date}</span>
			{time ? <span>{time}</span> : null}
		</div>
	);
}

function hostnameAsSiteName(url: string): string {
	try {
		return new URL(url).hostname.replace(/^www\./i, '');
	} catch {
		return url;
	}
}

function domainOf(row: Pick<CrawlRecord, 'domain' | 'url'>): string {
	return row.domain || extractRootDomain(row.url) || hostnameAsSiteName(row.url);
}

function diagnoseHref(row: CrawlRecord): string {
	const params = new URLSearchParams();
	params.set('domain', domainOf(row));
	const targetId = row.targetSiteId || '';
	if (targetId) params.set('target_id', targetId);
	params.set('forceRefresh', 'true');
	params.set('t', String(Date.now()));
	return `/diagnose?${params.toString()}`;
}

function a4ReportHref(row: CrawlRecord): string {
	if (row.auditLeadId) return `/audit/result?id=${encodeURIComponent(row.auditLeadId)}`;
	return `/audit/result?url=${encodeURIComponent(row.url)}`;
}

function isDiagnosed(row: CrawlRecord): boolean {
	return row.targetStatus === 'DIAGNOSED' || row.auditPhase === 'DONE';
}

function mergeTargetSiteFields(row: CrawlRecord, site: TargetSiteListItem): CrawlRecord {
	return {
		...row,
		domain: site.domain,
		targetSiteId: site.id,
		email: site.email,
		contactFormUrl: site.contact_form_url,
		phoneNumber: site.phone_number,
		address: site.address,
		kakaoChannelUrl: site.kakao_channel_url,
		instagramUrl: site.instagram_url,
		naverTalkUrl: site.naver_talk_url,
		googleRating: site.google_rating,
		googleReviewCount: site.google_review_count,
		lastScrapedAt: site.last_scraped_at,
		targetStatus: site.status,
		auditLeadId: site.audit_lead_id || row.auditLeadId,
		auditPhase: site.status === 'DIAGNOSED' ? 'DONE' : row.auditPhase,
		checkLocationNeeded: site.check_location_needed,
		parsedAddress: site.parsed_address || site.address,
	};
}

function contactCell(row: CrawlRecord) {
	const email = row.email?.trim();
	const phone = row.phoneNumber?.trim();
	if (email) {
		return (
			<div className="flex max-w-[180px] flex-col gap-0.5">
				<a
					href={`mailto:${email}`}
					className="inline-flex items-center gap-1 truncate text-xs font-medium text-sky-700 underline-offset-2 hover:underline"
					title={email}
				>
					<Mail className="h-3 w-3 shrink-0" aria-hidden />
					{email}
				</a>
				{phone ? (
					<a
						href={`tel:${phone}`}
						className="truncate text-[11px] text-slate-500 underline-offset-2 hover:underline"
						title={phone}
					>
						{phone}
					</a>
				) : null}
			</div>
		);
	}
	if (phone) {
		return (
			<a
				href={`tel:${phone}`}
				className="inline-flex max-w-[180px] items-center gap-1 truncate text-xs font-medium text-sky-700 underline-offset-2 hover:underline"
				title={phone}
			>
				{phone}
			</a>
		);
	}
	const formUrl = row.contactFormUrl?.trim();
	if (formUrl) {
		return (
			<a
				href={formUrl}
				target="_blank"
				rel="noopener noreferrer"
				className="inline-flex max-w-[180px] items-center gap-1 truncate text-xs font-medium text-indigo-700 underline-offset-2 hover:underline"
				title={formUrl}
			>
				<ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
				문의 폼
			</a>
		);
	}
	return <span className="text-xs text-slate-400">미수집</span>;
}

function metricsCells(row: CrawlRecord) {
	if (row.scanning) {
		return (
			<span className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-700">
				<Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
				[ 🔄 진단 중... ]
			</span>
		);
	}
	if (row.cms == null && row.seoScore == null && row.ttfbMs == null) {
		return <span className="text-xs text-slate-400">—</span>;
	}
	return (
		<div className="flex flex-col gap-0.5 text-[11px] leading-snug text-slate-600">
			<span className="font-semibold text-slate-800">{row.cms ?? 'CMS 미확인'}</span>
			<span className="tabular-nums">
				SEO {row.seoScore ?? '—'} · TTFB {row.ttfbMs != null ? `${row.ttfbMs}ms` : '—'}
			</span>
			<span>
				Viewport {row.hasViewport == null ? '—' : row.hasViewport ? 'OK' : '없음'}
				{row.isIndexable != null ? ` · 색인 ${row.isIndexable ? '허용' : '차단'}` : ''}
			</span>
		</div>
	);
}

/** Persistable list rows only — never seed mock/demo targets. */
function recordsFromStorage(): CrawlRecord[] {
	if (typeof window === 'undefined') return [];
	return loadImportedCrawlRecords().map((row) => ({
		...row,
		scanning: Boolean(row.scanning || row.scanLifecycle === 'SCANNING'),
		// RUNNING is only in-flight UI; remount restores PENDING unless already diagnosed.
		auditPhase:
			row.targetStatus === 'DIAGNOSED' || row.auditPhase === 'DONE' ? 'DONE' : 'PENDING',
	}));
}

function persistCollectedRecords(next: CrawlRecord[]) {
	if (next.length === 0) {
		clearImportedCrawlRecords();
		return;
	}
	saveImportedCrawlRecords(next.map((r) => r as ImportedCrawlListRecord));
}

function statusBadge(status: CrawlStatus) {
	if (status === 'success') {
		return (
			<span
				className="inline-flex items-center justify-center"
				title="성공"
				aria-label="성공"
			>
				<span aria-hidden>🟢</span>
			</span>
		);
	}
	if (status === 'warning') {
		return (
			<span className="inline-flex items-center gap-1 whitespace-nowrap rounded-md bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-800 ring-1 ring-amber-200">
				<span aria-hidden>🟡</span> 경고
			</span>
		);
	}
	return (
		<span className="inline-flex items-center gap-1 whitespace-nowrap rounded-md bg-rose-50 px-2 py-1 text-[11px] font-bold text-rose-700 ring-1 ring-rose-200">
			<span aria-hidden>🔴</span> 실패
		</span>
	);
}

function geoBadge(country: CrawlCountryCode, region: string, checkLocationNeeded?: boolean) {
	return (
		<div className="flex flex-col items-start gap-1">
			<span className="inline-flex max-w-full items-center truncate rounded-md bg-sky-50 px-2 py-1 text-[11px] font-bold text-sky-800 ring-1 ring-sky-200">
				{formatCountryRegionBadge(country, region)}
			</span>
			{checkLocationNeeded ? (
				<span className="inline-flex items-center rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 ring-1 ring-amber-200">
					지역 확인 필요
				</span>
			) : null}
		</div>
	);
}

function industryBadge(category: CrawlIndustryCode) {
	return (
		<span className="inline-flex max-w-full items-center truncate rounded-md bg-violet-50 px-2 py-1 text-[11px] font-bold text-violet-800 ring-1 ring-violet-200">
			{CRAWL_INDUSTRY_LABELS[category]}
		</span>
	);
}

function formatCount(n: number) {
	return n.toLocaleString('ko-KR');
}

function buildPageNumbers(current: number, total: number): number[] {
	if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);
	const start = Math.max(1, Math.min(current - 2, total - 4));
	return Array.from({ length: 5 }, (_, i) => start + i);
}

function escapeHtml(value: string) {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

function buildAuditSummaryHtml(item: CrawlRecord) {
	return `
		<div style="font-family:Pretendard,Apple SD Gothic Neo,sans-serif;padding:24px;width:640px;background:#fff;color:#0f172a;">
			<p style="margin:0 0 8px;font-size:12px;font-weight:700;color:#64748b;letter-spacing:.06em;">REDUE SEO / GEO 진단 요약</p>
			<h1 style="margin:0 0 12px;font-size:22px;font-weight:800;">${escapeHtml(item.title)}</h1>
			<p style="margin:0 0 6px;font-size:14px;"><strong>사이트</strong> ${escapeHtml(item.siteName)}</p>
			<p style="margin:0 0 6px;font-size:13px;word-break:break-all;"><strong>URL</strong> ${escapeHtml(item.url)}</p>
			<p style="margin:0 0 6px;font-size:13px;"><strong>수집 일시</strong> ${escapeHtml(item.crawledAt)}</p>
			<p style="margin:0 0 6px;font-size:13px;"><strong>국가/지역</strong> ${escapeHtml(formatCountryRegionBadge(item.country, item.region))}</p>
			<p style="margin:0 0 6px;font-size:13px;"><strong>업종</strong> ${escapeHtml(getIndustryLabel(item.category))}</p>
			<p style="margin:0 0 6px;font-size:13px;"><strong>수집 목적</strong> ${escapeHtml(getTargetTagLabel(item.targetTag))}</p>
			<p style="margin:0 0 6px;font-size:13px;"><strong>크롤 상태</strong> ${escapeHtml(STATUS_LABELS[item.status])}</p>
			<p style="margin:12px 0 0;font-size:13px;line-height:1.5;color:#334155;">${escapeHtml(item.snippet)}</p>
			${item.errorMessage ? `<p style="margin:10px 0 0;font-size:12px;color:#be123c;">오류: ${escapeHtml(item.errorMessage)}</p>` : ''}
		</div>
	`;
}

async function downloadAuditPdf(item: CrawlRecord) {
	const html2canvas = (await import('html2canvas')).default;
	const { jsPDF } = await import('jspdf');

	const disposable = document.createElement('div');
	disposable.style.cssText = 'position:fixed;left:-9999px;top:0;z-index:-1;';
	disposable.innerHTML = buildAuditSummaryHtml(item);
	document.body.appendChild(disposable);
	const target = disposable.firstElementChild as HTMLElement;

	try {
		const canvas = await html2canvas(target, {
			backgroundColor: '#ffffff',
			scale: 2,
			useCORS: true,
			allowTaint: false,
			logging: false,
			foreignObjectRendering: false,
		});
		const img = canvas.toDataURL('image/jpeg', 0.92);
		const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
		const pageWidth = pdf.internal.pageSize.getWidth();
		const pageHeight = pdf.internal.pageSize.getHeight();
		const margin = 36;
		const maxWidth = pageWidth - margin * 2;
		const maxHeight = pageHeight - margin * 2;
		const ratio = Math.min(maxWidth / canvas.width, maxHeight / canvas.height);
		const drawWidth = canvas.width * ratio;
		const drawHeight = canvas.height * ratio;
		pdf.addImage(img, 'JPEG', margin, margin, drawWidth, drawHeight);
		pdf.save(`audit_report_${item.no}_${formatTimestampForFilename(new Date())}.pdf`);
	} finally {
		disposable.remove();
	}
}

async function downloadAuditPng(item: CrawlRecord, captureEl?: HTMLElement | null) {
	const html2canvas = (await import('html2canvas')).default;
	let target = captureEl ?? null;
	let disposable: HTMLDivElement | null = null;

	if (!target) {
		disposable = document.createElement('div');
		disposable.style.cssText = 'position:fixed;left:-9999px;top:0;z-index:-1;';
		disposable.innerHTML = buildAuditSummaryHtml(item);
		document.body.appendChild(disposable);
		target = disposable.firstElementChild as HTMLElement;
	}

	try {
		const canvas = await html2canvas(target, {
			backgroundColor: '#ffffff',
			scale: 2,
			useCORS: true,
			allowTaint: false,
			logging: false,
			foreignObjectRendering: false,
		});
		const link = document.createElement('a');
		link.download = `audit_report_${item.no}_${formatTimestampForFilename(new Date())}.png`;
		link.href = canvas.toDataURL('image/png');
		link.click();
	} finally {
		disposable?.remove();
	}
}

function CrawlRowActions({
	item,
	menuOpen,
	refreshing,
	onToggleMenu,
	onCloseMenu,
	onRefresh,
	onStartAudit,
	onOpenResult,
	onOpenEmail,
	onDownloadPdf,
	onDownloadPng,
	onDelete,
}: {
	item: CrawlRecord;
	menuOpen: boolean;
	refreshing: boolean;
	onToggleMenu: () => void;
	onCloseMenu: () => void;
	onRefresh: () => void;
	onStartAudit: () => void;
	onOpenResult: () => void;
	onOpenEmail: () => void;
	onDownloadPdf: () => void;
	onDownloadPng: () => void;
	onDelete: () => void;
}) {
	const menuRef = useRef<HTMLDivElement>(null);
	const diagnosed = isDiagnosed(item);

	useEffect(() => {
		if (!menuOpen) return;
		function onDoc(e: MouseEvent) {
			if (!menuRef.current?.contains(e.target as Node)) onCloseMenu();
		}
		function onKey(e: KeyboardEvent) {
			if (e.key === 'Escape') onCloseMenu();
		}
		document.addEventListener('mousedown', onDoc);
		document.addEventListener('keydown', onKey);
		return () => {
			document.removeEventListener('mousedown', onDoc);
			document.removeEventListener('keydown', onKey);
		};
	}, [menuOpen, onCloseMenu]);

	const refreshButton = (
		<button
			type="button"
			onClick={onRefresh}
			disabled={refreshing}
			title="이메일·문의처 정보를 다시 수집합니다"
			className="inline-flex items-center whitespace-nowrap rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"
		>
			재수집
		</button>
	);

	if (item.auditPhase === 'RUNNING' && !diagnosed) {
		return (
			<div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
				{refreshButton}
				<button
					type="button"
					disabled
					className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700"
				>
					<Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
					진단 중...
				</button>
			</div>
		);
	}

	if (diagnosed) {
		return (
			<div className="relative flex items-center justify-end gap-1.5 whitespace-nowrap" ref={menuRef}>
				{refreshButton}
				<Link
					href={a4ReportHref(item)}
					target="_blank"
					rel="noopener noreferrer"
					className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 transition-colors hover:bg-emerald-100"
				>
					<FileText className="h-3.5 w-3.5" aria-hidden />
					A4 리포트 보기
				</Link>
				<button
					type="button"
					onClick={onOpenResult}
					className="inline-flex items-center gap-1 rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1.5 text-xs font-semibold text-sky-700 transition-colors hover:bg-sky-100"
				>
					<span aria-hidden>📄</span> 진단결과
				</button>

				<button
					type="button"
					onClick={onToggleMenu}
					aria-expanded={menuOpen}
					aria-haspopup="menu"
					aria-label="더보기 메뉴"
					className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-800"
				>
					<MoreVertical className="h-4 w-4" aria-hidden />
				</button>

				{menuOpen ? (
					<div
						role="menu"
						className="absolute right-0 top-full z-30 mt-1.5 w-52 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 text-xs shadow-lg"
					>
						<button
							type="button"
							role="menuitem"
							onClick={() => {
								onCloseMenu();
								onStartAudit();
							}}
							className="flex w-full items-center gap-2 px-3 py-2 text-left font-medium text-slate-700 hover:bg-slate-50"
						>
							⚡ 정밀 진단 다시 실행
						</button>
						<button
							type="button"
							role="menuitem"
							onClick={() => {
								onCloseMenu();
								onOpenEmail();
							}}
							className="flex w-full items-center gap-2 px-3 py-2 text-left font-medium text-slate-700 hover:bg-slate-50"
						>
							✉️ 이메일 미리보기/발송
						</button>
						<button
							type="button"
							role="menuitem"
							onClick={() => {
								onCloseMenu();
								onDownloadPdf();
							}}
							className="flex w-full items-center gap-2 px-3 py-2 text-left font-medium text-slate-700 hover:bg-slate-50"
						>
							📄 PDF 보고서 다운로드
						</button>
						<button
							type="button"
							role="menuitem"
							onClick={() => {
								onCloseMenu();
								onDownloadPng();
							}}
							className="flex w-full items-center gap-2 px-3 py-2 text-left font-medium text-slate-700 hover:bg-slate-50"
						>
							🖼️ 이미지(PNG) 다운로드
						</button>
						<div className="my-1 border-t border-slate-100" />
						<button
							type="button"
							role="menuitem"
							onClick={() => {
								onCloseMenu();
								onDelete();
							}}
							className="flex w-full items-center gap-2 px-3 py-2 text-left font-medium text-rose-700 hover:bg-rose-50"
						>
							🗑️ 휴지통으로 이동
						</button>
					</div>
				) : null}
			</div>
		);
	}

	return (
		<div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
			{refreshButton}
			<button
				type="button"
				onClick={onStartAudit}
				className="inline-flex items-center whitespace-nowrap rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-700"
			>
				정밀진단
			</button>
		</div>
	);
}

export function CollectedDataList() {
	/** false until client mount — prevents localStorage-driven hydration mismatch */
	const [isMounted, setIsMounted] = useState(false);
	const [records, setRecords] = useState<CrawlRecord[]>([]);
	const router = useRouter();
	const [refreshingIds, setRefreshingIds] = useState<Set<string>>(new Set());
	const [country, setCountry] = useState<CrawlCountryCode | 'ALL'>('ALL');
	const [region, setRegion] = useState<string>('ALL');
	const [category, setCategory] = useState<CrawlIndustryCode | 'ALL'>('ALL');
	const [status, setStatus] = useState<CrawlStatus | 'ALL'>('ALL');
	const [locationReviewOnly, setLocationReviewOnly] = useState(false);
	const [searchInput, setSearchInput] = useState('');
	const [query, setQuery] = useState('');
	const [pageSize, setPageSize] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(10);
	const [page, setPage] = useState(1);
	const [selected, setSelected] = useState<Set<string>>(new Set());
	const [detailId, setDetailId] = useState<string | null>(null);
	const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
	const [emailTarget, setEmailTarget] = useState<CrawlRecord | null>(null);
	const [exportBusy, setExportBusy] = useState<'pdf' | 'png' | null>(null);
	const [crawlToast, setCrawlToast] = useState<CrawlToastState | string | null>(null);
	const [exportingSheets, setExportingSheets] = useState(false);
	const [runningCrawl, setRunningCrawl] = useState(false);
	const [manualUrl, setManualUrl] = useState('');
	const [scheduleCadence, setScheduleCadence] = useState<ScheduleCadence>('daily');
	const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
	const [taxonomyDefaults, setTaxonomyDefaults] = useState(() => ({
		country: 'KR' as CrawlCountryCode,
		region: '전국',
		category: 'OTHER' as CrawlIndustryCode,
		targetTag: 'NEW_PROSPECT' as CrawlTargetTagCode,
	}));
	const auditModalBodyRef = useRef<HTMLDivElement>(null);

	const regionFilterOptions = useMemo(() => {
		if (country === 'ALL') {
			const all = new Set<string>();
			for (const opt of CRAWL_COUNTRY_OPTIONS) {
				for (const r of regionsForCountry(opt.value)) all.add(r);
			}
			return ['ALL', ...Array.from(all)];
		}
		return ['ALL', ...regionsForCountry(country)];
	}, [country]);

	useEffect(() => {
		try {
			const saved = window.localStorage.getItem(SCHEDULE_STORAGE_KEY) as ScheduleCadence | null;
			if (saved && SCHEDULE_OPTIONS.some((opt) => opt.value === saved)) {
				setScheduleCadence(saved);
			}
			setTaxonomyDefaults(loadTaxonomyDefaults());
		} catch {
			/* ignore storage errors */
		}
	}, []);

	/** setup 페이지에서 이관된 URL을 받아 리스트에 반영하고 즉시 정밀 스캔 실행 */
	useEffect(() => {
		// Client-only: load localStorage after mount so SSR/hydration HTML stays empty & stable
		setIsMounted(true);
		try {
			setRecords(recordsFromStorage());
		} catch (e) {
			console.error('Failed to parse localStorage crawl records:', e);
			setRecords([]);
		}
		setSelected(new Set());

		const payload = peekCrawlTransferQueue();
		if (!payload) return;

		const needsApiScan = payload.autoScan && payload.items.some((item) => !item.scanResult);
		const hasPrefetch = payload.items.some((item) => Boolean(item.scanResult));

		if (!payload.autoScan && !hasPrefetch) {
			clearCrawlTransferQueue();
			setCrawlToast(`이관 ${payload.items.length}건을 정밀 진단 리스트에 추가했습니다.`);
			setPage(1);
			return;
		}

		if (activeTransferScanQueuedAt === payload.queuedAt) return;
		activeTransferScanQueuedAt = payload.queuedAt;

		const defaults = loadTaxonomyDefaults();
		setCrawlToast(
			needsApiScan
				? `이관 ${payload.items.length}건을 정밀 진단 리스트에 추가했습니다. 즉시 정밀 스캔을 시작합니다.`
				: `이관 ${payload.items.length}건의 실측 결과를 리스트에 반영합니다.`,
		);
		setPage(1);
		if (needsApiScan) {
			setRunningCrawl(true);
			// Register all pending rows as SCANNING before the sequential async loop.
			const pendingKeys = new Set(
				payload.items.filter((item) => !item.scanResult).map((item) => urlKey(item.url)),
			);
			setRecords((prev) =>
				prev.map((row) =>
					pendingKeys.has(urlKey(row.url))
						? {
								...row,
								scanning: true,
								scanLifecycle: 'SCANNING',
								cms: row.cms || '스캔 중...',
								seoScore: row.seoScore ?? 0,
								snippet: '[ 🔄 진단 중... ]',
								menuPath: '이관 > 정밀 스캔 진행 중',
							}
						: row,
				),
			);
			for (const item of payload.items) {
				if (item.scanResult) continue;
				patchImportedCrawlRecord(item.url, {
					scanning: true,
					scanLifecycle: 'SCANNING',
					cms: '스캔 중...',
					seoScore: 0,
					snippet: '[ 🔄 진단 중... ]',
					menuPath: '이관 > 정밀 스캔 진행 중',
				});
			}
		}

		void (async () => {
			let ok = 0;
			let fail = 0;

			for (const item of payload.items) {
				const key = urlKey(item.url);

				if (item.scanResult) {
					ok += 1;
					const metrics = metricsFromScanData(item.scanResult);
					const patch = {
						siteName: metrics.siteName || item.siteName || item.url,
						title: `${metrics.siteName || item.siteName || '이관 대상'} 정밀 진단`,
						status: metrics.status,
						snippet: metrics.snippet,
						crawledAt: formatCrawledAt(metrics.crawledAt),
						errorMessage: undefined as string | undefined,
						menuPath: '이관 > 정밀 스캔 완료',
						cms: metrics.cms,
						ttfbMs: metrics.ttfbMs,
						hasViewport: metrics.hasViewport,
						isIndexable: metrics.isIndexable,
						seoScore: metrics.seoScore,
						psiUsed: metrics.psiUsed,
						description: metrics.description,
						scanning: false,
						scanLifecycle: 'COMPLETED' as const,
					};
					patchImportedCrawlRecord(item.url, patch);
					setRecords((prev) =>
						prev.map((row) => (urlKey(row.url) === key ? { ...row, ...patch } : row)),
					);
					continue;
				}

				if (!payload.autoScan) continue;

				setRecords((prev) =>
					prev.map((row) =>
						urlKey(row.url) === key
							? {
									...row,
									scanning: true,
									scanLifecycle: 'SCANNING',
									cms: '스캔 중...',
									seoScore: row.seoScore ?? 0,
									snippet: '[ 🔄 진단 중... ]',
									menuPath: '이관 > 정밀 스캔 진행 중',
								}
							: row,
					),
				);

				try {
					const res = await fetch('/api/crawling/scan', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							targetUrl: item.url,
							category: CRAWL_INDUSTRY_LABELS[item.category ?? defaults.category],
							region: item.region ?? defaults.region,
						}),
					});
					const json = (await res.json()) as HybridCrawlScanResponse;
					if (!res.ok || !('data' in json) || !json.data) {
						fail += 1;
						const errorMessage =
							'error' in json && typeof json.error === 'string'
								? json.error
								: `HTTP ${res.status}`;
						const patch = {
							status: 'failed' as const,
							snippet: '정밀 스캔 실패',
							errorMessage,
							crawledAt: formatLocalDateTime(new Date()),
							scanning: false,
							scanLifecycle: 'FAILED' as const,
							cms: '스캔 실패',
						};
						patchImportedCrawlRecord(item.url, patch);
						setRecords((prev) =>
							prev.map((row) => (urlKey(row.url) === key ? { ...row, ...patch } : row)),
						);
						continue;
					}

					ok += 1;
					const metrics = metricsFromScanData(json.data);
					const patch = {
						siteName: metrics.siteName || item.siteName || item.url,
						title: `${metrics.siteName || item.siteName || '이관 대상'} 정밀 진단`,
						status: metrics.status,
						snippet: metrics.snippet,
						crawledAt: formatCrawledAt(metrics.crawledAt),
						errorMessage: undefined as string | undefined,
						menuPath: '이관 > 정밀 스캔 완료',
						cms: metrics.cms,
						ttfbMs: metrics.ttfbMs,
						hasViewport: metrics.hasViewport,
						isIndexable: metrics.isIndexable,
						seoScore: metrics.seoScore,
						psiUsed: metrics.psiUsed,
						description: metrics.description,
						scanning: false,
						scanLifecycle: 'COMPLETED' as const,
					};
					patchImportedCrawlRecord(item.url, patch);
					setRecords((prev) =>
						prev.map((row) =>
							urlKey(row.url) === key
								? {
										...row,
										...patch,
										siteName:
											typeof patch.siteName === 'string' ? patch.siteName : row.siteName,
									}
								: row,
						),
					);
				} catch (err) {
					fail += 1;
					const patch = {
						status: 'failed' as const,
						snippet: '정밀 스캔 중 오류',
						errorMessage: err instanceof Error ? err.message : 'Unknown error',
						crawledAt: formatLocalDateTime(new Date()),
						scanning: false,
						scanLifecycle: 'FAILED' as const,
						cms: '스캔 실패',
					};
					patchImportedCrawlRecord(item.url, patch);
					setRecords((prev) =>
						prev.map((row) => (urlKey(row.url) === key ? { ...row, ...patch } : row)),
					);
				}
			}

			clearCrawlTransferQueue();
			if (activeTransferScanQueuedAt === payload.queuedAt) {
				activeTransferScanQueuedAt = null;
			}
			setRunningCrawl(false);
			setCrawlToast(
				`정밀 스캔 완료 ${ok}/${payload.items.length}건` + (fail ? ` (실패 ${fail})` : ''),
			);
		})();
	}, []);

	const targetHydrateKey = records
		.map((row) => domainOf(row))
		.filter(Boolean)
		.sort()
		.join(',');

	useEffect(() => {
		if (!isMounted || !targetHydrateKey) return;
		void hydrateFromTargetSites(recordsFromStorage());
	}, [isMounted, targetHydrateKey]);

	useEffect(() => {
		if (region !== 'ALL' && !regionFilterOptions.includes(region)) {
			setRegion('ALL');
		}
	}, [region, regionFilterOptions]);

	const filtered = useMemo(() => {
		const q = query.trim().toLowerCase();
		return records.filter((row) => {
			if (country !== 'ALL' && row.country !== country) return false;
			if (region !== 'ALL' && row.region !== region) return false;
			if (category !== 'ALL' && row.category !== category) return false;
			if (status !== 'ALL' && row.status !== status) return false;
			if (locationReviewOnly && !row.checkLocationNeeded) return false;
			if (!q) return true;
			return (
				row.title.toLowerCase().includes(q) ||
				row.url.toLowerCase().includes(q) ||
				row.siteName.toLowerCase().includes(q) ||
				row.menuPath.toLowerCase().includes(q) ||
				row.region.toLowerCase().includes(q) ||
				getIndustryLabel(row.category).toLowerCase().includes(q) ||
				(row.email || '').toLowerCase().includes(q) ||
				(row.domain || '').toLowerCase().includes(q)
			);
		});
	}, [records, country, region, category, status, locationReviewOnly, query]);

	const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
	const safePage = Math.min(page, pageCount);
	const pageItems = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
	const rangeStart = filtered.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
	const rangeEnd = Math.min(safePage * pageSize, filtered.length);
	const allPageSelected =
		pageItems.length > 0 && pageItems.every((row) => selected.has(row.id));
	const detail = detailId ? records.find((r) => r.id === detailId) ?? null : null;

	useEffect(() => {
		setPage(1);
		setSelected(new Set());
	}, [country, region, category, status, locationReviewOnly, query, pageSize]);

	useEffect(() => {
		setSelected(new Set());
	}, [page]);

	useEffect(() => {
		if (page > pageCount) setPage(pageCount);
	}, [page, pageCount]);

	useEffect(() => {
		if (!crawlToast) return;
		const normalized = normalizeToast(crawlToast);
		const ms = normalized?.actionHref ? 12000 : 2800;
		const t = window.setTimeout(() => setCrawlToast(null), ms);
		return () => window.clearTimeout(t);
	}, [crawlToast]);

	function handleSearch(e: FormEvent) {
		e.preventDefault();
		setQuery(searchInput);
	}

	function goToPage(next: number) {
		const clamped = Math.max(1, Math.min(pageCount, next));
		if (clamped === page) return;
		setSelected(new Set());
		setPage(clamped);
	}

	function toggleAllPage() {
		if (allPageSelected) {
			setSelected(new Set());
			return;
		}
		setSelected(new Set(pageItems.map((r) => r.id)));
	}

	function toggleOne(id: string) {
		setSelected((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	}

	function deleteSelected() {
		if (selected.size === 0) return;
		if (!window.confirm(`선택한 ${selected.size}건을 영구 삭제할까요?`)) return;
		const removeIds = new Set(selected);
		setRecords((prev) => {
			const next = prev.filter((r) => !removeIds.has(r.id));
			persistCollectedRecords(next);
			return next;
		});
		const removed = selected.size;
		setSelected(new Set());
		setCrawlToast(`${removed}건이 영구 삭제되었습니다.`);
	}

	function deleteOne(id: string) {
		if (!window.confirm('이 수집 데이터를 영구 삭제할까요?')) return;
		setRecords((prev) => {
			const next = prev.filter((r) => r.id !== id);
			persistCollectedRecords(next);
			return next;
		});
		setSelected((prev) => {
			const next = new Set(prev);
			next.delete(id);
			return next;
		});
		if (detailId === id) setDetailId(null);
		if (menuOpenId === id) setMenuOpenId(null);
		setCrawlToast('1건이 영구 삭제되었습니다.');
	}

	function confirmClearAllCollected() {
		clearImportedCrawlRecords();
		clearCrawlTransferQueue();
		activeTransferScanQueuedAt = null;
		setRecords([]);
		setSelected(new Set());
		setDetailId(null);
		setMenuOpenId(null);
		setResetConfirmOpen(false);
		setPage(1);
		setCrawlToast('수집 리스트를 모두 영구 삭제했습니다.');
	}

	function startAudit(row: CrawlRecord) {
		setMenuOpenId(null);
		setRecords((prev) =>
			prev.map((r) => (r.id === row.id ? { ...r, auditPhase: 'RUNNING' as const } : r)),
		);
		patchImportedCrawlRecord(row.url, { auditPhase: 'RUNNING' });
		router.push(diagnoseHref(row));
	}

	async function hydrateFromTargetSites(rows: CrawlRecord[]) {
		const domains = Array.from(
			new Set(rows.map((row) => domainOf(row)).filter((value) => value.includes('.'))),
		);
		if (domains.length === 0) return;
		try {
			const res = await fetch(
				`/api/crawling/targets?domains=${domains.map(encodeURIComponent).join(',')}`,
				{ cache: 'no-store' },
			);
			const json = (await res.json()) as TargetSitesLookupResponse;
			if (!res.ok || !('data' in json) || !Array.isArray(json.data)) return;
			const byDomain = new Map(json.data.map((site) => [site.domain, site]));
			setRecords((prev) => {
				const next = prev.map((row) => {
					const site = byDomain.get(domainOf(row));
					return site ? mergeTargetSiteFields(row, site) : row;
				});
				persistCollectedRecords(next);
				return next;
			});
		} catch {
			/* lookup is best-effort */
		}
	}

	async function refreshContact(row: CrawlRecord) {
		if (refreshingIds.has(row.id)) return;
		setRefreshingIds((prev) => new Set(prev).add(row.id));
		try {
			let targetId = row.targetSiteId || '';
			if (!targetId) {
				const domain = domainOf(row);
				const lookup = await fetch(
					`/api/crawling/targets?domains=${encodeURIComponent(domain)}`,
					{ cache: 'no-store' },
				);
				const lookupJson = (await lookup.json()) as TargetSitesLookupResponse;
				targetId = lookup.ok && 'data' in lookupJson ? lookupJson.data[0]?.id || '' : '';
			}
			if (!targetId) {
				setCrawlToast('타깃 DB 레코드가 없습니다. 타겟 검색에서 수집된 항목만 재수집할 수 있습니다.');
				return;
			}

			const res = await fetch(`/api/crawling/targets/${encodeURIComponent(targetId)}/refresh`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id: targetId }),
			});
			const json = (await res.json()) as TargetRefreshResponse;
			if (!res.ok || !('data' in json) || !json.data) {
				const errorMessage =
					'error' in json && typeof json.error === 'string'
						? json.error
						: `재수집 실패 (HTTP ${res.status})`;
				setCrawlToast(errorMessage);
				return;
			}

			const patch: Partial<CrawlRecord> = {
				targetSiteId: json.data.id,
				domain: json.data.domain,
				email: json.data.email,
				contactFormUrl: json.data.contact_form_url,
				phoneNumber: json.data.phone_number,
				address: json.data.address,
				kakaoChannelUrl: json.data.kakao_channel_url,
				instagramUrl: json.data.instagram_url,
				naverTalkUrl: json.data.naver_talk_url,
				googleRating: json.data.google_rating,
				googleReviewCount: json.data.google_review_count,
				lastScrapedAt: json.data.last_scraped_at,
				checkLocationNeeded: json.data.check_location_needed,
				parsedAddress: json.data.parsed_address || json.data.address,
			};
			patchImportedCrawlRecord(row.url, patch);
			setRecords((prev) => prev.map((r) => (r.id === row.id ? { ...r, ...patch } : r)));
			setCrawlToast(
				json.data.email
					? `재수집 완료 · ${json.data.email}`
					: json.data.contact_form_url
						? '재수집 완료 · 문의 폼 URL을 반영했습니다.'
						: '재수집 완료 · 이메일/문의처는 아직 미수집입니다.',
			);
		} catch (err) {
			setCrawlToast(err instanceof Error ? err.message : '정보 재수집 중 오류가 발생했습니다.');
		} finally {
			setRefreshingIds((prev) => {
				const next = new Set(prev);
				next.delete(row.id);
				return next;
			});
		}
	}

	function openAuditModal(item: CrawlRecord) {
		setMenuOpenId(null);
		setDetailId(item.id);
	}

	function openEmailModal(item: CrawlRecord) {
		setMenuOpenId(null);
		setEmailTarget(item);
	}

	async function handleDownloadPdf(item: CrawlRecord) {
		if (exportBusy) return;
		setExportBusy('pdf');
		try {
			await downloadAuditPdf(item);
			setCrawlToast('PDF 보고서 다운로드를 시작했습니다.');
		} catch {
			setCrawlToast('PDF 다운로드에 실패했습니다.');
		} finally {
			setExportBusy(null);
		}
	}

	async function handleDownloadPng(item: CrawlRecord) {
		if (exportBusy) return;
		setExportBusy('png');
		try {
			const capture =
				detailId === item.id ? auditModalBodyRef.current : null;
			await downloadAuditPng(item, capture);
			setCrawlToast('이미지(PNG) 다운로드를 시작했습니다.');
		} catch {
			setCrawlToast('PNG 다운로드에 실패했습니다.');
		} finally {
			setExportBusy(null);
		}
	}

	function handleScheduleChange(next: ScheduleCadence) {
		setScheduleCadence(next);
		try {
			window.localStorage.setItem(SCHEDULE_STORAGE_KEY, next);
		} catch {
			/* ignore storage errors */
		}
		const label = SCHEDULE_OPTIONS.find((opt) => opt.value === next)?.label ?? next;
		setCrawlToast(
			next === 'off'
				? '자동 스케줄러를 사용 안 함으로 설정했습니다.'
				: `자동 수집 주기가 '${label}'(으)로 저장되었습니다.`,
		);
	}

	function downloadExcel() {
		const rows = selected.size > 0 ? filtered.filter((r) => selected.has(r.id)) : filtered;
		if (rows.length === 0) {
			window.alert('다운로드할 데이터가 없습니다.');
			return;
		}

		const excelData = rows.map((item) => ({
			번호: item.no,
			'대상 사이트': item.siteName,
			'수집 타이틀': item.title,
			'원본 URL': item.url,
			'이메일 / 문의처': item.email || item.contactFormUrl || '미수집',
			전화번호: item.phoneNumber || '',
			국가: COUNTRY_FILTER_LABELS[item.country],
			지역: item.region,
			'지역 확인': item.checkLocationNeeded ? '필요' : '',
			주소: item.address || item.parsedAddress || '',
			카카오채널: item.kakaoChannelUrl || '',
			인스타그램: item.instagramUrl || '',
			네이버톡톡: item.naverTalkUrl || '',
			업종: getIndustryLabel(item.category),
			'수집 목적': getTargetTagLabel(item.targetTag),
			CMS: item.cms ?? '',
			'SEO 점수': item.seoScore ?? '',
			'TTFB(ms)': item.ttfbMs ?? '',
			Viewport: item.hasViewport == null ? '' : item.hasViewport ? 'OK' : '없음',
			색인: item.isIndexable == null ? '' : item.isIndexable ? '허용' : '차단',
			'수집 일시': item.crawledAt,
			상태: STATUS_LABELS[item.status],
			요약: item.snippet,
		}));

		const worksheet = XLSX.utils.json_to_sheet(excelData);
		const workbook = XLSX.utils.book_new();
		XLSX.utils.book_append_sheet(workbook, worksheet, '크롤링수집목록');

		const filename = `crawling_data_${formatTimestampForFilename(new Date())}.xlsx`;
		XLSX.writeFile(workbook, filename);

		const scopeLabel = selected.size > 0 ? '선택 항목' : '전체 리스트';
		setCrawlToast(`${scopeLabel} ${rows.length}건 엑셀 다운로드를 시작했습니다.`);
	}

	async function exportToGoogleSheets() {
		if (exportingSheets) return;
		if (selected.size === 0) {
			setCrawlToast('구글 시트로 내보낼 업체를 먼저 선택해 주세요.');
			return;
		}

		const rows = filtered.filter((r) => selected.has(r.id));
		if (rows.length === 0) {
			setCrawlToast('선택한 항목이 현재 필터 결과에 없습니다. 선택을 확인해 주세요.');
			return;
		}

		setExportingSheets(true);
		try {
			const res = await fetch('/api/crawling/export-sheets', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					title: `REDUE 수집목록_${formatTimestampForFilename(new Date())}`,
					items: rows.map((item) => ({
						siteName: item.siteName,
						category: getIndustryLabel(item.category),
						telephone: item.phoneNumber || '',
						address: item.address
							|| item.parsedAddress
							|| [COUNTRY_FILTER_LABELS[item.country], item.region]
								.filter(Boolean)
								.join(' ')
								.trim(),
						website: item.url,
						crawledAt: item.crawledAt,
					})),
				}),
			});
			const json = (await res.json()) as SheetsExportApiResponse;
			if (!res.ok || !json.spreadsheetUrl) {
				const errorMessage =
					(typeof json.error === 'string' && json.error) ||
					(typeof json.details === 'string' && json.details) ||
					`구글 시트 내보내기 실패 (HTTP ${res.status})`;
				setCrawlToast(errorMessage);
				return;
			}

			setCrawlToast({
				message: `구글 시트 생성 완료 · ${json.rowCount ?? rows.length}건이 기록되었습니다.`,
				actionHref: json.spreadsheetUrl,
				actionLabel: '구글 시트 열기 ↗',
			});
		} catch (err) {
			const message = err instanceof Error ? err.message : '네트워크 오류';
			setCrawlToast(
				`구글 시트 내보내기 중 연결에 실패했습니다. 네트워크 상태를 확인해 주세요. (${message})`,
			);
		} finally {
			setExportingSheets(false);
		}
	}

	async function runManualCrawl() {
		if (runningCrawl) return;
		const url = validateCrawlTransferUrl(manualUrl);
		if (!url) {
			setCrawlToast('올바른 URL을 입력해 주세요. (예: https://example.com)');
			return;
		}

		setRunningCrawl(true);
		const stamped = formatLocalDateTime(new Date());
		const nextNo = Math.max(...records.map((r) => r.no), 1000) + 1;
		const stamp = Date.now().toString(36);
		const pendingId = `cr-manual-${stamp}`;
		const pending: CrawlRecord = {
			id: pendingId,
			no: nextNo,
			siteName: hostnameAsSiteName(url),
			menuPath: '홈 > 수동 즉시 실행',
			title: `${hostnameAsSiteName(url)} 정밀 진단`,
			url,
			crawledAt: stamped,
			status: 'warning',
			country: taxonomyDefaults.country,
			region: taxonomyDefaults.region,
			category: taxonomyDefaults.category,
			targetTag: taxonomyDefaults.targetTag,
			snippet: '[ 🔄 진단 중... ]',
			auditPhase: 'PENDING',
			scanning: true,
		};

		setRecords((prev) => [pending, ...prev]);
		setPage(1);
		upsertImportedCrawlRecords([pending as ImportedCrawlListRecord]);

		try {
			const res = await fetch('/api/crawling/scan', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					targetUrl: url,
					category: CRAWL_INDUSTRY_LABELS[taxonomyDefaults.category],
					region: taxonomyDefaults.region,
				}),
			});
			const json = (await res.json()) as HybridCrawlScanResponse;
			if (!res.ok || !('data' in json) || !json.data) {
				const errorMessage =
					'error' in json && typeof json.error === 'string' ? json.error : `HTTP ${res.status}`;
				const patch = {
					status: 'failed' as const,
					snippet: '수동 크롤링 실패',
					errorMessage,
					crawledAt: formatLocalDateTime(new Date()),
					scanning: false,
				};
				patchImportedCrawlRecord(url, patch);
				setRecords((prev) =>
					prev.map((row) => (row.id === pendingId ? { ...row, ...patch } : row)),
				);
				setCrawlToast(`수동 크롤링 실패: ${errorMessage}`);
				return;
			}

			const metrics = metricsFromScanData(json.data);
			const patch = {
				siteName: metrics.siteName,
				title: `${metrics.siteName} 정밀 진단`,
				status: metrics.status,
				snippet: metrics.snippet,
				crawledAt: formatCrawledAt(metrics.crawledAt),
				menuPath: '홈 > 수동 즉시 실행 완료',
				errorMessage: undefined as string | undefined,
				cms: metrics.cms,
				ttfbMs: metrics.ttfbMs,
				hasViewport: metrics.hasViewport,
				isIndexable: metrics.isIndexable,
				seoScore: metrics.seoScore,
				psiUsed: metrics.psiUsed,
				description: metrics.description,
				scanning: false,
			};
			patchImportedCrawlRecord(url, patch);
			setRecords((prev) =>
				prev.map((row) => (row.id === pendingId ? { ...row, ...patch } : row)),
			);
			setManualUrl('');
			setCrawlToast(
				`수동 크롤링 완료 · ${metrics.siteName} · CMS ${metrics.cms} · SEO ${metrics.seoScore}`,
			);
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : 'Unknown error';
			const patch = {
				status: 'failed' as const,
				snippet: '수동 크롤링 중 오류',
				errorMessage,
				crawledAt: formatLocalDateTime(new Date()),
				scanning: false,
			};
			patchImportedCrawlRecord(url, patch);
			setRecords((prev) =>
				prev.map((row) => (row.id === pendingId ? { ...row, ...patch } : row)),
			);
			setCrawlToast(`수동 크롤링 오류: ${errorMessage}`);
		} finally {
			setRunningCrawl(false);
		}
	}

	const pageNumbers = buildPageNumbers(safePage, pageCount);
	const excelButtonLabel =
		selected.size > 0
			? `📊 선택 항목 엑셀 추출 (${selected.size})`
			: '📊 전체 리스트 엑셀 추출 (.xlsx)';
	const sheetsButtonLabel = exportingSheets
		? '구글 시트 생성 중...'
		: selected.size > 0
			? `구글 시트로 내보내기 (${selected.size})`
			: '구글 시트로 내보내기';
	const toastView = normalizeToast(crawlToast);

	// SSR + first client paint: identical empty/loading UI (no localStorage reads yet)
	if (!isMounted) {
		return (
			<div className="flex w-full min-w-0 flex-col gap-4" aria-busy="true" aria-live="polite">
				<div className="rounded-xl border border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-500 shadow-sm">
					<span className="inline-flex items-center justify-center gap-2">
						<Loader2 className="h-4 w-4 animate-spin text-slate-400" aria-hidden />
						데이터를 불러오는 중입니다...
					</span>
				</div>
				<div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
					<div className="animate-pulse space-y-3 p-4">
						<div className="h-4 w-1/3 rounded bg-slate-100" />
						<div className="h-10 w-full rounded bg-slate-100" />
						<div className="h-10 w-full rounded bg-slate-50" />
						<div className="h-10 w-full rounded bg-slate-100" />
						<div className="h-10 w-full rounded bg-slate-50" />
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="flex w-full min-w-0 flex-col gap-4">
			{toastView ? (
				<div
					role="status"
					className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm"
				>
					<p className="min-w-0 flex-1">{toastView.message}</p>
					{toastView.actionHref ? (
						<a
							href={toastView.actionHref}
							target="_blank"
							rel="noopener noreferrer"
							className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-[#0F9D58] px-3 py-1.5 text-xs font-bold text-white transition hover:bg-[#0b7a44]"
						>
							{toastView.actionLabel || '구글 시트 열기 ↗'}
							<ExternalLink className="h-3.5 w-3.5" aria-hidden />
						</a>
					) : null}
				</div>
			) : null}

			{/* A. Header Bar */}
			<section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
				<div className="flex flex-col gap-3">
					<div className="flex flex-wrap items-end gap-2">
						<label className="flex min-w-[140px] flex-col gap-1">
							<span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
								국가
							</span>
							<select
								value={country}
								onChange={(e) => {
									setCountry(e.target.value as CrawlCountryCode | 'ALL');
									setRegion('ALL');
								}}
								className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
							>
								{(Object.keys(COUNTRY_FILTER_LABELS) as Array<CrawlCountryCode | 'ALL'>).map(
									(key) => (
										<option key={key} value={key}>
											{COUNTRY_FILTER_LABELS[key]}
										</option>
									),
								)}
							</select>
						</label>

						<label className="flex min-w-[120px] flex-col gap-1">
							<span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
								지역
							</span>
							<select
								value={region}
								onChange={(e) => setRegion(e.target.value)}
								className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
							>
								{regionFilterOptions.map((key) => (
									<option key={key} value={key}>
										{key === 'ALL' ? '전체 지역' : key}
									</option>
								))}
							</select>
						</label>

						<label className="flex min-w-[140px] flex-col gap-1">
							<span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
								업종
							</span>
							<select
								value={category}
								onChange={(e) => setCategory(e.target.value as CrawlIndustryCode | 'ALL')}
								className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
							>
								{(Object.keys(CATEGORY_FILTER_LABELS) as Array<CrawlIndustryCode | 'ALL'>).map(
									(key) => (
										<option key={key} value={key}>
											{CATEGORY_FILTER_LABELS[key]}
										</option>
									),
								)}
							</select>
						</label>

						<label className="flex min-w-[120px] flex-col gap-1">
							<span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
								상태
							</span>
							<select
								value={status}
								onChange={(e) => setStatus(e.target.value as CrawlStatus | 'ALL')}
								className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
							>
								{(Object.keys(STATUS_LABELS) as Array<CrawlStatus | 'ALL'>).map((key) => (
									<option key={key} value={key}>
										{STATUS_LABELS[key]}
									</option>
								))}
							</select>
						</label>

						<label className="flex min-w-[140px] items-end gap-2 pb-2">
							<input
								type="checkbox"
								checked={locationReviewOnly}
								onChange={(e) => setLocationReviewOnly(e.target.checked)}
								className="h-4 w-4 accent-amber-600"
							/>
							<span className="text-xs font-bold text-amber-800">지역 확인 필요만</span>
						</label>

						<label className="flex min-w-[140px] flex-col gap-1">
							<span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
								페이지 당 보기
							</span>
							<select
								value={pageSize}
								onChange={(e) =>
									setPageSize(Number(e.target.value) as (typeof PAGE_SIZE_OPTIONS)[number])
								}
								className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
							>
								{PAGE_SIZE_OPTIONS.map((n) => (
									<option key={n} value={n}>
										{n}개씩 보기
									</option>
								))}
							</select>
						</label>

						<label className="flex min-w-[200px] flex-col gap-1">
							<span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
								⏰ 자동 수집 주기
							</span>
							<select
								value={scheduleCadence}
								onChange={(e) => handleScheduleChange(e.target.value as ScheduleCadence)}
								className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
								aria-label="자동 수집 주기"
							>
								{SCHEDULE_OPTIONS.map((opt) => (
									<option key={opt.value} value={opt.value}>
										{opt.label}
									</option>
								))}
							</select>
						</label>
					</div>

					<div className="flex flex-wrap items-center justify-between gap-3 md:flex-nowrap">
						<form
							onSubmit={handleSearch}
							className="flex min-w-[220px] flex-1 items-center gap-2 sm:min-w-[280px]"
						>
							<input
								type="search"
								value={searchInput}
								onChange={(e) => setSearchInput(e.target.value)}
								placeholder="제목, URL, 사이트명, 이메일, 지역, 업종 검색"
								aria-label="통합 검색"
								className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-800"
							/>
							<button
								type="submit"
								className="h-[38px] shrink-0 whitespace-nowrap rounded-lg border border-slate-300 bg-slate-100 px-3.5 py-2 text-sm font-bold text-slate-800 hover:bg-slate-200"
							>
								검색
							</button>
						</form>

						<div className="flex shrink-0 flex-wrap items-center gap-2 md:flex-nowrap">
							<input
								type="url"
								value={manualUrl}
								onChange={(e) => setManualUrl(e.target.value)}
								placeholder="https://example.com"
								disabled={runningCrawl}
								aria-label="수동 크롤링 URL"
								className="h-[38px] min-w-[200px] rounded-lg border border-slate-200 bg-white px-3.5 py-2 font-mono text-sm text-slate-800 disabled:opacity-60 sm:w-56"
							/>

							<button
								type="button"
								disabled={runningCrawl}
								onClick={() => void runManualCrawl()}
								className="inline-flex h-[38px] items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
							>
								{runningCrawl ? (
									<Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
								) : (
									<RefreshCw className="h-4 w-4 shrink-0" aria-hidden />
								)}
								{runningCrawl ? '진단 중...' : '수동 크롤링'}
							</button>

							<button
								type="button"
								disabled={records.length === 0}
								onClick={() => setResetConfirmOpen(true)}
								className="inline-flex h-[38px] items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-40"
							>
								<Trash2 className="h-4 w-4 shrink-0" aria-hidden />
								전체 초기화
							</button>
						</div>
					</div>
				</div>
			</section>

			{/* B. Data Grid */}
			<section className="w-full min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
				<div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50/80 px-4 py-2.5">
					<div className="flex flex-wrap items-center gap-2">
						<button
							type="button"
							disabled={filtered.length === 0}
							onClick={downloadExcel}
							className="rounded-md border border-emerald-200 bg-white px-3 py-1.5 text-[11px] font-bold text-emerald-800 hover:bg-emerald-50 disabled:opacity-40"
						>
							{excelButtonLabel}
						</button>
						<button
							type="button"
							disabled={exportingSheets || filtered.length === 0}
							onClick={() => void exportToGoogleSheets()}
							className="inline-flex items-center gap-1.5 rounded-md border border-[#0F9D58]/35 bg-[#0F9D58]/10 px-3 py-1.5 text-[11px] font-bold text-[#0b7a44] transition hover:bg-[#0F9D58]/15 disabled:cursor-not-allowed disabled:opacity-40"
						>
							{exportingSheets ? (
								<Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
							) : (
								<GoogleSheetsIcon className="h-3.5 w-3.5 shrink-0" />
							)}
							{sheetsButtonLabel}
						</button>
					</div>
					<p className="text-xs font-semibold tabular-nums text-slate-500">
						필터 결과 {formatCount(filtered.length)}건
						{selected.size > 0 ? ` · 선택 ${selected.size}건` : ''}
					</p>
				</div>
				<div className="w-full min-w-0 overflow-x-auto">
					<table className="w-full min-w-[1400px] border-collapse text-left text-sm">
						<thead>
							<tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-500">
								<th className="w-12 px-3 py-3">
									<input
										type="checkbox"
										checked={allPageSelected}
										onChange={toggleAllPage}
										disabled={pageItems.length === 0}
										aria-label="현재 페이지 전체 선택"
										className="h-4 w-4 accent-slate-900"
									/>
								</th>
								<th className="whitespace-nowrap px-3 py-3">ID / No</th>
								<th className="px-3 py-3">대상 사이트 / 메뉴</th>
								<th className="px-3 py-3">수집 항목 / 타이틀</th>
								<th className="whitespace-nowrap px-3 py-3">실측 지표</th>
								<th className="whitespace-nowrap px-3 py-3">이메일 / 문의처</th>
								<th className="whitespace-nowrap px-3 py-3">국가/지역</th>
								<th className="whitespace-nowrap px-3 py-3">업종</th>
								<th className="px-3 py-3">원본 URL</th>
								<th className="whitespace-nowrap px-3 py-3 text-center">크롤링 일시</th>
								<th className="min-w-[3.5rem] whitespace-nowrap px-3 py-3 text-center">상태</th>
								<th className="whitespace-nowrap px-3 py-3 text-right">관리 / 액션</th>
							</tr>
						</thead>
						<tbody>
							{pageItems.length === 0 ? (
								<tr>
									<td colSpan={12} className="px-4 py-16 text-center text-sm text-slate-500">
										{records.length === 0 ? (
											<div className="mx-auto flex max-w-md flex-col items-center gap-3">
												<p className="leading-relaxed">
													수집된 타겟 데이터가 없습니다.{' '}
													<Link
														href="/admin/crawling/setup"
														className="font-semibold text-indigo-600 underline-offset-2 hover:underline"
													>
														[타겟 검색]
													</Link>{' '}
													메뉴에서 사이트를 발굴해 보세요.
												</p>
											</div>
										) : (
											'조건에 맞는 수집 데이터가 없습니다.'
										)}
									</td>
								</tr>
							) : (
								pageItems.map((row) => {
									const checked = selected.has(row.id);
									return (
										<tr
											key={row.id}
											className={`border-b border-slate-100 transition ${
												checked ? 'bg-slate-50' : 'hover:bg-slate-50/70'
											}`}
										>
											<td className="px-3 py-3 align-middle">
												<input
													type="checkbox"
													checked={checked}
													onChange={() => toggleOne(row.id)}
													aria-label={`${row.no} 선택`}
													className="h-4 w-4 accent-slate-900"
												/>
											</td>
											<td className="whitespace-nowrap px-3 py-3 align-middle">
												<span className="font-mono text-xs font-semibold text-slate-700">
													#{row.no}
												</span>
												<span className="mt-0.5 block font-mono text-[10px] text-slate-400">
													{row.id}
												</span>
											</td>
											<td className="max-w-[180px] px-3 py-3 align-middle">
												<p className="truncate font-semibold text-slate-900">{row.siteName}</p>
												<p className="truncate text-xs text-slate-500">{row.menuPath}</p>
											</td>
											<td className="max-w-[220px] px-3 py-3 align-middle">
												<p className="truncate font-medium text-slate-800">{row.title}</p>
												<p className="truncate text-[11px] text-slate-400">
													{getTargetTagLabel(row.targetTag)}
												</p>
											</td>
											<td className="min-w-[160px] px-3 py-3 align-middle">{metricsCells(row)}</td>
											<td className="max-w-[180px] px-3 py-3 align-middle">{contactCell(row)}</td>
											<td className="whitespace-nowrap px-3 py-3 align-middle">
												{geoBadge(row.country, row.region, row.checkLocationNeeded)}
											</td>
											<td className="whitespace-nowrap px-3 py-3 align-middle">
												{industryBadge(row.category)}
											</td>
											<td className="max-w-[200px] px-3 py-3 align-middle">
												<a
													href={row.url}
													target="_blank"
													rel="noopener noreferrer"
													className="block truncate text-xs font-medium text-sky-700 underline-offset-2 hover:underline"
													title={row.url}
												>
													{row.url}
												</a>
											</td>
											<td className="whitespace-nowrap px-3 py-3 align-middle text-center font-mono text-xs text-slate-600">
												{crawledAtCell(row.crawledAt)}
											</td>
											<td className="min-w-[3.5rem] whitespace-nowrap px-3 py-3 align-middle text-center">
												{row.scanning || row.scanLifecycle === 'SCANNING' ? (
													<span className="inline-flex items-center gap-1 whitespace-nowrap rounded-md bg-indigo-50 px-2 py-1 text-[11px] font-bold text-indigo-700 ring-1 ring-indigo-200">
														<Loader2 className="h-3 w-3 animate-spin" aria-hidden />
														진단 중...
													</span>
												) : (
													statusBadge(row.status)
												)}
											</td>
											<td className="px-3 py-3 align-middle">
												<CrawlRowActions
													item={row}
													menuOpen={menuOpenId === row.id}
													refreshing={refreshingIds.has(row.id)}
													onToggleMenu={() =>
														setMenuOpenId((cur) => (cur === row.id ? null : row.id))
													}
													onCloseMenu={() => setMenuOpenId(null)}
													onRefresh={() => void refreshContact(row)}
													onStartAudit={() => startAudit(row)}
													onOpenResult={() => openAuditModal(row)}
													onOpenEmail={() => openEmailModal(row)}
													onDownloadPdf={() => void handleDownloadPdf(row)}
													onDownloadPng={() => void handleDownloadPng(row)}
													onDelete={() => deleteOne(row.id)}
												/>
											</td>
										</tr>
									);
								})
							)}
						</tbody>
					</table>
				</div>

				{/* C. Footer Bar */}
				<div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
					<div className="flex flex-wrap gap-2">
						<button
							type="button"
							disabled={selected.size === 0}
							onClick={deleteSelected}
							className="rounded-md border border-rose-200 bg-white px-3 py-1.5 text-[11px] font-bold text-rose-700 disabled:opacity-40"
						>
							선택 삭제 ({selected.size})
						</button>
						<button
							type="button"
							disabled={filtered.length === 0}
							onClick={downloadExcel}
							className="rounded-md border border-emerald-200 bg-white px-3 py-1.5 text-[11px] font-bold text-emerald-800 hover:bg-emerald-50 disabled:opacity-40"
						>
							{excelButtonLabel}
						</button>
						<button
							type="button"
							disabled={exportingSheets || filtered.length === 0}
							onClick={() => void exportToGoogleSheets()}
							className="inline-flex items-center gap-1.5 rounded-md border border-[#0F9D58]/35 bg-[#0F9D58]/10 px-3 py-1.5 text-[11px] font-bold text-[#0b7a44] transition hover:bg-[#0F9D58]/15 disabled:cursor-not-allowed disabled:opacity-40"
						>
							{exportingSheets ? (
								<Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
							) : (
								<GoogleSheetsIcon className="h-3.5 w-3.5 shrink-0" />
							)}
							{sheetsButtonLabel}
						</button>
					</div>

					<nav className="flex items-center justify-center gap-1" aria-label="페이지 이동">
						<button
							type="button"
							disabled={safePage <= 1}
							onClick={() => goToPage(safePage - 1)}
							className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 disabled:opacity-40"
							aria-label="이전 페이지"
						>
							&lt;
						</button>
						{pageNumbers.map((n) => (
							<button
								key={n}
								type="button"
								onClick={() => goToPage(n)}
								aria-current={n === safePage ? 'page' : undefined}
								className={`min-w-[2rem] rounded-md px-2.5 py-1.5 text-xs font-bold ${
									n === safePage
										? 'bg-slate-900 text-white'
										: 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
								}`}
							>
								{n}
							</button>
						))}
						<button
							type="button"
							disabled={safePage >= pageCount}
							onClick={() => goToPage(safePage + 1)}
							className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 disabled:opacity-40"
							aria-label="다음 페이지"
						>
							&gt;
						</button>
					</nav>

					<p className="text-right text-xs font-semibold tabular-nums text-slate-500 sm:min-w-[11rem]">
						총 {formatCount(filtered.length)}건 중 {rangeStart}-{rangeEnd} 표시
					</p>
				</div>
			</section>

			{/* 진단결과 Modal */}
			{detail ? (
				<div
					className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
					role="dialog"
					aria-modal="true"
					aria-labelledby="crawl-detail-title"
					onClick={() => setDetailId(null)}
				>
					<div
						className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 shadow-xl"
						onClick={(e) => e.stopPropagation()}
					>
						<div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
							<div className="min-w-0">
								<p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
									📄 진단결과
								</p>
								<h2 id="crawl-detail-title" className="mt-1 truncate text-lg font-bold text-slate-900">
									{detail.title}
								</h2>
							</div>
							<div className="flex flex-wrap items-center justify-end gap-1.5">
								<button
									type="button"
									onClick={() => openEmailModal(detail)}
									className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
								>
									✉️ 메일 예시
								</button>
								<button
									type="button"
									disabled={exportBusy === 'pdf'}
									onClick={() => void handleDownloadPdf(detail)}
									className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
								>
									📥 PDF
								</button>
								<button
									type="button"
									disabled={exportBusy === 'png'}
									onClick={() => void handleDownloadPng(detail)}
									className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
								>
									🖼️ PNG
								</button>
								<button
									type="button"
									onClick={() => setDetailId(null)}
									className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-slate-100 px-2.5 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-200"
								>
									✕ 닫기
								</button>
							</div>
						</div>

						<div ref={auditModalBodyRef}>
							<dl className="space-y-3 text-sm">
								<div className="grid grid-cols-[6.5rem_1fr] gap-2">
									<dt className="font-semibold text-slate-500">ID / No</dt>
									<dd className="font-mono text-slate-800">
										#{detail.no} · {detail.id}
									</dd>
								</div>
								<div className="grid grid-cols-[6.5rem_1fr] gap-2">
									<dt className="font-semibold text-slate-500">사이트 / 메뉴</dt>
									<dd className="text-slate-800">
										{detail.siteName}
										<span className="mt-0.5 block text-xs text-slate-500">{detail.menuPath}</span>
									</dd>
								</div>
								<div className="grid grid-cols-[6.5rem_1fr] gap-2">
									<dt className="font-semibold text-slate-500">원본 URL</dt>
									<dd>
										<a
											href={detail.url}
											target="_blank"
											rel="noopener noreferrer"
											className="break-all text-sky-700 underline-offset-2 hover:underline"
										>
											{detail.url}
										</a>
									</dd>
								</div>
								<div className="grid grid-cols-[6.5rem_1fr] gap-2">
									<dt className="font-semibold text-slate-500">이메일 / 문의처</dt>
									<dd>{contactCell(detail)}</dd>
								</div>
								{detail.phoneNumber ? (
									<div className="grid grid-cols-[6.5rem_1fr] gap-2">
										<dt className="font-semibold text-slate-500">전화번호</dt>
										<dd>
											<a
												href={`tel:${detail.phoneNumber}`}
												className="text-sky-700 underline-offset-2 hover:underline"
											>
												{detail.phoneNumber}
											</a>
										</dd>
									</div>
								) : null}
								{detail.kakaoChannelUrl || detail.instagramUrl || detail.naverTalkUrl ? (
									<div className="grid grid-cols-[6.5rem_1fr] gap-2">
										<dt className="font-semibold text-slate-500">소셜 / 채널</dt>
										<dd className="flex flex-col gap-1">
											{detail.kakaoChannelUrl ? (
												<a
													href={detail.kakaoChannelUrl}
													target="_blank"
													rel="noopener noreferrer"
													className="break-all text-sky-700 underline-offset-2 hover:underline"
												>
													카카오톡 채널
												</a>
											) : null}
											{detail.instagramUrl ? (
												<a
													href={detail.instagramUrl}
													target="_blank"
													rel="noopener noreferrer"
													className="break-all text-sky-700 underline-offset-2 hover:underline"
												>
													인스타그램
												</a>
											) : null}
											{detail.naverTalkUrl ? (
												<a
													href={detail.naverTalkUrl}
													target="_blank"
													rel="noopener noreferrer"
													className="break-all text-sky-700 underline-offset-2 hover:underline"
												>
													네이버 톡톡
												</a>
											) : null}
										</dd>
									</div>
								) : null}
								<div className="grid grid-cols-[6.5rem_1fr] gap-2">
									<dt className="font-semibold text-slate-500">크롤링 일시</dt>
									<dd className="font-mono text-slate-800">{detail.crawledAt}</dd>
								</div>
								<div className="grid grid-cols-[6.5rem_1fr] gap-2">
									<dt className="font-semibold text-slate-500">상태</dt>
									<dd>{statusBadge(detail.status)}</dd>
								</div>
								<div className="grid grid-cols-[6.5rem_1fr] gap-2">
									<dt className="font-semibold text-slate-500">국가/지역</dt>
									<dd>{geoBadge(detail.country, detail.region, detail.checkLocationNeeded)}</dd>
								</div>
								{detail.parsedAddress || detail.address || detail.checkLocationNeeded ? (
									<div className="grid grid-cols-[6.5rem_1fr] gap-2">
										<dt className="font-semibold text-slate-500">파싱 주소</dt>
										<dd className="text-slate-700">
											{detail.address || detail.parsedAddress || '주소를 파싱하지 못했습니다. 관리자 확인이 필요합니다.'}
										</dd>
									</div>
								) : null}
								<div className="grid grid-cols-[6.5rem_1fr] gap-2">
									<dt className="font-semibold text-slate-500">업종</dt>
									<dd>{industryBadge(detail.category)}</dd>
								</div>
								<div className="grid grid-cols-[6.5rem_1fr] gap-2">
									<dt className="font-semibold text-slate-500">수집 목적</dt>
									<dd className="text-slate-800">{getTargetTagLabel(detail.targetTag)}</dd>
								</div>
								<div className="grid grid-cols-[6.5rem_1fr] gap-2">
									<dt className="font-semibold text-slate-500">수집 요약</dt>
									<dd className="text-slate-700">{detail.snippet}</dd>
								</div>
								<div className="grid grid-cols-[6.5rem_1fr] gap-2">
									<dt className="font-semibold text-slate-500">실측 지표</dt>
									<dd className="text-slate-700">
										{detail.scanning ? (
											<span className="inline-flex items-center gap-1.5 font-semibold text-indigo-700">
												<Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
												[ 🔄 진단 중... ]
											</span>
										) : (
											<ul className="space-y-1 text-sm">
												<li>
													<span className="text-slate-500">CMS</span> · {detail.cms ?? '—'}
												</li>
												<li>
													<span className="text-slate-500">SEO</span> ·{' '}
													{detail.seoScore != null ? detail.seoScore : '—'}
												</li>
												<li>
													<span className="text-slate-500">TTFB</span> ·{' '}
													{detail.ttfbMs != null ? `${detail.ttfbMs}ms` : '—'}
												</li>
												<li>
													<span className="text-slate-500">Viewport</span> ·{' '}
													{detail.hasViewport == null
														? '—'
														: detail.hasViewport
															? 'OK'
															: '없음'}
												</li>
												<li>
													<span className="text-slate-500">색인</span> ·{' '}
													{detail.isIndexable == null
														? '—'
														: detail.isIndexable
															? '허용'
															: '차단'}
												</li>
												{detail.description ? (
													<li className="pt-1 text-xs text-slate-500">{detail.description}</li>
												) : null}
											</ul>
										)}
									</dd>
								</div>
								{detail.errorMessage ? (
									<div className="grid grid-cols-[6.5rem_1fr] gap-2">
										<dt className="font-semibold text-slate-500">오류 메시지</dt>
										<dd className="font-mono text-xs text-rose-700">{detail.errorMessage}</dd>
									</div>
								) : null}
							</dl>
						</div>
					</div>
				</div>
			) : null}

			{resetConfirmOpen ? (
				<div
					className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
					role="dialog"
					aria-modal="true"
					aria-labelledby="crawl-reset-title"
					onClick={() => setResetConfirmOpen(false)}
				>
					<div
						className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl"
						onClick={(e) => e.stopPropagation()}
					>
						<h3 id="crawl-reset-title" className="text-base font-bold text-slate-900">
							수집 리스트 전체 초기화
						</h3>
						<p className="mt-2 text-sm leading-relaxed text-slate-600">
							수집된 데이터를 모두 영구 삭제하시겠습니까?
							<br />
							이 작업은 되돌릴 수 없으며, 새로고침·페이지 이동 후에도 복구되지 않습니다.
						</p>
						<div className="mt-5 flex justify-end gap-2">
							<button
								type="button"
								onClick={() => setResetConfirmOpen(false)}
								className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
							>
								취소
							</button>
							<button
								type="button"
								onClick={confirmClearAllCollected}
								className="rounded-lg bg-rose-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-rose-700"
							>
								전체 삭제
							</button>
						</div>
					</div>
				</div>
			) : null}

			<EmailPreviewModal
				isOpen={Boolean(emailTarget)}
				onClose={() => setEmailTarget(null)}
				siteName={emailTarget?.siteName}
				targetUrl={emailTarget?.url}
			/>
		</div>
	);
}
