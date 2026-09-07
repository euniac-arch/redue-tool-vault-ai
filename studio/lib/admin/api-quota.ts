/**
 * API 사용량 및 쿼터 관리 — data model + mock generator + client fetcher.
 *
 * The shape here (`ApiQuotaSnapshot`) is the contract the future backend
 * usage-logging API is expected to return. `fetchApiQuotaUsage()` already
 * calls a real Next.js route (`/api/admin/usage/quota`); only that route's
 * internals need to change from `buildMockApiQuotaSnapshot()` to a real
 * usage-log aggregation query — the frontend requires no changes.
 */

export type ApiQuotaServiceName = 'Google OAuth' | 'Kakao Login' | 'Gemini API' | 'Translation API';

export type ApiQuotaStatus = 'normal' | 'warning' | 'critical';

export interface ApiQuotaUsage {
	serviceName: ApiQuotaServiceName;
	/** 당일 호출 횟수 */
	dailyUsage: number;
	/** 일일 쿼터 제한량 */
	dailyLimit: number;
	/** 월간 누적 사용량 */
	monthlyUsage: number;
	/** 월간 최대 쿼터 */
	monthlyLimit: number;
	/** 쿼터 소진율(%) — 일간/월간 중 더 급박한(높은) 비율을 채택 */
	usagePercentage: number;
	status: ApiQuotaStatus;
	/** 최근 호출 일시 (ISO 8601) */
	lastCalledAt: string;
}

export interface ApiQuotaHourlyPoint {
	/** `HH:00` label, oldest → newest, last 12 hours. */
	hour: string;
	calls: number;
}

export interface ApiQuotaDailyPoint {
	/** `M/D` label, oldest → newest, last 7 days. */
	date: string;
	calls: number;
}

export interface ApiQuotaCallStats {
	serviceName: ApiQuotaServiceName;
	hourly: ApiQuotaHourlyPoint[];
	daily: ApiQuotaDailyPoint[];
}

export type ProductUsageService = 'ai_research' | 'youtube_search' | 'audit';

export interface ProductUsageRow {
	service: ProductUsageService;
	label: string;
	memberDaily: number;
	guestDaily: number;
	memberLimit: number;
	guestLimit: number;
	memberRemaining: number;
	guestRemaining: number;
}

export interface ApiQuotaSnapshot {
	quotas: ApiQuotaUsage[];
	callStats: ApiQuotaCallStats[];
	productUsage?: ProductUsageRow[];
	/** ISO 8601 timestamp this snapshot was generated at. */
	generatedAt: string;
}

/** 80% 이상 → warning */
export const QUOTA_WARNING_THRESHOLD = 80;
/** 95% 이상 → critical */
export const QUOTA_CRITICAL_THRESHOLD = 95;

export const API_QUOTA_SERVICE_NAMES: ApiQuotaServiceName[] = [
	'Google OAuth',
	'Kakao Login',
	'Gemini API',
	'Translation API',
];

export function computeUsagePercentage(usage: number, limit: number): number {
	if (limit <= 0) return 0;
	return Math.min(100, Math.round((usage / limit) * 1000) / 10);
}

export function computeQuotaStatus(percentage: number): ApiQuotaStatus {
	if (percentage >= QUOTA_CRITICAL_THRESHOLD) return 'critical';
	if (percentage >= QUOTA_WARNING_THRESHOLD) return 'warning';
	return 'normal';
}

export function quotaRemainingCount(usage: number, limit: number): number {
	return Math.max(0, limit - usage);
}

