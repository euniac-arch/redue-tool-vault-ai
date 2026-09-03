import type {
	AIQuery,
	AIResponse,
	AsiEngineId,
	AsiProviderVendor,
	CitationResult,
	RecommendationResult,
} from '@/lib/ai-search-intelligence/types';

/** Provider transport. Same fields as `AIQuery` with a required site URL. */
export type AsiProviderQuery = AIQuery & {
	query: string;
	url: string;
};

export type AsiProviderHealth = {
	ok: boolean;
	provider: AsiEngineId;
	vendor: AsiProviderVendor;
	available: boolean;
	code: 'ok' | 'missing_key' | 'http_error' | 'empty' | 'blocked';
	error?: string;
};

/**
 * Shared provider port. Keep `query` as the live/mock transport.
 * generateAnswer / analyzeRecommendation / extractCitations are the same surface
 * the product asked for — implemented on this port, not a second interface.
 */
export type AsiProviderPort = {
	id: AsiEngineId;
	name: string;
	isAvailable(): boolean;
	query(input: AsiProviderQuery): Promise<AIResponse>;
	generateAnswer(input: AsiProviderQuery): Promise<AIResponse>;
	analyzeRecommendation(input: AsiProviderQuery, brand: string): Promise<RecommendationResult>;
	extractCitations(answer: string, extras?: { urls?: string[] }): CitationResult[];
	healthCheck(): Promise<AsiProviderHealth>;
};
