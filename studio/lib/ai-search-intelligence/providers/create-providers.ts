import { createClaudeAsiProvider } from '@/lib/ai-search-intelligence/providers/claude-provider';
import { createGeminiAsiProvider } from '@/lib/ai-search-intelligence/providers/gemini-provider';
import { createMockAsiProvider } from '@/lib/ai-search-intelligence/providers/mock-provider';
import { createOpenAiAsiProvider } from '@/lib/ai-search-intelligence/providers/openai-provider';
import { createPerplexityAsiProvider } from '@/lib/ai-search-intelligence/providers/perplexity-provider';
import { resolveAsiMode } from '@/lib/ai-search-intelligence/providers/resolve-mode';
import type { AsiProviderPort } from '@/lib/ai-search-intelligence/providers/types';
import { ASI_ENGINES, type AsiEngineId } from '@/lib/ai-search-intelligence/types';

function liveAdapter(id: AsiEngineId): AsiProviderPort {
	if (id === 'chatgpt') return createOpenAiAsiProvider();
	if (id === 'gemini') return createGeminiAsiProvider();
	if (id === 'perplexity') return createPerplexityAsiProvider();
	return createClaudeAsiProvider();
}

/** Server-only factory. Keys are never returned. Live adapters run unless ASI_MODE is explicitly mock. */
export function createAsiProviders(): AsiProviderPort[] {
	const mode = resolveAsiMode();
	return ASI_ENGINES.map((id) => (mode === 'mock' ? createMockAsiProvider(id) : liveAdapter(id)));
}

export function createAsiLiveAdapters(): AsiProviderPort[] {
	return ASI_ENGINES.map((id) => liveAdapter(id));
}
