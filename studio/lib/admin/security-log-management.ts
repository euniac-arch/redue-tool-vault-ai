/**
 * Admin "보안 및 접속 로그 관리" — types, mock data, and pure helpers.
 *
 * Mirrors the shape the future auth/audit-log table will return once real
 * login telemetry is wired up (see `studio/lib/admin/security-log-service.ts`
 * for the swap point).
 */

export type LogAction = 'LOGIN_SUCCESS' | 'LOGIN_FAILED' | 'PASSWORD_RESET' | 'ADMIN_ACCESS_DENIED';
export type LogSeverity = 'info' | 'warning' | 'critical';
export type LogSortKey = 'timestamp';
export type SortDirection = 'asc' | 'desc';

export type SecurityLog = {
	id: string;
	/** `YYYY-MM-DD HH:mm:ss` */
	timestamp: string;
	/** Email, or '비회원/Guest' for unauthenticated attempts. */
	userEmail: string;
	ipAddress: string;
	location: string;
	device: string;
	action: LogAction;
	severity: LogSeverity;
};

export type SecurityLogFilters = {
	query: string;
	severity: 'all' | LogSeverity;
};

export type SecurityLogKpi = {
	todayLoginAttempts: number;
	abnormalAttempts: number;
	blockedSuspiciousIps: number;
};

export const PAGE_SIZE = 10;

export const SECURITY_LOG_KPI_MOCK: SecurityLogKpi = {
	todayLoginAttempts: 486,
	abnormalAttempts: 23,
	blockedSuspiciousIps: 7,
};

export const MOCK_SECURITY_LOGS: SecurityLog[] = [
	{
		id: 'LOG-90142',
		timestamp: '2026-08-23 22:41:03',
		userEmail: 'dr.bae@nineoneclinic.com',
		ipAddress: '211.216.48.19',
		location: '대한민국 대구',
		device: 'Windows / Chrome',
		action: 'LOGIN_SUCCESS',
		severity: 'info',
	},
	{
		id: 'LOG-90141',
		timestamp: '2026-08-23 22:12:47',
		userEmail: '비회원/Guest',
		ipAddress: '45.134.140.22',
		location: '알 수 없음(VPN 의심)',
		device: 'Linux / curl',
		action: 'ADMIN_ACCESS_DENIED',
		severity: 'critical',
	},
	{
		id: 'LOG-90140',
		timestamp: '2026-08-23 21:58:15',
		userEmail: 'seo_master@kakao.com',
		ipAddress: '121.167.22.88',
		location: '대한민국 서울',
		device: 'macOS / Safari',
		action: 'LOGIN_SUCCESS',
		severity: 'info',
	},
	{
		id: 'LOG-90139',
		timestamp: '2026-08-23 21:44:02',
		userEmail: 'abuser_bot@tempmail.com',
		ipAddress: '185.220.101.44',
		location: '러시아',
		device: 'Linux / Headless Chrome',
		action: 'LOGIN_FAILED',
		severity: 'critical',
	},
	{
		id: 'LOG-90138',
		timestamp: '2026-08-23 21:30:55',
		userEmail: 'abuser_bot@tempmail.com',
		ipAddress: '185.220.101.44',
		location: '러시아',
		device: 'Linux / Headless Chrome',
		action: 'LOGIN_FAILED',
		severity: 'critical',
	},
	{
		id: 'LOG-90137',
		timestamp: '2026-08-23 20:52:31',
		userEmail: 'clinic_admin@seoul-plastic.com',
		ipAddress: '211.45.12.91',
		location: '대한민국 서울',
		device: 'Windows / Edge',
		action: 'PASSWORD_RESET',
		severity: 'warning',
	},
	{
		id: 'LOG-90136',
		timestamp: '2026-08-23 20:15:09',
		userEmail: 'growth_hacker@gmail.com',
		ipAddress: '35.216.88.14',
		location: '미국 오레곤',
		device: 'macOS / Chrome',
		action: 'LOGIN_SUCCESS',
		severity: 'info',
	},
	{
		id: 'LOG-90135',
		timestamp: '2026-08-23 19:48:22',
		userEmail: 'paused.user@outlook.com',
		ipAddress: '39.7.18.201',
		location: '대한민국 부산',
		device: 'iOS / Safari',
		action: 'LOGIN_FAILED',
		severity: 'warning',
	},
	{
		id: 'LOG-90134',
		timestamp: '2026-08-23 19:20:47',
		userEmail: 'paused.user@outlook.com',
		ipAddress: '39.7.18.201',
		location: '대한민국 부산',
		device: 'iOS / Safari',
		action: 'LOGIN_FAILED',
		severity: 'warning',
	},
	{
		id: 'LOG-90133',
		timestamp: '2026-08-23 18:59:10',
		userEmail: 'agency.lead@naver.com',
		ipAddress: '1.233.88.41',
		location: '대한민국 서울',
		device: 'Windows / Chrome',
		action: 'LOGIN_SUCCESS',
		severity: 'info',
	},
	{
		id: 'LOG-90132',
		timestamp: '2026-08-23 18:33:58',
		userEmail: 'geo.ops@redue.ai',
		ipAddress: '13.125.44.10',
		location: '대한민국 서울',
		device: 'macOS / Chrome',
		action: 'ADMIN_ACCESS_DENIED',
		severity: 'critical',
	},
	{
		id: 'LOG-90131',
		timestamp: '2026-08-23 17:47:36',
		userEmail: 'billing@gentle-amc.co.kr',
		ipAddress: '210.101.44.8',
		location: '대한민국 인천',
		device: 'Windows / Chrome',
		action: 'PASSWORD_RESET',
		severity: 'warning',
	},
	{
		id: 'LOG-90130',
		timestamp: '2026-08-23 17:05:14',
		userEmail: 'intern@startup-studio.io',
		ipAddress: '35.216.88.22',
		location: '미국 오레곤',
		device: 'Windows / Firefox',
		action: 'LOGIN_SUCCESS',
		severity: 'info',
	},
	{
		id: 'LOG-90129',
		timestamp: '2026-08-23 16:12:03',
		userEmail: '비회원/Guest',
		ipAddress: '103.94.12.7',
		location: '베트남',
		device: 'Android / Chrome',
		action: 'ADMIN_ACCESS_DENIED',
		severity: 'critical',
	},
	{
		id: 'LOG-90128',
		timestamp: '2026-08-23 15:30:12',
		userEmail: 'trial@temp-agency.kr',
		ipAddress: '175.223.44.66',
		location: '대한민국 서울',
		device: 'Android / Chrome',
		action: 'LOGIN_SUCCESS',
		severity: 'info',
	},
];

