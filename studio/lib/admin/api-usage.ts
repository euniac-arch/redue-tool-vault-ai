export type MembershipPlan = 'Free' | 'Pro' | 'Enterprise';

export type ApiProvider =
	| 'openai'
	| 'anthropic'
	| 'perplexity'
	| 'gemini'
	| 'googlemaps'
	| 'unsplash'
	| 'pexels'
	| 'pixabay';

export type ApiServiceFilter = 'all' | 'openai' | 'anthropic' | 'perplexity' | 'gemini' | 'googlemaps' | 'image';

export type ApiStatusCode = 200 | 429 | 500;
export type ApiStatusFilter = 'all' | ApiStatusCode;

export type ApiModelId =
	| 'gpt-4o'
	| 'gpt-4o-mini'
	| 'claude-3-5-sonnet'
	| 'sonar'
	| 'gemini-1.5-pro'
	| 'gemini-1.5-flash'
	| 'geocoding'
	| 'maps-sdk'
	| 'unsplash'
	| 'pexels'
	| 'pixabay';

export type UsageUnit = 'tokens' | 'request';
export type EngineHealth = 'healthy' | 'watch' | 'limited' | 'degraded';
export type ApiUsageSortKey = 'calledAt' | 'costUsd' | 'latencyMs';
export type SortDirection = 'asc' | 'desc';

export type ApiUsageLog = {
	id: string;
	calledAt: string;
	userEmail: string;
	plan: MembershipPlan;
	provider: ApiProvider;
	model: ApiModelId;
	modelLabel: string;
	domain: string;
	usageAmount: number;
	usageUnit: UsageUnit;
	promptTokens?: number;
	completionTokens?: number;
	costUsd: number;
	latencyMs: number;
	status: ApiStatusCode;
};

export type EngineShareRow = {
	id: ApiModelId;
	provider: ApiProvider;
	label: string;
	model: string;
	calls: number;
	tokens: number;
	costUsd: number;
	health: EngineHealth;
};

export type QuotaGauge = {
	id: string;
	provider: ApiProvider;
	label: string;
	caption: string;
	used: number;
	limit: number;
	unit: string;
	resetHint: string;
};

export type ApiUsageKpi = {
	monthCostUsd: number;
	monthBudgetUsd: number;
	todayPromptTokens: number;
	todayCompletionTokens: number;
	todayExternalCalls: number;
	todaySuccessRate: number;
	todayAvgLatencySec: number;
	todayMapsCalls: number;
	todayImageCalls: number;
};

export type BudgetControlState = {
	fallbackToCheapModels: boolean;
	warnAtEightyPercent: boolean;
};

export type ApiUsageFilters = {
	query: string;
	service: ApiServiceFilter;
	status: ApiStatusFilter;
};

export const PAGE_SIZE = 10;
export const BUDGET_CONTROL_STORAGE_KEY = 'redue-admin-budget-control';

export const DEFAULT_BUDGET_CONTROL: BudgetControlState = {
	fallbackToCheapModels: true,
	warnAtEightyPercent: true,
};

export const API_USAGE_KPI: ApiUsageKpi = {
	monthCostUsd: 128.45,
	monthBudgetUsd: 300,
	todayPromptTokens: 980_000,
	todayCompletionTokens: 440_800,
	todayExternalCalls: 4210,
	todaySuccessRate: 99.6,
	todayAvgLatencySec: 1.42,
	todayMapsCalls: 320,
	todayImageCalls: 850,
};

