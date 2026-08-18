import type { GeoNarrativeReport } from '@/lib/audit/geo-narrative';
import type { IndustryType, SiteMetadata } from '@/lib/audit/site-metadata';
import {
	checkViewport,
	type LighthouseViewportAudit,
} from '@/lib/audit/viewport';
import {
	GNUBOARD_HTML_RE,
	isGnuboardHtml,
	isYoungcartHtml,
	toAuditCmsLabel,
} from '@/lib/crawling/cms-from-html';
import type { AuditReport } from '@/lib/site-auditor';

type AuditLang = 'ko' | 'en';

const INDUSTRY_PARENT: Record<IndustryType, { ko: string; en: string }> = {
	MEDICAL: { ko: '의료', en: 'Medical' },
	LOCAL_STORE: { ko: '로컬 비즈니스', en: 'Local business' },
	B2B_MFG: { ko: 'B2B / 제조', en: 'B2B / Manufacturing' },
	GENERAL: { ko: '일반', en: 'General' },
};

function domainFromUrl(raw: string): string {
	try {
		return new URL(raw).hostname.replace(/^www\./, '');
	} catch {
		return raw.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0] || raw;
	}
}

function buildSignalCorpus(report: AuditReport): string {
	const paths = (report.pageMetas ?? []).map((p) => p.urlPath || '').join(' ');
	const urls = (report.collectedUrls ?? []).join(' ');
	const nav = (report.navItems ?? []).map((n) => n.url || '').join(' ');
	return [report.url, urls, paths, nav, report.footerText ?? ''].join(' ').toLowerCase();
}

/** Lightweight CMS guess from crawl URL / page-meta signals (no filesystem). */
export function inferCmsFromAuditReport(report: AuditReport, lang: AuditLang = 'ko'): string {
	const stored = (report.cmsType || '').trim();
	if (stored && stored !== 'UNKNOWN') {
		return stored;
	}

	const corpus = buildSignalCorpus(report);
	const hasYoungcart = isYoungcartHtml(corpus) || /cart\.php|orderform\.php/.test(corpus);
	const hasGnuboard =
		isGnuboardHtml(corpus) ||
		GNUBOARD_HTML_RE.test(corpus) ||
		/board\.php|\/bbs\/|g5_|gnuboard|head\.sub\.php|theme\/basic|bo_table=/.test(corpus);

	if (hasGnuboard && hasYoungcart) {
		return lang === 'ko' ? '그누보드 / 영카트' : 'Gnuboard / YoungCart';
	}
	if (hasGnuboard) return lang === 'ko' ? '그누보드' : 'Gnuboard';
	if (hasYoungcart) return lang === 'ko' ? '영카트' : 'YoungCart';
	if (/wp-content|wp-includes|wp-json|wordpress/.test(corpus)) return 'WordPress';
	if (/imweb|doothost|cdn\.imweb/.test(corpus)) return lang === 'ko' ? '아임웹' : 'Imweb';
	if (/cafe24/.test(corpus)) return 'Cafe24';
	if (/_next\/static|__next/.test(corpus)) return 'Next.js';
	if (/laravel|\/public\/index\.php/.test(corpus)) return 'Laravel';
	return toAuditCmsLabel('자체구축 / 기타', lang);
}

/** e.g. "의료 / 암치료 클리닉" — industry parent + site keyword. */
export function formatTargetCategory(
	meta: SiteMetadata | undefined,
	lang: AuditLang = 'ko',
	industryFallback?: string,
): string {
	if (!meta) {
		const fallback = (industryFallback || '').trim();
		return fallback || (lang === 'ko' ? '일반' : 'General');
	}
	const parent = INDUSTRY_PARENT[meta.industryType] ?? INDUSTRY_PARENT.GENERAL;
	const parentLabel = lang === 'ko' ? parent.ko : parent.en;
	const detail = (meta.category || meta.primaryKeyword || industryFallback || '').trim();
	if (!detail) return parentLabel;
	const detailNorm = detail.replace(/\s+/g, '').toLowerCase();
	const parentNorm = parentLabel.replace(/\s+/g, '').toLowerCase();
	if (detailNorm === parentNorm || detailNorm.includes(parentNorm)) return detail;
	return `${parentLabel} / ${detail}`;
}