export function cloneSecurityLogs(source: SecurityLog[] = MOCK_SECURITY_LOGS): SecurityLog[] {
	return source.map((log) => ({ ...log }));
}

export function filterSecurityLogs(logs: SecurityLog[], filters: SecurityLogFilters): SecurityLog[] {
	const q = filters.query.trim().toLowerCase();
	return logs.filter((log) => {
		if (filters.severity !== 'all' && log.severity !== filters.severity) return false;
		if (!q) return true;
		return log.userEmail.toLowerCase().includes(q) || log.ipAddress.toLowerCase().includes(q);
	});
}

export function sortSecurityLogs(logs: SecurityLog[], direction: SortDirection): SecurityLog[] {
	const sign = direction === 'asc' ? 1 : -1;
	return [...logs].sort((a, b) => a.timestamp.localeCompare(b.timestamp) * sign);
}

export function paginateSecurityLogs<T>(items: T[], page: number, pageSize = PAGE_SIZE): T[] {
	const safePage = Math.max(1, page);
	const start = (safePage - 1) * pageSize;
	return items.slice(start, start + pageSize);
}

export function formatTimestamp(value: string): string {
	const normalized = value.includes('T') ? value : value.replace(' ', 'T');
	const date = new Date(normalized);
	if (Number.isNaN(date.getTime())) return value;
	return date.toLocaleString('ko-KR', {
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
	});
}

export const ACTION_LABEL: Record<LogAction, string> = {
	LOGIN_SUCCESS: '로그인 성공',
	LOGIN_FAILED: '로그인 실패',
	PASSWORD_RESET: '비밀번호 재설정',
	ADMIN_ACCESS_DENIED: '관리자 접근 거부',
};

/** Whether an action/severity pair should render as a "성공(초록)" outcome. */
export function isSuccessfulLog(log: Pick<SecurityLog, 'severity'>): boolean {
	return log.severity === 'info';
}

export function csvEscape(value: string): string {
	if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
	return value;
}

/** Serializes rows into a CSV string (UTF-8, header row included). */
export function toCsv(rows: SecurityLog[]): string {
	const header = ['일시', '계정', 'IP', '접속 위치', '접속 환경', '액션', '심각도'];
	const lines = rows.map((row) =>
		[row.timestamp, row.userEmail, row.ipAddress, row.location, row.device, ACTION_LABEL[row.action], row.severity]
			.map((cell) => csvEscape(String(cell)))
			.join(','),
	);
	return [header.join(','), ...lines].join('\n');
}