export const ENGINE_SHARE_ROWS: EngineShareRow[] = [
	{
		id: 'gpt-4o',
		provider: 'openai',
		label: 'OpenAI',
		model: 'GPT-4o',
		calls: 186,
		tokens: 412_400,
		costUsd: 48.2,
		health: 'healthy',
	},
	{
		id: 'gpt-4o-mini',
		provider: 'openai',
		label: 'OpenAI',
		model: 'GPT-4o-mini',
		calls: 540,
		tokens: 628_400,
		costUsd: 12.4,
		health: 'healthy',
	},
	{
		id: 'claude-3-5-sonnet',
		provider: 'anthropic',
		label: 'Anthropic',
		model: 'Claude 3.5 Sonnet',
		calls: 94,
		tokens: 186_200,
		costUsd: 38.8,
		health: 'healthy',
	},
	{
		id: 'sonar',
		provider: 'perplexity',
		label: 'Perplexity',
		model: 'Sonar / Web Search',
		calls: 128,
		tokens: 94_600,
		costUsd: 14.2,
		health: 'watch',
	},
	{
		id: 'gemini-1.5-pro',
		provider: 'gemini',
		label: 'Google Gemini',
		model: 'Gemini 1.5 Pro',
		calls: 72,
		tokens: 68_400,
		costUsd: 9.65,
		health: 'healthy',
	},
	{
		id: 'gemini-1.5-flash',
		provider: 'gemini',
		label: 'Google Gemini',
		model: 'Gemini 1.5 Flash',
		calls: 210,
		tokens: 31_200,
		costUsd: 1.85,
		health: 'healthy',
	},
];

export const QUOTA_GAUGES: QuotaGauge[] = [
	{
		id: 'unsplash-hourly',
		provider: 'unsplash',
		label: 'Unsplash API',
		caption: '무료 쿼터 50 req/hr',
		used: 38,
		limit: 50,
		unit: 'req/hr',
		resetHint: '18분 후 롤링 리셋',
	},
	{
		id: 'pexels-hourly',
		provider: 'pexels',
		label: 'Pexels API',
		caption: '무료 쿼터 200 req/hr',
		used: 64,
		limit: 200,
		unit: 'req/hr',
		resetHint: '정각 리셋',
	},
	{
		id: 'pixabay-hourly',
		provider: 'pixabay',
		label: 'Pixabay API',
		caption: '무료 쿼터 100 req/min',
		used: 12,
		limit: 100,
		unit: 'req/min',
		resetHint: '분당 윈도우',
	},
	{
		id: 'maps-monthly',
		provider: 'googlemaps',
		label: 'Google Maps Platform',
		caption: '월간 무료 쿼터 10,000회',
		used: 320,
		limit: 10_000,
		unit: 'req/mo',
		resetHint: '9일 후 월간 리셋',
	},
];

