/**
 * Canonical service entry for system operation logs.
 * Re-exports `system-log-service.ts` so either import path works.
 */
export {
	exportSystemLogsCsv,
	fetchSystemLogKpi,
	fetchSystemLogs,
	type FetchSystemLogsParams,
	type FetchSystemLogsResult,
} from './system-log-service';
