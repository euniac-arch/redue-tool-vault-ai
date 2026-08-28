'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { MilestoneViewMode } from '@/lib/audit/milestone-types';

interface UseMilestonePermissionOptions {
	/** 이미 읽기전용 컨텍스트임이 확정된 경우(예: `/report/[id]` 고유 슬롯 URL) 강제로 client 모드로 고정. */
	forceClientView?: boolean;
}

/**
 * 마일스톤 뷰 권한 판정.
 *
 * - 관리자 모드: 로그인 세션이 admin 롤이거나(`/api/me`), URL에 `?admin=true`가 있으면 즉시 활성화.
 * - 고객 공유 모드: `?view=client` 또는 `forceClientView`(고유 슬롯 URL) — 관리자 조작 버튼 숨김, 확정된 회차만 조회.
 * - 일반 사용자: 위 두 조건에 모두 해당하지 않으면 기본값 — 마일스톤 UI 자체를 노출하지 않는다.
 */
export function useMilestonePermission(options?: UseMilestonePermissionOptions): {
	mode: MilestoneViewMode;
	isAdmin: boolean;
	isCheckingAdmin: boolean;
} {
	const searchParams = useSearchParams();
	const adminParam = searchParams?.get('admin') ?? '';
	const viewParam = searchParams?.get('view') ?? '';
	const adminQueryFlag = adminParam === 'true' || adminParam === '1';
	const clientQueryFlag = viewParam === 'client';

	const [sessionIsAdmin, setSessionIsAdmin] = useState(false);
	const [isCheckingAdmin, setIsCheckingAdmin] = useState(!adminQueryFlag);

	useEffect(() => {
		if (adminQueryFlag) {
			// URL 플래그가 이미 있으므로 세션 조회 없이 즉시 admin 모드로 확정.
			setIsCheckingAdmin(false);
			return;
		}
		let cancelled = false;
		setIsCheckingAdmin(true);
		fetch('/api/me', { cache: 'no-store' })
			.then((res) => (res.ok ? res.json() : null))
			.then((json: { role?: string } | null) => {
				if (cancelled) return;
				setSessionIsAdmin(typeof json?.role === 'string' && json.role.toLowerCase() === 'admin');
			})
			.catch(() => {
				if (!cancelled) setSessionIsAdmin(false);
			})
			.finally(() => {
				if (!cancelled) setIsCheckingAdmin(false);
			});
		return () => {
			cancelled = true;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [adminQueryFlag]);

	const isAdmin = adminQueryFlag || sessionIsAdmin;
	const mode: MilestoneViewMode = isAdmin
		? 'admin'
		: options?.forceClientView || clientQueryFlag
			? 'client'
			: 'user';

	return { mode, isAdmin, isCheckingAdmin };
}
