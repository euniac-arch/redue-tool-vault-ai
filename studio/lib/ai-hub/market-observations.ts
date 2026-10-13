/**
 * Published AI market observations.
 *
 * Web-traffic share, referral share, and company-reported usage stay in
 * separate blocks. Shares are the figures a source published for one
 * comparison set and one month — they are not rescaled, jittered, or mixed
 * with catalog visit strings.
 */

export const SHARE_UNAVAILABLE_LABEL = '점유율 데이터 미확보';
export const VISITS_UNAVAILABLE_LABEL = '방문량 미확보';
export const SHARE_SUM_TOLERANCE = 1.5;
export const SHARE_JUMP_REVIEW_PP = 8;

/** Watched secondary page. This is not a Similarweb primary dataset. */
export const PRIMARY_SOURCE_URL = 'https://www.platelunchcollective.com/research/retrieval-layer-intelligence';
/** Fixed secondary article. A newer month on another URL is not discovered here. */
export const CORROBORATION_SOURCE_URL =
	'https://officechai.com/ai/geminis-traffic-share-falls-for-fourth-straight-month-as-chatgpt-regains-ground-similarweb-data/';

export const WEB_TRAFFIC_COHORT = ['chatgpt', 'gemini', 'claude', 'deepseek', 'grok', 'ms-copilot', 'perplexity'] as const;
export const REFERRAL_COHORT = ['chatgpt', 'gemini', 'perplexity', 'ms-copilot', 'claude'] as const;

const MONTHS: Record<string, number> = {
	january: 1,
	february: 2,
	march: 3,
	april: 4,
	may: 5,
	june: 6,
	july: 7,
	august: 8,
	september: 9,
	october: 10,
	november: 11,
	december: 12,
};

const ASSISTANT_PATTERNS: Array<{ serviceId: string; serviceName: string; pattern: RegExp }> = [
	{ serviceId: 'chatgpt', serviceName: 'ChatGPT', pattern: /ChatGPT\s+(\d{1,2}(?:\.\d+)?)%\s+(\d{1,2}(?:\.\d+)?)%/i },
	{ serviceId: 'gemini', serviceName: 'Gemini', pattern: /Gemini\s+(\d{1,2}(?:\.\d+)?)%\s+(\d{1,2}(?:\.\d+)?)%/i },
	{ serviceId: 'claude', serviceName: 'Claude', pattern: /Claude\s+(\d{1,2}(?:\.\d+)?)%\s+(\d{1,2}(?:\.\d+)?)%/i },
	{ serviceId: 'deepseek', serviceName: 'DeepSeek', pattern: /DeepSeek\s+(\d{1,2}(?:\.\d+)?)%\s+(\d{1,2}(?:\.\d+)?)%/i },
	{ serviceId: 'grok', serviceName: 'Grok', pattern: /Grok\s+(\d{1,2}(?:\.\d+)?)%\s+(\d{1,2}(?:\.\d+)?)%/i },
	{ serviceId: 'ms-copilot', serviceName: 'Copilot', pattern: /Copilot\s+(\d{1,2}(?:\.\d+)?)%\s+(\d{1,2}(?:\.\d+)?)%/i },
	{ serviceId: 'perplexity', serviceName: 'Perplexity', pattern: /Perplexity\s+(\d{1,2}(?:\.\d+)?)%\s+(\d{1,2}(?:\.\d+)?)%/i },
];

export type MarketCheckStatus =
	| 'seed'
	| 'secondary_corroborated'
	| 'single_secondary_source'
	| 'confirmed_unchanged'
	| 'updated'
	| 'admin_approved'
	| 'kept_previous'
	| 'check_failed'
	| 'review_required';

export type MarketConfidence = 'high' | 'medium' | 'low';

export type MarketSourceRole = 'primary' | 'secondary' | 'corroboration' | 'cited_unfetched';

export type MarketSourceLink = {
	label: string;
	url: string;
	role: MarketSourceRole;
};

export type ServiceShareRow = {
	serviceId: string;
	serviceName: string;
	sharePct: number;
	momChangePp: number | null;
	rank: number;
};

