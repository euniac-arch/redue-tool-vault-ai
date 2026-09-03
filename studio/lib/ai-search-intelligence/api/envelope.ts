import {
	asiSafeErrorMessage,
	httpStatusForAsiError,
	type AsiErrorCode,
} from '@/lib/ai-search-intelligence/api/errors';
import type { AsiProviderVendor, AsiRuntimeMode } from '@/lib/ai-search-intelligence/types';

export type AsiEnvelopeMeta = {
	mode: AsiRuntimeMode;
	provider: AsiProviderVendor | 'multi';
	timestamp: string;
	requestId: string;
	operation?: string;
};

export type AsiEnvelopeError = {
	code: AsiErrorCode;
	message: string;
};

export type AsiEnvelope<T> = {
	success: boolean;
	data: T | null;
	meta: AsiEnvelopeMeta;
	error: AsiEnvelopeError | null;
};

export function asiEnvelopeMeta(input: {
	mode: AsiRuntimeMode;
	provider?: AsiProviderVendor | 'multi';
	requestId: string;
	operation?: string;
}): AsiEnvelopeMeta {
	return {
		mode: input.mode,
		provider: input.provider ?? 'multi',
		timestamp: new Date().toISOString(),
		requestId: input.requestId,
		...(input.operation ? { operation: input.operation } : {}),
	};
}

export function asiSuccessEnvelope<T>(data: T, meta: AsiEnvelopeMeta): AsiEnvelope<T> {
	return { success: true, data, meta, error: null };
}

export function asiErrorEnvelope(
	code: AsiErrorCode,
	meta: AsiEnvelopeMeta,
	locale: 'ko' | 'en' = 'ko',
): { body: AsiEnvelope<null>; status: number } {
	return {
		status: httpStatusForAsiError(code),
		body: {
			success: false,
			data: null,
			meta,
			error: {
				code,
				message: asiSafeErrorMessage(code, locale),
			},
		},
	};
}

export function localeFromRequest(req: Request): 'ko' | 'en' {
	const header = (req.headers.get('accept-language') || '').toLowerCase();
	if (header.startsWith('en')) return 'en';
	return 'ko';
}
