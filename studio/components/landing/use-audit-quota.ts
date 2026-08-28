'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { buildAuditQuota, readGuestAuditCount, writeGuestAuditCount, type AuditQuotaSnapshot } from '@/lib/audit/free-audit-quota';

export function useAuditQuota() {
	const { status } = useSession();
	// Must match the server-rendered markup exactly on first paint — `localStorage` is only
	// readable client-side, so start from the same neutral snapshot on both sides and let the
	// post-mount `refresh()` effect below correct it (a post-hydration update, not a mismatch).
	const [quota, setQuota] = useState<AuditQuotaSnapshot>(() => buildAuditQuota(0, false));
	const [ready, setReady] = useState(false);

	const refresh = useCallback(async () => {
		const localUsed = readGuestAuditCount();
		try {
			const res = await fetch('/api/audit/quota', { cache: 'no-store' });
			const data = (await res.json()) as { used?: number; unlimited?: boolean; authenticated?: boolean };
			const unlimited = data.unlimited === true;
			const serverUsed = Number(data.used) || 0;
			// Server (Prisma + cookie) is the source of truth. Mirroring it here
			// keeps localStorage from re-inflating a just-reset count.
			if (!unlimited) writeGuestAuditCount(serverUsed);
			const next = buildAuditQuota(serverUsed, unlimited);
			setQuota(next);
			return next;
		} catch {
			const next = buildAuditQuota(localUsed, false);
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
