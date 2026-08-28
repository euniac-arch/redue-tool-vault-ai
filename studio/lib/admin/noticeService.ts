/**
 * Canonical service entry for notice CRUD.
 * Re-exports `notice-service.ts` so either import path works:
 *   `@/lib/admin/noticeService`  or  `@/lib/admin/notice-service`
 */
export {
	AdminNoticeNotFoundError,
	__resetAdminNoticesMockStore,
	createNotice,
	deleteNotice,
	fetchNoticeList,
	fetchNotices,
	toggleNoticeStatus,
	updateNotice,
	type FetchNoticesParams,
	type FetchNoticesResult,
} from './notice-service';