export const MOCK_API_USAGE_LOGS: ApiUsageLog[] = [
	{
		id: 'LOG-88421',
		calledAt: '2026-08-22 17:12:08',
		userEmail: 'dr.bae@nineoneclinic.com',
		plan: 'Pro',
		provider: 'openai',
		model: 'gpt-4o',
		modelLabel: 'gpt-4o',
		domain: 'nineoneclinic.com',
		usageAmount: 1420,
		usageUnit: 'tokens',
		promptTokens: 980,
		completionTokens: 440,
		costUsd: 0.0184,
		latencyMs: 1840,
		status: 200,
	},
	{
		id: 'LOG-88420',
		calledAt: '2026-08-22 17:11:44',
		userEmail: 'geo.ops@redue.ai',
		plan: 'Enterprise',
		provider: 'anthropic',
		model: 'claude-3-5-sonnet',
		modelLabel: 'claude-3-5',
		domain: 'redue.ai',
		usageAmount: 2860,
		usageUnit: 'tokens',
		promptTokens: 2100,
		completionTokens: 760,
		costUsd: 0.0177,
		latencyMs: 2210,
		status: 200,
	},
	{
		id: 'LOG-88419',
		calledAt: '2026-08-22 17:10:19',
		userEmail: 'content@nineoneclinic.com',
		plan: 'Pro',
		provider: 'pexels',
		model: 'pexels',
		modelLabel: 'pexels',
		domain: 'nineoneclinic.com',
		usageAmount: 1,
		usageUnit: 'request',
		costUsd: 0,
		latencyMs: 412,
		status: 200,
	},
	{
		id: 'LOG-88418',
		calledAt: '2026-08-22 17:09:51',
		userEmail: 'seo_master@kakao.com',
		plan: 'Pro',
		provider: 'unsplash',
		model: 'unsplash',
		modelLabel: 'unsplash',
		domain: 'gentle-amc.co.kr',
		usageAmount: 1,
		usageUnit: 'request',
		costUsd: 0,
		latencyMs: 980,
		status: 429,
	},
	{
		id: 'LOG-88417',
		calledAt: '2026-08-22 17:08:33',
		userEmail: 'growth_hacker@gmail.com',
		plan: 'Enterprise',
		provider: 'perplexity',
		model: 'sonar',
		modelLabel: 'sonar',
		domain: 'startup-studio.io',
		usageAmount: 1840,
		usageUnit: 'tokens',
		promptTokens: 620,
		completionTokens: 1220,
		costUsd: 0.0061,
		latencyMs: 3120,
		status: 200,
	},
	{
		id: 'LOG-88416',
		calledAt: '2026-08-22 17:07:02',
		userEmail: 'clinic_admin@seoul-plastic.com',
		plan: 'Pro',
		provider: 'googlemaps',
		model: 'geocoding',
		modelLabel: 'geocoding',
		domain: 'seoul-plastic.com',
		usageAmount: 1,
		usageUnit: 'request',
		costUsd: 0.005,
		latencyMs: 268,
		status: 200,
	},
	{
		id: 'LOG-88415',
		calledAt: '2026-08-22 17:05:47',
		userEmail: 'agency.lead@naver.com',
		plan: 'Enterprise',
		provider: 'gemini',
		model: 'gemini-1.5-pro',
		modelLabel: 'gemini-1.5-pro',
		domain: 'medi-growth.kr',
		usageAmount: 3210,
		usageUnit: 'tokens',
		promptTokens: 2480,
		completionTokens: 730,
		costUsd: 0.0068,
		latencyMs: 1670,
		status: 200,
	},
	{
		id: 'LOG-88414',
		calledAt: '2026-08-22 17:04:11',
		userEmail: 'trial@temp-agency.kr',
		plan: 'Free',
		provider: 'openai',
		model: 'gpt-4o-mini',
		modelLabel: 'gpt-4o-mini',
		domain: 'temp-agency.kr',
		usageAmount: 640,
		usageUnit: 'tokens',
		promptTokens: 410,
		completionTokens: 230,
		costUsd: 0.0002,
		latencyMs: 540,
		status: 200,
	},
	{
		id: 'LOG-88413',
		calledAt: '2026-08-22 17:02:58',
		userEmail: 'intern@startup-studio.io',
		plan: 'Free',
		provider: 'pixabay',
		model: 'pixabay',
		modelLabel: 'pixabay',
		domain: 'startup-studio.io',
		usageAmount: 1,
		usageUnit: 'request',
		costUsd: 0,
		latencyMs: 390,
		status: 200,
	},
	{
		id: 'LOG-88412',
		calledAt: '2026-08-22 16:58:22',
		userEmail: 'billing@gentle-amc.co.kr',
		plan: 'Enterprise',
		provider: 'googlemaps',
		model: 'maps-sdk',
		modelLabel: 'maps-sdk',
		domain: 'gentle-amc.co.kr',
		usageAmount: 1,
		usageUnit: 'request',
		costUsd: 0.007,
		latencyMs: 188,
		status: 200,
	},
	{
		id: 'LOG-88411',
		calledAt: '2026-08-22 16:54:09',
		userEmail: 'paused.user@outlook.com',
		plan: 'Free',
		provider: 'openai',
		model: 'gpt-4o-mini',
		modelLabel: 'gpt-4o-mini',
		domain: 'paused-lab.net',
		usageAmount: 890,
		usageUnit: 'tokens',
		promptTokens: 610,
		completionTokens: 280,
		costUsd: 0.0003,
		latencyMs: 710,
		status: 429,
	},
	{
		id: 'LOG-88410',
		calledAt: '2026-08-22 16:49:41',
		userEmail: 'geo.ops@redue.ai',
		plan: 'Enterprise',
		provider: 'gemini',
		model: 'gemini-1.5-flash',
		modelLabel: 'gemini-1.5-flash',
		domain: 'redue.ai',
		usageAmount: 1120,
		usageUnit: 'tokens',
		promptTokens: 800,
		completionTokens: 320,
		costUsd: 0.0002,
		latencyMs: 430,
		status: 200,
	},
	{
		id: 'LOG-88409',
		calledAt: '2026-08-22 16:44:18',
		userEmail: 'dr.bae@nineoneclinic.com',
		plan: 'Pro',
		provider: 'perplexity',
		model: 'sonar',
		modelLabel: 'sonar',
		domain: 'nineoneclinic.com',
		usageAmount: 2040,
		usageUnit: 'tokens',
		promptTokens: 740,
		completionTokens: 1300,
		costUsd: 0.0071,
		latencyMs: 4280,
		status: 500,
	},
	{
		id: 'LOG-88408',
		calledAt: '2026-08-22 16:38:55',
		userEmail: 'seo_master@kakao.com',
		plan: 'Pro',
		provider: 'anthropic',
		model: 'claude-3-5-sonnet',
		modelLabel: 'claude-3-5',
		domain: 'gentle-amc.co.kr',
		usageAmount: 1680,
		usageUnit: 'tokens',
		promptTokens: 1210,
		completionTokens: 470,
		costUsd: 0.0107,
		latencyMs: 1980,
		status: 200,
	},
	{
		id: 'LOG-88407',
		calledAt: '2026-08-22 16:31:07',
		userEmail: 'clinic_admin@seoul-plastic.com',
		plan: 'Pro',
		provider: 'unsplash',
		model: 'unsplash',
		modelLabel: 'unsplash',
		domain: 'seoul-plastic.com',
		usageAmount: 1,
		usageUnit: 'request',
		costUsd: 0,
		latencyMs: 620,
		status: 200,
	},
	{
		id: 'LOG-88406',
		calledAt: '2026-08-22 16:22:40',
		userEmail: 'agency.lead@naver.com',
		plan: 'Enterprise',
		provider: 'openai',
		model: 'gpt-4o',
		modelLabel: 'gpt-4o',
		domain: 'medi-growth.kr',
		usageAmount: 3560,
		usageUnit: 'tokens',
		promptTokens: 2410,
		completionTokens: 1150,
		costUsd: 0.0175,
		latencyMs: 2460,
		status: 200,
	},
	{
		id: 'LOG-88405',
		calledAt: '2026-08-22 16:14:12',
		userEmail: 'content@nineoneclinic.com',
		plan: 'Pro',
		provider: 'googlemaps',
		model: 'geocoding',
		modelLabel: 'geocoding',
		domain: 'nineoneclinic.com',
		usageAmount: 1,
		usageUnit: 'request',
		costUsd: 0.005,
		latencyMs: 304,
		status: 200,
	},
	{
		id: 'LOG-88404',
		calledAt: '2026-08-22 16:08:29',
		userEmail: 'growth_hacker@gmail.com',
		plan: 'Enterprise',
		provider: 'gemini',
		model: 'gemini-1.5-pro',
		modelLabel: 'gemini-1.5-pro',
		domain: 'startup-studio.io',
		usageAmount: 2740,
		usageUnit: 'tokens',
		promptTokens: 1980,
		completionTokens: 760,
		costUsd: 0.0063,
		latencyMs: 5120,
		status: 500,
	},
	{
		id: 'LOG-88403',
		calledAt: '2026-08-22 15:56:03',
		userEmail: 'trial@temp-agency.kr',
		plan: 'Free',
		provider: 'pexels',
		model: 'pexels',
		modelLabel: 'pexels',
		domain: 'temp-agency.kr',
		usageAmount: 1,
		usageUnit: 'request',
		costUsd: 0,
		latencyMs: 448,
		status: 200,
	},
	{
		id: 'LOG-88402',
		calledAt: '2026-08-22 15:47:51',
		userEmail: 'intern@startup-studio.io',
		plan: 'Free',
		provider: 'openai',
		model: 'gpt-4o-mini',
		modelLabel: 'gpt-4o-mini',
		domain: 'startup-studio.io',
		usageAmount: 1180,
		usageUnit: 'tokens',
		promptTokens: 790,
		completionTokens: 390,
		costUsd: 0.0004,
		latencyMs: 610,
		status: 200,
	},
	{
		id: 'LOG-88401',
		calledAt: '2026-08-22 15:33:16',
		userEmail: 'billing@gentle-amc.co.kr',
		plan: 'Enterprise',
		provider: 'perplexity',
		model: 'sonar',
		modelLabel: 'sonar',
		domain: 'gentle-amc.co.kr',
		usageAmount: 960,
		usageUnit: 'tokens',
		promptTokens: 340,
		completionTokens: 620,
		costUsd: 0.0032,
		latencyMs: 2540,
		status: 200,
	},
	{
		id: 'LOG-88400',
		calledAt: '2026-08-22 15:21:08',
		userEmail: 'geo.ops@redue.ai',
		plan: 'Enterprise',
		provider: 'pixabay',
		model: 'pixabay',
		modelLabel: 'pixabay',
		domain: 'redue.ai',
		usageAmount: 1,
		usageUnit: 'request',
		costUsd: 0,
		latencyMs: 276,
		status: 200,
	},
	{
		id: 'LOG-88399',
		calledAt: '2026-08-22 15:08:44',
		userEmail: 'dr.bae@nineoneclinic.com',
		plan: 'Pro',
		provider: 'gemini',
		model: 'gemini-1.5-flash',
		modelLabel: 'gemini-1.5-flash',
		domain: 'nineoneclinic.com',
		usageAmount: 740,
		usageUnit: 'tokens',
		promptTokens: 510,
		completionTokens: 230,
		costUsd: 0.0001,
		latencyMs: 390,
		status: 200,
	},
	{
		id: 'LOG-88398',
		calledAt: '2026-08-22 14:52:27',
		userEmail: 'seo_master@kakao.com',
		plan: 'Pro',
		provider: 'googlemaps',
		model: 'geocoding',
		modelLabel: 'geocoding',
		domain: 'gentle-amc.co.kr',
		usageAmount: 1,
		usageUnit: 'request',
		costUsd: 0.005,
		latencyMs: 1540,
		status: 429,
	},
	{
		id: 'LOG-88397',
		calledAt: '2026-08-22 14:41:03',
		userEmail: 'clinic_admin@seoul-plastic.com',
		plan: 'Pro',
		provider: 'openai',
		model: 'gpt-4o',
		modelLabel: 'gpt-4o',
		domain: 'seoul-plastic.com',
		usageAmount: 1980,
		usageUnit: 'tokens',
		promptTokens: 1320,
		completionTokens: 660,
		costUsd: 0.0099,
		latencyMs: 1720,
		status: 200,
	},
	{
		id: 'LOG-88396',
		calledAt: '2026-08-22 14:28:19',
		userEmail: 'agency.lead@naver.com',
		plan: 'Enterprise',
		provider: 'anthropic',
		model: 'claude-3-5-sonnet',
		modelLabel: 'claude-3-5',
		domain: 'medi-growth.kr',
		usageAmount: 4120,
		usageUnit: 'tokens',
		promptTokens: 3050,
		completionTokens: 1070,
		costUsd: 0.0252,
		latencyMs: 2680,
		status: 200,
	},
	{
		id: 'LOG-88395',
		calledAt: '2026-08-22 14:11:55',
		userEmail: 'paused.user@outlook.com',
		plan: 'Free',
		provider: 'unsplash',
		model: 'unsplash',
		modelLabel: 'unsplash',
		domain: 'paused-lab.net',
		usageAmount: 1,
		usageUnit: 'request',
		costUsd: 0,
		latencyMs: 880,
		status: 429,
	},
	{
		id: 'LOG-88394',
		calledAt: '2026-08-22 13:58:02',
		userEmail: 'growth_hacker@gmail.com',
		plan: 'Enterprise',
		provider: 'pexels',
		model: 'pexels',
		modelLabel: 'pexels',
		domain: 'startup-studio.io',
		usageAmount: 1,
		usageUnit: 'request',
		costUsd: 0,
		latencyMs: 334,
		status: 200,
	},
	{
		id: 'LOG-88393',
		calledAt: '2026-08-22 13:40:31',
		userEmail: 'content@nineoneclinic.com',
		plan: 'Pro',
		provider: 'openai',
		model: 'gpt-4o-mini',
		modelLabel: 'gpt-4o-mini',
		domain: 'nineoneclinic.com',
		usageAmount: 860,
		usageUnit: 'tokens',
		promptTokens: 540,
		completionTokens: 320,
		costUsd: 0.0003,
		latencyMs: 480,
		status: 200,
	},
	{
		id: 'LOG-88392',
		calledAt: '2026-08-22 13:22:14',
		userEmail: 'geo.ops@redue.ai',
		plan: 'Enterprise',
		provider: 'googlemaps',
		model: 'maps-sdk',
		modelLabel: 'maps-sdk',
		domain: 'redue.ai',
		usageAmount: 1,
		usageUnit: 'request',
		costUsd: 0.007,
		latencyMs: 210,
		status: 200,
	},
];

