/**
 * Per-account monthly usage. Units are estimated — we do not know vendor invoice $ .
 */
import { AsiServiceError } from '@/lib/ai-search-intelligence/api/errors';
import type { AsiTierLimits } from '@/lib/ai-search-intelligence/entitlement/catalog';
import {
	toPublicAsiAccountUsage,
	type PublicAsiAccountUsage,
} from '@/lib/ai-search-intelligence/entitlement/usage-public';
import { clearPersistedUsage, readPersistedUsage, writePersistedUsage } from '@/lib/ai-search-intelligence/persist/usage-file';

export type { PublicAsiAccountUsage } from '@/lib/ai-search-intelligence/entitlement/usage-public';
export { asiQuotaRemaining, PUBLIC_ASI_ACCOUNT_USAGE_KEYS } from '@/lib/ai-search-intelligence/entitlement/usage-public';

export type AsiAccountUsage = {
	month: string;
	queriesUsed: number;
	queriesLimit: number;
	providerCalls: number;
	providerCallsLimit: number;
	estimatedUsage: number;
	estimated: true;
};

const ACCOUNTS = new Map<string, { month: string; queriesUsed: number; providerCalls: number }>();

export function asiUsageMonth(now = Date.now()): string {
	return new Date(now).toISOString().slice(0, 7);
}

export function clearAsiAccountUsage(usageKey?: string) {
	if (!usageKey) {
		ACCOUNTS.clear();
		return;
	}
	ACCOUNTS.delete(usageKey);
	clearPersistedUsage(usageKey);
}

function persistRow(usageKey: string, row: { month: string; queriesUsed: number; providerCalls: number }) {
	writePersistedUsage(usageKey, row);
}

function readRow(usageKey: string, now = Date.now()) {
	const month = asiUsageMonth(now);
	const current = ACCOUNTS.get(usageKey);
	if (!current) {
		const disk = readPersistedUsage(usageKey);
		const seed =
			disk && disk.month === month
				? { month: disk.month, queriesUsed: disk.queriesUsed, providerCalls: disk.providerCalls }
				: { month, queriesUsed: 0, providerCalls: 0 };
		ACCOUNTS.set(usageKey, seed);
		return seed;
	}
	if (current.month !== month) {
		const fresh = { month, queriesUsed: 0, providerCalls: 0 };
		ACCOUNTS.set(usageKey, fresh);
		persistRow(usageKey, fresh);
		return fresh;
	}
	return current;
}

export function readAsiAccountUsage(usageKey: string, limits: AsiTierLimits, now = Date.now()): AsiAccountUsage {
	const row = readRow(usageKey, now);
	return {
		month: row.month,
		queriesUsed: row.queriesUsed,
		queriesLimit: limits.monthlyQueries,
		providerCalls: row.providerCalls,
		providerCallsLimit: limits.monthlyProviderCalls,
		estimatedUsage: row.providerCalls,
		estimated: true,
	};
}

export function publicAsiAccountUsage(usage: AsiAccountUsage): PublicAsiAccountUsage {
	return toPublicAsiAccountUsage(usage);
}

export function assertAsiMonthlyBudget(
	usageKey: string,
	limits: AsiTierLimits,
	upcomingQueries: number,
	now = Date.now(),
) {
	const row = readRow(usageKey, now);
	if (Number.isFinite(limits.monthlyQueries) && row.queriesUsed + upcomingQueries > limits.monthlyQueries) {
		throw new AsiServiceError('entitlement_quota');
	}
	if (Number.isFinite(limits.monthlyProviderCalls) && row.providerCalls >= limits.monthlyProviderCalls) {
		throw new AsiServiceError('entitlement_quota');
	}
}

export function recordAsiAccountQueries(usageKey: string, count: number, now = Date.now()) {
	const row = readRow(usageKey, now);
	row.queriesUsed += Math.max(0, count);
	persistRow(usageKey, row);
}

export function recordAsiAccountProviderCall(usageKey: string, now = Date.now()) {
	const row = readRow(usageKey, now);
	row.providerCalls += 1;
	persistRow(usageKey, row);
}