export type MetricBlock = {
	metricType: 'web_traffic_share' | 'ai_referral_share';
	metricLabel: string;
	provider: string;
	sourceType: 'secondary_publication' | 'primary_dataset' | 'company_statement';
	sourceName: string;
	sourceUrl: string;
	sources: MarketSourceLink[];
	periodStart: string;
	periodEnd: string;
	periodLabel: string;
	publishedAt: string;
	isEstimated: boolean;
	confidenceLevel: MarketConfidence;
	validationStatus: 'passed' | 'review_required' | 'rejected';
	notes: string[];
	rows: ServiceShareRow[];
};

export type MarketBundle = {
	revision: number;
	granularity: 'monthly' | 'daily';
	checkedAt: string | null;
	checkStatus: MarketCheckStatus;
	checkNote: string;
	domainPolicy: string[];
	webTraffic: MetricBlock;
	referral: MetricBlock | null;
	visitFootnote: string | null;
	usageFootnote: string | null;
};

export type MarketCheckCandidate = {
	periodStart: string;
	periodEnd: string;
	periodLabel: string;
	metricType: 'web_traffic_share';
	sourceUrl: string;
	rows: Array<{ serviceId: string; serviceName: string; sharePct: number }>;
};

export type MarketCheckLog = {
	date: string;
	checkedAt: string;
	status: MarketCheckStatus;
	note: string;
	error?: string;
	candidate?: MarketCheckCandidate;
};

export type ParsedWebTrafficTable = {
	periodStart: string;
	periodEnd: string;
	periodLabel: string;
	rows: ServiceShareRow[];
};

type ShareCarrier = { serviceId: string; sharePct: number };