export const SERVICE_FILTER_OPTIONS: { value: ApiServiceFilter; label: string }[] = [
	{ value: 'all', label: '전체' },
	{ value: 'openai', label: 'OpenAI' },
	{ value: 'anthropic', label: 'Anthropic' },
	{ value: 'perplexity', label: 'Perplexity' },
	{ value: 'gemini', label: 'Gemini' },
	{ value: 'googlemaps', label: 'GoogleMaps' },
	{ value: 'image', label: 'Image' },
];

export const STATUS_FILTER_OPTIONS: { value: ApiStatusFilter; label: string }[] = [
	{ value: 'all', label: '전체 상태' },
	{ value: 200, label: '200 OK' },
	{ value: 429, label: '429 Limit' },
	{ value: 500, label: '500 Error' },
];

export const SORT_OPTIONS: { value: ApiUsageSortKey; label: string }[] = [
	{ value: 'calledAt', label: '최근호출순' },
	{ value: 'costUsd', label: '비용순' },
	{ value: 'latencyMs', label: '지연시간순' },
];

export function cloneUsageLogs(source: ApiUsageLog[] = MOCK_API_USAGE_LOGS): ApiUsageLog[] {
	return source.map((row) => ({ ...row }));
}

export function matchesServiceFilter(provider: ApiProvider, service: ApiServiceFilter): boolean {
	if (service === 'all') return true;
	if (service === 'image') return provider === 'unsplash' || provider === 'pexels' || provider === 'pixabay';
	return provider === service;
}

