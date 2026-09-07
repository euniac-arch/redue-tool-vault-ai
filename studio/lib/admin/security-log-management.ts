/**
 * Admin "보안 및 접속 로그 관리" — shared types and display helpers.
 * Persistence lives in Prisma `SecurityAccessLog`; the dashboard reads
 * through `/api/admin/security-logs*`.
 */

export const GUEST_EMAIL = 'Guest';

export type SecurityEventType =
	| 'LOGIN_SUCCESS'
	| 'LOGIN_FAIL'
	| 'LOGOUT'
	| 'ADMIN_ACCESS'
	| 'ADMIN_ACCESS_DENIED'
	| 'API_QUOTA_EXCEEDED'
	| 'PASSWORD_RESET';

export type SecurityLogStatus = 'SUCCESS' | 'WARNING' | 'FAIL';
export type SortDirection = 'asc' | 'desc';

/** @deprecated Use SecurityEventType. Kept for older call sites. */
export type LogAction = SecurityEventType;
/** @deprecated Use SecurityLogStatus. */
export type LogSeverity = 'info' | 'warning' | 'critical';

export type SecurityLog = {
	id: string;
	/** `YYYY-MM-DD HH:mm:ss` */
	timestamp: string;
	eventType: SecurityEventType;
	userEmail: string;
	ipAddress: string;
	userAgent: string;
	country: string;
	device: string;
	status: SecurityLogStatus;
	details: string;
};

export type SecurityLogFilters = {
	query: string;
	eventType: 'all' | SecurityEventType;
	status: 'all' | SecurityLogStatus;
	from: string;
	to: string;
};

export type SecurityLogKpi = {
	todayAccessCount: number;
	failedOrSuspiciousCount: number;
	activeAdminCount: number;
};

export const PAGE_SIZE = 25;

export const EMPTY_SECURITY_LOG_KPI: SecurityLogKpi = {
	todayAccessCount: 0,
	failedOrSuspiciousCount: 0,
	activeAdminCount: 0,
};

export const SECURITY_EVENT_TYPES: SecurityEventType[] = [
	'LOGIN_SUCCESS',
	'LOGIN_FAIL',
	'LOGOUT',
	'ADMIN_ACCESS',
	'ADMIN_ACCESS_DENIED',
	'API_QUOTA_EXCEEDED',
	'PASSWORD_RESET',
];

export const SECURITY_LOG_STATUSES: SecurityLogStatus[] = ['SUCCESS', 'WARNING', 'FAIL'];

export const EVENT_TYPE_LABEL: Record<SecurityEventType, string> = {
	LOGIN_SUCCESS: '로그인 성공',
	LOGIN_FAIL: '로그인 실패',
	LOGOUT: '로그아웃',
	ADMIN_ACCESS: '관리자 접근',
	ADMIN_ACCESS_DENIED: '관리자 접근 거부',
	API_QUOTA_EXCEEDED: 'API 쿼터 초과',
	PASSWORD_RESET: '비밀번호 재설정',
};

export const STATUS_LABEL: Record<SecurityLogStatus, string> = {
	SUCCESS: '성공',
	WARNING: '의심',
	FAIL: '실패',
};

const COUNTRY_LABEL: Record<string, string> = {
	KR: '대한민국',
	US: '미국',
	JP: '일본',
	CN: '중국',
	TW: '대만',
	HK: '홍콩',
	SG: '싱가포르',
	VN: '베트남',
	TH: '태국',
	ID: '인도네시아',
	IN: '인도',
	GB: '영국',
	DE: '독일',
	FR: '프랑스',
	AU: '호주',
	CA: '캐나다',
	RU: '러시아',
	BR: '브라질',
	PH: '필리핀',
	MY: '말레이시아',
	UNKNOWN: '알 수 없음',
};

export function countryLabel(code: string): string {
	const normalized = (code || 'KR').trim().toUpperCase() || 'KR';
	return COUNTRY_LABEL[normalized] || normalized;
}

export function formatIpCountry(ipAddress: string, country: string): string {
	return `${ipAddress} / ${countryLabel(country)}`;
}

export function isSecurityEventType(value: string | null | undefined): value is SecurityEventType {
	return Boolean(value && SECURITY_EVENT_TYPES.includes(value as SecurityEventType));
}

export function isSecurityLogStatus(value: string | null | undefined): value is SecurityLogStatus {
	return Boolean(value && SECURITY_LOG_STATUSES.includes(value as SecurityLogStatus));
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

export function isSuccessfulLog(log: Pick<SecurityLog, 'status'>): boolean {
	return log.status === 'SUCCESS';
}

export function csvEscape(value: string): string {
	if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
	return value;
}

export function toCsv(rows: SecurityLog[]): string {
	const header = ['일시', '이벤트', '사용자', 'IP', '국가', '브라우저/기기', '상태', '상세'];
	const lines = rows.map((row) =>
		[
			row.timestamp,
			EVENT_TYPE_LABEL[row.eventType],
			row.userEmail,
			row.ipAddress,
			countryLabel(row.country),
			row.device,
			STATUS_LABEL[row.status],
			row.details,
		]
			.map((cell) => csvEscape(String(cell)))
			.join(','),
	);
	return [header.join(','), ...lines].join('\n');
}

/** Legacy aliases used by older UI helpers. */
export const ACTION_LABEL = EVENT_TYPE_LABEL;