/** Deterministic mulberry32 PRNG so mock charts stay stable within a single render pass. */
function seededRandom(seed: number): () => number {
	let state = seed | 0;
	return () => {
		state = (state + 0x6d2b79f5) | 0;
		let t = Math.imul(state ^ (state >>> 15), 1 | state);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function hashSeed(label: string): number {
	let h = 0;
	for (let i = 0; i < label.length; i += 1) {
		h = (h * 31 + label.charCodeAt(i)) | 0;
	}
	return h;
}

const SERVICE_QUOTA_BASE: Record<
	ApiQuotaServiceName,
	{ dailyLimit: number; monthlyLimit: number; dailyRatio: number; monthlyRatio: number }
> = {
	'Google OAuth': { dailyLimit: 10_000, monthlyLimit: 300_000, dailyRatio: 0.43, monthlyRatio: 0.43 },
	'Kakao Login': { dailyLimit: 5_000, monthlyLimit: 150_000, dailyRatio: 0.83, monthlyRatio: 0.79 },
	'Gemini API': { dailyLimit: 2_000, monthlyLimit: 60_000, dailyRatio: 0.97, monthlyRatio: 0.91 },
	'Translation API': { dailyLimit: 50_000, monthlyLimit: 1_500_000, dailyRatio: 0.29, monthlyRatio: 0.27 },
};

function buildQuotaUsage(serviceName: ApiQuotaServiceName, now: Date): ApiQuotaUsage {
	const base = SERVICE_QUOTA_BASE[serviceName];
	const rand = seededRandom(hashSeed(`${serviceName}:${now.toDateString()}`));
	const jitter = () => 1 + (rand() - 0.5) * 0.04;

	const dailyUsage = Math.min(base.dailyLimit, Math.round(base.dailyLimit * base.dailyRatio * jitter()));
	const monthlyUsage = Math.min(
		base.monthlyLimit,
		Math.round(base.monthlyLimit * base.monthlyRatio * jitter()),
	);
	const dailyPct = computeUsagePercentage(dailyUsage, base.dailyLimit);
	const monthlyPct = computeUsagePercentage(monthlyUsage, base.monthlyLimit);
	const usagePercentage = Math.max(dailyPct, monthlyPct);
	const minutesAgo = Math.round(1 + rand() * 8);

	return {
		serviceName,
		dailyUsage,
		dailyLimit: base.dailyLimit,
		monthlyUsage,
		monthlyLimit: base.monthlyLimit,
		usagePercentage,
		status: computeQuotaStatus(usagePercentage),
		lastCalledAt: new Date(now.getTime() - minutesAgo * 60_000).toISOString(),
	};
}

/** Rough daytime traffic shape (oldest → newest) used to spread mock hourly calls. */
const HOUR_CURVE = [0.35, 0.3, 0.28, 0.32, 0.45, 0.6, 0.78, 0.92, 1, 0.88, 0.7, 0.5];

function buildCallStats(quota: ApiQuotaUsage, now: Date): ApiQuotaCallStats {
	const rand = seededRandom(hashSeed(`${quota.serviceName}:stats:${now.toDateString()}`));
	const curveSum = HOUR_CURVE.reduce((sum, weight) => sum + weight, 0);
	const hourlyTotal = quota.dailyUsage * 0.5;

	const hourly: ApiQuotaHourlyPoint[] = HOUR_CURVE.map((weight, idx) => {
		const hoursAgo = HOUR_CURVE.length - 1 - idx;
		const bucket = new Date(now.getTime() - hoursAgo * 60 * 60 * 1000);
		const calls = Math.max(0, Math.round(((hourlyTotal * weight) / curveSum) * (1 + (rand() - 0.5) * 0.2)));
		return { hour: `${String(bucket.getHours()).padStart(2, '0')}:00`, calls };
	});

	const dailyAvg = quota.monthlyUsage / 30;
	const daily: ApiQuotaDailyPoint[] = Array.from({ length: 7 }, (_, idx) => {
		const daysAgo = 6 - idx;
		const day = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
		const calls =
			daysAgo === 0
				? quota.dailyUsage
				: Math.max(0, Math.round(dailyAvg * (0.75 + rand() * 0.5)));
		return { date: `${day.getMonth() + 1}/${day.getDate()}`, calls };
	});

	return { serviceName: quota.serviceName, hourly, daily };
}

/**
 * Builds a full mock snapshot matching the future backend usage-logging API shape.
 * Swap the call site (the `/api/admin/usage/quota` route) for a real aggregation
 * query once the backend lands — `ApiQuotaSnapshot` stays unchanged.
 */
export function buildMockApiQuotaSnapshot(now: Date = new Date()): ApiQuotaSnapshot {
	const quotas = API_QUOTA_SERVICE_NAMES.map((name) => buildQuotaUsage(name, now));
	const callStats = quotas.map((quota) => buildCallStats(quota, now));
	return { quotas, callStats, generatedAt: now.toISOString() };
}

export function formatQuotaNumber(value: number): string {
	return value.toLocaleString('en-US');
}

export function formatLastCalledAt(iso: string): string {
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return iso;
	const diffMin = Math.round((Date.now() - date.getTime()) / 60_000);
	if (diffMin < 1) return '방금 전';
	if (diffMin < 60) return `${diffMin}분 전`;
	const diffHour = Math.round(diffMin / 60);
	if (diffHour < 24) return `${diffHour}시간 전`;
	return date.toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/**
 * Fetches the current API quota snapshot for the admin dashboard.
 * Backed today by a mock-generating Next.js route; once the real backend
 * usage-logging API exists, only that route's implementation needs to change.
 */
export async function fetchApiQuotaUsage(signal?: AbortSignal): Promise<ApiQuotaSnapshot> {
	const res = await fetch('/api/admin/usage/quota', { cache: 'no-store', signal });
	if (!res.ok) {
		throw new Error(`API 쿼터 데이터를 불러오지 못했습니다. (${res.status})`);
	}
	return res.json() as Promise<ApiQuotaSnapshot>;
}
