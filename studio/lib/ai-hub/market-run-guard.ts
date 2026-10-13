/**
 * Decisions applied inside the Firestore transaction.
 * The transaction is what makes the read and write atomic. These functions
 * only choose the outcome from the values that transaction read.
 */

export function decideRunClaim(input: {
	lastCheckDate: string | null;
	checkStatus: string | null;
	lockExpiresAt: string | null;
	today: string;
	now: number;
}): 'done' | 'busy' | 'claim' {
	if (input.lastCheckDate === input.today && input.checkStatus !== 'confirmed_unchanged') return 'done';
	const expires = input.lockExpiresAt ? Date.parse(input.lockExpiresAt) : Number.NaN;
	if (Number.isFinite(expires) && expires > input.now) return 'busy';
	return 'claim';
}

/** A finished check may write only with its own lock and the revision it read. */
export function decideCommitGuard(input: {
	lockToken: string | null;
	expectedToken: string;
	storedRevision: number | null;
	baseRevision: number | null;
}): 'ok' | 'lock_lost' | 'stale_base' {
	if (!input.expectedToken || input.lockToken !== input.expectedToken) return 'lock_lost';
	if (input.storedRevision !== input.baseRevision) return 'stale_base';
	return 'ok';
}

/** A rejected write must not replace the bundle readers already have. */
export function bundleAfterRejectedWrite<T>(previous: T, persistence: { ok: boolean; durable: boolean }, attempted: T): T {
	if (!persistence.ok || !persistence.durable) return previous;
	return attempted;
}