export function resolveTargetBrandName(
	report: AuditReport,
	reportData?: GeoNarrativeReport | null,
): string {
	const fromMeta = report.siteMeta?.brandName?.trim();
	if (fromMeta) return fromMeta;
	const fromNarrative = reportData?.brandName?.trim();
	if (fromNarrative) return fromNarrative;
	return domainFromUrl(report.url);
}

export function formatTargetScanStamp(
	iso: string,
	lang: AuditLang = 'ko',
): { dateTime: string | null } {
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) {
		return { dateTime: null };
	}
	if (lang === 'ko') {
		const formattedDate = d
			.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })
			.replace(/\.$/, '');
		const formattedTime = d.toLocaleTimeString('ko-KR', {
			hour12: false,
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
		});
		return { dateTime: `${formattedDate} ${formattedTime}` };
	}
	const date = d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
	const time = d.toLocaleTimeString('en-US', {
		hour12: false,
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
	});
	return { dateTime: `${date} ${time}` };
}

/** Google-recommended TTFB threshold (≤200ms). */
export const TTFB_GOOD_MS = 200;
const TTFB_WARN_MS = 600;

export function formatTargetTtfb(
	ms: number,
	lang: AuditLang = 'ko',
): {
	label: string;
	valueLabel: string;
	tone: 'good' | 'warn' | 'bad';
	statusKey: 'good' | 'warn' | 'bad' | 'unknown';
} {
	const safe = Number.isFinite(ms) && ms > 0 ? Math.round(ms) : 0;
	if (!safe) {
		return {
			label: lang === 'ko' ? '측정 불가' : 'N/A',
			valueLabel: lang === 'ko' ? '측정 불가' : 'N/A',
			tone: 'warn',
			statusKey: 'unknown',
		};
	}

	const tone: 'good' | 'warn' | 'bad' =
		safe <= TTFB_GOOD_MS ? 'good' : safe <= TTFB_WARN_MS ? 'warn' : 'bad';
	const emoji = tone === 'good' ? '🟢' : tone === 'warn' ? '🟡' : '🔴';
	const valueLabel =
		safe >= 1000 ? `${(safe / 1000).toFixed(1).replace(/\.0$/, '')}s` : `${safe}ms`;

	return {
		label: `${emoji} ${valueLabel}`,
		valueLabel,
		tone,
		statusKey: tone,
	};
}

export function formatTargetServerLocation(
	report: AuditReport,
	lang: AuditLang = 'ko',
): { primary: string; badge: string | null } {
	const loc = report.serverLocation;
	if (loc?.countryCode && loc.countryCode !== '—') {
		return { primary: loc.countryCode, badge: loc.label || null };
	}
	if (loc?.label) return { primary: loc.label, badge: null };

	// Legacy reports: soft fallback from site locality / KR TLD.
	try {
		const host = new URL(report.url).hostname.toLowerCase();
		const city = (report.siteMeta?.broadLocation || report.siteMeta?.location || '').trim();
		if (/\.kr$|\.co\.kr$|\.or\.kr$|\.go\.kr$/.test(host)) {
			const country = lang === 'ko' ? '한국' : 'South Korea';
			return {
				primary: 'KR',
				badge: city ? `${country} / ${city}` : country,
			};
		}
		if (city) {
			return {
				primary: lang === 'ko' ? `추정 · ${city}` : `Est. · ${city}`,
				badge: null,
			};
		}
	} catch {
		/* ignore */
	}
	return {
		primary: lang === 'ko' ? '위치 미확인' : 'Unknown region',
		badge: null,
	};
}