export function stripHtml(value: string): string {
	return value
		.replace(/<script[\s\S]*?<\/script>/gi, ' ')
		.replace(/<style[\s\S]*?<\/style>/gi, ' ')
		.replace(/<[^>]+>/g, ' ')
		.replace(/&nbsp;/gi, ' ')
		.replace(/&amp;/gi, '&')
		.replace(/&#37;/g, '%')
		.replace(/\s+/g, ' ')
		.trim();
}

function pad2(value: number): string {
	return String(value).padStart(2, '0');
}

function daysInMonth(year: number, month: number): number {
	return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function periodDaySpan(start: string, end: string): number {
	const from = Date.parse(`${start}T00:00:00Z`);
	const to = Date.parse(`${end}T00:00:00Z`);
	if (!Number.isFinite(from) || !Number.isFinite(to)) return Number.NaN;
	return Math.round((to - from) / 86_400_000);
}

/** Daily growth must not be synthesized from a month-long observation. */
export function periodGranularity(start: string, end: string): 'daily' | 'monthly' | 'other' {
	const span = periodDaySpan(start, end);
	if (!Number.isFinite(span)) return 'other';
	if (span <= 1) return 'daily';
	if (span >= 27 && span <= 31) return 'monthly';
	return 'other';
}

export function shouldRunDailyCheck(lastCheckDate: string | null, today: string): boolean {
	return lastCheckDate !== today;
}

export function formatMomPp(value: number | null | undefined): string | null {
	if (typeof value !== 'number' || !Number.isFinite(value)) return null;
	const rounded = Math.round(value * 10) / 10;
	return `${rounded > 0 ? '+' : ''}${rounded.toFixed(1)}%p`;
}

export function checkStatusLabel(status: MarketCheckStatus): string {
	switch (status) {
		case 'seed':
			return '저장소의 마지막 2차 인용본';
		case 'secondary_corroborated':
			return '2차 출처 일치 · Similarweb 원문 미수집';
		case 'single_secondary_source':
			return '단일 2차 출처 · Similarweb 원문 미수집';
		case 'confirmed_unchanged':
			return '2차 출처 검증 · Similarweb 원문 미수집';
		case 'updated':
			return '오늘 확인 · 새 관측 반영';
		case 'admin_approved':
			return '관리자 승인 반영 · Similarweb 원문 미수집';
		case 'kept_previous':
			return '오늘 확인 · 이전 검증본 유지';
		case 'check_failed':
			return '출처 확인 실패 · 이전 검증본 유지';
		case 'review_required':
			return '검토 필요 · 이전 검증본 유지';
		default:
			return '이전 검증본 유지';
	}
}

/**
 * A stored `confirmed_unchanged` document is the older status name.
 * The same September snapshot stays at the secondary-source level.
 * It is not presented as a completed primary-source check, and this does not write Firestore.
 */
export function interpretLegacyMarketStatus(bundle: MarketBundle, reference: MarketBundle): MarketBundle {
	if (bundle.checkStatus !== 'confirmed_unchanged') return bundle;
	const samePeriod =
		bundle.webTraffic.periodStart === reference.webTraffic.periodStart && bundle.webTraffic.periodEnd === reference.webTraffic.periodEnd;
	const prior = new Map(reference.webTraffic.rows.map((row) => [row.serviceId, row.sharePct]));
	const sameShares =
		bundle.webTraffic.rows.length === reference.webTraffic.rows.length &&
		bundle.webTraffic.rows.every((row) => prior.get(row.serviceId) === row.sharePct);
	if (!samePeriod || !sameShares) {
		return {
			...bundle,
			checkNote: '저장된 상태값은 이전 이름입니다. Similarweb 원문은 확인하지 않았으며, 공개 수치는 마지막 저장본입니다.',
		};
	}
	return {
		...bundle,
		checkStatus: 'secondary_corroborated',
		checkNote: reference.checkNote,
		webTraffic: {
			...bundle.webTraffic,
			sourceName: reference.webTraffic.sourceName,
			sourceType: reference.webTraffic.sourceType,
			sources: reference.webTraffic.sources,
			notes: reference.webTraffic.notes,
		},
	};
}

export function listWebTrafficRows(bundle: MarketBundle): ServiceShareRow[] {
	return [...bundle.webTraffic.rows].sort((a, b) => a.rank - b.rank || a.serviceId.localeCompare(b.serviceId));
}

export function marketCacheToken(bundle: MarketBundle): string {
	return `${bundle.revision}:${bundle.webTraffic.periodEnd}:${bundle.checkedAt ?? 'unchecked'}:${bundle.checkStatus}`;
}

export function rankShareRows(rows: Array<Omit<ServiceShareRow, 'rank'> & { rank?: number }>): ServiceShareRow[] {
	const sorted = [...rows].sort((a, b) => b.sharePct - a.sharePct || a.serviceId.localeCompare(b.serviceId));
	return sorted.map((row, index) => ({
		serviceId: row.serviceId,
		serviceName: row.serviceName,
		sharePct: row.sharePct,
		momChangePp: row.momChangePp ?? null,
		rank: index + 1,
	}));
}

export function validateShareRows(
	rows: ServiceShareRow[],
	options?: { allowedIds?: readonly string[]; requireAll?: boolean },
): { ok: boolean; errors: string[]; sum: number } {
	const errors: string[] = [];
	const seen = new Set<string>();
	let sum = 0;
	const allowed = options?.allowedIds ? new Set(options.allowedIds) : null;
	for (const row of rows) {
		if (!row.serviceId || seen.has(row.serviceId)) errors.push(`duplicate or empty service: ${row.serviceId || '(blank)'}`);
		seen.add(row.serviceId);
		if (row.serviceId.includes('spaces')) errors.push(`sub-feature counted as its own service: ${row.serviceId}`);
		if (allowed && !allowed.has(row.serviceId)) errors.push(`outside comparison set: ${row.serviceId}`);
		if (!(row.sharePct >= 0) || row.sharePct > 100 || !Number.isFinite(row.sharePct)) {
			errors.push(`share out of range: ${row.serviceId}`);
		}
		sum += Number.isFinite(row.sharePct) ? row.sharePct : 0;
	}
	if (options?.requireAll && allowed) {
		for (const id of allowed) {
			if (!seen.has(id)) errors.push(`missing service: ${id}`);
		}
	}
	const rounded = Math.round(sum * 10) / 10;
	if (rows.length > 0 && Math.abs(rounded - 100) > SHARE_SUM_TOLERANCE) errors.push(`share sum ${rounded}`);
	return { ok: errors.length === 0, errors, sum: rounded };
}

export function validateMetricBlock(block: MetricBlock, options?: { allowedIds?: readonly string[]; requireAll?: boolean }): string[] {
	const errors: string[] = [];
	if (!block.sourceUrl || !/^https:\/\//.test(block.sourceUrl)) errors.push('missing source url');
	if (!block.provider) errors.push('missing provider');
	if (!/^\d{4}-\d{2}-\d{2}$/.test(block.periodStart) || !/^\d{4}-\d{2}-\d{2}$/.test(block.periodEnd)) {
		errors.push('missing measurement period');
	} else if (block.periodStart.slice(0, 7) !== block.periodEnd.slice(0, 7)) {
		errors.push('measurement period mixes months');
	}
	if (periodGranularity(block.periodStart, block.periodEnd) === 'other') errors.push('measurement period is neither a day nor a month');
	errors.push(...validateShareRows(block.rows, options).errors);
	return errors;
}

export function assertValidBundle(input: unknown): MarketBundle {
	const bundle = input as MarketBundle;
	const errors = [
		...validateMetricBlock(bundle?.webTraffic, { allowedIds: WEB_TRAFFIC_COHORT, requireAll: true }),
		...(bundle?.referral ? validateMetricBlock(bundle.referral, { allowedIds: REFERRAL_COHORT, requireAll: true }) : []),
	];
	if (!bundle?.domainPolicy?.length) errors.push('missing domain policy');
	if (bundle?.granularity !== 'monthly' && bundle?.granularity !== 'daily') errors.push('missing granularity');
	if (bundle?.webTraffic && periodGranularity(bundle.webTraffic.periodStart, bundle.webTraffic.periodEnd) === 'daily' && bundle.granularity !== 'daily') {
		errors.push('daily period labeled as a longer metric');
	}
	if (errors.length) throw new Error(`market bundle failed validation: ${errors.join('; ')}`);
	return bundle;
}

function monthWindow(label: string): { periodStart: string; periodEnd: string; periodLabel: string } | null {
	const match = /^(January|February|March|April|May|June|July|August|September|October|November|December)\s+(20\d{2})$/i.exec(label.trim());
	if (!match) return null;
	const month = MONTHS[match[1].toLowerCase()];
	const year = Number(match[2]);
	if (!month || !year) return null;
	const last = daysInMonth(year, month);
	return {
		periodStart: `${year}-${pad2(month)}-01`,
		periodEnd: `${year}-${pad2(month)}-${pad2(last)}`,
		periodLabel: `${year}년 ${month}월 관측 데이터`,
	};
}

const MONTH_PATTERN = /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(20\d{2})\b/gi;

export type WebTrafficClassification =
	| { status: 'parsed'; table: ParsedWebTrafficTable }
	| { status: 'rejected'; reason: string };

function webTrafficSlice(text: string): { slice: string; reason?: string } {
	const lower = text.toLowerCase();
	const anchor = lower.indexOf('ai assistant web traffic share');
	if (anchor < 0) return { slice: '', reason: 'web traffic heading missing' };
	const referralAt = lower.indexOf('ai referral traffic', anchor + 10);
	const end = referralAt > anchor ? referralAt : Math.min(text.length, anchor + 5000);
	return { slice: text.slice(anchor, end) };
}

function observationMonth(slice: string): { periodStart: string; periodEnd: string; periodLabel: string } | null {
	const months = [...slice.matchAll(MONTH_PATTERN)];
	for (let index = 0; index < months.length - 1; index += 1) {
		const current = months[index];
		const next = months[index + 1];
		if (current.index == null || next.index == null) continue;
		if (next.index - current.index < 80) {
			return monthWindow(current[0]);
		}
	}
	return months[0] ? monthWindow(months[0][0]) : null;
}

/**
 * Reads only the web-traffic section. The referral table, including its April
 * comparison column, is cut off before parsing. The first of two adjacent
 * month headings is the observation column.
 */
export function classifyWebTrafficPage(page: string): WebTrafficClassification {
	const text = stripHtml(page);
	const { slice, reason } = webTrafficSlice(text);
	if (!slice) return { status: 'rejected', reason: reason ?? 'web traffic heading missing' };
	if (!/similarweb/i.test(slice)) return { status: 'rejected', reason: 'web traffic section has no Similarweb attribution' };
	const firstShare = slice.search(/ChatGPT\s+\d/i);
	const statcounterAt = slice.search(/statcounter/i);
	if (statcounterAt >= 0 && (firstShare < 0 || statcounterAt < firstShare)) {
		return { status: 'rejected', reason: 'section is referral traffic, not website-visit share' };
	}
	const period = observationMonth(slice);
	if (!period) return { status: 'rejected', reason: 'observation month missing' };
	if (periodGranularity(period.periodStart, period.periodEnd) !== 'monthly') {
		return { status: 'rejected', reason: 'observation period is not a calendar month' };
	}
	const parsed: Array<Omit<ServiceShareRow, 'rank'>> = [];
	for (const assistant of ASSISTANT_PATTERNS) {
		const match = assistant.pattern.exec(slice);
		if (!match) return { status: 'rejected', reason: `missing ${assistant.serviceName} in the web-traffic table` };
		if (!slice.toLowerCase().includes(assistant.serviceName.toLowerCase())) {
			return { status: 'rejected', reason: `service name missing: ${assistant.serviceName}` };
		}
		parsed.push({
			serviceId: assistant.serviceId,
			serviceName: assistant.serviceName,
			sharePct: Number(match[1]),
			momChangePp: null,
		});
	}
	const rows = rankShareRows(parsed);
	const validation = validateShareRows(rows, { allowedIds: WEB_TRAFFIC_COHORT, requireAll: true });
	const structural = validation.errors.filter((error) => !error.startsWith('share sum'));
	if (structural.length) return { status: 'rejected', reason: structural.join('; ') };
	return { status: 'parsed', table: { ...period, rows } };
}

export function parseWebTrafficTable(page: string): ParsedWebTrafficTable | null {
	const classified = classifyWebTrafficPage(page);
	return classified.status === 'parsed' ? classified.table : null;
}

export function textCorroboratesShares(
	page: string,
	rows: Array<{ serviceName: string; sharePct: number }>,
	periodStart?: string,
): boolean {
	const text = stripHtml(page);
	if (periodStart) {
		const month = Number(periodStart.slice(5, 7));
		const year = periodStart.slice(0, 4);
		const monthName = Object.entries(MONTHS).find(([, value]) => value === month)?.[0];
		if (!monthName || !new RegExp(`\\b${monthName}\\s+${year}\\b`, 'i').test(text)) return false;
	}
	return rows.every((row) => {
		const pct = row.sharePct.toFixed(1);
		const name = row.serviceName.toLowerCase();
		let from = 0;
		while (from < text.length) {
			const at = text.toLowerCase().indexOf(name, from);
			if (at < 0) return false;
			const window = text.slice(at, at + row.serviceName.length + 280);
			if (window.includes(pct) || window.includes(`${row.sharePct}%`)) return true;
			from = at + name.length;
		}
		return false;
	});
}

export function maxShareJump(previous: ShareCarrier[], next: ShareCarrier[]): number {
	const prior = new Map(previous.map((row) => [row.serviceId, row.sharePct]));
	let max = 0;
	for (const row of next) {
		const before = prior.get(row.serviceId);
		if (before == null) return Number.POSITIVE_INFINITY;
		max = Math.max(max, Math.abs(row.sharePct - before));
	}
	for (const row of previous) {
		if (!next.some((item) => item.serviceId === row.serviceId)) return Number.POSITIVE_INFINITY;
	}
	return max;
}

function sameShares(left: ShareCarrier[], right: ShareCarrier[]): boolean {
	if (left.length !== right.length) return false;
	const prior = new Map(right.map((row) => [row.serviceId, row.sharePct]));
	return left.every((row) => prior.get(row.serviceId) === row.sharePct);
}

function withCheck(bundle: MarketBundle, checkedAt: string, status: MarketCheckStatus, note: string): MarketBundle {
	return { ...bundle, checkedAt, checkStatus: status, checkNote: note };
}

export async function resolveMarketCheck(options: {
	current: MarketBundle;
	lastCheckDate: string | null;
	today: string;
	now?: Date;
	fetchText: (url: string) => Promise<string>;
}): Promise<{ bundle: MarketBundle; lastCheckDate: string; fetched: boolean; log: MarketCheckLog }> {
	const now = options.now ?? new Date();
	const checkedAt = now.toISOString();
	const staleEvidence = options.current.checkStatus === 'confirmed_unchanged';
	if (!shouldRunDailyCheck(options.lastCheckDate, options.today) && !staleEvidence) {
		return {
			bundle: options.current,
			lastCheckDate: options.today,
			fetched: false,
			log: {
				date: options.today,
				checkedAt: options.current.checkedAt ?? checkedAt,
				status: options.current.checkStatus,
				note: '같은 KST 날짜의 확인이 이미 있어 다시 수집하지 않았습니다.',
			},
		};
	}

	const finish = (bundle: MarketBundle, log: MarketCheckLog) => ({
		bundle,
		lastCheckDate: options.today,
		fetched: true,
		log,
	});
	const keep = (status: MarketCheckStatus, note: string, extra?: Pick<MarketCheckLog, 'error' | 'candidate'>) =>
		finish(withCheck(options.current, checkedAt, status, note), {
			date: options.today,
			checkedAt,
			status,
			note,
			...extra,
		});

	try {
		let plateText: string | null = null;
		let plateError: string | undefined;
		let officeText: string | null = null;
		let officeError: string | undefined;
		try {
			plateText = await options.fetchText(PRIMARY_SOURCE_URL);
		} catch (error) {
			plateError = error instanceof Error ? error.message : String(error);
		}
		try {
			officeText = await options.fetchText(CORROBORATION_SOURCE_URL);
		} catch (error) {
			officeError = error instanceof Error ? error.message : String(error);
		}
		if (!plateText && !officeText) {
			return keep('check_failed', '2차 출처 요청에 실패했습니다. 마지막 관측을 유지합니다. Similarweb 원문은 수집하지 않습니다.', {
				error: [plateError, officeError].filter(Boolean).join('; '),
			});
		}

		const classified = plateText ? classifyWebTrafficPage(plateText) : { status: 'rejected' as const, reason: plateError ?? 'plate lunch unavailable' };
		const officeAgreesCurrent = officeText
			? textCorroboratesShares(officeText, options.current.webTraffic.rows, options.current.webTraffic.periodStart)
			: false;

		if (classified.status === 'rejected') {
			if (officeAgreesCurrent) {
				const note = `Plate Lunch 웹 트래픽 표를 채택하지 못했습니다 (${classified.reason}). OfficeChai 기사만 기존 ${options.current.webTraffic.periodLabel}와 같습니다. Similarweb 원문은 미수집입니다.`;
				return keep('single_secondary_source', note, { error: classified.reason });
			}
			const note = '웹 트래픽 표의 제목·기간·서비스·지표 검증을 통과하지 못했습니다. 마지막 관측을 유지합니다.';
			return keep('check_failed', note, { error: [classified.reason, officeError].filter(Boolean).join('; ') });
		}

		const table = classified.table;
		const officeAgreesTable = officeText ? textCorroboratesShares(officeText, table.rows, table.periodStart) : false;
		const unchanged = sameShares(table.rows, options.current.webTraffic.rows) && table.periodStart === options.current.webTraffic.periodStart;
		if (unchanged) {
			if (officeAgreesTable) {
				const note = `Plate Lunch Collective와 OfficeChai가 같은 ${options.current.webTraffic.periodLabel} 웹 방문 점유율을 인용합니다. Similarweb 원문은 수집하지 않았으므로 1차 검증이 아닙니다.`;
				return keep('secondary_corroborated', note);
			}
			const note = `Plate Lunch의 웹 트래픽 표만 기존 관측과 같습니다. OfficeChai는 확인되지 않았습니다${officeError ? ` (${officeError})` : ''}. Similarweb 원문은 미수집입니다.`;
			return keep('single_secondary_source', note, { error: officeError });
		}

		const jump = maxShareJump(options.current.webTraffic.rows, table.rows);
		const newer = table.periodStart > options.current.webTraffic.periodStart;
		const jumpNote = jump > SHARE_JUMP_REVIEW_PP ? ` 최대 변동 ${jump}pp는 8%p 검토 기준을 넘습니다.` : '';
		const note = newer
			? `감시 중인 Plate Lunch 페이지에서 ${table.periodLabel} 웹 트래픽 표가 보였습니다. Similarweb 원문이 없어 반영하지 않고 검토로 남깁니다.${jumpNote}`
			: `감시 중인 2차 페이지의 기간·수치·표가 기존 관측과 다릅니다. 공개 수치는 바꾸지 않습니다.${jumpNote}`;
		return keep('review_required', note, {
			error: officeAgreesTable ? undefined : 'OfficeChai가 같은 기간과 수치를 확인하지 못했습니다.',
			candidate: {
				periodStart: table.periodStart,
				periodEnd: table.periodEnd,
				periodLabel: table.periodLabel,
				metricType: 'web_traffic_share',
				sourceUrl: PRIMARY_SOURCE_URL,
				rows: table.rows.map((row) => ({
					serviceId: row.serviceId,
					serviceName: row.serviceName,
					sharePct: row.sharePct,
				})),
			},
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.error('[ai-market] source check failed:', message);
		const note = '출처 요청에 실패했습니다. 마지막 관측을 유지합니다.';
		return keep('check_failed', note, { error: message });
	}
}

export type PublicMarketTool = {
	id: string;
	category: string;
	name: string;
	recommend_score: number;
};

export type PublicMarketRankFields = {
	webTrafficSharePct: number | null;
	webTrafficRank: number | null;
	webTrafficMomPp: number | null;
	rankBasis: 'web_traffic' | 'editorial';
	categoryRank: number;
	currentRank: number;
	previousRank: number;
	previousCategoryRank: number;
	rankDelta: number;
	isNew: false;
	isHot: false;
	isRising: false;
	status: 'ranked';
};

/** Overlay verified web-traffic ranks. Tools outside the comparison set stay unranked instead of 0%. */
export function applyPublicMarketView<T extends PublicMarketTool>(tools: T[], bundle: MarketBundle): Array<T & PublicMarketRankFields> {
	const byId = new Map(bundle.webTraffic.rows.map((row) => [row.serviceId, row]));
	const annotated = tools.map((tool) => {
		const row = byId.get(tool.id);
		return {
			...tool,
			webTrafficSharePct: row ? row.sharePct : null,
			webTrafficRank: row ? row.rank : null,
			webTrafficMomPp: row ? row.momChangePp : null,
			rankBasis: row ? ('web_traffic' as const) : ('editorial' as const),
		};
	});
	const groups = new Map<string, typeof annotated>();
	for (const tool of annotated) {
		const list = groups.get(tool.category) ?? [];
		list.push(tool);
		groups.set(tool.category, list);
	}
	const categoryRank = new Map<string, number>();
	for (const group of groups.values()) {
		const ordered = [...group].sort((a, b) => {
			if (a.webTrafficRank != null && b.webTrafficRank != null) return a.webTrafficRank - b.webTrafficRank;
			if (a.webTrafficRank != null) return -1;
			if (b.webTrafficRank != null) return 1;
			return b.recommend_score - a.recommend_score || a.name.localeCompare(b.name, 'ko') || a.id.localeCompare(b.id);
		});
		ordered.forEach((tool, index) => categoryRank.set(tool.id, index + 1));
	}
	return annotated.map((tool) => {
		const cat = categoryRank.get(tool.id) ?? 0;
		const current = tool.webTrafficRank ?? 0;
		return {
			...tool,
			categoryRank: cat,
			currentRank: current,
			previousRank: current,
			previousCategoryRank: cat,
			rankDelta: 0,
			isNew: false as const,
			isHot: false as const,
			isRising: false as const,
			status: 'ranked' as const,
		};
	});
}