export function filterUsageLogs(logs: ApiUsageLog[], filters: ApiUsageFilters): ApiUsageLog[] {
	const q = filters.query.trim().toLowerCase();
	return logs.filter((row) => {
		if (!matchesServiceFilter(row.provider, filters.service)) return false;
		if (filters.status !== 'all' && row.status !== filters.status) return false;
		if (!q) return true;
		return (
			row.userEmail.toLowerCase().includes(q) ||
			row.domain.toLowerCase().includes(q) ||
			row.modelLabel.toLowerCase().includes(q) ||
			row.id.toLowerCase().includes(q)
		);
	});
}

export function sortUsageLogs(
	logs: ApiUsageLog[],
	sortKey: ApiUsageSortKey,
	direction: SortDirection,
): ApiUsageLog[] {
	const sign = direction === 'asc' ? 1 : -1;
	return [...logs].sort((a, b) => {
		if (sortKey === 'calledAt') {
			const byTime = a.calledAt.localeCompare(b.calledAt) * sign;
			return byTime !== 0 ? byTime : a.id.localeCompare(b.id);
		}
		if (sortKey === 'costUsd') {
			const byCost = (a.costUsd - b.costUsd) * sign;
			return byCost !== 0 ? byCost : b.calledAt.localeCompare(a.calledAt);
		}
		const byLatency = (a.latencyMs - b.latencyMs) * sign;
		return byLatency !== 0 ? byLatency : b.calledAt.localeCompare(a.calledAt);
	});
}