export function formatTargetIndexStatus(
	report: AuditReport,
	lang: AuditLang = 'ko',
): { label: string; badge: string; allowed: boolean; description: string } {
	const okBadge = lang === 'ko' ? '정상' : 'OK';
	const blockedBadge = lang === 'ko' ? '차단' : 'Blocked';
	const allowedLabel = lang === 'ko' ? '검색 및 AI 수집 허용' : 'Search & AI collection allowed';
	const blockedLabel = lang === 'ko' ? '검색 및 AI 수집 차단' : 'Search & AI collection blocked';
	const allowedDescription =
		lang === 'ko'
			? '네이버·구글 포털 검색 노출과 ChatGPT·Perplexity 등 AI 검색 답변에 정상 활용될 수 있습니다.'
			: 'Portals like Naver and Google, and AI engines such as ChatGPT and Perplexity, can read and use this page.';
	const blockedDescription =
		lang === 'ko'
			? '검색 포털·AI 엔진이 이 페이지를 읽지 못하도록 설정되어 있어 검색·AI 답변 노출이 제한될 수 있습니다.'
			: 'Search portals and AI engines are blocked from reading this page, which can limit search and AI answer visibility.';

	if (report.indexStatus) {
		const allowed = report.indexStatus.allowed;
		return {
			allowed,
			label: allowed ? allowedLabel : blockedLabel,
			badge: allowed ? okBadge : blockedBadge,
			description: allowed ? allowedDescription : blockedDescription,
		};
	}

	// Legacy fallback: AI-bot robots check only.
	const aiBotCheck = (report.checklist ?? report.categories.flatMap((c) => c.checks)).find(
		(c) => c.id === 'ai-bots-allowed',
	);
	if (aiBotCheck) {
		const allowed = (aiBotCheck.status ?? (aiBotCheck.passed ? 'pass' : 'fail')) === 'pass';
		return {
			allowed,
			label: allowed ? allowedLabel : blockedLabel,
			badge: allowed ? okBadge : blockedBadge,
			description: allowed ? allowedDescription : blockedDescription,
		};
	}

	return {
		allowed: true,
		label: allowedLabel,
		badge: okBadge,
		description: allowedDescription,
	};
}

export function isHttpsUrl(raw: string): boolean {
	try {
		return new URL(raw).protocol === 'https:';
	} catch {
		return /^https:\/\//i.test(raw);
	}
}

/** Mobile viewport meta status for the target-entity meta card. */
export function formatTargetViewportStatus(
	report: AuditReport,
	opts?: {
		/** PageSpeed / Lighthouse `audits['viewport']` (cross-validation). */
		viewportAudit?: LighthouseViewportAudit | null;
		htmlSource?: string | null;
	},
): { present: boolean; known: boolean } {
	const result = checkViewport({
		viewportAudit: opts?.viewportAudit,
		htmlSource: opts?.htmlSource,
		hasViewportMeta: report.hasViewportMeta,
	});
	return { present: result.present, known: result.known };
}

export function displayTargetUrl(raw: string): string {
	try {
		const u = new URL(raw);
		const path = u.pathname === '/' ? '' : u.pathname.replace(/\/$/, '');
		return `${u.origin}${path}`;
	} catch {
		return raw.replace(/\/$/, '');
	}
}

export type PortalCollectorId = 'google' | 'naver' | 'gptbot';

export interface PortalCollectorStatus {
	id: PortalCollectorId;
	label: string;
	/** Short crawler name for tooltip / aria (Googlebot, Yeti, GPTBot). */
	crawler: string;
	allowed: boolean;
}

function isAiBotsCheckPassing(report: AuditReport): boolean | null {
	const checks = report.checklist?.length ? report.checklist : report.categories.flatMap((c) => c.checks);
	const botCheck = checks.find((c) => c.id === 'ai-bots-allowed');
	if (!botCheck) return null;
	return (botCheck.status ?? (botCheck.passed ? 'pass' : 'fail')) === 'pass';
}

/**
 * Googlebot / Yeti / GPTBot collection chips for the Target Entity header.
 * Google & Naver follow combined robots.txt + meta robots; GPTBot uses the
 * per-bot robots map when present.
 */
export function resolvePortalCollectorStatuses(report: AuditReport): PortalCollectorStatus[] {
	const indexAllowed = report.indexStatus?.allowed ?? true;
	const googleAllowed = report.indexStatus
		? Boolean(report.indexStatus.robotsTxtOk && report.indexStatus.metaRobotsOk)
		: indexAllowed;
	const naverAllowed = googleAllowed;

	const gptFromMetrics = report.metrics?.aiBotAccess?.gptbot;
	const gptFromCheck = isAiBotsCheckPassing(report);
	const gptAllowed =
		typeof gptFromMetrics === 'boolean' ? gptFromMetrics : gptFromCheck !== null ? gptFromCheck : true;

	return [
		{ id: 'google', label: 'Google', crawler: 'Googlebot', allowed: googleAllowed },
		{ id: 'naver', label: 'Naver', crawler: 'Yeti', allowed: naverAllowed },
		{ id: 'gptbot', label: 'GPTBot', crawler: 'GPTBot', allowed: gptAllowed },
	];
}
