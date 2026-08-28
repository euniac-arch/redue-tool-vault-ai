/**
 * Admin "시스템 운영 및 작업 내역" — types, mock data, and pure helpers.
 *
 * See `studio/lib/admin/systemLogService.ts` for the data-access seam.
 */

export type SystemLogModule = 'USER_MGMT' | 'CONTENT' | 'SYSTEM_CONFIG' | 'AUTH';
export type SystemLogResult = 'SUCCESS' | 'INFO' | 'PENDING';
export type SortDirection = 'asc' | 'desc';

export type SystemLog = {
	id: string;
	/** `YYYY-MM-DD HH:mm:ss` */
	timestamp: string;
	/** Operator nickname, or '시스템' for automated jobs. */
	operator: string;
	module: SystemLogModule;
	actionDetail: string;
	result: SystemLogResult;
};

export type SystemLogFilters = {
	query: string;
	module: 'all' | SystemLogModule;
};

export type SystemLogKpi = {
	totalJobs: number;
	todayChanges: number;
	pendingJobs: number;
};

export const PAGE_SIZE = 10;

export const MODULE_LABEL: Record<SystemLogModule, string> = {
	USER_MGMT: '회원 관리',
	CONTENT: '콘텐츠',
	SYSTEM_CONFIG: '시스템 설정',
	AUTH: '인증',
};

export const RESULT_LABEL: Record<SystemLogResult, string> = {
	SUCCESS: '성공',
	INFO: '안내',
	PENDING: '대기',
};

export const MOCK_SYSTEM_LOGS: SystemLog[] = [
	{
		id: 'SYS-8841',
		timestamp: '2026-08-23 22:41:03',
		operator: 'REDUE Ops',
		module: 'USER_MGMT',
		actionDetail: '회원 권한 변경 — geo.ops@redue.ai → 운영진',
		result: 'SUCCESS',
	},
	{
		id: 'SYS-8840',
		timestamp: '2026-08-23 21:18:44',
		operator: '한소희',
		module: 'CONTENT',
		actionDetail: '공지사항 게시 — NTC-2031 정기 서버 점검 안내',
		result: 'SUCCESS',
	},
	{
		id: 'SYS-8839',
		timestamp: '2026-08-23 20:05:12',
		operator: '시스템',
		module: 'SYSTEM_CONFIG',
		actionDetail: '시스템 설정 갱신 — API 쿼터 야간 리셋',
		result: 'INFO',
	},
	{
		id: 'SYS-8838',
		timestamp: '2026-08-23 19:32:08',
		operator: '박서준',
		module: 'AUTH',
		actionDetail: '세션 종료 — 관리자 콘솔 강제 로그아웃',
		result: 'SUCCESS',
	},
	{
		id: 'SYS-8837',
		timestamp: '2026-08-23 18:14:51',
		operator: 'REDUE Ops',
		module: 'CONTENT',
		actionDetail: '공지사항 임시저장 — Enterprise 할인 이벤트 초안',
		result: 'PENDING',
	},
	{
		id: 'SYS-8836',
		timestamp: '2026-08-23 16:40:27',
		operator: '김도현',
		module: 'USER_MGMT',
		actionDetail: '회원 크레딧 지급 — USR-1028 +50',
		result: 'SUCCESS',
	},
	{
		id: 'SYS-8835',
		timestamp: '2026-08-23 15:08:03',
		operator: '시스템',
		module: 'AUTH',
		actionDetail: '만료 세션 정리 — 14건 자동 종료',
		result: 'INFO',
	},
	{
		id: 'SYS-8834',
		timestamp: '2026-08-23 13:22:19',
		operator: '이하늘',
		module: 'SYSTEM_CONFIG',
		actionDetail: 'Firebase 환경값 갱신 승인 대기',
		result: 'PENDING',
	},
	{
		id: 'SYS-8833',
		timestamp: '2026-08-22 23:10:45',
		operator: '윤서연',
		module: 'CONTENT',
		actionDetail: '공지사항 게시 — GEO 리포트 v2 업데이트 안내',
		result: 'SUCCESS',
	},
	{
		id: 'SYS-8832',
		timestamp: '2026-08-22 18:55:01',
		operator: '시스템',
		module: 'SYSTEM_CONFIG',
		actionDetail: '시스템 설정 갱신 — 크롤링 큐 이중화 적용',
		result: 'SUCCESS',
	},
	{
		id: 'SYS-8831',
		timestamp: '2026-08-22 14:07:36',
		operator: '배준혁',
		module: 'USER_MGMT',
		actionDetail: '회원 상태 변경 — USR-1027 계정 정지',
		result: 'SUCCESS',
	},
	{
		id: 'SYS-8830',
		timestamp: '2026-08-22 11:28:14',
		operator: 'REDUE Ops',
		module: 'AUTH',
		actionDetail: '세션 종료 — 의심 IP 동시 세션 차단',
		result: 'INFO',
	},
	{
		id: 'SYS-8829',
		timestamp: '2026-08-21 17:44:50',
		operator: '한소희',
		module: 'CONTENT',
		actionDetail: '공지사항 보관 — 여름 시즌 프로모션',
		result: 'SUCCESS',
	},
	{
		id: 'SYS-8828',
		timestamp: '2026-08-21 09:15:22',
		operator: '시스템',
		module: 'USER_MGMT',
		actionDetail: '탈퇴 회원 데이터 파기 예약 — USR-1036',
		result: 'PENDING',
	},
];

export function cloneSystemLogs(source: SystemLog[] = MOCK_SYSTEM_LOGS): SystemLog[] {
	return source.map((log) => ({ ...log }));
}

export function filterSystemLogs(logs: SystemLog[], filters: SystemLogFilters): SystemLog[] {
	const q = filters.query.trim().toLowerCase();
	return logs.filter((log) => {
		if (filters.module !== 'all' && log.module !== filters.module) return false;
		if (!q) return true;
		return (
			log.operator.toLowerCase().includes(q) ||
			log.actionDetail.toLowerCase().includes(q) ||
			log.id.toLowerCase().includes(q) ||
			MODULE_LABEL[log.module].toLowerCase().includes(q)
		);
	});
}

export function sortSystemLogs(logs: SystemLog[], direction: SortDirection): SystemLog[] {
	const sign = direction === 'asc' ? 1 : -1;
	return [...logs].sort((a, b) => a.timestamp.localeCompare(b.timestamp) * sign);
}

export function paginateSystemLogs<T>(items: T[], page: number, pageSize = PAGE_SIZE): T[] {
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

export function summarizeSystemLogs(logs: SystemLog[], todayPrefix = '2026-08-23'): SystemLogKpi {
	return {
		totalJobs: logs.length,
		todayChanges: logs.filter((log) => log.timestamp.startsWith(todayPrefix)).length,
		pendingJobs: logs.filter((log) => log.result === 'PENDING').length,
	};
}

function csvEscape(value: string): string {
	if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
	return value;
}

export function toSystemLogCsv(rows: SystemLog[]): string {
	const header = ['일시', '작업자', '모듈', '작업 내용', '결과'];
	const lines = rows.map((row) =>
		[row.timestamp, row.operator, MODULE_LABEL[row.module], row.actionDetail, RESULT_LABEL[row.result]]
			.map((cell) => csvEscape(String(cell)))
			.join(','),
	);
	return [header.join(','), ...lines].join('\n');
}
