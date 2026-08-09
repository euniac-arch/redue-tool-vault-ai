/**
 * REDUE AI SEO & GEO Studio doesn't call a hosted LLM to draft the master
 * schema block — the WordPress code generator (`lib/code-generator.ts`) is a
 * fully deterministic template. To make the Step 6 admin cost/margin
 * dashboard meaningful, `/api/patch/run` still runs the *scan + code
 * generation* through this module's token estimator, exactly as if
 * `gpt-4o-mini` drafted the schema block and `Claude 3.5 Haiku` reviewed the
 * before/after diff for safety — then bills both at their real, published
 * per-token rates. This keeps the cost ledger (`ApiUsageLog`) grounded in
 * real pricing even though no network call to OpenAI/Anthropic is made.
 */

export type LlmModel = 'gpt-4o-mini' | 'claude-3.5-haiku';

interface ModelRate {
	label: string;
	inputPerMillionUsd: number;
	outputPerMillionUsd: number;
}

// Published list pricing, verified against provider docs (Aug 2026).
export const LLM_RATES: Record<LlmModel, ModelRate> = {
	'gpt-4o-mini': { label: 'GPT-4o mini', inputPerMillionUsd: 0.15, outputPerMillionUsd: 0.6 },
	'claude-3.5-haiku': { label: 'Claude 3.5 Haiku', inputPerMillionUsd: 0.8, outputPerMillionUsd: 4.0 },
};

/** ~4 chars/token is the standard rough estimator for English/code-heavy text. */
function estimateTokens(text: string): number {
	return Math.max(1, Math.ceil(text.length / 4));
}

function costFor(model: LlmModel, inputTokens: number, outputTokens: number): number {
	const rate = LLM_RATES[model];
	return (inputTokens / 1_000_000) * rate.inputPerMillionUsd + (outputTokens / 1_000_000) * rate.outputPerMillionUsd;
}

export interface SimulatedUsageEntry {
	model: LlmModel;
	inputTokens: number;
	outputTokens: number;
	costUsd: number;
}

/**
 * Simulates the two-model pipeline used for one `/api/patch/run` call:
 *  - `gpt-4o-mini` drafts the schema block from the scanned file context (input = original file, output = generated block).
 *  - `claude-3.5-haiku` reviews the resulting diff for safety (input = diff, output = a short pass/fail verdict).
 */
export function simulatePatchRunUsage(originalFileContent: string, injectedBlock: string, diffText: string): SimulatedUsageEntry[] {
	const draftInputTokens = estimateTokens(originalFileContent);
	const draftOutputTokens = estimateTokens(injectedBlock);
	const reviewInputTokens = estimateTokens(diffText);
	const reviewOutputTokens = estimateTokens('SCHEMA_INJECTION_REVIEW: PASS — marker block verified, no destructive edits detected.');

	return [
		{
			model: 'gpt-4o-mini',
			inputTokens: draftInputTokens,
			outputTokens: draftOutputTokens,
			costUsd: costFor('gpt-4o-mini', draftInputTokens, draftOutputTokens),
		},
		{
			model: 'claude-3.5-haiku',
			inputTokens: reviewInputTokens,
			outputTokens: reviewOutputTokens,
			costUsd: costFor('claude-3.5-haiku', reviewInputTokens, reviewOutputTokens),
		},
	];
}

/** Fixed demo exchange rate (KRW per 1 USD) used to convert API spend into the KRW margin calculation. */
export const USD_TO_KRW = Number(process.env.USD_TO_KRW_RATE || 1380);