export function paginateUsageLogs<T>(items: T[], page: number, pageSize = PAGE_SIZE): T[] {
	const safePage = Math.max(1, page);
	const start = (safePage - 1) * pageSize;
	return items.slice(start, start + pageSize);
}

export function monthBudgetRatio(kpi: ApiUsageKpi = API_USAGE_KPI): number {
	if (kpi.monthBudgetUsd <= 0) return 0;
	return Math.min(100, (kpi.monthCostUsd / kpi.monthBudgetUsd) * 100);
}

export function todayTokenTotal(kpi: ApiUsageKpi = API_USAGE_KPI): number {
	return kpi.todayPromptTokens + kpi.todayCompletionTokens;
}

export function engineCostTotal(rows: EngineShareRow[] = ENGINE_SHARE_ROWS): number {
	return rows.reduce((sum, row) => sum + row.costUsd, 0);
}

export function engineSharePercent(row: EngineShareRow, rows: EngineShareRow[] = ENGINE_SHARE_ROWS): number {
	const total = engineCostTotal(rows);
	if (total <= 0) return 0;
	return (row.costUsd / total) * 100;
}

export function quotaUsedPercent(gauge: QuotaGauge): number {
	if (gauge.limit <= 0) return 0;
	return Math.min(100, (gauge.used / gauge.limit) * 100);
}

