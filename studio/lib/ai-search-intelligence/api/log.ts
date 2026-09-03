/**
 * Server logs for /api/intelligence. requestId is always present.
 * API key values, bearer tokens, and secret-looking fields are stripped.
 */

const SECRET_KEY = /key|secret|token|authorization|password|credential/i;

export function createAsiRequestId(): string {
	const rand = Math.random().toString(36).slice(2, 10);
	return `asi_${Date.now().toString(36)}_${rand}`;
}

export function redactAsiSecrets(value: string): string {
	return value
		.replace(/\bsk-[a-zA-Z0-9_-]+\b/g, '[redacted]')
		.replace(/\bAIza[0-9A-Za-z_-]{10,}\b/g, '[redacted]')
		.replace(/\bpplx-[a-zA-Z0-9_-]+\b/g, '[redacted]')
		.replace(/\bBearer\s+\S+/gi, 'Bearer [redacted]')
		.replace(/\bkey=([^&\s]+)/gi, 'key=[redacted]')
		.replace(/\bx-api-key["\s:=]+[^"\s]+/gi, 'x-api-key:[redacted]');
}

function sanitizeValue(key: string, value: unknown): unknown {
	if (SECRET_KEY.test(key)) return '[redacted]';
	if (typeof value === 'string') return redactAsiSecrets(value);
	if (Array.isArray(value)) return value.map((item) => sanitizeValue('', item));
	if (value && typeof value === 'object') {
		return Object.fromEntries(
			Object.entries(value as Record<string, unknown>).map(([child, item]) => [child, sanitizeValue(child, item)]),
		);
	}
	return value;
}

export function logAsiRequest(
	requestId: string,
	level: 'info' | 'error',
	payload: Record<string, unknown>,
): void {
	const safe = Object.fromEntries(
		Object.entries(payload).map(([key, value]) => [key, sanitizeValue(key, value)]),
	);
	const line = `[asi ${requestId}] ${JSON.stringify(safe)}`;
	if (level === 'error') console.error(line);
	else console.info(line);
}
