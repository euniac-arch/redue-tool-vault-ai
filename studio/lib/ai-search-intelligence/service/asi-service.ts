import { createAsiEngine } from '@/lib/ai-search-intelligence/adapters/create-engine';
import type { AsiEnginePort, AsiRunInput, AsiServiceAction } from '@/lib/ai-search-intelligence/adapters/port';
import { AsiServiceError } from '@/lib/ai-search-intelligence/api/errors';
import { asiOperationToAction, type AsiOperation } from '@/lib/ai-search-intelligence/api/operations';
import {
	asiProviderRuntimeStatus,
	asiProviderVendor,
	hasAsiProviderKey,
	resolveAsiMode,
} from '@/lib/ai-search-intelligence/providers/resolve-mode';
import { readAsiUsageReport } from '@/lib/ai-search-intelligence/guard/metrics';
import { ASI_ENGINES, type AsiProviderVendor } from '@/lib/ai-search-intelligence/types';

/** Intelligence Service — the only server entry the API route should call. */
export function createAsiService(): AsiEnginePort {
	return createAsiEngine();
}

export async function runAsiService(action: AsiServiceAction, input: AsiRunInput) {
	const service = createAsiService();
	switch (action) {
		case 'war-room':
			return service.loadWarRoom(input);
		case 'perception':
			return service.loadPerception(input);
		case 'recommendation':
			return service.loadRecommendation(input);
		case 'evidence':
			return service.loadEvidence(input);
		case 'agent-readiness':
			return service.loadAgentReadiness(input);
		case 'opportunity':
			return service.loadOpportunity(input);
		case 'explorer':
			return service.loadExplorer(input);
		case 'gap':
			return service.loadGap(input);
		case 'action':
			return service.loadAction(input);
		case 'visibility':
			return service.loadVisibility(input);
		default:
			return null;
	}
}

export async function runAsiOperation(operation: AsiOperation, input: AsiRunInput) {
	const snapshot = await runAsiService(asiOperationToAction(operation), input);
	if (!snapshot) throw new AsiServiceError('invalid_url');
	return snapshot;
}

/** Public runtime status. Never includes API keys. */
export function asiRuntimePublicStatus() {
	const mode = resolveAsiMode();
	return {
		mode,
		providers: ASI_ENGINES.map((id) => ({
			id,
			vendor: asiProviderVendor(id),
			status: asiProviderRuntimeStatus(id),
			available: mode !== 'mock' && hasAsiProviderKey(id),
		})),
		usage: readAsiUsageReport(),
	};
}

/** Client GET payload. No usage internals, lastError, or credentials. */
export function asiRuntimeClientStatus() {
	const { mode, providers } = asiRuntimePublicStatus();
	return { mode, providers };
}

export function asiRuntimeMetaProvider(): AsiProviderVendor | 'multi' {
	const status = asiRuntimePublicStatus();
	const live = status.providers.filter((row) => row.status === 'live').map((row) => row.vendor);
	if (live.length === 1) return live[0];
	return 'multi';
}