export function quotaRemaining(gauge: QuotaGauge): number {
	return Math.max(0, gauge.limit - gauge.used);
}

export function formatUsd(value: number, digits = 2): string {
	if (value === 0) return '$0.00';
	if (value > 0 && value < 0.01) return `$${value.toFixed(4)}`;
	return `$${value.toFixed(digits)}`;
}

export function formatTokens(value: number): string {
	if (value >= 1_000_000) {
		const millions = value / 1_000_000;
		return `${millions.toLocaleString('en-US', { maximumFractionDigits: 2 })}M`;
	}
	if (value >= 1000) {
		return value.toLocaleString('en-US');
	}
	return String(value);
}

export function formatCompactTokens(value: number): string {
	if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 1 : 2)}M`;
	if (value >= 1000) return `${Math.round(value / 1000)}k`;
	return String(value);
}

export function formatCalledAt(value: string): string {
	if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) return value;
	const normalized = value.includes('T') ? value : value.replace(' ', 'T');
	const date = new Date(normalized);
	if (Number.isNaN(date.getTime())) return value;
	const yyyy = date.getFullYear();
	const mm = String(date.getMonth() + 1).padStart(2, '0');
	const dd = String(date.getDate()).padStart(2, '0');
	const hh = String(date.getHours()).padStart(2, '0');
	const min = String(date.getMinutes()).padStart(2, '0');
	const ss = String(date.getSeconds()).padStart(2, '0');
	return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
}

export function statusLabel(status: ApiStatusCode): string {
	if (status === 200) return '200 OK';
	if (status === 429) return '429 Too Many Requests';
	return '500 Fail';
}

export function latencyTone(ms: number): 'fast' | 'mid' | 'slow' {
	if (ms < 800) return 'fast';
	if (ms < 2000) return 'mid';
	return 'slow';
}

export function readBudgetControl(): BudgetControlState {
	if (typeof window === 'undefined') return DEFAULT_BUDGET_CONTROL;
	try {
		const raw = window.localStorage.getItem(BUDGET_CONTROL_STORAGE_KEY);
		if (!raw) return DEFAULT_BUDGET_CONTROL;
		const parsed = JSON.parse(raw) as Partial<BudgetControlState>;
		return {
			fallbackToCheapModels: parsed.fallbackToCheapModels ?? DEFAULT_BUDGET_CONTROL.fallbackToCheapModels,
			warnAtEightyPercent: parsed.warnAtEightyPercent ?? DEFAULT_BUDGET_CONTROL.warnAtEightyPercent,
		};
	} catch {
		return DEFAULT_BUDGET_CONTROL;
	}
}

export function persistBudgetControl(state: BudgetControlState) {
	try {
		window.localStorage.setItem(BUDGET_CONTROL_STORAGE_KEY, JSON.stringify(state));
	} catch {
		/* private mode / blocked storage */
	}
}
