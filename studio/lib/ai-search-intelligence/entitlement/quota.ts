import { ASI_TIER_LIMITS } from '@/lib/ai-search-intelligence/entitlement/catalog';
import type { AsiActor } from '@/lib/ai-search-intelligence/entitlement/actor-model';

const GUEST_RUNS = new Map<string, number>();

export function readAsiGuestRuns(clientKey: string): number {
	return GUEST_RUNS.get(clientKey) ?? 0;
}

export function clearAsiGuestRuns(clientKey?: string) {
	if (!clientKey) {
		GUEST_RUNS.clear();
		return;
	}
	GUEST_RUNS.delete(clientKey);
}

export function asiGuestDiagnoseRemaining(actor: AsiActor, clientKey: string): number {
	if (actor.tier !== 'guest') return Number.POSITIVE_INFINITY;
	const used = readAsiGuestRuns(clientKey);
	return Math.max(0, ASI_TIER_LIMITS.guest.diagnoses - used);
}

export function consumeAsiGuestDiagnose(actor: AsiActor, clientKey: string): { ok: boolean; used: number; remaining: number } {
	if (actor.tier !== 'guest') {
		return { ok: true, used: 0, remaining: Number.POSITIVE_INFINITY };
	}
	const used = readAsiGuestRuns(clientKey);
	if (used >= ASI_TIER_LIMITS.guest.diagnoses) {
		return { ok: false, used, remaining: 0 };
	}
	const next = used + 1;
	GUEST_RUNS.set(clientKey, next);
	return { ok: true, used: next, remaining: Math.max(0, ASI_TIER_LIMITS.guest.diagnoses - next) };
}
