'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import {
	buildAuditQuota,
	isDevUnlimitedAuditQuota,
	readGuestDailyCount,
	todayStamp,
	type AuditQuotaSnapshot,
} from '@/lib/audit/free-audit-quota';

export function useAuditQuota() {
	const { status } = useSession();
	const [quota, setQuota] = useState<AuditQuotaSnapshot>(() => {
		if (isDevUnlimitedAuditQuota()) return buildAuditQuota(0, true, todayStamp(), true);
		const local = readGuestDailyCount();
		return buildAuditQuota(local.count, false, local.date);
	});
	const [ready, setReady] = useState(isDevUnlimitedAuditQuota());

	const refresh = useCallback(async () => {
		if (isDevUnlimitedAuditQuota()) {
			const next = buildAuditQuota(0, true, todayStamp(), true);
			setQuota(next);
			setReady(true);
			return next;
		}
		const local = readGuestDailyCount();
		try {
			const res = await fetch('/api/audit/quota', { cache: 'no-store' });
			const data = (await res.json()) as {
				used?: number;
				unlimited?: boolean;
				devMode?: boolean;
				date?: string;
			};
			const date = data.date || todayStamp();
			const unlimited = data.unlimited === true || data.devMode === true;
			const serverUsed = Number(data.used) || 0;
			const used = unlimited ? serverUsed : Math.max(serverUsed, local.date === date ? local.count : 0);
			const next = buildAuditQuota(used, unlimited, date, data.devMode === true);
			setQuota(next);
			return next;
		} catch {
			const next = buildAuditQuota(local.count, false, local.date);
			setQuota(next);
			return next;
		} finally {
			setReady(true);
		}
	}, []);

	useEffect(() => {
		void refresh();
	}, [refresh, status]);

	return { quota, ready, refresh };
}
